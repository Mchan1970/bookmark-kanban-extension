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
      
      //Initialize命令Panel
      this.commandPalette = new CommandPalette(this.bookmarkManager);
      await this.commandPalette.initialize();
      
      //InitializeEventManager
      this.eventManager = new EventManager(this);
      
      //InitializeMessageHandle器
      this.messageHandler = new MessageHandler(this);
      
      //Initialize站点CheckManager
      this.siteCheckManager = new SiteCheckManager(this);
      
      //InitializeNotificationManager
      this.notificationManager = new NotificationManager();

      //ShowLoadState
      this.uiManager.showLoading();
      
      //SettingsBookmark变更Listener
      this.bookmarkManager.setChangeListener(() => this.handleBookmarksChange());
      this.bookmarkManager.setRemoveListener((id) => {
        //直接Handle DOM，不触发完整Refresh
        const bookmarkItem = document.querySelector(`[data-bookmark-id="${id}"]`);
        if (bookmarkItem) {
          bookmarkItem.style.transition = 'opacity 0.3s ease';
          bookmarkItem.style.opacity = '0';
          setTimeout(() => {
            bookmarkItem.remove();
            //Delete后UpdateBookmark顺序Storage
            this.dragManager.saveBookmarkOrder();
          }, 300);
        }
      });
      
      //渲染Kanban
      await this.uiManager.renderKanban();
      
      //InitializeDrag功能
      this.dragManager.initialize();

      //Add全局EventListener
      this.eventManager.setupEventListeners();

      //InitializeIcon懒Load
      this.initializeFaviconLoading();

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.uiManager.showErrorMessage();
    }
  }
} 