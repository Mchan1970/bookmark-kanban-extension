import { CleanupRepository } from './cleanupRepository.js';
import {
  flattenBookmarks,
  buildSections,
  buildStatusMap,
  normalizeStatusValue,
  STALE_THRESHOLD_MS,
  STATUS_EXPIRATION_MS
} from './cleanupEngine.js';

export class CleanupState {
  constructor(bookmarkManager, options = {}) {
    this.bookmarkManager = bookmarkManager;
    this.repository = options.repository || new CleanupRepository();

    this.ignore = {
      dead: new Set(),
      duplicates: new Set(),
      stale: new Set()
    };

    this.metadata = {
      lastCheckedAt: {},
      lastKnownStatus: {}
    };

    this.sections = {
      dead: [],
      duplicates: [],
      stale: []
    };

    this.statusMap = {};
    this.subscribers = new Set();

    this.staleThreshold = options.staleThreshold ?? STALE_THRESHOLD_MS;
    this.statusExpiration = options.statusExpiration ?? STATUS_EXPIRATION_MS;
  }

  async initialize() {
    const [ignoreSets, metadata] = await Promise.all([
      this.repository.loadIgnoreSets(),
      this.repository.loadMetadata()
    ]);

    this.ignore = ignoreSets;
    this.metadata = metadata;
    await this.repository.syncSessionStatus(this.metadata);
    await this.refresh();
  }

  async refresh() {
    const tree = await this.bookmarkManager.getBookmarkTree();
    const bookmarkIndex = flattenBookmarks(tree);
    this.sections = buildSections(bookmarkIndex, {
      metadata: this.metadata,
      ignore: this.ignore,
      staleThreshold: this.staleThreshold
    });
    this.statusMap = buildStatusMap(this.metadata, this.ignore, this.statusExpiration);
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
    return {
      dead: this.sections.dead.length,
      duplicates: this.sections.duplicates.length,
      stale: this.sections.stale.length
    };
  }

  getSection(section) {
    return this.sections[section] || [];
  }

  getStatusMap() {
    return { ...this.statusMap };
  }

  getStatusForBookmark(bookmarkId) {
    return this.statusMap[bookmarkId] || null;
  }

  async updateStatus(statusMap) {
    if (!statusMap) {
      return;
    }

    const now = Date.now();
    Object.entries(statusMap).forEach(([bookmarkId, status]) => {
      this.metadata.lastCheckedAt[bookmarkId] = now;
      this.metadata.lastKnownStatus[bookmarkId] = status;
    });

    await this.repository.saveMetadata(this.metadata);
    await this.refresh();
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
    if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
      return;
    }

    let changed = false;

    bookmarkIds.forEach(id => {
      if (this.metadata.lastKnownStatus[id] !== undefined) {
        delete this.metadata.lastKnownStatus[id];
        changed = true;
      }
      if (this.metadata.lastCheckedAt[id] !== undefined) {
        delete this.metadata.lastCheckedAt[id];
        changed = true;
      }
    });

    if (!changed) {
      return;
    }

    await this.repository.saveMetadata(this.metadata);
    await this.refresh();
  }

  notify() {
    const snapshot = {
      counts: this.getCounts(),
      sections: this.sections,
      statusMap: this.statusMap
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
