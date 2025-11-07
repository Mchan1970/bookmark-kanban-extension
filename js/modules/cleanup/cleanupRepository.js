import { ACCESS_STATS_STORAGE_KEY } from './cleanupConstants.js';

export class CleanupRepository {
  constructor() {
    this.STORAGE_KEY = 'kanbanCleanupState';
    this.METADATA_KEY = 'kanbanCleanupMetadata';
  }

  async loadIgnoreSets() {
    const data = await this.readFromStorage(this.STORAGE_KEY);
    const ignore = data?.ignore || {};
    return {
      duplicates: new Set(ignore.duplicates || []),
      stale: new Set(ignore.stale || [])
    };
  }

  async saveIgnoreSets(ignoreSets) {
    const payload = {
      ignore: {
        duplicates: Array.from(ignoreSets.duplicates || []),
        stale: Array.from(ignoreSets.stale || [])
      }
    };
    await this.writeToStorage(this.STORAGE_KEY, payload);
  }

  async loadAccessStats() {
    const data = await this.readFromStorage(ACCESS_STATS_STORAGE_KEY);
    return data || {};
  }

  readFromStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to read cleanup storage:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result[key] || null);
      });
    });
  }

  writeToStorage(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to persist cleanup storage:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }
}
