export class EventManager {
  constructor(app) {
    this.app = app;
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
      
      // Handle the “Check Sites” button
      if (target.closest('#check-sites-button')) {
        e.preventDefault();
        e.stopPropagation();
        this.app.siteCheckManager.handleSiteCheck();
        return;
      }
      
      //HandleSettingsButtonClick
      if (target.closest('#settings-button')) {
        e.preventDefault();
        e.stopPropagation();
        this.app.modalManager.showSettingsModal();
        return;
      }
      
      //HandleEditButtonClick
      if (target.closest('.edit-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const bookmarkItem = target.closest('.bookmark-item');
        if (bookmarkItem) {
          this.handleEditClick(bookmarkItem);
        }
      }
      
      //HandleDeleteButtonClick
      if (target.closest('.delete-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const bookmarkItem = target.closest('.bookmark-item');
        if (bookmarkItem) {
          this.handleDeleteClick(bookmarkItem);
        }
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
    const bookmarkId = bookmarkItem.dataset.bookmarkId;
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
    const bookmarkId = bookmarkItem.dataset.bookmarkId;
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
} 
