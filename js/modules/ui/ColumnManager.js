import { createElement } from '../utils.js';

export class ColumnManager {
  constructor(bookmarkManager, notificationService) {
    this.bookmarkManager = bookmarkManager;
    this.notificationService = notificationService;
    this.bookmarkRenderer = null; //Will be set later via setter
  }

  /*** Set the bookmark renderer
   * @param {BookmarkRenderer} renderer The bookmark renderer instance
   */
  setBookmarkRenderer(renderer) {
    this.bookmarkRenderer = renderer;
  }

  /*** Create an empty state element
   * @returns {HTMLElement}
   */
  createEmptyState() {
    const empty = createElement('div', 'empty-column');
    empty.textContent = 'No bookmarks';
    return empty;
  }

  /*** Render a folder column
   * @param {Object} folder Folder data
   * @param {HTMLElement} container Container to append to
   * @param {Object} savedBookmarkOrder Saved bookmark order
   */
  renderFolderColumn(folder, container, savedBookmarkOrder) {
    const column = createElement('div', 'kanban-column');
    column.dataset.columnType = 'folder';
    column.dataset.folderId = folder.id;

    //Create header
    const header = this.createColumnHeader(folder.title, this.countBookmarksInFolder(folder), {
      columnType: 'folder',
      folderId: folder.id
    });
    column.appendChild(header);
    
    //Add double-click event handling for title editing
    this.setupTitleEditHandling(header, column);
    
    //Create bookmark list
    const bookmarkList = createElement('div', 'bookmark-list');
    
    if (folder.children) {
      const directBookmarks = folder.children.filter(child => child.url);

      if (savedBookmarkOrder && savedBookmarkOrder[folder.id]) {
        this.renderOrderedBookmarks(directBookmarks, bookmarkList, savedBookmarkOrder[folder.id]);
      } else {
        directBookmarks.forEach(child => {
          const bookmarkItem = this.bookmarkRenderer.createBookmarkItem(child);
          bookmarkList.appendChild(bookmarkItem);
        });
      }

      folder.children
        .filter(child => child.children)
        .forEach(child => {
          this.renderSubfolderGroup(child, bookmarkList, savedBookmarkOrder);
        });
    }

    if (bookmarkList.children.length === 0) {
      bookmarkList.appendChild(this.createEmptyState());
    }

    column.appendChild(bookmarkList);
    container.appendChild(column);
  }
  
  /*** Render a special column (uncategorized or system folder)
   * @param {string} title Column title
   * @param {Array} bookmarks Bookmarks array
   * @param {HTMLElement} container Container to append to
   * @param {string} folderId Folder ID (null for uncategorized)
   * @param {string} type Column type ('uncategorized' or 'special')
   * @param {Object} savedBookmarkOrder Saved bookmark order
   */
  renderSpecialColumn(title, bookmarks, container, folderId, type, savedBookmarkOrder) {
    const column = createElement('div', 'kanban-column');
    column.dataset.columnType = type;
    column.dataset.folderId = folderId;
    
    //Create header
    const header = this.createColumnHeader(title, this.countBookmarksInList(bookmarks), {
      columnType: type,
      folderId: folderId || ''
    });
    column.appendChild(header);
    
    //Add double-click event handling for title editing
    this.setupTitleEditHandling(header, column);
    
    //Create bookmark list
    const bookmarkList = createElement('div', 'bookmark-list');
    
    //Determine the correct column ID for storage
    const columnStorageId = column.dataset.columnType === 'uncategorized' ? 
      'uncategorized' : folderId;
    
    let renderedContent = false;

    const directBookmarks = bookmarks.filter(bookmark => bookmark.url);

    //If there's saved bookmark order, render in order
    if (columnStorageId && savedBookmarkOrder && savedBookmarkOrder[columnStorageId]) {
      const appended = this.renderOrderedBookmarks(directBookmarks, bookmarkList, savedBookmarkOrder[columnStorageId]);
      renderedContent = renderedContent || appended;
      
      //Render subfolders
      bookmarks.forEach(bookmark => {
        if (bookmark.children) {
          const groupRendered = this.renderSubfolderGroup(bookmark, bookmarkList, savedBookmarkOrder);
          renderedContent = renderedContent || groupRendered;
        }
      });
    } else {
      //Render in original order
      bookmarks.forEach(bookmark => {
        if (bookmark.url) {
          const bookmarkItem = this.bookmarkRenderer.createBookmarkItem(bookmark);
          bookmarkList.appendChild(bookmarkItem);
          renderedContent = true;
        } else if (bookmark.children) {
          const groupRendered = this.renderSubfolderGroup(bookmark, bookmarkList, savedBookmarkOrder);
          renderedContent = renderedContent || groupRendered;
        }
      });
    }

    if (!renderedContent) {
      bookmarkList.appendChild(this.createEmptyState());
    }
    
    column.appendChild(bookmarkList);
    container.appendChild(column);
  }
  
