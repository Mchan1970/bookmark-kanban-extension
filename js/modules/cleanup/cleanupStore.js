/*** CleanupStore
 * Aggregates bookmark cleanup suggestions (dead links, duplicates, stale items)
 * and persists user preferences such as ignore lists.
 */
export class CleanupStore {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;

    this.STORAGE_KEY = 'kanbanCleanupState';
    this.METADATA_KEY = 'kanbanCleanupMetadata';
    this.STALE_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000; // 6 months
    this.STATUS_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

    this.subscribers = new Set();
    this._initialized = false;
  }

  /*** Initialize store state from persisted storage
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    await Promise.all([
      this.loadIgnoreList(),
      this.loadMetadata()
    ]);

    // Attempt to hydrate with session status if available
    await this.syncSessionStatus();

    await this.refresh();
    this._initialized = true;
  }

  /*** Refresh all cleanup categories by traversing the current bookmark tree
   */
  async refresh() {
    const tree = await this.bookmarkManager.getBookmarkTree();
    const bookmarkIndex = this.flattenBookmarks(tree);

    const deadItems = this.computeDeadItems(bookmarkIndex);
    const duplicateItems = this.computeDuplicateItems(bookmarkIndex);
    const staleItems = this.computeStaleItems(bookmarkIndex);

    this.sections = {
      dead: deadItems,
      duplicates: duplicateItems,
      stale: staleItems
    };

    this.notify();
  }

  /*** Subscribe to store updates
   * @param {Function} callback Observer callback
   * @returns {Function} Unsubscribe handler
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /*** Update metadata based on latest site status results
   * @param {Object} statusMap Map of bookmarkId -> status string|boolean
   */
  async updateStatus(statusMap) {
    if (!statusMap) {
      return;
    }

    const now = Date.now();
    const lastCheckedAt = { ...this.metadata.lastCheckedAt };
    const lastKnownStatus = { ...this.metadata.lastKnownStatus };

    Object.entries(statusMap).forEach(([bookmarkId, status]) => {
      lastCheckedAt[bookmarkId] = now;
      lastKnownStatus[bookmarkId] = status;
    });

    this.metadata = { lastCheckedAt, lastKnownStatus };
    await this.persistMetadata();
    await this.refresh();
  }

  /*** Mark bookmarks in a section as ignored
   * @param {string} section Section name
   * @param {Array<string>} bookmarkIds Bookmark IDs to ignore
   */
  async ignoreItems(section, bookmarkIds) {
    if (!this.ignore[section]) {
      return;
    }

    bookmarkIds.forEach(id => this.ignore[section].add(id));
    await this.persistIgnoreList();
    await this.refresh();
  }

  /*** Remove bookmarks from ignore list when user undoes an ignore action
   * @param {string} section Section name
   * @param {Array<string>} bookmarkIds Bookmark IDs to remove
   */
  async unignoreItems(section, bookmarkIds) {
    if (!this.ignore[section]) {
      return;
    }

    bookmarkIds.forEach(id => this.ignore[section].delete(id));
    await this.persistIgnoreList();
    await this.refresh();
  }

  /*** Get summary counts for each section
   * @returns {{ dead: number, duplicates: number, stale: number }}
   */
  getCounts() {
    return {
      dead: this.sections.dead.length,
      duplicates: this.sections.duplicates.length,
      stale: this.sections.stale.length
    };
  }

  /*** Get current status map
   * @returns {Object<string,string>} bookmarkId -> status key
   */
  getStatusMap() {
    return this.computeStatusMap();
  }

  /*** Get status for single bookmark
   * @param {string} bookmarkId Bookmark ID
   * @returns {string|null} Status key or null when healthy/expired
   */
  getStatusForBookmark(bookmarkId) {
    const map = this.computeStatusMap();
    return map[bookmarkId] || null;
  }

  /*** Retrieve section items
   * @param {string} section Section name
   * @returns {Array<Object>} Section items
   */
  getSection(section) {
    return this.sections[section] || [];
  }

  /*** Notify subscribers about state changes
   */
  notify() {
    const snapshot = {
      counts: this.getCounts(),
      sections: this.sections,
      statusMap: this.getStatusMap()
    };
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('CleanupStore subscriber error:', error);
      }
    });
  }

  /*** Load ignore list from storage
   * @private
   */
  async loadIgnoreList() {
    const data = await this.readFromStorage(this.STORAGE_KEY);
    if (!data) {
      return;
    }

    ['dead', 'duplicates', 'stale'].forEach(section => {
      const ids = Array.isArray(data?.ignore?.[section]) ? data.ignore[section] : [];
      this.ignore[section] = new Set(ids);
    });
  }

  /*** Persist ignore list to storage
   * @private
   */
  async persistIgnoreList() {
    const ignore = {};
    Object.entries(this.ignore).forEach(([section, set]) => {
      ignore[section] = Array.from(set);
    });
    await this.writeToStorage(this.STORAGE_KEY, { ignore });
  }

  /*** Load metadata (last check timestamps, statuses)
   * @private
   */
  async loadMetadata() {
    const metadata = await this.readFromStorage(this.METADATA_KEY);
    if (!metadata) {
      return;
    }

    this.metadata = {
      lastCheckedAt: metadata.lastCheckedAt || {},
      lastKnownStatus: metadata.lastKnownStatus || {}
    };
  }

  /*** Persist metadata to storage
   * @private
   */
  async persistMetadata() {
    await this.writeToStorage(this.METADATA_KEY, this.metadata);
  }

  /*** Attempt to hydrate metadata using session storage (latest run)
   * @private
   */
  async syncSessionStatus() {
    if (!chrome.storage.session) {
      return;
    }

    return new Promise((resolve) => {
      chrome.storage.session.get(['siteStatus'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to read session site status:', chrome.runtime.lastError);
          resolve();
          return;
        }

        const statusMap = result.siteStatus;
        if (statusMap) {
          const now = Date.now();
          Object.entries(statusMap).forEach(([bookmarkId, status]) => {
            this.metadata.lastCheckedAt[bookmarkId] = now;
            this.metadata.lastKnownStatus[bookmarkId] = status;
          });
        }
        resolve();
      });
    });
  }

  /*** Flatten bookmark tree to a lookup table with paths
   * @private
   * @param {Array} tree Bookmark tree (from Chrome)
   * @returns {Object} Lookup map { bookmarkId: item }
   */
  flattenBookmarks(tree) {
    const index = {};
    const stack = tree.map(node => ({ node, path: [] }));

    while (stack.length > 0) {
      const { node, path } = stack.pop();

      if (node.url) {
        index[node.id] = {
          id: node.id,
          title: node.title || '(No title)',
          url: node.url,
          parentId: node.parentId || null,
          folderPath: path.join(' / ') || 'Bookmarks Bar'
        };
        continue;
      }

      if (node.children && node.children.length > 0) {
        const nextPath = node.title ? [...path, node.title] : [...path];
        node.children.forEach(child => {
          stack.push({ node: child, path: nextPath });
        });
      }
    }

    return index;
  }

  /*** Compute dead link suggestions
   * @private
   * @param {Object} bookmarkIndex Lookup map
   * @returns {Array<Object>} Dead link entries
   */
  computeDeadItems(bookmarkIndex) {
    const items = [];

    Object.keys(bookmarkIndex).forEach(bookmarkId => {
      if (this.ignore.dead.has(bookmarkId)) {
        return;
      }

      const status = this.metadata.lastKnownStatus[bookmarkId];

      if (status === undefined || status === true) {
        return;
      }

      const bookmark = bookmarkIndex[bookmarkId];
      const severity = status === false ? 'error' : 'warning';

      items.push({
        id: bookmark.id,
        type: 'dead',
        severity,
        status,
        title: bookmark.title,
        url: bookmark.url,
        folderPath: bookmark.folderPath,
        lastCheckedAt: this.metadata.lastCheckedAt[bookmarkId] || null
      });
    });

    items.sort((a, b) => {
      const timeA = a.lastCheckedAt || 0;
      const timeB = b.lastCheckedAt || 0;
      return timeB - timeA;
    });

    return items;
  }

  /*** Compute duplicate bookmark suggestions
   * @private
   * @param {Object} bookmarkIndex Lookup map
   * @returns {Array<Object>} Duplicate entries
   */
  computeDuplicateItems(bookmarkIndex) {
    const groups = new Map();

    Object.values(bookmarkIndex).forEach(bookmark => {
      if (!bookmark.url) {
        return;
      }

      const groupId = this.normalizeUrl(bookmark.url);
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId).push(bookmark);
    });

    const duplicateItems = [];

    groups.forEach((bookmarks, groupId) => {
      if (bookmarks.length < 2) {
        return;
      }

      bookmarks.forEach(bookmark => {
        if (this.ignore.duplicates.has(bookmark.id)) {
          return;
        }

        duplicateItems.push({
          id: bookmark.id,
          type: 'duplicates',
          groupId,
          title: bookmark.title,
          url: bookmark.url,
          folderPath: bookmark.folderPath,
          duplicateCount: bookmarks.length
        });
      });
    });

    duplicateItems.sort((a, b) => a.title.localeCompare(b.title));
    return duplicateItems;
  }

  /*** Compute stale bookmark suggestions
   * @private
   * @param {Object} bookmarkIndex Lookup map
   * @returns {Array<Object>} Stale entries
   */
  computeStaleItems(bookmarkIndex) {
    const items = [];
    const now = Date.now();

    Object.values(bookmarkIndex).forEach(bookmark => {
      const bookmarkId = bookmark.id;

      if (this.ignore.stale.has(bookmarkId)) {
        return;
      }

      const lastChecked = this.metadata.lastCheckedAt[bookmarkId];
      if (!lastChecked) {
        return;
      }

      const age = now - lastChecked;
      if (age < this.STALE_THRESHOLD_MS) {
        return;
      }

      items.push({
        id: bookmarkId,
        type: 'stale',
        title: bookmark.title,
        url: bookmark.url,
        folderPath: bookmark.folderPath,
        lastCheckedAt: lastChecked,
        age
      });
    });

    items.sort((a, b) => b.age - a.age);
    return items;
  }

  /*** Normalize URL for duplicate grouping
   * @private
   * @param {string} rawUrl Bookmark URL
   * @returns {string} Normalized identifier
   */
  normalizeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const host = url.hostname.toLowerCase();
      const path = url.pathname.replace(/\/+$/, '');

      const params = Array.from(url.searchParams.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      const queryPart = params ? `?${params}` : '';
      return `${host}${path}${queryPart}`;
    } catch (error) {
      return rawUrl.trim().toLowerCase();
    }
  }

  /*** Helper: read an object from chrome.storage.local
   * @private
   * @param {string} key Storage key
   * @returns {Promise<Object|null>}
   */
  readFromStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to read cleanup storage:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result[key] || null);
      });
    });
  }

  /*** Helper: write an object into chrome.storage.local
   * @private
   * @param {string} key Storage key
   * @param {Object} value Value to persist
   */
  writeToStorage(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to persist cleanup storage:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  /*** Build current status map from metadata
   * @private
   * @returns {Object<string,string>}
   */
  computeStatusMap() {
    const statuses = {};
    const now = Date.now();

    Object.entries(this.metadata.lastKnownStatus || {}).forEach(([bookmarkId, rawStatus]) => {
      const lastChecked = this.metadata.lastCheckedAt?.[bookmarkId];
      if (!lastChecked) {
        return;
      }

      if (now - lastChecked > this.STATUS_EXPIRATION_MS) {
        return;
      }

      const normalized = this.normalizeStatusValue(rawStatus);
      if (!normalized) {
        return;
      }

      if (normalized === 'dead' && this.ignore.dead.has(bookmarkId)) {
        return;
      }

      if ((normalized === 'cert-error' || normalized === 'no-https') && this.ignore.dead.has(bookmarkId)) {
        return;
      }

      statuses[bookmarkId] = normalized;
    });

    return statuses;
  }

  /*** Normalize raw status into badge key
   * @private
   * @param {boolean|string} status Raw status from site checker
   * @returns {string|null}
   */
  normalizeStatusValue(status) {
    if (status === false) {
      return 'dead';
    }
    if (status === 'certificate-error') {
      return 'cert-error';
    }
    if (status === 'no-https') {
      return 'no-https';
    }
    return null;
  }
}
