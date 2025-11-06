import { formatDateTime } from '../utils.js';
import { BookmarkRenderer } from './BookmarkRenderer.js';
import { ColumnManager } from './ColumnManager.js';
import { KanbanRenderer } from './KanbanRenderer.js';
import { NotificationService } from './NotificationService.js';
import { UIStateManager } from './UIStateManager.js';
import { tagRenderer } from '../tagRenderer.js';
import { tagManager } from '../tagManager.js';

export class UIManager {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
    this.container = document.getElementById('kanban-container');
    this.activeTag = null;
    this.tagFilterContainer = null;
    this.renderRequestId = 0;
    
    //Initialize services
    this.notificationService = new NotificationService();
    this.uiStateManager = new UIStateManager(this.container);
    
    //Initialize renderers in correct order
    this.bookmarkRenderer = new BookmarkRenderer();
    this.columnManager = new ColumnManager(this.bookmarkManager, this.notificationService);
    this.columnManager.setBookmarkRenderer(this.bookmarkRenderer);

    //Set up tag click callback
    this.bookmarkRenderer.setTagClickCallback((tag, event) => {
      this.handleTagClick(tag, event);
    });
    tagRenderer.setTagFilterCallback((tag) => {
      this.handleTagFilterToggle(tag);
    });
    
    //Initialize kanban renderer with all required dependencies
    this.kanbanRenderer = new KanbanRenderer(
      this.bookmarkManager,
      this.columnManager,
      this.bookmarkRenderer
    );
    
