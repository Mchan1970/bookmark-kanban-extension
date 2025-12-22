/*** Display Manager Class
 * Handles bookmark display mode (single/double line)
 */
export class DisplayManager {
  constructor() {
    this.STORAGE_KEY = 'bookmark_board_display_mode';
    this.DEFAULT_MODE = 'double';
    this.availableModes = ['single', 'double', 'full'];
    this.currentMode = this.DEFAULT_MODE;
    this.initializeDisplayMode();
  }

  /*** Initialize display mode settings
   */
  async initializeDisplayMode() {
    try {
      //Get saved display mode settings
      const savedMode = await this.getSavedMode();
      
      //Apply mode
      if (savedMode && this.availableModes.includes(savedMode)) {
        this.currentMode = savedMode;
      }
      
      this.applyDisplayMode(this.currentMode);
      
      //Initialize display mode selector if available
      this.initializeSelector();
    } catch (error) {
      console.error('Failed to initialize display mode:', error);
      //In case of error, apply default mode
      this.applyDisplayMode(this.DEFAULT_MODE);
    }
  }

  /*** Initialize display mode selector
   */
  initializeSelector() {
    const selector = document.getElementById('display-mode-selector');
    if (!selector) return;
    
    //Set current mode
    selector.value = this.currentMode;
    
    //Add change event listener
    selector.addEventListener('change', (e) => {
      this.switchDisplayMode(e.target.value);
    });
  }

  /*** Get saved display mode settings
   */
  getSavedMode() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([this.STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to get display mode settings:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(result[this.STORAGE_KEY] || null);
        }
      });
    });
  }

  /*** Save display mode settings
   * @param {string} mode Display mode name
   */
  saveDisplayMode(mode) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [this.STORAGE_KEY]: mode }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save display mode settings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /*** Apply display mode
   * @param {string} mode Display mode name
   */
  applyDisplayMode(mode) {
    if (!this.availableModes.includes(mode)) {
      console.warn(`Unknown display mode: ${mode}, using default mode`);
      mode = this.DEFAULT_MODE;
    }
    
    //Set data attribute on body
    document.body.setAttribute('data-display-mode', mode);
    
    //Update URL attribute for bookmark items in single-line mode
    if (mode === 'single') {
      this.updateBookmarkUrlAttributes();
    }
    
    this.currentMode = mode;
  }

  /*** Update bookmark items with URL attribute for tooltip
   */
  updateBookmarkUrlAttributes() {
    document.querySelectorAll('.bookmark-item').forEach(item => {
      const domainElement = item.querySelector('.bookmark-domain');
      if (domainElement) {
        const url = domainElement.textContent;
        item.setAttribute('data-url', url);
      }
    });
  }

  /*** Switch display mode
   * @param {string} mode Display mode name
   */
  async switchDisplayMode(mode) {
    try {
      this.applyDisplayMode(mode);
      await this.saveDisplayMode(mode);
      return true;
    } catch (error) {
      console.error('Failed to switch display mode:', error);
      return false;
    }
  }

  /*** Get current display mode
   * @returns {string} Current display mode name
   */
  getCurrentDisplayMode() {
    return this.currentMode;
  }

  /*** Get available display modes list
   * @returns {Array} Available display modes array
   */
  getAvailableDisplayModes() {
    return [...this.availableModes];
  }
}

//Export singleton
export const displayManager = new DisplayManager(); 
