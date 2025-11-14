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
    let bookmarkId = null;
    let newFolderId = null;
    let newIndex;

    try {
        bookmarkId = evt.item.dataset.bookmarkId;
        const targetColumn = evt.to.closest('.kanban-column');

        // 1. Assign rollback data *before* any potential failure
        rollbackItem = evt.item;
        rollbackFrom = evt.from;

        // 2. Validate inputs
        if (!bookmarkId || !targetColumn) {
            throw new Error('Invalid bookmark or target column.');
        }

        if (targetColumn.dataset.columnType === 'uncategorized') {
            newFolderId = '1';
        } else {
            newFolderId = targetColumn.dataset.folderId;
        }

        // 3. Get the index with robust logic that ignores empty state elements
        let newIndex;

        // Check if target column is truly empty (only has placeholders, not actual bookmarks)
        const targetBookmarkItems = Array.from(evt.to.children).filter(child =>
            child.classList.contains('bookmark-item') && child.dataset && child.dataset.bookmarkId
        );
        const onlyDraggedItemInTarget = targetBookmarkItems.length === 1 &&
          targetBookmarkItems[0].dataset.bookmarkId === bookmarkId;
        const isTargetEmpty = targetBookmarkItems.length === 0;

        console.log(`🔍 Empty column check: ${isTargetEmpty}, items found: ${targetBookmarkItems.length}`);

        if (isTargetEmpty || onlyDraggedItemInTarget) {
            // Empty column: always use index 0 for first bookmark
            newIndex = 0;
        } else {
            // Non-empty column: use Sortable's index or calculate position
            if (evt.newIndex !== undefined && evt.newIndex >= 0) {
                // Prefer Sortable's index when available
                newIndex = evt.newIndex;
                console.log('📐 Using Sortable index:', evt.newIndex);
            } else {
                // Calculate position based on dragged element among actual bookmarks
                const draggedElement = targetBookmarkItems.find(child =>
                    child.dataset.bookmarkId === bookmarkId
                );

                if (draggedElement) {
                    const allBookmarkItems = Array.from(evt.to.children).filter(child =>
                        child.classList.contains('bookmark-item') && child.dataset && child.dataset.bookmarkId
                    );
                    newIndex = allBookmarkItems.indexOf(draggedElement);
                    console.log('🔍 Calculated index:', newIndex);
                } else {
                    // Fallback: insert at end
                    newIndex = targetBookmarkItems.length;
                    console.log('🔍 Using fallback index (end):', newIndex);
                }
            }
        }

        // Final validation and debug
        if (newIndex === undefined || newIndex < 0) {
            console.error('Index calculation failed:', {
                bookmarkId,
                targetColumnId: targetColumn.dataset?.folderId,
                evtNewIndex: evt.newIndex,
                calculatedNewIndex: newIndex,
                targetChildrenCount: evt.to.children.length,
                isEmptyColumn: this.isColumnEmpty(evt.to)
            });
            throw new Error('Invalid bookmark position calculated');
        }

        // 4. Log debug information and execute the move
        const targetChildren = Array.from(evt.to.children);
        const actualBookmarks = targetChildren.filter(child => child.classList.contains('bookmark-item') && child.dataset.bookmarkId);
        const isEmptyColumn = actualBookmarks.length === 0;

        console.log(`🎯 Attempting to move bookmark: ${bookmarkId}`);
        console.log(`📁 Target folder ID: ${newFolderId}`);
        console.log(`📍 Calculated index: ${newIndex}`);
        console.log(`🧪 Target column children count: ${evt.to.children.length}`);
        console.log(`📚 Actual bookmark items count: ${actualBookmarks.length}`);
        console.log(`🔍 Is column empty: ${isEmptyColumn}`);
        console.log(`🔍 Target column children:`, targetChildren.map((child, idx) => ({
            index: idx,
            element: child.tagName.toLowerCase(),
            bookmarkId: child.dataset?.bookmarkId,
            className: child.className,
            isBookmarkItem: child.classList.contains('bookmark-item'),
            isTarget: child.dataset?.bookmarkId === bookmarkId,
            textContent: child.textContent?.substring(0, 30) + (child.textContent?.length > 30 ? '...' : '')
        })));

        // Add debug check for target folder validity
        console.log('🔎 Calling Chrome bookmarks API...');
        console.log('🎯 Target column analysis:', {
            totalChildren: evt.to.children.length,
            childrenDetails: Array.from(evt.to.children).map(child => ({
                class: child.className,
                text: child.textContent?.trim(),
                isBookmark: child.classList.contains('bookmark-item') && child.dataset?.bookmarkId
            }))
        });

        await this.bookmarkManager.moveBookmark(bookmarkId, {
            parentId: newFolderId,
            index: newIndex
        });

        this.updateColumnCount(evt.from);
        if (evt.to !== evt.from) {
            this.updateColumnCount(evt.to);
        }

        console.log('✅ Bookmark moved successfully in Chrome.');
        this.removeEmptyStatePlaceholder(evt.to);
        this.ensureEmptyStatePlaceholder(evt.from);

    } catch (error) {
        console.error('❌ Failed to move bookmark:', error);
        console.error('❌ Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            bookmarkId: bookmarkId,
            targetFolder: newFolderId,
            targetIndex: newIndex,
            columnChildren: Array.from(evt.to.children).map(child => ({
                class: child.className,
                text: child.textContent?.trim(),
                isBookmark: child.classList.contains('bookmark-item') && child.dataset?.bookmarkId
            }))
        });

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
  /*** Check if a column is truly empty (contains actual bookmark items)
   * @param {HTMLElement} columnElement Column element to check
   * @returns {boolean} True if column has no bookmark items
   */
isColumnEmpty(columnElement) {
  if (!columnElement) {
    return true;
  }

  const bookmarkList = columnElement.querySelector('.bookmark-list');
  if (!bookmarkList) {
    return true;
  }

  // Count actual bookmark items (exclude placeholders, dividers, empty states, etc.)
  const actualBookmarks = Array.from(bookmarkList.children).filter(child => {
    return child.classList.contains('bookmark-item') &&
           child.dataset &&
           child.dataset.bookmarkId &&
           child.dataset.bookmarkId !== '' &&
           child.dataset.bookmarkId !== undefined;
  });

  return actualBookmarks.length === 0;
}

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

  ensureEmptyStatePlaceholder(listElement) {
    if (!listElement) {
      return;
    }
    const hasBookmarkItems = listElement.querySelector('.bookmark-item');
    if (hasBookmarkItems) {
      this.removeEmptyStatePlaceholder(listElement);
      return;
    }
    if (!listElement.querySelector('.empty-column')) {
      const placeholder = document.createElement('div');
      placeholder.className = 'empty-column';
      placeholder.textContent = 'No bookmarks';
      listElement.appendChild(placeholder);
    }
  }

  removeEmptyStatePlaceholder(listElement) {
    if (!listElement) {
      return;
    }
    const empty = listElement.querySelector('.empty-column');
    if (empty) {
      empty.remove();
    }
  }

  updateColumnCount(listElement) {
    if (!listElement) {
      return;
    }
    const column = listElement.closest('.kanban-column');
    if (!column) {
      return;
    }
    const countElement = column.querySelector('.column-count');
    if (!countElement) {
      return;
    }
    const totalBookmarks = column.querySelectorAll('.bookmark-item').length;
    countElement.textContent = totalBookmarks.toString();
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
