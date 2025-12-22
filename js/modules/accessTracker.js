import { ACCESS_STATS_STORAGE_KEY } from './cleanup/cleanupConstants.js';

export class AccessTracker {
  constructor() {
    // 移除了URL映射相关字段，现在只保留统计信息
    this.accessStats = {};
    this.STATS_KEY = ACCESS_STATS_STORAGE_KEY;
    this.saveTimer = null;
  }

  async initialize() {
    await this.loadAccessStats();
    this.registerListeners();
  }

  async loadAccessStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STATS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          this.accessStats = {};
          resolve();
          return;
        }
        this.accessStats = result[this.STATS_KEY] || {};
        resolve();
      });
    });
  }

  registerListeners() {
    // 移除了旧的 tabs.onUpdated 监听器
    // 现在使用"点击即活跃"策略，通过 recordVisitById 直接记录

    chrome.bookmarks.onRemoved.addListener((id) => {
      // 清理已删除书签的统计数据
      if (this.accessStats[id]) {
        delete this.accessStats[id];
        this.scheduleSave();
      }
    });
  }

  // 已移除URL映射相关方法：
// - addBookmarkToIndex()
// - removeBookmarkFromIndex()
// - updateBookmarkUrl()
// 现在直接通过书签ID记录访问，不需要URL映射

  // recordVisit 方法已移除 - 现在使用 recordVisitById 替代
  // 旧的复杂URL匹配逻辑不再需要

  scheduleSave() {
    if (this.saveTimer) {
      return;
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      chrome.storage.local.set({ [this.STATS_KEY]: this.accessStats }, () => {
        // ignore errors; storage writes are best-effort
      });
    }, 1000);
  }

  // 已移除复杂的URL匹配方法：
// - findMatchingBookmarks()
// - isDomainMatch()
// - isSubdomainMatch()
// - isSubdomainToPathMatch()
// - isPathMatch()
//
// 现在使用简单的"点击即活跃"策略，不再需要这些复杂的匹配逻辑

  // 直接通过 ID 记录访问（用于 UI 点击事件）
  async recordVisitById(bookmarkId) {
    if (!bookmarkId) {
      const error = new Error('Missing bookmarkId when recording visit');
      console.error('[AccessTracker] Missing bookmarkId when recording visit');
      throw error;
    }

    let exists = false;
    try {
      exists = await this.verifyBookmarkExists(bookmarkId);
    } catch (error) {
      console.error('[AccessTracker] Failed to verify bookmark before recording visit:', error);
      throw error;
    }

    if (!exists) {
      const error = new Error(`Bookmark ${bookmarkId} not found`);
      console.error(`[AccessTracker] Bookmark ${bookmarkId} not found, skipping visit record`);
      throw error;
    }

    const timestamp = Date.now();
    const stats = this.accessStats[bookmarkId] || { visitCount: 0, lastVisitedAt: 0 };

    stats.visitCount = (stats.visitCount || 0) + 1;
    stats.lastVisitedAt = timestamp;

    this.accessStats[bookmarkId] = stats;
    this.scheduleSave();

    return true;
  }

  verifyBookmarkExists(bookmarkId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(bookmarkId, (nodes) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(Array.isArray(nodes) && nodes.length > 0);
      });
    });
  }

  // normalizeUrl 方法已移除 - 不再需要URL匹配逻辑
}
