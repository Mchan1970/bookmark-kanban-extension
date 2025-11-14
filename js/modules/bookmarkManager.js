const BOOKMARK_BAR_ID = '1';

/*** Bookmark Manager Class
 * Handles all operations related to Chrome Bookmarks API
 */
export class BookmarkManager {
  constructor() {
    //Cache bookmark tree to reduce API calls
    this.bookmarkTree = null;
    
    //Register bookmark change listener
    this.changeListener = null;
    this.removeListener = null;
  }

  /*** Initialize bookmark change listener
   */
  initializeChangeListener() {
    //Remove existing listener and handle different events separately
    chrome.bookmarks.onCreated.addListener(this.handleBookmarkCreated.bind(this));
    chrome.bookmarks.onMoved.addListener(this.handleBookmarkMoved.bind(this));
    chrome.bookmarks.onChanged.addListener(this.handleBookmarkChanged.bind(this));
    chrome.bookmarks.onRemoved.addListener(this.handleBookmarkRemoved.bind(this));
  }

  /*** Handle bookmark deletion
   */
  handleBookmarkRemoved(id, removeInfo) {
    //Special handling for delete event
    //Only update internal cache, do not trigger full refresh
    if (this.bookmarkTree) {
      this.removeBookmarkFromTree(id);
    }
    //Trigger delete-specific callback
    if (this.removeListener) {
      this.removeListener(id);
    }
    //Trigger general change callback to update UI
    if (this.changeListener) {
      this.changeListener();
    }
  }

  /*** Refresh bookmark tree cache
   */
  async refreshBookmarkTree() {
    try {
      const tree = await this.getBookmarkTree();
      this.bookmarkTree = tree;
      //Trigger update event
      this.changeListener?.();
    } catch (error) {
      console.error('Failed to refresh bookmark tree:', error);
    }
  }

  /*** Get complete bookmark tree
   * @returns {Promise<Array>} Bookmark tree data
   */
  getBookmarkTree() {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((tree) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tree);
        }
      });
    });
  }

  /*** Get bookmark bar contents
   * @returns {Promise<Array>} Bookmark bar contents
   */
  async getBookmarkBarContents() {
    try {
      const tree = await this.getBookmarkTree();
      //Bookmark bar ID is usually "1"
      const bookmarkBar = tree[0].children.find(child => child.id === BOOKMARK_BAR_ID);
      return bookmarkBar ? bookmarkBar.children : [];
    } catch (error) {
      console.error('Failed to get bookmark bar contents:', error);
      return [];
    }
  }

  /*** Move bookmark
   * @param {string} id Bookmark ID
   * @param {Object} destination Destination {parentId, index}
   * @returns {Promise<void>}
   */
  moveBookmark(id, destination) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(id, destination, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /*** Update bookmark
   * @param {string} id Bookmark ID
   * @param {Object} changes Content to update {title, url}
   * @returns {Promise<Object>} Updated bookmark object
   */
  updateBookmark(id, changes) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.update(id, changes, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  /*** Delete bookmark
   * @param {string} id Bookmark ID
   * @returns {Promise<void>}
   */
  deleteBookmark(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          //Only update internal cache, do not trigger full refresh
          this.updateBookmarkTreeCache();
          resolve();
        }
      });
    });
  }

  /*** Only update internal cache, do not trigger UI re-render
   */
  async updateBookmarkTreeCache() {
    try {
      const tree = await this.getBookmarkTree();
      this.bookmarkTree = tree;
      //Note: This does not trigger onBookmarksChanged
    } catch (error) {
      console.error('Failed to update bookmark tree cache:', error);
    }
  }

  /*** Create bookmark
   * @param {Object} bookmark Bookmark information {parentId, title, url}
   * @returns {Promise<Object>} Created bookmark object
   */
  createBookmark(bookmark) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(bookmark, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  createFolder(parentId, title) {
    return new Promise((resolve, reject) => {
      if (!parentId || !title) {
        reject(new Error('Missing folder information'));
        return;
      }
      chrome.bookmarks.create({ parentId, title }, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  async createColumnFolder(title) {
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) {
      throw new Error('Column title is required');
    }
    return this.createFolder(BOOKMARK_BAR_ID, normalizedTitle);
  }

  /*** Get bookmark folders
   * @returns {Promise<Array>} Folder list
   */
  async getFolders() {
    try {
      const tree = await this.getBookmarkTree();
      const folders = [];
      
      const extractFolders = (node) => {
        if (node.children) {
          folders.push({
            id: node.id,
            title: node.title,
            parentId: node.parentId
          });
          node.children.forEach(extractFolders);
        }
      };
      
      tree.forEach(extractFolders);
      return folders;
    } catch (error) {
      console.error('Failed to get folders:', error);
      return [];
    }
  }

  /*** Set bookmark change callback function
   * @param {Function} callback Callback function
   */
  setChangeListener(callback) {
    this.changeListener = callback;
  }

  /*** Set bookmark delete callback function
   * @param {Function} callback Callback function
   */
  setRemoveListener(callback) {
    this.removeListener = callback;
  }

  getFolderChildren(folderId) {
    return new Promise((resolve, reject) => {
      if (!folderId) {
        resolve([]);
        return;
      }
      chrome.bookmarks.getChildren(folderId, (children) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(children || []);
        }
      });
    });
  }

  async isFolderEmpty(folderId) {
    if (!folderId) {
      return false;
    }
    const children = await this.getFolderChildren(folderId);
    return !children || children.length === 0;
  }

  deleteFolder(folderId) {
    return new Promise((resolve, reject) => {
      if (!folderId) {
        reject(new Error('Missing folder identifier'));
        return;
      }
      chrome.bookmarks.removeTree(folderId, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          this.updateBookmarkTreeCache();
          resolve();
        }
      });
    });
  }
}
