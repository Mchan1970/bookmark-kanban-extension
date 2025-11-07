import { BookmarkActionMenu } from './ui/BookmarkActionMenu.js';

export class EventManager {
  constructor(app) {
    this.app = app;
    this.actionMenu = new BookmarkActionMenu((action, bookmark) => this.handleMenuAction(action, bookmark));
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
}
