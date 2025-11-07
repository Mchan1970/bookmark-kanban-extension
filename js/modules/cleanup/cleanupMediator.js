import { CleanupState } from './cleanupState.js';
import { CleanupActions } from './cleanupActions.js';
import { CleanupUIController } from './cleanupUIController.js';

export class CleanupMediator {
  constructor({ bookmarkManager, notificationManager, archiveManager, recycleManager, preferences }) {
    this.bookmarkManager = bookmarkManager;
    this.notificationManager = notificationManager;
    this.archiveManager = archiveManager;
    this.recycleManager = recycleManager;
    this.preferences = preferences;

    this.state = new CleanupState(bookmarkManager, { preferences });
    this.actions = new CleanupActions({
      archiveManager,
      recycleManager,
      store: this.state,
      notificationManager,
      afterAction: () => this.handleAfterAction()
    });

    this.ui = new CleanupUIController(notificationManager, {
      handleBulkAction: (action, selection) => this.handleBulkAction(action, selection),
      ignoreSingle: (section, bookmarkId) => this.actions.ignore(section, [bookmarkId]),
      fetchArchiveItems: () => this.fetchArchiveItems(),
      fetchRecycleItems: () => this.fetchRecycleItems(),
      archiveRestore: (ids) => this.handleArchiveRestore(ids),
      archiveRemove: (ids) => this.handleArchiveRemove(ids),
      recycleRestore: (ids) => this.handleRecycleRestore(ids),
      recyclePurge: (ids) => this.handleRecyclePurge(ids)
    });

    this.unsubscribe = null;
  }

  async initialize() {
    const uiReady = await this.ui.initialize();
    if (uiReady === false) {
      return false;
    }

    await this.state.initialize();

    this.unsubscribe = this.state.subscribe((snapshot) => {
      this.ui.renderSnapshot(snapshot);
    });

    await this.ui.refreshPanels();
    return true;
  }

  destroy() {
    this.unsubscribe?.();
    this.state?.destroy?.();
  }

  async refresh() {
    await this.state.refresh();
  }

  async handleBulkAction(action, selection) {
    const totalSelected = Object.values(selection).reduce((acc, ids) => acc + ids.length, 0);
    if (totalSelected === 0) {
      return;
    }

    if (action === 'ignore') {
      await Promise.all(
        Object.entries(selection).map(([section, ids]) => {
          if (!ids.length) {
            return Promise.resolve();
          }
          return this.actions.ignore(section, ids, { showToast: false });
        })
      );
      this.notificationManager?.showToast('Ignored selected items');
      await this.state.refresh();
      return;
    }

    const bookmarkIds = this.collectAllSelectedIds(selection);
    if (action === 'archive') {
      await this.actions.archive(bookmarkIds);
      return;
    }

    if (action === 'delete') {
      await this.actions.remove(bookmarkIds);
      return;
    }
  }

  collectAllSelectedIds(selection) {
    const aggregate = new Set();
    Object.values(selection).forEach(ids => {
      ids.forEach(id => aggregate.add(id));
    });
    return Array.from(aggregate);
  }

  async handleAfterAction() {
    await this.state.refresh();
    await this.ui.refreshPanels();
    if (typeof this.bookmarkManager?.refreshBookmarkTree === 'function') {
      try {
        await this.bookmarkManager.refreshBookmarkTree();
      } catch (error) {
        console.error('Failed to refresh bookmark tree:', error);
      }
    }
  }

  async fetchArchiveItems() {
    const items = await this.archiveManager.listArchived();
    return items || [];
  }

  async fetchRecycleItems() {
    const items = await this.recycleManager.listTrashed();
    return items || [];
  }

  async handleArchiveRestore(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.archiveManager.restoreBookmarks(bookmarkIds);
    this.notificationManager?.showToast('Archive items restored');
    await this.handleAfterAction();
  }

  async handleArchiveRemove(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.archiveManager.removeEntries(bookmarkIds);
    this.notificationManager?.showWarningToast('Removed from archive');
    await this.ui.refreshPanels({ archiveOnly: true });
  }

  async handleRecycleRestore(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.recycleManager.restoreBookmarks(bookmarkIds);
    this.notificationManager?.showToast('Restored from recycle bin');
    await this.handleAfterAction();
  }

  async handleRecyclePurge(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.recycleManager.purgeBookmarks(bookmarkIds);
    this.notificationManager?.showWarningToast('Deleted permanently');
    await this.ui.refreshPanels({ recycleOnly: true });
  }

  async archiveBookmarks(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.actions.archive(bookmarkIds);
  }
}
