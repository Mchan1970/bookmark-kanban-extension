//js/modules/commandPalette.js

import { createElement } from './utils.js';

/*** Command Palette - VS Code style quick search
 */
export class CommandPalette {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
    this.isVisible = false;
    this.allBookmarks = [];
    this.filteredBookmarks = [];
    this.selectedIndex = 0;
    this.initialized = false;
    this.boundKeydownHandler = this.handleGlobalKeydown.bind(this);
  }

  /*** Initialize command palette
   */
  async initialize() {
    if (this.initialized) return;
    
    //Create DOM elements
    await this.createPalette();
    
    //Setup event listeners
    this.setupEventListeners();
    
    this.initialized = true;
  }

  /*** Create command palette DOM elements
   */
  async createPalette() {
    //Create overlay
    this.overlay = createElement('div', 'command-palette-overlay');
    
    //Create palette container
    this.palette = createElement('div', 'command-palette');
    
    //Create search input
    this.input = createElement('input', 'command-input');
    this.input.type = 'text';
    this.input.placeholder = 'Search bookmarks...';
    this.input.setAttribute('spellcheck', 'false');
    
    //Create results container
    this.results = createElement('div', 'command-results');
    
    //Create shortcuts help
    this.shortcuts = createElement('div', 'command-shortcuts');
    this.shortcuts.innerHTML = `
      <div class="command-shortcut">
        <span class="command-key">↑↓</span>
        <span>Navigate</span>
      </div>
      <div class="command-shortcut">
        <span class="command-key">Enter</span>
        <span>Open</span>
      </div>
      <div class="command-shortcut">
        <span class="command-key">Tab</span>
        <span>Focus</span>
      </div>
      <div class="command-shortcut">
        <span class="command-key">Esc</span>
        <span>Close</span>
      </div>
    `;
    
    //Assemble palette
    this.palette.appendChild(this.input);
    this.palette.appendChild(this.results);
    this.palette.appendChild(this.shortcuts);
    this.overlay.appendChild(this.palette);
    
    //Add to DOM
    document.body.appendChild(this.overlay);
  }

  /*** Setup event listeners
   */
  setupEventListeners() {
    //Input events
    this.input.addEventListener('input', () => this.handleSearch());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    //Overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
    
    //Add global keyboard shortcut
    document.addEventListener('keydown', this.boundKeydownHandler);
  }

  /*** Handle global keyboard shortcuts
   */
  handleGlobalKeydown(e) {
    //Cmd/Ctrl + Shift + P to show
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      this.toggle();
    }
    
    //Esc to hide
    if (e.key === 'Escape' && this.isVisible) {
      e.preventDefault();
      this.hide();
    }
  }

  /*** Toggle command palette visibility
   */
  async toggle() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  async quickSearch(query = '') {
    await this.toggleIfHidden();
    if (typeof query === 'string') {
      this.input.value = query;
      this.handleSearch();
    }
  }

  async toggleIfHidden() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isVisible) {
      await this.show();
    }
  }

  /*** Show command palette
   */
  async show() {
    if (this.isVisible) return;
    
    //Load bookmarks
    await this.loadBookmarks();
    
    //Show palette
    this.overlay.classList.add('active');
    this.isVisible = true;
    
    //Focus input
    setTimeout(() => {
      this.input.focus();
    }, 50);

    //Reset state
    this.input.value = '';
    this.filteredBookmarks = [];
    this.selectedIndex = 0;
    this.renderResults();
  }

  /*** Hide command palette
   */
  hide() {
    this.overlay.classList.remove('active');
    this.isVisible = false;
    this.input.blur();
  }

  /*** Load所有Bookmark
   */
  async loadBookmarks() {
    try {
      const tree = await this.bookmarkManager.getBookmarkTree();
      this.allBookmarks = [];
      this.extractBookmarks(tree[0]);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  }

  /*** 递归提取Bookmark
   * @param {Object} node Bookmark节点
   * @param {Array} path When前路径
   */
  extractBookmarks(node, path = []) {
    if (!node) return;
    
    const currentPath = [...path];
    if (node.title) {
      currentPath.push(node.title);
    }
    
    if (node.url) {
      this.allBookmarks.push({
        id: node.id,
        title: node.title || '',
        url: node.url,
        path: currentPath.slice(0, -1),
        parentId: node.parentId
      });
    }
    
    if (node.children) {
      node.children.forEach(child => {
        this.extractBookmarks(child, currentPath);
      });
    }
  }

  /*** HandleSearch输入
   */
  handleSearch() {
    const query = this.input.value.toLowerCase().trim();
    
    if (!query) {
      this.filteredBookmarks = [];
      this.renderResults();
      return;
    }
    
    //Filter bookmarks
    this.filteredBookmarks = this.allBookmarks.filter(bookmark => {
      const titleMatch = bookmark.title.toLowerCase().includes(query);
      const urlMatch = bookmark.url.toLowerCase().includes(query);
      return titleMatch || urlMatch;
    });
    
    //Sort results (title matches first)
    this.filteredBookmarks.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aInTitle = aTitle.includes(query);
      const bInTitle = bTitle.includes(query);
      
      if (aInTitle && !bInTitle) return -1;
      if (!aInTitle && bInTitle) return 1;
      
      //If both match title or both don't, sort by title
      return aTitle.localeCompare(bTitle);
    });
    
    //Reset selection
    this.selectedIndex = this.filteredBookmarks.length > 0 ? 0 : -1;
    
    //Render results
    this.renderResults();
  }

  /*** HandleKey盘导航
   * @param {KeyboardEvent} e Key盘Event
   */
  handleKeydown(e) {
    if (!this.isVisible) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.moveSelection(1);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.moveSelection(-1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.openBookmark(this.filteredBookmarks[this.selectedIndex]);
        }
        break;
        
      case 'Tab':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.locateBookmark(this.filteredBookmarks[this.selectedIndex]);
        }
        break;
    }
  }

  /*** 移动Select
   * @param {number} direction 方向 (1：向下，-1：向上)
   */
  moveSelection(direction) {
    if (this.filteredBookmarks.length === 0) return;
    
    this.selectedIndex += direction;
    
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.filteredBookmarks.length - 1;
    } else if (this.selectedIndex >= this.filteredBookmarks.length) {
      this.selectedIndex = 0;
    }
    
    this.renderResults();
    
    //Ensure selected item is visible
    const selectedElement = this.results.querySelector('.selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }

  /*** 渲染Search结果
   */
  renderResults() {
    this.results.innerHTML = '';
    
    if (this.filteredBookmarks.length === 0) {
      if (this.input.value.trim()) {
        const empty = createElement('div', 'command-empty');
        empty.textContent = '未找到匹配的书签';
        this.results.appendChild(empty);
      }
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    this.filteredBookmarks.forEach((bookmark, index) => {
      const item = createElement('div', 'command-item');
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      }
      
      const title = createElement('div', 'command-item-title');
      title.textContent = bookmark.title || '(无标题)';
      
      const url = createElement('div', 'command-item-url');
      url.textContent = bookmark.url;
      
      const path = createElement('div', 'command-item-path');
      path.textContent = bookmark.path.join(' > ') || '书签栏';
      
      item.appendChild(title);
      item.appendChild(url);
      item.appendChild(path);
      
      item.addEventListener('click', () => {
        this.openBookmark(bookmark);
      });
      
      item.addEventListener('mousemove', () => {
        this.selectedIndex = index;
        this.renderResults();
      });
      
      fragment.appendChild(item);
    });
    
    this.results.appendChild(fragment);
  }

  /*** OpenBookmark
   * @param {Object} bookmark BookmarkObject
   */
  openBookmark(bookmark) {
    window.open(bookmark.url, '_blank');
    this.hide();
  }

  /*** 定位到Bookmark
   * @param {Object} bookmark BookmarkObject
   */
  locateBookmark(bookmark) {
    const element = document.querySelector(`[data-bookmark-id="${bookmark.id}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight');
      setTimeout(() => {
        element.classList.remove('highlight');
      }, 2000);
      this.hide();
    }
  }
}
