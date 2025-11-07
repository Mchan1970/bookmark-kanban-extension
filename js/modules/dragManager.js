//js/modules/dragManager.js
import { storageManager } from './storageManager.js';

export class DragManager {
  constructor(bookmarkManager, uiManager) {
    this.bookmarkManager = bookmarkManager;
    this.uiManager = uiManager;
    this.sortableInstances = new Map();
    this.dragTimeout = null;
    this.longPressDelay = 300; //Reduce long press delay time to increase responsiveness
    this.isDragging = false; //Add dragging state flag
  }

  /*** Initialize drag functionality
   */
  initialize() {
    console.log('Initializing drag functionality');
    //Ensure cleanup of any existing instances before initialization
    this.destroy();
    
    //Wait a short time to ensure DOM is fully rendered
    setTimeout(() => {
      this.initializeColumnDrag();
      this.initializeBookmarkDrag();
    }, 100);
  }

  /*** Initialize column drag
   */
  initializeColumnDrag() {
    const kanbanBoard = document.querySelector('.kanban-board');
    if (!kanbanBoard) {
      console.warn('Kanban board container not found');
      return;
    }

    //Modify selector to match new column structure
    const columns = kanbanBoard.querySelectorAll('.kanban-column');
    if (columns.length === 0) {
      console.warn('No kanban columns found');
      return;
    }

    console.log(`Found ${columns.length} columns`);

    try {
      //Ensure Sortable is defined
      if (typeof Sortable === 'undefined') {
        console.error('Sortable library not loaded!');
        return;
      }
      
      const columnSortable = Sortable.create(kanbanBoard, {
        animation: 150,
        draggable: '.kanban-column',
        handle: '.column-header', //Use column header as drag handle
        ghostClass: 'column-ghost',
        chosenClass: 'column-chosen',
        dragClass: 'column-drag',
        onStart: () => {
          this.isDragging = true;
        },
        onEnd: (evt) => {
          this.isDragging = false;
          //Save new column order
          this.saveColumnOrder();
        }
      });
      
      //Save instance for later cleanup
      this.sortableInstances.set('board', columnSortable);
      console.log('Successfully initialized column drag');
    } catch (error) {
      console.error('Failed to initialize column drag:', error);
    }
  }

  /*** Initialize bookmark drag
   */
  initializeBookmarkDrag() {
    //Initialize drag for each bookmark list
    const bookmarkLists = document.querySelectorAll('.bookmark-list');
    bookmarkLists.forEach(list => {
      const instance = Sortable.create(list, {
        animation: 150,
        group: 'bookmarks', //Allow dragging between columns
        draggable: '.bookmark-item',
        ghostClass: 'bookmark-ghost',
        chosenClass: 'bookmark-chosen',
        dragClass: 'bookmark-drag',
        onStart: () => {
          this.isDragging = true;
        },
        onEnd: async (evt) => {
          this.isDragging = false;
          if (evt.from !== evt.to) {
            //Handle cross-column movement
            await this.handleBookmarkMove(evt);
          }
          //Save all bookmark orders
          this.saveBookmarkOrder();
        }
      });
      
      //Save instance for later cleanup
      const folderId = list.closest('.kanban-column').dataset.folderId;
      if (folderId) {
        this.sortableInstances.set(`list-${folderId}`, instance);
      }
    });

    //Initialize drag for subfolders as well
    const subfolderGroups = document.querySelectorAll('.subfolder-group');
    subfolderGroups.forEach(group => {
      const instance = Sortable.create(group, {
        animation: 150,
        group: 'bookmarks',
        draggable: '.bookmark-item',
        ghostClass: 'bookmark-ghost',
        chosenClass: 'bookmark-chosen',
        dragClass: 'bookmark-drag',
        onEnd: () => {
          //Save all bookmark orders
          this.saveBookmarkOrder();
        }
      });
      
      //Can save subfolder drag instance if needed
      const parentFolderId = group.closest('.kanban-column').dataset.folderId;
      if (parentFolderId) {
        const subfolderId = group.querySelector('.subfolder-title')?.textContent;
        if (subfolderId) {
          this.sortableInstances.set(`subfolder-${parentFolderId}-${subfolderId}`, instance);
        }
      }
    });
  }