    //Initialize UI components
    this.initializeTimeUpdate();
  }

  /*** Initialize time update
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

  /*** Render the kanban board
   */
  async renderKanban() {
    try {
      const requestId = ++this.renderRequestId;
      //Clear container
      this.container.innerHTML = '';
      
      //Get bookmark tree
      const bookmarkTree = await this.bookmarkManager.getBookmarkTree();
      if (requestId !== this.renderRequestId) {
        return;
      }
      if (!bookmarkTree || bookmarkTree.length === 0) {
        this.container.appendChild(this.createEmptyState());
        return;
      }

      //Reset and collect tags for the current dataset
      tagManager.clearCache();
      this.collectTags(bookmarkTree);

      const availableTags = tagManager.getAllTags();
      if (availableTags.length === 0 || (this.activeTag && !availableTags.includes(this.activeTag))) {
        this.activeTag = null;
      }

      if (requestId !== this.renderRequestId) {
        return;
      }

      const nodes = [];

      //Render tag filter if applicable
      if (availableTags.length > 0) {
        const filterElement = this.renderTagFilter(availableTags);
        if (filterElement) {
          nodes.push(filterElement);
        }
      }

      //Filter bookmark tree when a tag is active
      let effectiveTree = bookmarkTree;
      if (this.activeTag) {
        const { filteredTree, matchCount } = this.filterBookmarkTree(bookmarkTree, this.activeTag);
        effectiveTree = filteredTree;

        if (matchCount === 0) {
          nodes.push(this.createTagEmptyState(this.activeTag));
          this.container.replaceChildren(...nodes);
          return;
        }
      }

      //Create board container
      const boardContainer = document.createElement('div');
      boardContainer.className = 'kanban-board-wrapper';

      //Render board content into wrapper
      await this.kanbanRenderer.renderBoard(boardContainer, effectiveTree, {
        activeTag: this.activeTag
      });

      if (requestId !== this.renderRequestId) {
        return;
      }

      nodes.push(boardContainer);

      this.container.replaceChildren(...nodes);
      
    } catch (error) {
      console.error('Failed to render kanban:', error);
      this.uiStateManager.showError('Failed to load bookmarks');
    }
  }

  /*** Filter bookmark tree by active tag
   * @param {Array} tree Bookmark tree array
   * @param {string} activeTag Tag name
   * @returns {{ filteredTree: Array, matchCount: number }}
   */
  filterBookmarkTree(tree, activeTag) {
    if (!activeTag) {
      return { filteredTree: tree, matchCount: 0 };
    }

    let matchCount = 0;

    const cloneNode = (node, children = null) => ({
      ...node,
      ...(children !== null ? { children } : {})
    });

    const filterNode = (node, isRoot = false) => {
      if (node.url) {
        const processed = tagManager.processBookmark(node);
        const matched = processed.tags.includes(activeTag);
        if (matched) {
          matchCount++;
          return cloneNode(node);
        }
        return null;
      }

      if (node.children && node.children.length > 0) {
        const filteredChildren = [];
        node.children.forEach(child => {
          const filteredChild = filterNode(child, false);
          if (filteredChild) {
            filteredChildren.push(filteredChild);
          }
        });

        if (filteredChildren.length > 0 || isRoot) {
          return cloneNode(node, filteredChildren);
        }

        return isRoot ? cloneNode(node, []) : null;
      }

      return isRoot ? cloneNode(node) : null;
    };

    const filteredTree = tree
      .map((node, index) => filterNode(node, index === 0))
      .filter(Boolean);

    return { filteredTree, matchCount };
  }

  /*** Show loading state
   */
  showLoading() {
    this.uiStateManager.showLoading();
  }

  /*** Show error message
   */
  showErrorMessage() {
    this.uiStateManager.showError('An error occurred while loading bookmarks');
  }

  /*** Show disabled message
   */
  showDisabledMessage() {
    this.uiStateManager.showDisabledMessage();
  }

  /*** Remove a bookmark item from the UI
   * @param {string} bookmarkId Bookmark ID to remove
   */
  removeBookmarkItem(bookmarkId) {
    this.bookmarkRenderer.removeBookmarkItem(bookmarkId);
  }

  /*** Update a bookmark item in the UI
   * @param {Object} bookmark Bookmark data
   */
  updateBookmarkItem(bookmark) {
    this.bookmarkRenderer.updateBookmarkItem(bookmark);
  }

  /*** Show drag guide for new users
   */
  showDragGuide() {
    this.uiStateManager.showDragGuide();
  }

  /*** Handle tag click events
   * @param {string} tag Tag name
   * @param {Event} event Click event
   */
  handleTagClick(tag) {
    if (this.activeTag === tag) {
      this.clearTagFilter();
    } else {
      this.applyTagFilter(tag);
    }
  }

  /*** Handle tag filter toggles
   * @param {string|null} tag Selected tag or null when clearing
   */
  handleTagFilterToggle(tag) {
    if (!tag || tag === this.activeTag) {
      this.clearTagFilter();
    } else {
      this.applyTagFilter(tag);
    }
  }

  /*** Apply tag filter and re-render
   * @param {string} tag Tag name
   */
  applyTagFilter(tag) {
    if (!tag) return;
    this.activeTag = tag;
    this.renderKanban();
  }

  /*** Clear tag filter and re-render
   */
  clearTagFilter() {
    if (this.activeTag === null) return;
    this.activeTag = null;
    this.renderKanban();
  }

  /*** Collect tags from bookmark tree to warm caches
   * @param {Array} nodes Bookmark tree nodes
   */
  collectTags(nodes) {
    if (!nodes) return;
    const traverse = (items) => {
      items.forEach(item => {
        if (item.url) {
          tagManager.processBookmark(item);
        }
        if (item.children) {
          traverse(item.children);
        }
      });
    };
    traverse(nodes);
  }

  /*** Render tag filter UI
   * @param {Array} availableTags Available tag names
   * @returns {HTMLElement|null} Rendered filter element
   */
  renderTagFilter(availableTags) {
    if (!availableTags || availableTags.length === 0) {
      return null;
    }

    if (!this.tagFilterContainer) {
      this.tagFilterContainer = document.createElement('div');
      this.tagFilterContainer.id = 'tag-filter-container';
      this.tagFilterContainer.className = 'tag-filter-container';
    }

    this.tagFilterContainer.innerHTML = '';

    const filterElement = tagRenderer.createTagFilter(
      availableTags,
      this.activeTag ? [this.activeTag] : []
    );

    this.tagFilterContainer.appendChild(filterElement);
    return this.tagFilterContainer;
  }

  /*** Create empty state element
   * @returns {HTMLElement}
   */
  createEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No bookmarks available.';
    return empty;
  }

  createTagEmptyState(tag) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tag-filter-empty';
    wrapper.textContent = `No bookmarks found with tag #${tag}`;
    return wrapper;
  }
} 
