//js/modules/themeManager.js

/*** Theme Manager Class
 * Handles theme switching and persistence
 */
export class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'bookmark_board_theme';
    this.DEFAULT_THEME = 'default';
    this.availableThemes = ['default', 'dark', 'green', 'purple', 'high-contrast'];
    this.currentTheme = this.DEFAULT_THEME;
    this.listeners = new Set();
    this._hasAppliedInitialTheme = false;
    this.initializeTheme();
  }

  /*** Initialize theme settings
   */
  async initializeTheme() {
    try {
      //Get saved theme settings
      const savedTheme = await this.getSavedTheme();

      //Apply theme with validation
      if (savedTheme && this.availableThemes.includes(savedTheme)) {
        this.currentTheme = savedTheme;
      } else {
        //If saved theme is invalid, clean it up and use system preference
        if (savedTheme && !this.availableThemes.includes(savedTheme)) {
          console.warn(`Invalid theme "${savedTheme}" found in storage, clearing and using default`);
          await this.clearInvalidTheme();
        }

        //Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.currentTheme = prefersDark ? 'dark' : 'default';
      }

      this.applyTheme(this.currentTheme);

      //Set up system theme change listener
      this.setupSystemThemeListener();
    } catch (error) {
      console.error('Failed to initialize theme:', error);
      //In case of error, apply default theme
      this.applyTheme(this.DEFAULT_THEME);
    }
  }

  /*** Get saved theme settings
   */
  getSavedTheme() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([this.STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to get theme settings:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(result[this.STORAGE_KEY] || null);
        }
      });
    });
  }

  /*** Clear invalid theme from storage
   */
  async clearInvalidTheme() {
    return new Promise((resolve) => {
      chrome.storage.sync.remove(this.STORAGE_KEY, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to clear invalid theme:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  /*** Save theme settings
   * @param {string} theme  Theme name
   */
  saveTheme(theme) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [this.STORAGE_KEY]: theme }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save theme settings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /*** Apply theme
   * @param {string} theme  Theme name
   */
  applyTheme(theme) {
    if (!this.availableThemes.includes(theme)) {
      console.warn(`Unknown theme: ${theme}, using default theme`);
      theme = this.DEFAULT_THEME;
      //Also clear the invalid theme from storage
      this.clearInvalidTheme();
    }

    if (this._hasAppliedInitialTheme && this.currentTheme === theme) {
      return;
    }

    //Ensure applied to document.documentElement (i.e., <html> element)
    document.documentElement.removeAttribute('data-theme');

    if (theme !== 'default') {
      document.documentElement.setAttribute('data-theme', theme);
    }

    this.currentTheme = theme;
    this._hasAppliedInitialTheme = true;
    this.notifyThemeChange(theme);
  }

  /*** Subscribe to theme changes
   * @param {Function} listener Callback receiving new theme name
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /*** Notify listeners when theme changes */
  notifyThemeChange(theme) {
    this.listeners.forEach((listener) => {
      try {
        listener(theme);
      } catch (error) {
        console.error('Theme listener error:', error);
      }
    });
  }

  /*** Switch theme
   * @param {string} theme  Theme name
   */
  async switchTheme(theme) {
    try {
      this.applyTheme(theme);
      await this.saveTheme(theme);
      return true;
    } catch (error) {
      console.error('Failed to switch theme:', error);
      return false;
    }
  }

  /*** Set up system theme change listener
   */
  setupSystemThemeListener() {
    if (window.matchMedia) {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleThemeChange = (e) => {
        //Respond to system theme change only when user hasn't manually set theme
        this.getSavedTheme().then(savedTheme => {
          if (!savedTheme) {
            this.applyTheme(e.matches ? 'dark' : 'default');
          }
        });
      };
      
      //Use new addEventListener method (if available)
      if (darkModeMediaQuery.addEventListener) {
        darkModeMediaQuery.addEventListener('change', handleThemeChange);
      } else {
        //Fallback to old addListener method
        darkModeMediaQuery.addListener(handleThemeChange);
      }
    }
  }

  /*** Get current theme
   * @returns {string} Current theme name
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /*** Get available themes list
   * @returns {Array} Available themes array
   */
  getAvailableThemes() {
    return [...this.availableThemes];
  }
}

//Export singleton
export const themeManager = new ThemeManager();
