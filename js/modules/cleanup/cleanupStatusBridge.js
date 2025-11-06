export class CleanupStatusBridge {
  constructor() {
    this.statusMap = {};
    this.callback = null;
    this.resolver = null;
  }

  setUpdateCallback(callback) {
    this.callback = callback;
    this.emit();
  }

  setResolver(resolver) {
    this.resolver = resolver;
  }

  update(statusMap = {}) {
    this.statusMap = statusMap || {};
    this.emit();
  }

  emit() {
    if (typeof this.callback === 'function') {
      this.callback({ ...this.statusMap });
    }
  }

  getStatus(bookmarkId) {
    if (!bookmarkId) {
      return null;
    }
    if (this.statusMap[bookmarkId]) {
      return this.statusMap[bookmarkId];
    }
    if (typeof this.resolver === 'function') {
      return this.resolver(bookmarkId);
    }
    return null;
  }
}
