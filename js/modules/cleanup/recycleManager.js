/*** RecycleManager
 * Soft-deletes bookmarks by storing their metadata so they can be restored.
 */
export class RecycleManager {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
    this.STORAGE_KEY = 'kanbanRecycleBin';
    this.FALLBACK_FOLDER_ID = '2'; // "Other Bookmarks"
  }

  async trashBookmarks(bookmarkIds) {
    if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
      return [];
    }

    const state = await this._loadState();
    const trashedItems = [];

    for (const bookmarkId of bookmarkIds) {
      const bookmark = await this._getBookmark(bookmarkId);
      if (!bookmark || !bookmark.url) {
        continue;
      }

      const folderPath = await this._computeFolderPath(bookmark);

      const payload = {
        originalId: bookmark.id,
        title: bookmark.title || '(Untitled bookmark)',
        url: bookmark.url,
        parentId: bookmark.parentId || null,
        index: typeof bookmark.index === 'number' ? bookmark.index : null,
        deletedAt: Date.now(),
        folderPath
      };

      state.items.push(payload);
      trashedItems.push(payload);

      await this.bookmarkManager.deleteBookmark(bookmark.id);
    }

    await this._saveState(state);
    return trashedItems;
  }

  async restoreBookmarks(bookmarkIds) {
    if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
      return [];
    }

    const state = await this._loadState();
    const remaining = [];
    const restored = [];

    for (const item of state.items) {
      if (!bookmarkIds.includes(item.originalId)) {
        remaining.push(item);
        continue;
      }

      const parentExists = item.parentId ? await this._folderExists(item.parentId) : false;
      const createOptions = {
        parentId: parentExists ? item.parentId : this.FALLBACK_FOLDER_ID,
        title: item.title,
        url: item.url
      };

      if (parentExists && typeof item.index === 'number') {
        createOptions.index = item.index;
      }

      await this._createBookmark(createOptions);
      restored.push(item);
    }

    state.items = remaining;
    await this._saveState(state);
    return restored;
  }

  async purgeBookmarks(bookmarkIds) {
    if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
      return;
    }

    const state = await this._loadState();
    state.items = state.items.filter(item => !bookmarkIds.includes(item.originalId));
    await this._saveState(state);
  }

  async listTrashed() {
    const state = await this._loadState();
    return state.items
      .slice()
      .sort((a, b) => b.deletedAt - a.deletedAt);
  }

  async _loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to load recycle bin:', chrome.runtime.lastError);
          resolve({ items: [] });
          return;
        }
        resolve(result[this.STORAGE_KEY] || { items: [] });
      });
    });
  }

  async _saveState(state) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: state }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save recycle bin:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  async _getBookmark(bookmarkId) {
    return new Promise((resolve) => {
      chrome.bookmarks.get(bookmarkId, (nodes) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to fetch bookmark:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(nodes && nodes.length > 0 ? nodes[0] : null);
      });
    });
  }

  async _folderExists(folderId) {
    return new Promise((resolve) => {
      chrome.bookmarks.get(folderId, (nodes) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        const node = nodes && nodes[0];
        if (!node) {
          resolve(false);
          return;
        }
        resolve(node.url === undefined);
      });
    });
  }

  async _createBookmark(options) {
    return new Promise((resolve) => {
      chrome.bookmarks.create(options, (bookmark) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to recreate bookmark:', chrome.runtime.lastError);
        }
        resolve(bookmark);
      });
    });
  }

  async _computeFolderPath(bookmark) {
    const path = [];
    let currentParent = bookmark.parentId;

    while (currentParent) {
      // eslint-disable-next-line no-await-in-loop
      const node = await this._getBookmark(currentParent);
      if (!node) {
        break;
      }

      if (node.title) {
        path.push(node.title);
      }

      currentParent = node.parentId;
    }

    if (path.length === 0) {
      return 'Bookmarks Bar';
    }

    return path.reverse().join(' / ');
  }
}