  /*** Create column header with title and count
   * @param {string} title Column title
   * @param {number} count Item count
   * @returns {HTMLElement} Header element
   */
  createColumnHeader(title, count, options = {}) {
    const header = createElement('div', 'column-header');
    
    //Add drag handle
    const dragHandle = createElement('div', 'column-drag-handle');
    dragHandle.innerHTML = '⠿';
    dragHandle.title = 'Drag to reorder';
    header.appendChild(dragHandle);
    
    //Add title
    const titleElement = createElement('div', 'column-title');
    titleElement.textContent = title;
    
    //Add count
    const countElement = createElement('div', 'column-count');
    countElement.textContent = count;
    
    header.appendChild(titleElement);

    const { columnType = '', folderId = '' } = options;
    const infoMessage = this.getSpecialColumnInfo(columnType, folderId);
    if (infoMessage) {
      titleElement.classList.add('column-title--special');
      const infoElement = createElement('span', 'column-info');
      infoElement.textContent = 'ⓘ';
      infoElement.setAttribute('data-tooltip', infoMessage);
      titleElement.appendChild(infoElement);
    }

    header.appendChild(countElement);
    
    return header;
  }

  getSpecialColumnInfo(columnType, folderId) {
    if (columnType === 'uncategorized') {
      return 'Bookmarks directly on the bookmarks bar – title cannot be edited';
    }
    if (folderId === '2') {
      return 'Other Bookmarks – system column, title cannot be edited';
    }
    if (folderId === '3') {
      return 'Mobile Bookmarks – system column, title cannot be edited';
    }
    return '';
  }
  
  /*** Set up double-click handler for title editing
   * @param {HTMLElement} header Header element
   * @param {HTMLElement} column Column element
   */
  setupTitleEditHandling(header, column) {
    header.addEventListener('dblclick', (e) => {
      //Ensure click is on title, not drag handle or count
      if (e.target.classList.contains('column-title') ||
          e.target.closest('.column-title')) {
        this.handleColumnTitleEdit(column);
      }
    });
  }
  
