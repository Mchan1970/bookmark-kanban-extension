export class CleanupRepository {
  constructor() {
    this.STORAGE_KEY = 'kanbanCleanupState';
    this.METADATA_KEY = 'kanbanCleanupMetadata';
  }

  async loadIgnoreSets() {
    const data = await this.readFromStorage(this.STORAGE_KEY);
    const ignore = data?.ignore || {};
    return {
      dead: new Set(ignore.dead || []),
      duplicates: new Set(ignore.duplicates || []),
      stale: new Set(ignore.stale || [])
    };
  }

  async saveIgnoreSets(ignoreSets) {
    const payload = {
      ignore: {
        dead: Array.from(ignoreSets.dead || []),
        duplicates: Array.from(ignoreSets.duplicates || []),
        stale: Array.from(ignoreSets.stale || [])
      }
    };
    await this.writeToStorage(this.STORAGE_KEY, payload);
  }

  async loadMetadata() {
    const data = await this.readFromStorage(this.METADATA_KEY);
    return {
      lastCheckedAt: data?.lastCheckedAt || {},
      lastKnownStatus: data?.lastKnownStatus || {}
    };
  }

  async saveMetadata(metadata) {
    await this.writeToStorage(this.METADATA_KEY, metadata);
  }

  async syncSessionStatus(metadata) {
    if (!chrome.storage.session) {
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.session.get(['siteStatus'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to read session site status:', chrome.runtime.lastError);
          resolve();
          return;
        }

        const statusMap = result.siteStatus;
        if (statusMap) {
          const now = Date.now();
          Object.entries(statusMap).forEach(([bookmarkId, status]) => {
            metadata.lastCheckedAt[bookmarkId] = now;
            metadata.lastKnownStatus[bookmarkId] = status;
          });
        }
        resolve();
      });
    });
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
