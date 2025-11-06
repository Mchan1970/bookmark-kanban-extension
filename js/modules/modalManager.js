import { createElement } from './utils.js';

export class ModalManager {
  constructor(bookmarkManager, uiManager, app) {
    this.bookmarkManager = bookmarkManager;
    this.uiManager = uiManager;
    this.app = app;
    this.activeModal = null;
    this.initializeModals();
  }

  /*** Initialize modals
   */
  initializeModals() {
    //Create edit modal
    this.editModal = this.createEditModal();
    //Create confirm delete modal
    this.confirmModal = this.createConfirmModal();
    //Create settings modal
    this.settingsModal = document.getElementById('settingsModal');
    
    //Add to document
    document.body.appendChild(this.editModal);
    document.body.appendChild(this.confirmModal);
    
    //Bind global click event for closing modals
    document.addEventListener('click', (e) => {
      //Only close when clicking the modal background
      if (e.target.classList.contains('modal') && !e.target.closest('.modal-content')) {
        this.closeActiveModal();
      }
    });

    //Bind ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.closeActiveModal();
      }
    });
  }

  /*** Create edit modal
   * @returns {HTMLElement} Modal element
   */
  createEditModal() {
    const modal = createElement('div', 'modal');
    modal.id = 'editModal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Edit Bookmark</h2>
        <form id="editBookmarkForm">
          <div class="form-group">
            <label for="bookmarkTitle">Title</label>
            <input type="text" id="bookmarkTitle" required>
          </div>
          <div class="form-group">
            <label for="bookmarkUrl">URL</label>
            <input type="url" id="bookmarkUrl" required>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">Save</button>
          </div>
        </form>
      </div>
    `;

    //Add keyboard event handling
    const titleInput = modal.querySelector('#bookmarkTitle');
    const urlInput = modal.querySelector('#bookmarkUrl');
    
    //Prevent backspace key from triggering history navigation in input fields
    [titleInput, urlInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value) {
          e.preventDefault();
        }
      });
    });

    return modal;
  }

  /*** Create confirm delete modal
   * @returns {HTMLElement} Modal element
   */
  createConfirmModal() {
    const modal = createElement('div', 'modal');
    modal.id = 'confirmModal';
    
    modal.innerHTML = `
      <div class="modal-content confirm-content">
        <h2>Delete Bookmark</h2>
        <p class="confirm-message">Are you sure you want to delete "<span id="deleteBookmarkTitle"></span>"?</p>
        <div class="form-actions">
          <button type="button" class="btn-cancel">Cancel</button>
          <button type="button" class="btn-delete">Delete</button>
        </div>
      </div>
    `;

    return modal;
  }

  /*** Show edit modal
   * @param {Object} bookmark Bookmark data
   */
  showEditModal(bookmark) {
    const modal = this.editModal;
    const form = modal.querySelector('#editBookmarkForm');
    const titleInput = modal.querySelector('#bookmarkTitle');
    const urlInput = modal.querySelector('#bookmarkUrl');
    
    //Fill current values
    titleInput.value = bookmark.title;
    urlInput.value = bookmark.url;
    
    //Bind form submit event
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleBookmarkEdit(bookmark.id, {
        title: titleInput.value,
        url: urlInput.value
      });
    };
    
    //Bind cancel button
    modal.querySelector('.btn-cancel').onclick = () => this.closeActiveModal();
    
    this.showModal(modal);
    titleInput.focus();
  }

  /*** Show confirm delete modal
   * @param {Object} bookmark Bookmark data
   */
  showConfirmModal(bookmark) {
    const modal = this.confirmModal;
    
    //Set confirmation message
    const titleSpan = modal.querySelector('#deleteBookmarkTitle');
    titleSpan.textContent = bookmark.title;
    
    //Get button elements
    const confirmBtn = modal.querySelector('.btn-delete');
    const cancelBtn = modal.querySelector('.btn-cancel');
    
    //Remove existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    //Bind new delete event
    newConfirmBtn.addEventListener('click', async () => {
      try {
        newConfirmBtn.disabled = true;
        newConfirmBtn.textContent = 'Deleting...';
        
        //Save current scroll position
        const scrollPosition = window.scrollY;
        console.log("Delete before scroll position:", scrollPosition);
        
        //Execute delete operation
        await this.bookmarkManager.deleteBookmark(bookmark.id);
        
        //Close modal
        this.closeActiveModal();
        
        //Show success message
        this.showToast('Bookmark deleted');
        
        //Important: Stop possible global refresh
        //Use direct DOM manipulation instead of triggering a full refresh
        const bookmarkItem = document.querySelector(`[data-bookmark-id="${bookmark.id}"]`);
        if (bookmarkItem) {
          bookmarkItem.style.transition = 'opacity 0.3s ease';
          bookmarkItem.style.opacity = '0';
          
          setTimeout(() => {
            //Remove element after fade out
            bookmarkItem.remove();
            
            //Update bookmark order storage
            if (window.app && window.app.dragManager) {
              window.app.dragManager.saveBookmarkOrder();
            }
            
            //More reliably restore scroll position - use multiple attempts to ensure success
            //Try immediately once
            //Then try a few more times to ensure success
            //Finally use requestAnimationFrame to ensure restoration after rendering
            const restoreScroll = () => {
              console.log("Try to restore scroll position:", scrollPosition);
              window.scrollTo(0, scrollPosition);
            };
            
            //Immediately try once
            restoreScroll();
            
            //Then try a few more times to ensure success
            setTimeout(restoreScroll, 50);
            setTimeout(restoreScroll, 150);
            
            //Finally use requestAnimationFrame to ensure restoration after rendering
            setTimeout(() => {
              requestAnimationFrame(restoreScroll);
            }, 300);
          }, 300);
        }
        
      } catch (error) {
        console.error('Failed to delete bookmark:', error);
        this.showToast('Failed to delete bookmark: ' + (error.message || 'Unknown error'), 'error');
      } finally {
        if (newConfirmBtn) {
          newConfirmBtn.disabled = false;
          newConfirmBtn.textContent = 'Delete';
        }
      }
    });
    
    //Bind cancel event
    newCancelBtn.addEventListener('click', () => {
      this.closeActiveModal();
    });
    
    //Show modal
    this.showModal(modal);
  }

  /*** Show settings modal
   */
  showSettingsModal() {
    const modal = this.settingsModal;
    
    //Ensure current settings are reflected
    if (window.app) {
      //Theme selector
      const themeSelector = modal.querySelector('#theme-selector');
      if (themeSelector && window.app.themeManager) {
        themeSelector.value = window.app.themeManager.getCurrentTheme();
      }
      
      //Display mode selector
      const displayModeSelector = modal.querySelector('#display-mode-selector');
      if (displayModeSelector && window.app.displayManager) {
        displayModeSelector.value = window.app.displayManager.getCurrentDisplayMode();
      }
    }
    
    //Bind events if not already bound
    this.bindSettingsEvents(modal);
    
    //Show modal
    this.showModal(modal);
  }
  
  /*** Bind settings modal events
   * @param {HTMLElement} modal Settings modal element
   */
  bindSettingsEvents(modal) {
    //Theme selector
    const themeSelector = modal.querySelector('#theme-selector');
    if (themeSelector && !themeSelector.dataset.bound) {
      themeSelector.addEventListener('change', (e) => {
        if (window.app && window.app.themeManager) {
          window.app.themeManager.switchTheme(e.target.value);
        }
      });
      themeSelector.dataset.bound = 'true';
    }
    
    //Display mode selector
    const displayModeSelector = modal.querySelector('#display-mode-selector');
    if (displayModeSelector && !displayModeSelector.dataset.bound) {
      displayModeSelector.addEventListener('change', (e) => {
        if (window.app && window.app.displayManager) {
          window.app.displayManager.switchDisplayMode(e.target.value);
        }
      });
      displayModeSelector.dataset.bound = 'true';
    }
    
    //Refresh bookmarks button
    const refreshButton = modal.querySelector('#refresh-bookmarks');
    if (refreshButton && !refreshButton.dataset.bound) {
      refreshButton.addEventListener('click', () => {
        if (window.app && window.app.bookmarkManager) {
          this.closeActiveModal();
          window.app.bookmarkManager.refreshBookmarkTree();
          this.showToast('Bookmarks refreshed');
        }
      });
      refreshButton.dataset.bound = 'true';
    }
    
    //Reset layout button
    const resetButton = modal.querySelector('#reset-layout');
    if (resetButton && !resetButton.dataset.bound) {
      resetButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the board layout? This will restore the default order of columns and bookmarks.')) {
          if (window.app) {
            this.closeActiveModal();
            window.app.resetLayout();
          }
        }
      });
      resetButton.dataset.bound = 'true';
    }
    
    //Close button
    const closeButton = modal.querySelector('#closeSettings');
    if (closeButton && !closeButton.dataset.bound) {
      closeButton.addEventListener('click', () => {
        this.closeActiveModal();
      });
      closeButton.dataset.bound = 'true';
    }
  }

  /*** Show short notification message
   * @param {string} message Message content
   * @param {string} type Message type (info, success, error)
   */
  showToast(message, type = 'info') {
    //Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 15px';
    toast.style.backgroundColor = type === 'error' ? '#f44336' : '#4caf50';
    toast.style.color = 'white';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    
    //Add to document
    document.body.appendChild(toast);
    
    //Show animation
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    //Auto dismiss
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /*** Handle bookmark edit
   * @param {string} id Bookmark ID
   * @param {Object} changes Changes to apply
   */
  async handleBookmarkEdit(id, changes) {
    try {
      const updatedBookmark = await this.bookmarkManager.updateBookmark(id, changes);
      this.uiManager.updateBookmarkItem(updatedBookmark);
      this.closeActiveModal();
    } catch (error) {
      console.error('Failed to update bookmark:', error);
      this.showError('Failed to update bookmark, please try again');
    }
  }

  /*** Show modal
   * @param {HTMLElement} modal Modal element
   */
  showModal(modal) {
    this.activeModal = modal;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; //Prevent background scrolling
  }

  /*** Close current active modal
   */
  closeActiveModal() {
    if (this.activeModal) {
      try {
        //Reset all button states
        const buttons = this.activeModal.querySelectorAll('button');
        buttons.forEach(button => {
          button.disabled = false;
          if (button.classList.contains('btn-delete')) {
            button.textContent = 'Delete';
          }
        });
        
        this.activeModal.classList.remove('show');
        document.body.style.overflow = '';
        this.activeModal = null;
      } catch (error) {
        console.error('Error closing modal:', error);
      }
    }
  }

  /*** Show error message
   * @param {string} message Error message
   */
  showError(message) {
    //Can implement better error UI as needed
    alert(message);
  }
} 