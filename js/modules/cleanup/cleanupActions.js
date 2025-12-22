export class CleanupActions {
  constructor({ archiveManager, recycleManager, store, notificationManager, afterAction }) {
    this.archiveManager = archiveManager;
    this.recycleManager = recycleManager;
    this.store = store;
    this.notificationManager = notificationManager;
    this.afterAction = afterAction || (() => Promise.resolve());
  }

  async ignore(section, bookmarkIds, options = {}) {
    if (!section || !Array.isArray(bookmarkIds) || !bookmarkIds.length) {
      return;
    }

    await this.store.ignoreItems(section, bookmarkIds);
    if (options.showToast !== false) {
      this.notificationManager?.showToast('Item ignored');
    }
  }

  async archive(bookmarkIds) {
    if (!Array.isArray(bookmarkIds) || !bookmarkIds.length) {
      return;
    }

    const archived = await this.archiveManager.archiveBookmarks(bookmarkIds);
    if (archived.length) {
      await this.recycleManager.purgeBookmarks(archived.map(item => item.originalId || item.id));
      // Add archived bookmarks to ignore list so they don't appear in future cleanup scans
      await this.store.ignoreItems('stale', archived.map(item => item.originalId || item.id));
    }
    if (!archived.length) {
      return;
    }

    this.notificationManager?.showActionToast(
      `Archived ${archived.length} bookmark${archived.length > 1 ? 's' : ''}`,
      'Undo',
      async () => {
        await this.archiveManager.restoreBookmarks(archived.map(item => item.id));
        await this.afterAction();
      }
    );

    await this.afterAction();
  }

  async remove(bookmarkIds) {
    if (!Array.isArray(bookmarkIds) || !bookmarkIds.length) {
      return;
    }

    await this.archiveManager.removeEntries(bookmarkIds);

    const trashed = await this.recycleManager.trashBookmarks(bookmarkIds);
    if (!trashed.length) {
      return;
    }

    this.notificationManager?.showActionToast(
      `Deleted ${trashed.length} bookmark${trashed.length > 1 ? 's' : ''}`,
      'Undo',
      async () => {
        await this.recycleManager.restoreBookmarks(trashed.map(item => item.originalId));
        await this.afterAction();
      },
      'warning'
    );

    await this.afterAction();
  }
}
