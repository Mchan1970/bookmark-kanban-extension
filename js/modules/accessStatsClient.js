import { ACCESS_STATS_STORAGE_KEY } from './cleanup/cleanupConstants.js';

export class AccessStatsClient {
  constructor() {
    this.stats = {};
    this.listeners = new Set();
    this.handleStorageChange = this.handleStorageChange.bind(this);
    this.isSubscribed = false;
  }

  async initialize() {
    await this.loadFromStorage();
    this.subscribeToChanges();
  }

  async loadFromStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      this.stats = {};
      return;
    }

    await new Promise((resolve) => {
      chrome.storage.local.get([ACCESS_STATS_STORAGE_KEY], (result) => {
        if (chrome.runtime?.lastError) {
          console.error('Failed to load access stats:', chrome.runtime.lastError);
          this.stats = {};
        } else {
          this.stats = result[ACCESS_STATS_STORAGE_KEY] || {};
        }
        resolve();
      });
    });
  }

  subscribeToChanges() {
    if (this.isSubscribed || typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return;
    }
    chrome.storage.onChanged.addListener(this.handleStorageChange);
    this.isSubscribed = true;
  }

  handleStorageChange(changes, areaName) {
    if (areaName !== 'local') {
      return;
    }
    const statsChange = changes[ACCESS_STATS_STORAGE_KEY];
    if (!statsChange) {
      return;
    }
    this.stats = statsChange.newValue || {};
    this.emit();
  }

  getStatsFor(bookmarkId) {
    if (!bookmarkId) {
      return null;
    }
    return this.stats[bookmarkId] || null;
  }

  onChange(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach(listener => {
      try {
        listener(this.stats);
      } catch (error) {
        console.error('AccessStatsClient listener error:', error);
      }
    });
  }

  destroy() {
    if (this.isSubscribed && typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(this.handleStorageChange);
    }
    this.listeners.clear();
    this.isSubscribed = false;
  }
}
