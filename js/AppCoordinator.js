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
    
    // 使 app 实例全局可访问
    window.app = this;
  }

  async initialize() {
    try {
      // 初始化主题管理器
      this.themeManager = themeManager;
      await this.themeManager.initializeTheme();
      
      // 初始化显示模式管理器
      this.displayManager = displayManager;
      await this.displayManager.initializeDisplayMode();
      
      // 初始化书签管理器
      this.bookmarkManager = new BookmarkManager();

      // 初始化标签管理器
      this.tagManager = tagManager;
      this.tagRenderer = tagRenderer;

      // 初始化 UI 管理器
      this.uiManager = new UIManager(this.bookmarkManager);
      
      // 初始化模态框管理器
      this.modalManager = new ModalManager(this.bookmarkManager, this.uiManager);
      
      // 初始化拖拽管理器
      this.dragManager = new DragManager(this.bookmarkManager, this.uiManager);
      
      // 初始化命令面板
      this.commandPalette = new CommandPalette(this.bookmarkManager);
      await this.commandPalette.initialize();

      this.setupHeaderSearch();
      
      // 初始化事件管理器
      this.eventManager = new EventManager(this);
      
      // 初始化消息处理器
      this.messageHandler = new MessageHandler(this);
      
      // 初始化站点检查管理器
      this.siteCheckManager = new SiteCheckManager(this);
      
      // 初始化通知管理器
      this.notificationManager = new NotificationManager();
      
      // 检查是否启用新标签页
      const enabled = await this.checkNewTabEnabled();
      if (!enabled) {
        this.uiManager.showDisabledMessage();
        return;
      }

      // 显示加载状态
      this.uiManager.showLoading();
      
      // 设置书签变更监听器
      this.bookmarkManager.setChangeListener(() => this.handleBookmarksChange());
      this.bookmarkManager.setRemoveListener((id) => {
        // 直接处理 DOM，不触发完整刷新
        this.uiManager.removeBookmarkItem(id);
      });
      
      // 渲染看板
      await this.uiManager.renderKanban();
      
      // 初始化拖拽功能
      this.dragManager.initialize();

      // 添加全局事件监听器
      this.eventManager.setupEventListeners();

      // 初始化图标懒加载
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
        resolve(result.showOnNewTab !== false); // 默认为 true
      });
    });
  }

  initializeFaviconLoading() {
    if (this.faviconObserver) {
      this.faviconObserver.disconnect();
      this.faviconObserver = null;
    }
    
    // 使用新的图标加载器
    faviconLoader.initialize();
  }

  handleBookmarksChange() {
    if (this._bookmarkChangeTimer) {
      clearTimeout(this._bookmarkChangeTimer);
    }
    
    this._bookmarkChangeTimer = setTimeout(async () => {
      try {
        // 如果正在拖拽，不更新
        if (this.dragManager && this.dragManager.isDragging) {
          return;
        }
        
        console.log('Processing bookmark changes, re-rendering board');
        
        // 保存当前滚动位置
        const scrollPosition = window.scrollY;
        
        // 在重新渲染前销毁拖拽实例
        if (this.dragManager) {
          this.dragManager.destroy();
        }
        
        // 重新渲染
        await this.uiManager.renderKanban();
        
        // 重新初始化拖拽
        if (this.dragManager) {
          this.dragManager.initialize();
        }

        this.initializeFaviconLoading();
        
        // 保存新布局
        this.dragManager.saveColumnOrder();
        this.dragManager.saveBookmarkOrder();

        // 使用 setTimeout 和 requestAnimationFrame 确保 DOM 已更新
        setTimeout(() => {
          requestAnimationFrame(() => {
            // 恢复滚动位置
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
