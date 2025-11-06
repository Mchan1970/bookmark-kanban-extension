import { BookmarkManager } from './modules/bookmarkManager.js';
import { UIManager } from './modules/ui/UIManager.js';
import { ModalManager } from './modules/modalManager.js';
import { DragManager } from './modules/dragManager.js';
import { faviconLoader } from './modules/faviconLoader.js';
import { storageManager } from './modules/storageManager.js';
import { themeManager } from './modules/themeManager.js';
import { displayManager } from './modules/displayManager.js';
import { CommandPalette } from './modules/commandPalette.js';
import { EventManager } from './modules/eventManager.js';
import { MessageHandler } from './modules/messageHandler.js';
import { SiteCheckManager } from './modules/siteCheckManager.js';
import { NotificationManager } from './modules/notificationManager.js';
import { tagManager } from './modules/tagManager.js';
import { tagRenderer } from './modules/tagRenderer.js';

export class AppCoordinator {
  constructor() {
    this._isDeleteOperation = false;
    this.faviconObserver = null;
    this.siteStatus = new Map();
    
    // Expose the app instance globally when needed
    window.app = this;
  }

  async initialize() {
    try {
      // Initialize the theme manager
      this.themeManager = themeManager;
      await this.themeManager.initializeTheme();
      
      // Initialize the display mode manager
      this.displayManager = displayManager;
      await this.displayManager.initializeDisplayMode();
      
      // Initialize the bookmark manager
      this.bookmarkManager = new BookmarkManager();

      // Initialize the tag manager
      this.tagManager = tagManager;
      this.tagRenderer = tagRenderer;

      // Initialize the UI manager
      this.uiManager = new UIManager(this.bookmarkManager);
      
      // Initialize the modal manager
      this.modalManager = new ModalManager(this.bookmarkManager, this.uiManager);
      
      // Initialize the drag manager
      this.dragManager = new DragManager(this.bookmarkManager, this.uiManager);
      
      // Initialize the command palette
      this.commandPalette = new CommandPalette(this.bookmarkManager);
      await this.commandPalette.initialize();

      this.setupHeaderSearch();
      
      // Initialize the event manager
      this.eventManager = new EventManager(this);
      
      // Initialize the message handler
      this.messageHandler = new MessageHandler(this);
      
      // Initialize the site check manager
      this.siteCheckManager = new SiteCheckManager(this);
      
      // Initialize the notification manager
      this.notificationManager = new NotificationManager();
      
      // Determine whether the new-tab replacement is enabled
      const enabled = await this.checkNewTabEnabled();
      if (!enabled) {
        this.uiManager.showDisabledMessage();
        return;
      }

      // Show loading state
      this.uiManager.showLoading();
      
      // Set up listeners for bookmark changes
      this.bookmarkManager.setChangeListener(() => this.handleBookmarksChange());
      this.bookmarkManager.setRemoveListener((id) => {
        // Update DOM directly without triggering a full refresh
        this.uiManager.removeBookmarkItem(id);
      });
      
      // Render the kanban board
      await this.uiManager.renderKanban();
      
      // Initialize drag-and-drop interactions
      this.dragManager.initialize();

      // Register global event listeners
      this.eventManager.setupEventListeners();

      // Initialize lazy loading for favicon icons
      this.initializeFaviconLoading();

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.uiManager.showErrorMessage();
    }
  }

  setupHeaderSearch() {
    const searchInput = document.getElementById('header-search');
    const searchButton = document.getElementById('header-search-go');

    if (!searchInput || !this.commandPalette) {
      return;
    }

    const triggerSearch = () => {
      const query = searchInput.value.trim();
      this.commandPalette.quickSearch(query);
    };

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        triggerSearch();
      }
    });

    if (searchButton) {
      searchButton.addEventListener('click', (event) => {
        event.preventDefault();
        triggerSearch();
      });
    }
  }

  async checkNewTabEnabled() {
    return new Promise(resolve => {
      chrome.storage.sync.get(['showOnNewTab'], result => {
        resolve(result.showOnNewTab !== false); // Default is true
      });
    });
  }

  initializeFaviconLoading() {
    if (this.faviconObserver) {
      this.faviconObserver.disconnect();
      this.faviconObserver = null;
    }
    
    // Use the new favicon loader
    faviconLoader.initialize();
  }

  handleBookmarksChange() {
    if (this._bookmarkChangeTimer) {
      clearTimeout(this._bookmarkChangeTimer);
    }
    
    this._bookmarkChangeTimer = setTimeout(async () => {
      try {
        // Skip updates while a drag operation is in progress
        if (this.dragManager && this.dragManager.isDragging) {
          return;
        }
        
        console.log('Processing bookmark changes, re-rendering board');
        
        // Remember current scroll position
        const scrollPosition = window.scrollY;
        
        // Destroy drag instances before re-rendering
        if (this.dragManager) {
          this.dragManager.destroy();
        }
        
        // Re-render the board
        await this.uiManager.renderKanban();
        
        // Reinitialize drag interactions
        if (this.dragManager) {
          this.dragManager.initialize();
        }

        this.initializeFaviconLoading();
        
        // Persist any new layout ordering
        this.dragManager.saveColumnOrder();
        this.dragManager.saveBookmarkOrder();

        // Use setTimeout and requestAnimationFrame to wait for DOM updates
        setTimeout(() => {
          requestAnimationFrame(() => {
            // Restore scroll position
            window.scrollTo(0, scrollPosition);
          });
        }, 100);
        
      } catch (error) {
        console.error('Error processing bookmark changes:', error);
      }
    }, 300);
  }

  resetLayout() {
    storageManager.clearAllOrderData();
    location.reload();
  }

  async switchTheme(theme) {
    try {
      await this.themeManager.switchTheme(theme);
      this.notificationManager.showToast(`Theme switched to ${theme}`);
      return true;
    } catch (error) {
      console.error('Failed to switch theme:', error);
      this.notificationManager.showErrorToast('Failed to switch theme');
      return false;
    }
  }

  async switchDisplayMode(mode) {
    try {
      await this.displayManager.switchDisplayMode(mode);
      this.notificationManager.showToast(`Display mode switched to ${mode} line`);
      return true;
    } catch (error) {
      console.error('Failed to switch display mode:', error);
      this.notificationManager.showErrorToast('Failed to switch display mode');
      return false;
    }
  }
} 
