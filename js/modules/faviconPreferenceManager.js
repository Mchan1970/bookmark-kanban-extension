export class FaviconPreferenceManager {
  constructor() {
    this.STORAGE_KEY = 'bookmark_board_show_favicons';
    this.defaultValue = true;
    this.currentValue = this.defaultValue;
  }

  async initialize() {
    const stored = await this.readPreference();
    if (typeof stored === 'boolean') {
      this.currentValue = stored;
    }
    this.apply(this.currentValue);
  }

  async readPreference() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
        resolve(null);
        return;
      }

      chrome.storage.sync.get([this.STORAGE_KEY], (result) => {
        if (chrome.runtime?.lastError) {
          console.error('Failed to read favicon preference:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result[this.STORAGE_KEY]);
      });
    });
  }

  async setPreference(enabled) {
    const value = Boolean(enabled);
    this.currentValue = value;
    this.apply(value);

    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
        resolve({ success: true });
        return;
      }

      chrome.storage.sync.set({ [this.STORAGE_KEY]: value }, () => {
        if (chrome.runtime?.lastError) {
          console.error('Failed to save favicon preference:', chrome.runtime.lastError);
          resolve({ success: false, message: 'Failed to save preference' });
          return;
        }
        resolve({ success: true });
      });
    });
  }

  apply(enabled) {
    const showFavicons = enabled !== false;
    document.body.setAttribute('data-show-favicons', showFavicons ? 'true' : 'false');
  }

  isEnabled() {
    return this.currentValue !== false;
  }
}
