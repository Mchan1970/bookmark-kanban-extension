import { createElement, getDomain } from '../utils.js';
import { faviconLoader } from '../faviconLoader.js';
import { tagRenderer } from '../tagRenderer.js';
import { tagManager } from '../tagManager.js';

export class BookmarkRenderer {
  constructor() {
    // Callbacks from outer components
    this.onBookmarkOrderChanged = null;
    this.onTagClick = null; // 标签点击回调
  }
  
  /**
   * Set callback for when bookmark order changes
   * @param {Function} callback Callback function
   */
  setOrderChangedCallback(callback) {
    this.onBookmarkOrderChanged = callback;
  }

  /**
   * Set callback for tag click events
   * @param {Function} callback Callback function
   */
  setTagClickCallback(callback) {
    this.onTagClick = callback;
    tagRenderer.setTagClickCallback(callback);
  }

  /**
   * Create a bookmark item element
   * @param {Object} bookmark Bookmark data
   * @returns {HTMLElement} Bookmark item element
   */
  createBookmarkItem(bookmark) {
    const item = createElement('div', 'bookmark-item');
    item.setAttribute('data-bookmark-id', bookmark.id);
    item.setAttribute('draggable', 'true');

    // Add URL as data attribute for single-line mode tooltip
    item.setAttribute('data-url', bookmark.url);

    // 处理书签数据，提取标签信息
    const processedBookmark = tagManager.processBookmark(bookmark);

    const content = createElement('div', 'bookmark-content');

    // Create favicon container
    const faviconContainer = createElement('div', 'bookmark-favicon');

    // Create text container for title and tags
    const textContainer = createElement('div', 'bookmark-text-container');

    // Create title element (使用清理后的标题)
    const title = createElement('div', 'bookmark-title');
    title.textContent = processedBookmark.cleanTitle || '(Untitled)';
    title.title = processedBookmark.cleanTitle || processedBookmark.url;

    // Create tags container
    const tagsContainer = tagRenderer.createTagContainer(processedBookmark.tags, {
      size: 'small',
      clickable: true
    });

    // Create domain element
    const domain = createElement('div', 'bookmark-domain');
    domain.textContent = getDomain(bookmark.url);

    // Create actions container
    const actions = createElement('div', 'bookmark-actions');

    // Assemble text container
    textContainer.appendChild(title);
    if (tagsContainer) {
      textContainer.appendChild(tagsContainer);
    }
    textContainer.appendChild(domain);

    // Create edit button
    const editButton = createElement('button', 'bookmark-action edit-btn');
    editButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    `;
    editButton.title = 'Edit';

    // Create delete button
    const deleteButton = createElement('button', 'bookmark-action delete-btn');
    deleteButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
    `;
    deleteButton.title = 'Delete';

    // Assemble actions
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    // Assemble content
    content.appendChild(faviconContainer);
    content.appendChild(textContainer);
    
    // Assemble item
    item.appendChild(content);
    item.appendChild(actions);
    
    // Add click handler to open bookmark
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.bookmark-action')) {
        window.open(bookmark.url, '_blank');
      }
    });
    
    // Load favicon
    faviconLoader.prepareIconElement(faviconContainer, bookmark.url);
    
    return item;
  }
  
  /**
   * Update specific bookmark display
   * @param {Object} bookmark Bookmark data
   */
  updateBookmarkItem(bookmark) {
    const item = document.querySelector(`.bookmark-item[data-bookmark-id="${bookmark.id}"]`);
    if (item) {
      const processedBookmark = tagManager.processBookmark(bookmark);

      // Update dataset
      item.dataset.url = bookmark.url;

      // Update title text and tooltip
      const titleElement = item.querySelector('.bookmark-title');
      if (titleElement) {
        titleElement.textContent = processedBookmark.cleanTitle || '(Untitled)';
        titleElement.title = processedBookmark.cleanTitle || processedBookmark.url;
      }

      // Update tags
      const textContainer = item.querySelector('.bookmark-text-container');
      if (textContainer) {
        // Remove existing tags container if present
        const existingTagsContainer = textContainer.querySelector('.bookmark-tags');
        if (existingTagsContainer) {
          existingTagsContainer.remove();
        }

        // Re-insert tags container before domain
        const domainElement = textContainer.querySelector('.bookmark-domain');
        const newTagsContainer = tagRenderer.createTagContainer(processedBookmark.tags, {
          size: 'small',
          clickable: true
        });

        if (newTagsContainer) {
          if (domainElement) {
            textContainer.insertBefore(newTagsContainer, domainElement);
          } else {
            textContainer.appendChild(newTagsContainer);
          }
        }
      }

      // Update domain
      const domainElement = item.querySelector('.bookmark-domain');
      if (domainElement) {
        domainElement.textContent = getDomain(bookmark.url);
      }

      // Update favicon
      const faviconElement = item.querySelector('.bookmark-favicon');
      if (faviconElement) {
        faviconLoader.prepareIconElement(faviconElement, bookmark.url);
      }
    }
  }
  
  /**
   * Remove single bookmark element
   * @param {string} bookmarkId Bookmark ID to remove
   */
  removeBookmarkItem(bookmarkId) {
    const bookmarkItem = document.querySelector(`.bookmark-item[data-bookmark-id="${bookmarkId}"]`);
    if (bookmarkItem) {
      bookmarkItem.style.transition = 'opacity 0.3s ease';
      bookmarkItem.style.opacity = '0';
      
      setTimeout(() => {
        bookmarkItem.remove();
        
        const column = bookmarkItem.closest('.kanban-column');
        if (column) {
          const count = column.querySelector('.column-count');
          const currentCount = parseInt(count.textContent) - 1;
          count.textContent = currentCount;
          
          const bookmarkList = column.querySelector('.bookmark-list');
          if (bookmarkList && bookmarkList.children.length === 0) {
            bookmarkList.innerHTML = '<div class="empty-column">No bookmarks</div>';
          }
        }
        
        // Notify about order change
        if (this.onBookmarkOrderChanged) {
          this.onBookmarkOrderChanged();
        }
      }, 300);
    }
  }
  
  /**
   * Create empty folder message
   * @returns {HTMLElement} Message element
   */
  createEmptyMessage() {
    const empty = createElement('div', 'empty-column');
    empty.textContent = 'This folder is empty';
    return empty;
  }
} 