  /*** Handle bookmark movement
   * @param {Event} evt Drag event object
   */
  async handleBookmarkMove(evt) {
    let rollbackItem = null;
    let rollbackFrom = null;

    try {
        const bookmarkId = evt.item.dataset.bookmarkId;
        const targetColumn = evt.to.closest('.kanban-column');

        // 1. Assign rollback data *before* any potential failure
        rollbackItem = evt.item;
        rollbackFrom = evt.from;

        // 2. Validate inputs
        if (!bookmarkId || !targetColumn) {
            throw new Error('Invalid bookmark or target column.');
        }

        let newFolderId;
        if (targetColumn.dataset.columnType === 'uncategorized') {
            newFolderId = '1';
        } else {
            newFolderId = targetColumn.dataset.folderId;
        }

        // 3. Get the index DIRECTLY from the event. This is the correct fix.
        const newIndex = evt.newIndex;

        if (newIndex === undefined || newIndex < 0) {
             throw new Error('Could not determine new bookmark position.');
        }

        // 4. Log and execute the move
        console.log(`Moving bookmark: ${bookmarkId} to folder: ${newFolderId} at index: ${newIndex}`);

        await this.bookmarkManager.moveBookmark(bookmarkId, {
            parentId: newFolderId,
            index: newIndex
        });

        console.log('✅ Bookmark moved successfully in Chrome.');

    } catch (error) {
        console.error('❌ Failed to move bookmark:', error);

        // 5. Execute UI rollback on failure
        this.rollbackBookmarkMove(rollbackItem, rollbackFrom, evt.oldIndex);

        // 6. Show error message
        this.showErrorMessage(`Error moving bookmark: ${error.message}`);
    }
  }

  /**
   * Rolls back the UI change if the API call fails.
   * @param {HTMLElement} item - The element that was dragged.
   * @param {HTMLElement} from - The original list element.
   * @param {number} oldIndex - The original index in the 'from' list.
   */
  rollbackBookmarkMove(item, from, oldIndex) {
    if (!item || !from) {
      console.warn('Cannot rollback: missing item or source container');
      return;
    }

    try {
      // Remove from new parent (if it's still there)
      if (item.parentNode) {
        item.parentNode.removeChild(item);
      }

      // Re-insert into old parent at the correct index
      const referenceNode = from.children[oldIndex];
      from.insertBefore(item, referenceNode);

      console.log('✅ UI rollback completed.');
    } catch (rollbackError) {
      console.error('❌ Failed to rollback UI:', rollbackError);
      // At this point, a full UI refresh might be needed
    }
  }

  /**
   * Show error message to user
   * @param {string} message Error message
   */
  showErrorMessage(message) {
    // 创建简单的错误提示
    const errorToast = document.createElement('div');
    errorToast.className = 'error-toast';
    errorToast.textContent = message;
    errorToast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(errorToast);

    // 3秒后自动移除
    setTimeout(() => {
      if (errorToast.parentNode) {
        errorToast.parentNode.removeChild(errorToast);
      }
    }, 3000);
  }

  /*** Save column order
   */
  saveColumnOrder() {
    const columns = document.querySelectorAll('.kanban-board > .kanban-column');
    if (columns.length === 0) return;
    
    //Use storageManager to save column order
    storageManager.saveColumnOrder(columns);
  }

  /*** Save bookmark order
   */
  saveBookmarkOrder() {
    //Use storageManager to collect and save bookmark order
    const bookmarkOrders = storageManager.collectBookmarkOrderFromDOM();
    storageManager.saveBookmarkOrder(bookmarkOrders);
  }

  /*** Destroy all drag instances
   */
  destroy() {
    console.log('Destroying drag instances');
    this.sortableInstances.forEach((instance, key) => {
      if (instance && typeof instance.destroy === 'function') {
        try {
          instance.destroy();
          console.log(`Successfully destroyed instance: ${key}`);
        } catch (error) {
          console.error(`Failed to destroy instance ${key}:`, error);
        }
      }
    });
    this.sortableInstances.clear();
    
    //Ensure cleanup of any remaining states
    document.body.classList.remove('dragging');
    const beingDragged = document.querySelectorAll('.being-dragged');
    beingDragged.forEach(el => el.classList.remove('being-dragged'));
    
    this.isDragging = false;
  }
  
  /*** Reinitialize drag functionality
   * Call this method after drag completion to resolve refresh issues
   */
  reinitialize() {
    console.log('Reinitializing drag functionality');
    //Ensure cleanup of old instances
    this.destroy();
    
    //Short delay to ensure DOM is updated
    setTimeout(() => {
      this.initialize();
    }, 100);
  }
}