  /*** Handle column title edit
   * @param {HTMLElement} columnElement Column element
   */
  handleColumnTitleEdit(columnElement) {
    //Get column type and ID
    const columnType = columnElement.dataset.columnType;
    const folderId = columnElement.dataset.folderId;
    const titleElement = columnElement.querySelector('.column-title');
    const originalTitle = titleElement.textContent;
    
    //Check if it's a special column
    if (columnType === 'uncategorized') {
      this.notificationService.showToast(
        'Uncategorized column cannot be renamed. You can drag these bookmarks to other columns to organize them.',
        'info',
        5000
      );
      return;
    }
    
    //Check if it's a Chrome special folder
    if (folderId === '2' || folderId === '3') {
      const folderName = folderId === '2' ? 'Other Bookmarks' : 'Mobile Bookmarks';
      this.notificationService.showToast(
        `"${folderName}" is a Chrome special folder and cannot be renamed directly. Consider creating a new folder and organizing these bookmarks into more meaningful categories.`,
        'info',
        5000
      );
      return;
    }
    
    //Create edit input box
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'column-title-edit';
    inputElement.value = originalTitle;
    inputElement.style.width = '100%';
    inputElement.style.padding = '4px';
    inputElement.style.border = '1px solid var(--primary-color)';
    inputElement.style.borderRadius = 'var(--border-radius)';
    inputElement.style.fontSize = titleElement.style.fontSize || '1.2rem';
    
    //Replace title element with input box
    titleElement.style.display = 'none';
    titleElement.parentNode.insertBefore(inputElement, titleElement.nextSibling);
    
    //Focus input box and select all text
    inputElement.focus();
    inputElement.select();
    
    //Handle input box events
    inputElement.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newTitle = inputElement.value.trim();
        
        //Validate new title
        if (!newTitle) {
          inputElement.style.borderColor = 'var(--danger-color)';
          return;
        }
        
        //Save changes
        await this.saveColumnTitle(folderId, newTitle, titleElement);
        
        //Restore UI
        this.finishTitleEdit(inputElement, titleElement);
      } else if (e.key === 'Escape') {
        //Cancel edit
        this.finishTitleEdit(inputElement, titleElement);
      }
    });
    
    //Handle blur event
    inputElement.addEventListener('blur', () => {
      //Simple delay to allow Enter key event to process first
      setTimeout(() => {
        if (document.body.contains(inputElement)) {
          this.finishTitleEdit(inputElement, titleElement);
        }
      }, 100);
    });
  }
  
  /*** Complete title editing
   * @param {HTMLInputElement} inputElement Input element
   * @param {HTMLElement} titleElement Title element
   */
  finishTitleEdit(inputElement, titleElement) {
    titleElement.style.display = '';
    if (inputElement.parentNode) {
      inputElement.parentNode.removeChild(inputElement);
    }
  }
  
  /*** Save column title
   * @param {string} folderId Folder ID
   * @param {string} newTitle New title
   * @param {HTMLElement} titleElement Title element
   */
  async saveColumnTitle(folderId, newTitle, titleElement) {
    try {
      //Update bookmark folder title using Chrome API
      const result = await chrome.bookmarks.update(folderId, { title: newTitle });
      
      //Update UI
      titleElement.textContent = result.title;
      
      //Show success message
      this.notificationService.showToast(`Column title updated to "${newTitle}"`, 'success');
      
      return true;
    } catch (error) {
      console.error('Failed to update column title:', error);
      this.notificationService.showToast('Failed to update column title', 'error');
      return false;
    }
  }
  
  /*** Render bookmarks according to saved order
   * @param {Array} bookmarks Bookmarks array
   * @param {HTMLElement} container Container to render into
   * @param {Array} savedOrder Saved order array of bookmark IDs
   */
  renderOrderedBookmarks(bookmarks, container, savedOrder) {
    let appended = false;

    //Create a bookmark map for quick lookup by id
    const bookmarkMap = {};
    bookmarks.forEach(bookmark => {
      if (bookmark.url) {
        bookmarkMap[bookmark.id] = bookmark;
      }
    });
    
    //Add bookmarks in saved order
    savedOrder.forEach(bookmarkId => {
      if (bookmarkMap[bookmarkId]) {
        const bookmarkItem = this.bookmarkRenderer.createBookmarkItem(bookmarkMap[bookmarkId]);
        container.appendChild(bookmarkItem);
        appended = true;
        //Remove from map to avoid duplicate addition
        delete bookmarkMap[bookmarkId];
      }
    });
    
    //Add any bookmarks not in saved order
    Object.values(bookmarkMap).forEach(bookmark => {
      const bookmarkItem = this.bookmarkRenderer.createBookmarkItem(bookmark);
      container.appendChild(bookmarkItem);
      appended = true;
    });

    return appended;
  }
  
  /*** Render subfolder group
   * @param {Object} folder Subfolder data
   * @param {HTMLElement} container Container to append to
   * @param {Object} savedBookmarkOrder Saved bookmark order
   */
  renderSubfolderGroup(folder, container, savedBookmarkOrder) {
    //Don't render if subfolder has no bookmarks
    if (!folder.children || folder.children.length === 0) return false;

    const directBookmarks = folder.children.filter(child => child.url);
    const nestedFolders = folder.children.filter(child => child.children && child.children.length > 0);

    if (directBookmarks.length === 0 && nestedFolders.length === 0) {
      return false;
    }

    const subfolderGroup = createElement('div', 'subfolder-group');
    const subfolderTitle = createElement('div', 'subfolder-title');
    subfolderTitle.textContent = folder.title;
    subfolderGroup.appendChild(subfolderTitle);

    let rendered = false;

    if (directBookmarks.length > 0) {
      const subfolderKey = `subfolder-${folder.id}`;
      if (savedBookmarkOrder && savedBookmarkOrder[subfolderKey]) {
        const appended = this.renderOrderedBookmarks(directBookmarks, subfolderGroup, savedBookmarkOrder[subfolderKey]);
        rendered = rendered || appended;
      } else {
        directBookmarks.forEach(child => {
          const bookmarkItem = this.bookmarkRenderer.createBookmarkItem(child);
          subfolderGroup.appendChild(bookmarkItem);
          rendered = true;
        });
      }
    }

    nestedFolders.forEach(childFolder => {
      const childRendered = this.renderSubfolderGroup(childFolder, subfolderGroup, savedBookmarkOrder);
      rendered = rendered || childRendered;
    });

    if (rendered) {
      container.appendChild(subfolderGroup);
      return true;
    }

    return false;
  }
  
  /*** Count bookmarks in folder (recursively)
   * @param {Object} folder Folder object
   * @returns {number} Total bookmark count
   */
  countBookmarksInFolder(folder) {
    let count = 0;
    if (folder.children) {
      folder.children.forEach(child => {
        if (child.url) {
          count++;
        } else if (child.children) {
          count += this.countBookmarksInFolder(child);
        }
      });
    }
    return count;
  }

  /*** Count bookmarks within a generic list (direct children + subfolders)
   * @param {Array} items Array of bookmark or folder nodes
   * @returns {number} Total bookmark count
   */
  countBookmarksInList(items) {
    if (!items || items.length === 0) {
      return 0;
    }

    let count = 0;
    items.forEach(item => {
      if (item.url) {
        count++;
      } else if (item.children) {
        count += this.countBookmarksInFolder(item);
      }
    });
    return count;
  }
  
  /*** Update column bookmark count
   * @param {string} columnId Column ID
   */
  updateColumnCount(columnId) {
    const column = document.querySelector(`.kanban-column[data-folder-id="${columnId}"]`);
    if (column) {
      const bookmarkList = column.querySelector('.bookmark-list');
      const count = column.querySelector('.column-count');
      count.textContent = bookmarkList.children.length;
    }
  }
} 
