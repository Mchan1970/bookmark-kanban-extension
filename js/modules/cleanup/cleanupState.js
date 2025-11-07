import { CleanupRepository } from './cleanupRepository.js';
import { SECTION_KEYS } from './cleanupConstants.js';
import {
  flattenBookmarks,
  buildSections
} from './cleanupEngine.js';

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

    this.statusMap = {};
    this.subscribers = new Set();
  }

  async initialize() {
    const ignoreSets = await this.repository.loadIgnoreSets();
    SECTION_KEYS.forEach(section => {
      this.ignore[section] = ignoreSets[section] || new Set();
    });
    await this.refresh();
  }

  async refresh() {
    const tree = await this.bookmarkManager.getBookmarkTree();
    const bookmarkIndex = flattenBookmarks(tree);
    this.sections = buildSections(bookmarkIndex, {
      ignore: this.ignore
    });
    this.statusMap = {};
    this.notify();
  }

  subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    this.subscribers.add(callback);
    callback({
      counts: this.getCounts(),
      sections: this.sections,
      statusMap: this.statusMap
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

  getStatusForBookmark(bookmarkId) {
    return null;
  }

  async updateStatus(statusMap) {
    return;
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

  async clearStatuses(bookmarkIds = []) {
    return;
  }

  notify() {
    const snapshot = {
      counts: this.getCounts(),
      sections: this.sections,
      statusMap: {}
    };
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('CleanupState subscriber error:', error);
      }
    });
  }
}
