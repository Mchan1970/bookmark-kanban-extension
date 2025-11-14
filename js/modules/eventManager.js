import { BookmarkActionMenu } from './ui/BookmarkActionMenu.js';
import { ColumnActionMenu } from './ui/ColumnActionMenu.js';

export class EventManager {
  constructor(app) {
    this.app = app;
    this.actionMenu = new BookmarkActionMenu(
      (action, bookmark) => this.handleMenuAction(action, bookmark),
      {
        getAccessStats: (bookmarkId) => this.app.getBookmarkAccessStats?.(bookmarkId)
      }
    );
    this.columnMenu = new ColumnActionMenu((action, column) => this.handleColumnMenuAction(action, column));
  }

  setupEventListeners() {
    this.setupDocumentListeners();
    this.setupKeyboardShortcuts();
  }

  setupDocumentListeners() {
    document.addEventListener('click', (e) => {
      // Ignore clicks while a drag operation is in progress
      if (this.app.dragManager && this.app.dragManager.isDragging) {
        return;
      }
      
      const target = e.target;
      
      //HandleSettingsButtonClick
      if (target.closest('#settings-button')) {
        e.preventDefault();
        e.stopPropagation();
        this.app.modalManager.showSettingsModal();
        return;
      }

      if (target.closest('#add-column-button')) {
        e.preventDefault();
        e.stopPropagation();
        this.app.modalManager.showAddColumnModal();
        return;
      }
      
      //Handle more actions button
      if (target.closest('.bookmark-menu-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const bookmarkItem = target.closest('.bookmark-item');
        if (bookmarkItem) {
          const rect = target.getBoundingClientRect();
          this.openBookmarkMenu(bookmarkItem, { anchorRect: rect });
        }
        return;
      }

      if (target.closest('.column-menu-button')) {
        e.preventDefault();
        e.stopPropagation();
        const columnElement = target.closest('.kanban-column');
        if (columnElement) {
          const rect = target.getBoundingClientRect();
          this.openColumnMenu(columnElement, { anchorRect: rect });
        }
        return;
      }
    });

    document.addEventListener('contextmenu', (e) => {
      const bookmarkItem = e.target.closest('.bookmark-item');
      if (!bookmarkItem) {
        return;
      }
      e.preventDefault();
      const position = { x: e.clientX, y: e.clientY };
      this.openBookmarkMenu(bookmarkItem, { position });
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.actionMenu.visible) {
        return;
      }

      const hoveredBookmark = e.target.closest('.bookmark-item');
      if (!hoveredBookmark) {
        return;
      }

      const currentId = this.actionMenu.currentBookmark?.id;
      if (currentId && hoveredBookmark.dataset.bookmarkId !== currentId) {
        this.actionMenu.hide();
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Intercept Ctrl/Cmd + F to avoid clashing with the built-in browser search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
      }
      
      // Ctrl/Cmd + S triggers a manual layout save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveCurrentLayout();
      }
    });
  }

  async handleEditClick(bookmarkItem) {
    if (!bookmarkItem) return;
    await this.handleEditById(bookmarkItem.dataset.bookmarkId);
  }

  async handleEditById(bookmarkId) {
    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const [bookmark] = await chrome.bookmarks.get(bookmarkId);
        this.app.modalManager.showEditModal(bookmark);
      } else {
        console.error('Chrome bookmarks API is not available');
      }
    } catch (error) {
      console.error('Failed to get bookmark:', error);
    }
  }

  async handleDeleteClick(bookmarkItem) {
    if (!bookmarkItem) return;
    await this.handleDeleteById(bookmarkItem.dataset.bookmarkId);
  }

  async handleDeleteById(bookmarkId) {
    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const [bookmark] = await chrome.bookmarks.get(bookmarkId);
        this.app.modalManager.showConfirmModal(bookmark);
      } else {
        console.error('Chrome bookmarks API is not available');
      }
    } catch (error) {
      console.error('Failed to get bookmark:', error);
      if (this.app.notificationManager) {
        this.app.notificationManager.showErrorToast('Failed to retrieve bookmark information');
      }
    }
  }
  
  saveCurrentLayout() {
    if (this.app.dragManager) {
      this.app.dragManager.saveColumnOrder();
      this.app.dragManager.saveBookmarkOrder();
      if (this.app.notificationManager) {
        this.app.notificationManager.showToast('Layout saved successfully');
      }
    }
  }

  openBookmarkMenu(bookmarkItem, options = {}) {
    const bookmarkId = bookmarkItem.dataset.bookmarkId;
    const url = bookmarkItem.dataset.url;
    this.actionMenu.show({
      id: bookmarkId,
      url,
      anchorRect: options.anchorRect,
      position: options.position
    });
  }

  openColumnMenu(columnElement, options = {}) {
    if (!columnElement) {
      return;
    }
    const titleElement = columnElement.querySelector('.column-title');
    const title = titleElement?.textContent?.trim() || 'Untitled column';
    this.columnMenu.show({
      columnElement,
      folderId: columnElement.dataset.folderId || '',
      columnType: columnElement.dataset.columnType || '',
      title,
      anchorRect: options.anchorRect
    });
  }

  async handleMenuAction(action, bookmark) {
    switch (action) {
      case 'edit':
        await this.handleEditById(bookmark.id);
        break;
      case 'delete':
        await this.handleDeleteById(bookmark.id);
        break;
      case 'archive':
        await this.handleArchiveBookmark(bookmark.id);
        break;
      case 'copy-link':
        await this.handleCopyLink(bookmark.url);
        break;
      default:
        break;
    }
  }

  async handleColumnMenuAction(action, column) {
    switch (action) {
      case 'delete-column':
        await this.handleDeleteColumn(column);
        break;
      default:
        break;
    }
  }

  async handleArchiveBookmark(bookmarkId) {
    try {
      await this.app.cleanupManager?.archiveBookmarks([bookmarkId]);
    } catch (error) {
      console.error('Failed to archive bookmark:', error);
      this.app.notificationManager?.showErrorToast('Failed to archive bookmark');
    }
  }

  async handleCopyLink(url) {
    if (!url) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      this.app.notificationManager?.showToast('Link copied');
    } catch (error) {
      console.error('Failed to copy link:', error);
      this.app.notificationManager?.showErrorToast('Failed to copy link');
    }
  }

  async handleDeleteColumn(column) {
    if (!column) {
      return;
    }

    const { folderId, columnType, title } = column;

    if (!folderId) {
      this.app.notificationManager?.showWarningToast('This column cannot be deleted.');
      return;
    }

    if (columnType === 'uncategorized') {
      this.app.notificationManager?.showWarningToast('Uncategorized column cannot be deleted.');
      return;
    }

    if (folderId === '2' || folderId === '3') {
      this.app.notificationManager?.showWarningToast('System columns cannot be deleted.');
      return;
    }

    try {
      const isEmpty = await this.app.bookmarkManager.isFolderEmpty(folderId);
      if (!isEmpty) {
        this.app.notificationManager?.showWarningToast('Column is not empty. Move or delete its bookmarks first.');
        return;
      }

      const confirmed = window.confirm(`Delete column "${title}"? This action cannot be undone.`);
      if (!confirmed) {
        return;
      }

      await this.app.bookmarkManager.deleteFolder(folderId);
      this.app.notificationManager?.showToast(`Deleted column "${title}"`);
      if (typeof this.app.handleBookmarksChange === 'function') {
        this.app.handleBookmarksChange();
      }
    } catch (error) {
      console.error('Failed to delete column:', error);
      this.app.notificationManager?.showErrorToast('Failed to delete column.');
    }
  }
}
