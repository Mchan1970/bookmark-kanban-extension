export class AppCoordinator {
  async initialize() {
    try {
      //InitializeThemeManager
      this.themeManager = themeManager;
      await this.themeManager.initializeTheme();
      
      //Initialize display manager
      this.displayManager = displayManager;
      await this.displayManager.initializeDisplayMode();
      
      //InitializeBookmarkManager
      this.bookmarkManager = new BookmarkManager();
      
      //Initialize UI Manager
      this.uiManager = new UIManager(this.bookmarkManager);
      
      //Initialize modal manager - ensure app reference is passed
      this.modalManager = new ModalManager(this.bookmarkManager, this.uiManager, this);
      
      //InitializeDragManager
      this.dragManager = new DragManager(this.bookmarkManager, this.uiManager);
      
      //Initialize command palette
      this.commandPalette = new CommandPalette(this.bookmarkManager);
      await this.commandPalette.initialize();
      
      //InitializeEventManager
      this.eventManager = new EventManager(this);
      
      //Initialize message handler
      this.messageHandler = new MessageHandler(this);
      
      //InitializeNotificationManager
      this.notificationManager = new NotificationManager();

      //ShowLoadState
      this.uiManager.showLoading();
      
      //Set up bookmark change listener
      this.bookmarkManager.setChangeListener(() => this.handleBookmarksChange());
      this.bookmarkManager.setRemoveListener((id) => {
        //Handle DOM directly, no full refresh triggered
        const bookmarkItem = document.querySelector(`[data-bookmark-id="${id}"]`);
        if (bookmarkItem) {
          bookmarkItem.style.transition = 'opacity 0.3s ease';
          bookmarkItem.style.opacity = '0';
          setTimeout(() => {
            bookmarkItem.remove();
            //Update bookmark order after deletion
            this.dragManager.saveBookmarkOrder();
          }, 300);
        }
      });
      
      //Render kanban
      await this.uiManager.renderKanban();
      
      //Initialize drag functionality
      this.dragManager.initialize();

      //Add global event listener
      this.eventManager.setupEventListeners();

      //Initialize lazy icon loading
      this.initializeFaviconLoading();

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.uiManager.showErrorMessage();
    }
  }
} 
