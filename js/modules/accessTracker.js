import { ACCESS_STATS_STORAGE_KEY } from './cleanup/cleanupConstants.js';

export class AccessTracker {
  constructor() {
    this.urlToBookmarks = new Map(); // normalized URL -> Set of bookmarkIds
    this.bookmarkUrls = new Map();   // bookmarkId -> normalized URL
    this.accessStats = {};
    this.STATS_KEY = ACCESS_STATS_STORAGE_KEY;
    this.saveTimer = null;
  }

  async initialize() {
    await Promise.all([
      this.buildBookmarkIndex(),
      this.loadAccessStats()
    ]);
    this.registerListeners();
  }

  async buildBookmarkIndex() {
    const tree = await chrome.bookmarks.getTree();
    const traverse = (nodes) => {
      nodes.forEach(node => {
        if (node.url) {
          this.addBookmarkToIndex(node.id, node.url);
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    traverse(tree);
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
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab?.url) {
        this.recordVisit(tab.url);
      }
    });

    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      if (bookmark?.url) {
        this.addBookmarkToIndex(id, bookmark.url);
      }
    });

    chrome.bookmarks.onRemoved.addListener((id) => {
      this.removeBookmarkFromIndex(id);
      if (this.accessStats[id]) {
        delete this.accessStats[id];
        this.scheduleSave();
      }
    });

    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      if (changeInfo?.url) {
        this.updateBookmarkUrl(id, changeInfo.url);
      }
    });

    chrome.bookmarks.onImportBegan?.addListener(() => {
      // optional hook if available; just clear map to rebuild after import
      this.urlToBookmarks.clear();
      this.bookmarkUrls.clear();
    });

    chrome.bookmarks.onImportEnded?.addListener(() => {
      this.buildBookmarkIndex();
    });
  }

  addBookmarkToIndex(bookmarkId, rawUrl) {
    const normalized = this.normalizeUrl(rawUrl);
    if (!normalized) {
      return;
    }
    this.bookmarkUrls.set(bookmarkId, normalized);
    if (!this.urlToBookmarks.has(normalized)) {
      this.urlToBookmarks.set(normalized, new Set());
    }
    this.urlToBookmarks.get(normalized).add(bookmarkId);
  }

  removeBookmarkFromIndex(bookmarkId) {
    const url = this.bookmarkUrls.get(bookmarkId);
    if (!url) {
      return;
    }
    const idSet = this.urlToBookmarks.get(url);
    if (idSet) {
      idSet.delete(bookmarkId);
      if (idSet.size === 0) {
        this.urlToBookmarks.delete(url);
      }
    }
    this.bookmarkUrls.delete(bookmarkId);
  }

  updateBookmarkUrl(bookmarkId, newUrl) {
    this.removeBookmarkFromIndex(bookmarkId);
    this.addBookmarkToIndex(bookmarkId, newUrl);
  }

  recordVisit(rawUrl) {
    const normalized = this.normalizeUrl(rawUrl);
    if (!normalized) {
      return;
    }
    const bookmarkIds = this.urlToBookmarks.get(normalized);
    if (!bookmarkIds || bookmarkIds.size === 0) {
      return;
    }
    const timestamp = Date.now();
    let changed = false;
    bookmarkIds.forEach((bookmarkId) => {
      const stats = this.accessStats[bookmarkId] || { visitCount: 0, lastVisitedAt: 0 };
      stats.visitCount = (stats.visitCount || 0) + 1;
      stats.lastVisitedAt = timestamp;
      this.accessStats[bookmarkId] = stats;
      changed = true;
    });
    if (changed) {
      this.scheduleSave();
    }
  }

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

  normalizeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      const normalizedPath = url.pathname.replace(/\/+/g, '/');
      const trimmed = normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) || '/' : normalizedPath;
      return `${url.origin}${trimmed}${url.search}`.toLowerCase();
    } catch (error) {
      return null;
    }
  }
}
