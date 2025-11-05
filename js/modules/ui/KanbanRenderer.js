import { storageManager } from '../storageManager.js';

export class KanbanRenderer {
  constructor(bookmarkManager, columnManager, bookmarkRenderer) {
    this.bookmarkManager = bookmarkManager;
    this.columnManager = columnManager;
    this.bookmarkRenderer = bookmarkRenderer;
  }

  /**
   * Render the entire kanban board
   * @param {HTMLElement} container The container to render the board into
   */
  async renderBoard(container, bookmarkTree = null, options = {}) {
    const { activeTag = null } = options;

    // Clear container
    container.innerHTML = '';
    
    // Create kanban board
    const kanbanBoard = document.createElement('div');
    kanbanBoard.className = 'kanban-board';
    container.appendChild(kanbanBoard);

    // Determine bookmark tree data
    let treeData = bookmarkTree;
    if (!treeData) {
      treeData = await this.bookmarkManager.getBookmarkTree();
    }
    
    // Get saved column order
    const savedColumnOrder = await storageManager.getColumnOrder();
    
    // Get saved bookmark order
    const savedBookmarkOrder = await storageManager.getBookmarkOrder();
    
    if (treeData && treeData.length > 0) {
      // Process bookmark tree and apply saved order
      await this.processBookmarkTree(treeData[0], kanbanBoard, savedColumnOrder, savedBookmarkOrder);
    }
  }

  /**
   * Process bookmark tree and apply saved order
   */
  async processBookmarkTree(node, container, savedColumnOrder, savedBookmarkOrder) {
    if (!node.children) return;
    
    // Prepare all column data without immediate rendering
    const columnsData = [];
    
    // Find bookmark bar
    const bookmarkBar = node.children.find(child => child.id === '1');
    if (bookmarkBar) {
      // Process folders in bookmark bar
      bookmarkBar.children.forEach(child => {
        if (child.children) { // Is a folder
          columnsData.push({
            type: 'folder',
            data: child
          });
        }
      });
      
      // Create an "Uncategorized" column for direct bookmarks in bookmark bar
      const uncategorizedBookmarks = bookmarkBar.children.filter(child => child.url);
      if (uncategorizedBookmarks.length > 0) {
        columnsData.push({
          type: 'uncategorized',
          title: 'Uncategorized',
          data: uncategorizedBookmarks
        });
      }
    }
    
    // Process "Other Bookmarks"
    const otherBookmarks = node.children.find(child => child.id === '2');
    if (otherBookmarks) {
      columnsData.push({
        type: 'special',
        data: otherBookmarks
      });
    }
    
    // Process "Mobile Bookmarks"
    const mobileBookmarks = node.children.find(child => child.id === '3');
    if (mobileBookmarks) {
      columnsData.push({
        type: 'special',
        data: mobileBookmarks
      });
    }
    
    // Determine which columns to render and in what order
    const orderedColumns = this.determineColumnOrder(columnsData, savedColumnOrder);
    
    // Render ordered columns
    orderedColumns.forEach(col => {
      this.renderColumn(col, container, savedBookmarkOrder);
    });
  }
  
  /**
   * Determine column order based on saved order
   */
  determineColumnOrder(columnsData, savedColumnOrder) {
    // If no saved order, return original order
    if (!savedColumnOrder || savedColumnOrder.length === 0) {
      return [...columnsData];
    }
    
    // Arrange columns according to saved order
    const orderedColumns = [];
    
    // First find all matching columns
    savedColumnOrder.forEach(columnId => {
      let matchColumn;
      
      if (columnId === 'uncategorized') {
        // Handle uncategorized column
        matchColumn = columnsData.find(col => col.type === 'uncategorized');
      } else {
        // Handle regular folders and special folders
        matchColumn = columnsData.find(col => {
          if (col.type === 'folder') return col.data.id === columnId;
          if (col.type === 'special') return col.data.id === columnId;
          return false;
        });
      }
      
      if (matchColumn) {
        orderedColumns.push(matchColumn);
      }
    });
    
    // Add columns not in saved order
    columnsData.forEach(col => {
      let columnId;
      
      if (col.type === 'uncategorized') {
        columnId = 'uncategorized';
      } else if (col.type === 'folder' || col.type === 'special') {
        columnId = col.data.id;
      }
      
      if (columnId && !savedColumnOrder.includes(columnId)) {
        orderedColumns.push(col);
      } else if (!columnId) {
        // Handle special columns without IDs
        orderedColumns.push(col);
      }
    });
    
    return orderedColumns;
  }
  
  /**
   * Render a single column
   */
  renderColumn(columnData, container, savedBookmarkOrder) {
    switch(columnData.type) {
      case 'folder':
        this.columnManager.renderFolderColumn(columnData.data, container, savedBookmarkOrder);
        break;
      case 'uncategorized':
        this.columnManager.renderSpecialColumn(
          columnData.title, 
          columnData.data, 
          container, 
          null, 
          'uncategorized',
          savedBookmarkOrder
        );
        break;
      case 'special':
        this.columnManager.renderSpecialColumn(
          columnData.data.title, 
          columnData.data.children || [], 
          container, 
          columnData.data.id,
          'special',
          savedBookmarkOrder
        );
        break;
    }
  }
} 
