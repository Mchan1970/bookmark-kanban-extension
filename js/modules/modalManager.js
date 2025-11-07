import { createElement } from './utils.js';
import { Modal, modalManager } from './Modal.js';
import { tagManager } from './tagManager.js';

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
    //Create settings modal using new factory
    this.settingsModal = this.createSettingsModal();

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

  /*** Create settings modal using new Modal factory
   * @returns {Modal} Settings modal instance
   */
  createSettingsModal() {
    const settingsContent = `
      <div class="settings-container">
        <div class="settings-group">
          <h3>Appearance</h3>
          <div class="form-group">
            <label for="theme-selector">Theme</label>
            <select id="theme-selector" class="theme-selector">
              <option value="default">Default (Light Blue)</option>
              <option value="dark">Dark</option>
              <option value="green">Green</option>
              <option value="purple">Purple</option>
              <option value="high-contrast">High Contrast</option>
            </select>
          </div>
          <div class="form-group">
            <label for="display-mode-selector">Display Mode</label>
            <select id="display-mode-selector" class="display-mode-selector">
              <option value="double">Double Line</option>
              <option value="single">Single Line</option>
              <option value="full">Full (wrap titles)</option>
            </select>
          </div>
          <div class="form-group form-group--toggle">
            <label class="form-switch">
              <input type="checkbox" id="favicon-visibility-toggle" checked>
              <span>Show website icons (favicons) before titles</span>
            </label>
            <p class="form-help-text">Disable for an ultra-minimal text-only layout.</p>
          </div>
        </div>
        <div class="settings-group">
          <h3>Data Management</h3>
          <div class="form-group">
            <button id="refresh-bookmarks" class="btn-secondary">Refresh Bookmarks</button>
          </div>
          <div class="form-group">
            <button id="reset-layout" class="btn-secondary">Reset Layout</button>
          </div>
        </div>
        <div class="settings-group">
          <h3>Cleanup</h3>
          <div class="form-group">
            <label for="stale-threshold-input">Stale bookmark threshold</label>
            <div class="stale-threshold-control">
              <span>Mark a bookmark as stale after</span>
              <input type="number" id="stale-threshold-input" min="7" max="3650" step="1" inputmode="numeric">
              <span>days without a visit.</span>
            </div>
            <p class="form-help-text">Changes apply immediately to Cleanup suggestions.</p>
          </div>
          <div class="form-group">
            <button id="open-archive-view" class="btn-secondary">View Archived Bookmarks</button>
          </div>
          <div class="form-group">
            <button id="open-recycle-view" class="btn-secondary">View Recycle Bin</button>
          </div>
        </div>
        <div class="settings-group">
          <h3>Advanced</h3>
          <div class="form-group">
            <label for="tag-palette-config">Custom Tag Palette (JSON)</label>
            <textarea id="tag-palette-config" class="settings-textarea" rows="5" placeholder='{"default":[{"bg":"#E3F2FD","text":"#0F172A"}]}'></textarea>
            <p class="form-help-text">Leave empty to use built-in palettes.</p>
            <button type="button" class="btn-secondary btn-inline" id="load-tag-palette-template">Insert Default Template</button>
          </div>
          <div class="form-actions form-actions--inline">
            <button type="button" class="btn-secondary" id="save-tag-palette">Save Palette</button>
            <button type="button" class="btn-secondary" id="reset-tag-palette">Reset Palette</button>
          </div>
        </div>
      </div>
    `;

    return new Modal({
      id: 'settingsModal',
      title: 'Settings',
      content: settingsContent,
      width: '500px',
      maxWidth: '90vw',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      onOpen: (modal) => {
        // Ensure current settings are reflected when modal opens
        if (window.app) {
          const themeSelector = modal.getButton('#theme-selector');
          if (themeSelector && window.app.themeManager) {
            themeSelector.value = window.app.themeManager.getCurrentTheme();
          }

          const displayModeSelector = modal.getButton('#display-mode-selector');
          if (displayModeSelector && window.app.displayManager) {
            displayModeSelector.value = window.app.displayManager.getCurrentDisplayMode();
          }
        }

        const paletteField = modal.element.querySelector('#tag-palette-config');
        if (paletteField) {
          paletteField.value = tagManager.getCustomPaletteJSON();
        }

        const staleThresholdInput = modal.element.querySelector('#stale-threshold-input');
        if (staleThresholdInput && window.app?.cleanupPreferences) {
          staleThresholdInput.value = window.app.cleanupPreferences.getCurrentThresholdDays();
        }

        const faviconToggle = modal.element.querySelector('#favicon-visibility-toggle');
        if (faviconToggle && window.app?.faviconPreferenceManager) {
          faviconToggle.checked = window.app.faviconPreferenceManager.isEnabled();
        }

        // Bind events
        this.bindSettingsEvents(modal.element);
      }
    });
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
        
        const usedRecycle = await this.trySoftDeleteBookmark(bookmark.id);
        if (usedRecycle) {
          this.closeActiveModal();
          return;
        }
        
        //Execute delete operation (fallback path without recycle)
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
    // Show the modal using the new Modal instance
    this.settingsModal.show();
  }
  
  /*** Bind settings modal events
   * @param {HTMLElement} modal Settings modal element
   */
  bindSettingsEvents(modal) {
    const closeSettings = () => {
      if (this.settingsModal) {
        this.settingsModal.close();
      } else {
        this.closeActiveModal();
      }
    };

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

    const faviconToggle = modal.querySelector('#favicon-visibility-toggle');
    if (faviconToggle && !faviconToggle.dataset.bound) {
      faviconToggle.addEventListener('change', async (event) => {
        const manager = window.app?.faviconPreferenceManager;
        if (!manager) {
          return;
        }
        const result = await manager.setPreference(event.target.checked);
        if (!result?.success) {
          this.showToast(result?.message || 'Failed to update preference', 'error');
          event.target.checked = manager.isEnabled();
        }
      });
      faviconToggle.dataset.bound = 'true';
    }
    
    //Refresh bookmarks button
    const refreshButton = modal.querySelector('#refresh-bookmarks');
    if (refreshButton && !refreshButton.dataset.bound) {
      refreshButton.addEventListener('click', () => {
        if (window.app && window.app.bookmarkManager) {
          closeSettings();
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
            closeSettings();
            window.app.resetLayout();
          }
        }
      });
      resetButton.dataset.bound = 'true';
    }

    const openArchiveView = modal.querySelector('#open-archive-view');
    if (openArchiveView && !openArchiveView.dataset.bound) {
      openArchiveView.addEventListener('click', async () => {
        closeSettings();
        await window.app?.cleanupManager?.ui?.openArchiveModal();
      });
      openArchiveView.dataset.bound = 'true';
    }

    const openRecycleView = modal.querySelector('#open-recycle-view');
    if (openRecycleView && !openRecycleView.dataset.bound) {
      openRecycleView.addEventListener('click', async () => {
        closeSettings();
        await window.app?.cleanupManager?.ui?.openRecycleModal();
      });
      openRecycleView.dataset.bound = 'true';
    }

    const savePaletteButton = modal.querySelector('#save-tag-palette');
    if (savePaletteButton && !savePaletteButton.dataset.bound) {
      savePaletteButton.addEventListener('click', async () => {
        const textarea = modal.querySelector('#tag-palette-config');
        const result = await tagManager.saveCustomPaletteConfig(textarea?.value || '');
        if (result.success) {
          this.showToast('Custom palette saved');
        } else {
          this.showToast(result.message || 'Failed to save palette', 'error');
        }
      });
      savePaletteButton.dataset.bound = 'true';
    }

    const resetPaletteButton = modal.querySelector('#reset-tag-palette');
    if (resetPaletteButton && !resetPaletteButton.dataset.bound) {
      resetPaletteButton.addEventListener('click', async () => {
        await tagManager.clearCustomPaletteConfig();
        const textarea = modal.querySelector('#tag-palette-config');
        if (textarea) {
          textarea.value = '';
        }
        this.showToast('Palette reset to defaults');
      });
      resetPaletteButton.dataset.bound = 'true';
    }

    const loadTemplateButton = modal.querySelector('#load-tag-palette-template');
    if (loadTemplateButton && !loadTemplateButton.dataset.bound) {
      loadTemplateButton.addEventListener('click', () => {
        const textarea = modal.querySelector('#tag-palette-config');
        if (textarea) {
          textarea.value = tagManager.getDefaultPaletteTemplate();
        }
      });
      loadTemplateButton.dataset.bound = 'true';
    }

    const staleThresholdInput = modal.querySelector('#stale-threshold-input');
    if (staleThresholdInput && !staleThresholdInput.dataset.bound) {
      staleThresholdInput.addEventListener('change', async (event) => {
        const preferences = window.app?.cleanupPreferences;
        if (!preferences) {
          return;
        }
        const result = await preferences.setStaleThresholdDays(event.target.value);
        if (result?.success) {
          event.target.value = result.days;
          this.showToast('Stale threshold updated');
        } else {
          this.showToast(result?.message || 'Failed to update threshold', 'error');
          event.target.value = preferences.getCurrentThresholdDays();
        }
      });
      staleThresholdInput.dataset.bound = 'true';
    }
    
    // Close button is now handled automatically by the new Modal factory
  }

  async trySoftDeleteBookmark(bookmarkId) {
    try {
      const actions = this.app?.cleanupManager?.actions;
      if (!actions?.remove) {
        return false;
      }
      await actions.remove([bookmarkId]);
      return true;
    } catch (error) {
      console.error('Failed to soft delete bookmark:', error);
      return false;
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
