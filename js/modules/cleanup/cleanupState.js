import { CleanupRepository } from './cleanupRepository.js';
import { SECTION_KEYS, DEFAULT_STALE_THRESHOLD_MS, ACCESS_STATS_STORAGE_KEY } from './cleanupConstants.js';
import { flattenBookmarks, buildSections } from './cleanupEngine.js';

export class CleanupState {
  constructor(bookmarkManager, options = {}) {
    this.bookmarkManager = bookmarkManager;
    this.repository = options.repository || new CleanupRepository();

    this.ignore = {};
    SECTION_KEYS.forEach(section => {
      this.ignore[section] = new Set();
    });

    this.sections = {};
    SECTION_KEYS.forEach(section => {
      this.sections[section] = [];
    });

    this.accessStats = {};
    this.bookmarkIndex = {};
    this.subscribers = new Set();
    this.storageListener = null;

    this.staleThreshold = options.staleThreshold ?? DEFAULT_STALE_THRESHOLD_MS;
  }

  async initialize() {
    const [ignoreSets, accessStats] = await Promise.all([
      this.repository.loadIgnoreSets(),
      this.repository.loadAccessStats()
    ]);

    SECTION_KEYS.forEach(section => {
      this.ignore[section] = ignoreSets[section] || new Set();
    });

    this.accessStats = accessStats || {};
    await this.refresh();
    this.subscribeToAccessStats();
  }

  async refresh(options = {}) {
    const { reuseIndex = false } = options;
    const shouldReload = !reuseIndex || !this.hasBookmarkIndex();

    if (shouldReload) {
      const tree = await this.bookmarkManager.getBookmarkTree();
      this.bookmarkIndex = flattenBookmarks(tree);
    }

    this.rebuildSections();
  }

  subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    this.subscribers.add(callback);
    callback({
      counts: this.getCounts(),
      sections: this.sections
    });
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getCounts() {
    return SECTION_KEYS.reduce((acc, section) => {
      acc[section] = this.sections[section]?.length || 0;
      return acc;
    }, {});
  }

  getSection(section) {
    return this.sections[section] || [];
  }

  getStatusMap() {
    return {};
  }

  getStatusForBookmark() {
    return null;
  }

  async updateStatus() {
    // no-op in lite mode
  }

  async ignoreItems(section, bookmarkIds) {
    if (!Array.isArray(bookmarkIds) || !this.ignore[section]) {
      return;
    }

    bookmarkIds.forEach(id => this.ignore[section].add(id));
    await this.repository.saveIgnoreSets(this.ignore);
    await this.refresh();
  }

  async unignoreItems(section, bookmarkIds) {
    if (!Array.isArray(bookmarkIds) || !this.ignore[section]) {
      return;
    }

    bookmarkIds.forEach(id => this.ignore[section].delete(id));
    await this.repository.saveIgnoreSets(this.ignore);
    await this.refresh();
  }

  async clearStatuses() {
    // no-op
  }

  subscribeToAccessStats() {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return;
    }

    this.storageListener = (changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      const statsChange = changes[ACCESS_STATS_STORAGE_KEY];
      if (!statsChange) {
        return;
      }

      this.accessStats = statsChange.newValue || {};
      this.refresh({ reuseIndex: true });
    };

    chrome.storage.onChanged.addListener(this.storageListener);
  }

  hasBookmarkIndex() {
    return this.bookmarkIndex && Object.keys(this.bookmarkIndex).length > 0;
  }

  rebuildSections() {
    this.sections = buildSections(this.bookmarkIndex || {}, {
      ignore: this.ignore,
      accessStats: this.accessStats,
      staleThreshold: this.staleThreshold
    });
    this.notify();
  }

  notify() {
    const snapshot = {
      counts: this.getCounts(),
      sections: this.sections
    };
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('CleanupState subscriber error:', error);
      }
    });
  }

  destroy() {
    if (
      this.storageListener &&
      typeof chrome !== 'undefined' &&
      chrome.storage?.onChanged
    ) {
      chrome.storage.onChanged.removeListener(this.storageListener);
      this.storageListener = null;
    }
    this.subscribers.clear();
  }
}
