import { createElement, getDomain } from '../utils.js';
import { faviconLoader } from '../faviconLoader.js';
import { tagRenderer } from '../tagRenderer.js';
import { tagManager } from '../tagManager.js';

export class BookmarkRenderer {
  constructor() {
    //Callbacks from outer components
    this.onBookmarkOrderChanged = null;
    this.onTagClick = null; //TagClickCallback
    this.statusProvider = null;
  }
  
  /*** Set callback for when bookmark order changes
   * @param {Function} callback Callback function
   */
  setOrderChangedCallback(callback) {
    this.onBookmarkOrderChanged = callback;
  }

  /*** Set callback for tag click events
   * @param {Function} callback Callback function
   */
  setTagClickCallback(callback) {
    this.onTagClick = callback;
    tagRenderer.setTagClickCallback(callback);
  }

  /*** Set provider for bookmark status badges
   * @param {Function} provider Function returning status key for a bookmark
   */
  setStatusProvider(provider) {
    this.statusProvider = provider;
  }

  /*** Create a bookmark item element
   * @param {Object} bookmark Bookmark data
   * @returns {HTMLElement} Bookmark item element
   */
  createBookmarkItem(bookmark) {
    const item = createElement('div', 'bookmark-item');
    item.setAttribute('data-bookmark-id', bookmark.id);
    item.setAttribute('draggable', 'true');

    //Add URL as data attribute for single-line mode tooltip
    item.setAttribute('data-url', bookmark.url);

    // Extract tag metadata for this bookmark
    const processedBookmark = tagManager.processBookmark(bookmark);

    const content = createElement('div', 'bookmark-content');

    //Create favicon container
    const faviconContainer = createElement('img', 'bookmark-favicon');
    faviconContainer.alt = '';
    faviconContainer.loading = 'lazy';

    //Create text container for title and tags
    const textContainer = createElement('div', 'bookmark-text-container');

    const tooltipText = this.buildTooltipText(processedBookmark.cleanTitle, bookmark.url);

    // Create title element (using the cleaned title)
    const title = createElement('div', 'bookmark-title');
    title.textContent = processedBookmark.cleanTitle || '(Untitled)';
    title.title = tooltipText;

    //Create tags container
    const tagsContainer = tagRenderer.createTagContainer(processedBookmark.tags, {
      size: 'small',
      clickable: true
    });

    //Create domain element
    const domain = createElement('div', 'bookmark-domain');
    domain.textContent = getDomain(bookmark.url);

    //Assemble text container
    textContainer.appendChild(title);
    if (tagsContainer) {
      textContainer.appendChild(tagsContainer);
    }
    textContainer.appendChild(domain);

    //Create menu trigger
    const menuButton = createElement('button', 'bookmark-menu-button bookmark-menu-btn');
    menuButton.type = 'button';
    menuButton.setAttribute('draggable', 'false');
    menuButton.setAttribute('aria-haspopup', 'true');
    menuButton.setAttribute('title', 'More actions');
    menuButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5" r="2"></circle>
        <circle cx="12" cy="12" r="2"></circle>
        <circle cx="12" cy="19" r="2"></circle>
      </svg>
    `;

    //Assemble content
    content.appendChild(faviconContainer);
    content.appendChild(textContainer);
    
    //Assemble item
    item.appendChild(content);
    item.appendChild(menuButton);

    // Attach tooltip info for hover (single-line + native title)
    item.setAttribute('data-tooltip', tooltipText);
    item.setAttribute('title', tooltipText);
    
    //Add click handler to open bookmark
    item.addEventListener('click', (e) => {
      if (e.defaultPrevented) {
        return;
      }
      if (e.target.closest('.bookmark-menu-button')) {
        return;
      }
      if (!e.target.closest('.bookmark-action-menu')) {
        window.open(bookmark.url, '_blank');

        // 记录访问（点击即活跃策略）
        chrome.runtime.sendMessage({
          type: 'recordVisitById',
          bookmarkId: bookmark.id
        });
      }
    });
    
    //Load favicon
    faviconLoader.prepareIconElement(faviconContainer, bookmark.url);

    //Apply status badge if available
    const status = this.statusProvider ? this.statusProvider(bookmark.id) : null;
    this.applyStatusToItem(item, status);
    
    return item;
  }
  
  /*** Update specific bookmark display
   * @param {Object} bookmark Bookmark data
   */
  updateBookmarkItem(bookmark) {
    const item = document.querySelector(`.bookmark-item[data-bookmark-id="${bookmark.id}"]`);
    if (item) {
      const processedBookmark = tagManager.processBookmark(bookmark);

      //Update dataset
      item.dataset.url = bookmark.url;

      //Update title text and tooltip
      const titleElement = item.querySelector('.bookmark-title');
      const tooltipText = this.buildTooltipText(processedBookmark.cleanTitle, bookmark.url);

      if (titleElement) {
        titleElement.textContent = processedBookmark.cleanTitle || '(Untitled)';
        titleElement.title = tooltipText;
      }

      item.setAttribute('data-tooltip', tooltipText);
      item.setAttribute('title', tooltipText);

      //Update tags
      const textContainer = item.querySelector('.bookmark-text-container');
      if (textContainer) {
        //Remove existing tags container if present
        const existingTagsContainer = textContainer.querySelector('.bookmark-tags');
        if (existingTagsContainer) {
          existingTagsContainer.remove();
        }

        //Re-insert tags container before domain
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

      //Update domain
      const domainElement = item.querySelector('.bookmark-domain');
      if (domainElement) {
        domainElement.textContent = getDomain(bookmark.url);
      }

      //Update favicon
      const faviconElement = item.querySelector('.bookmark-favicon');
      if (faviconElement) {
        faviconLoader.prepareIconElement(faviconElement, bookmark.url);
      }
    }
  }
  
  /*** Remove single bookmark element
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
        
        //Notify about order change
        if (this.onBookmarkOrderChanged) {
          this.onBookmarkOrderChanged();
        }
      }, 300);
    }
  }
  
  /*** Create empty folder message
   * @returns {HTMLElement} Message element
   */
  createEmptyMessage() {
    const empty = createElement('div', 'empty-column');
    empty.textContent = 'This folder is empty';
    return empty;
  }

  /*** Update bookmark status badge
   * @param {string} bookmarkId Bookmark ID
   * @param {string|null} status Status key
   */
  updateBookmarkStatus(bookmarkId, status) {
    const item = document.querySelector(`.bookmark-item[data-bookmark-id="${bookmarkId}"]`);
    this.applyStatusToItem(item, status);
  }

  /*** Apply status map to all currently rendered bookmarks
   * @param {Object<string,string>} statusMap Bookmark ID -> status key
   */
  applyStatusMap(statusMap = {}) {
    const items = document.querySelectorAll('.bookmark-item');
    items.forEach(item => {
      const bookmarkId = item.dataset.bookmarkId;
      const status = statusMap[bookmarkId] || null;
      this.applyStatusToItem(item, status);
    });
  }

  /*** Internal helper to apply site-status attribute
   * @param {HTMLElement|null} item Bookmark element
   * @param {string|null} status Status key (dead, cert-error, no-https)
   */
  applyStatusToItem(item, status) {
    if (!item) {
      return;
    }

    if (!status) {
      item.removeAttribute('data-site-status');
      return;
    }

    item.setAttribute('data-site-status', status);
  }

  buildTooltipText(title, url) {
    const cleanTitle = (title || '').trim();
    if (cleanTitle && url) {
      return `${cleanTitle}\n${url}`;
    }
    return cleanTitle || url || '';
  }
}
