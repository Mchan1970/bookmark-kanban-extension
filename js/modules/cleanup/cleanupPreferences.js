import {
  DAY_IN_MS,
  DEFAULT_STALE_THRESHOLD_DAYS,
  MAX_STALE_THRESHOLD_DAYS,
  MIN_STALE_THRESHOLD_DAYS,
  STALE_THRESHOLD_STORAGE_KEY
} from './cleanupConstants.js';

export class CleanupPreferences {
  constructor() {
    this.storageKey = STALE_THRESHOLD_STORAGE_KEY;
    this.currentDays = DEFAULT_STALE_THRESHOLD_DAYS;
    this.listeners = new Set();
    this.isListening = false;
    this.boundHandleStorageChange = this.handleStorageChange.bind(this);
  }

  async initialize() {
    await this.loadFromStorage();
    this.subscribeToStorage();
  }

  async loadFromStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
      return;
    }

    await new Promise((resolve) => {
      chrome.storage.sync.get([this.storageKey], (result) => {
        if (chrome.runtime?.lastError) {
          console.error('Failed to load cleanup preferences:', chrome.runtime.lastError);
        } else {
          const storedDays = parseInt(result[this.storageKey], 10);
          if (!Number.isNaN(storedDays)) {
            this.currentDays = this.normalizeDays(storedDays);
          }
        }
        resolve();
      });
    });
  }

  subscribeToStorage() {
    if (this.isListening || typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return;
    }
    chrome.storage.onChanged.addListener(this.boundHandleStorageChange);
    this.isListening = true;
  }

  handleStorageChange(changes, areaName) {
    if (areaName !== 'sync') {
      return;
    }
    const change = changes[this.storageKey];
    if (!change) {
      return;
    }
    const updatedDays = this.normalizeDays(change.newValue);
    if (updatedDays === this.currentDays) {
      return;
    }
    this.currentDays = updatedDays;
    this.emit();
  }

  normalizeDays(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return this.currentDays || DEFAULT_STALE_THRESHOLD_DAYS;
    }
    return Math.min(
      MAX_STALE_THRESHOLD_DAYS,
      Math.max(MIN_STALE_THRESHOLD_DAYS, parsed)
    );
  }

  getCurrentThresholdDays() {
    return this.currentDays;
  }

  getCurrentThresholdMs() {
    return this.currentDays * DAY_IN_MS;
  }

  async setStaleThresholdDays(days) {
    const normalized = this.normalizeDays(days);

    if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
      this.currentDays = normalized;
      this.emit();
      return { success: true, days: normalized };
    }

    return new Promise((resolve) => {
      chrome.storage.sync.set({ [this.storageKey]: normalized }, () => {
        if (chrome.runtime?.lastError) {
          console.error('Failed to save cleanup preferences:', chrome.runtime.lastError);
          resolve({
            success: false,
            message: 'Failed to save setting'
          });
          return;
        }
        this.currentDays = normalized;
        this.emit();
        resolve({ success: true, days: normalized });
      });
    });
  }

  onThresholdChange(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const payload = {
      days: this.getCurrentThresholdDays(),
      milliseconds: this.getCurrentThresholdMs()
    };
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error('CleanupPreferences listener error:', error);
      }
    });
  }

  destroy() {
    if (this.isListening && typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(this.boundHandleStorageChange);
    }
    this.isListening = false;
    this.listeners.clear();
  }
}
