import { formatDateTime } from '../utils.js';
import { BookmarkRenderer } from './BookmarkRenderer.js';
import { ColumnManager } from './ColumnManager.js';
import { KanbanRenderer } from './KanbanRenderer.js';
import { NotificationService } from './NotificationService.js';
import { UIStateManager } from './UIStateManager.js';
import { tagRenderer } from '../tagRenderer.js';

export class UIManager {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
    this.container = document.getElementById('kanban-container');
    
    // Initialize services
    this.notificationService = new NotificationService();
    this.uiStateManager = new UIStateManager(this.container);
    
    // Initialize renderers in correct order
    this.bookmarkRenderer = new BookmarkRenderer();
    this.columnManager = new ColumnManager(this.bookmarkManager, this.notificationService);
    this.columnManager.setBookmarkRenderer(this.bookmarkRenderer);

    // Set up tag click callback
    this.bookmarkRenderer.setTagClickCallback((tag, event) => {
      this.handleTagClick(tag, event);
    });
    
    // Initialize kanban renderer with all required dependencies
    this.kanbanRenderer = new KanbanRenderer(
      this.bookmarkManager,
      this.columnManager,
      this.bookmarkRenderer
    );
    
    // Initialize UI components
    this.initializeTimeUpdate();
  }

  /**
   * Initialize time update
   */
  initializeTimeUpdate() {
    const updateDateTime = () => {
      const { time, date } = formatDateTime(new Date());
      document.getElementById('current-time').textContent = time;
      document.getElementById('current-date').textContent = date;
    };

    updateDateTime();
    setInterval(updateDateTime, 1000);
  }

  /**
   * Render the kanban board
   */
  async renderKanban() {
    try {
      // Clear container
      this.container.innerHTML = '';
      
      // Get bookmark tree
      const bookmarkTree = await this.bookmarkManager.getBookmarkTree();
      
      // Render board
      await this.kanbanRenderer.renderBoard(this.container, bookmarkTree);
      
    } catch (error) {
      console.error('Failed to render kanban:', error);
      this.uiStateManager.showError('Failed to load bookmarks');
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.uiStateManager.showLoading();
  }

  /**
   * Show error message
   */
  showErrorMessage() {
    this.uiStateManager.showError('An error occurred while loading bookmarks');
  }

  /**
   * Show disabled message
   */
  showDisabledMessage() {
    this.uiStateManager.showDisabledMessage();
  }

  /**
   * Remove a bookmark item from the UI
   * @param {string} bookmarkId Bookmark ID to remove
   */
  removeBookmarkItem(bookmarkId) {
    this.bookmarkRenderer.removeBookmarkItem(bookmarkId);
  }

  /**
   * Update a bookmark item in the UI
   * @param {Object} bookmark Bookmark data
   */
  updateBookmarkItem(bookmark) {
    this.bookmarkRenderer.updateBookmarkItem(bookmark);
  }

  /**
   * Show drag guide for new users
   */
  showDragGuide() {
    this.uiStateManager.showDragGuide();
  }

  /**
   * Handle tag click events
   * @param {string} tag Tag name
   * @param {Event} event Click event
   */
  handleTagClick(tag, event) {
    console.log(`Tag clicked: ${tag}`);
    // TODO: Implement tag filtering functionality
    // For now, just show a notification
    this.notificationService.show(`点击了标签: ${tag}`, 'info');
  }
} 