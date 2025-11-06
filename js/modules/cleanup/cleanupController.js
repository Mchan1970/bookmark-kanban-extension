import { CleanupStore } from './cleanupStore.js';
import { CleanupView } from './cleanupView.js';
import { CleanupActions } from './cleanupActions.js';
import { ArchivePanelController } from './archivePanelController.js';
import { RecyclePanelController } from './recyclePanelController.js';
import { CleanupStatusBridge } from './cleanupStatusBridge.js';
import { SECTION_KEYS } from './cleanupConstants.js';

export class CleanupController {
  constructor({ bookmarkManager, notificationManager, archiveManager, recycleManager }) {
    this.bookmarkManager = bookmarkManager;
    this.notificationManager = notificationManager;
    this.archiveManager = archiveManager;
    this.recycleManager = recycleManager;

    this.store = new CleanupStore(bookmarkManager);
    this.statusBridge = new CleanupStatusBridge();
    this.unsubscribe = null;

    this.selected = {};
    SECTION_KEYS.forEach(section => {
      this.selected[section] = new Set();
    });

    this.elements = {};
    this.view = null;
    this.actions = null;
    this.archivePanel = null;
    this.recyclePanel = null;
  }

  async initialize() {
    this.cacheElements();

    if (!this.elements.headerButton) {
      return;
    }

    this.initializeViewControllers();
    this.bindEvents();

    await this.store.initialize();

    this.statusBridge.setResolver((bookmarkId) => this.store.getStatusForBookmark(bookmarkId));
    this.handleStoreUpdate({
      counts: this.store.getCounts(),
      sections: {
        dead: this.store.getSection('dead'),
        duplicates: this.store.getSection('duplicates'),
        stale: this.store.getSection('stale')
      },
      statusMap: this.store.getStatusMap()
    });

    this.unsubscribe = this.store.subscribe((snapshot) => {
      this.handleStoreUpdate(snapshot);
    });

    await this.refreshBinViews();
  }

  destroy() {
    this.unsubscribe?.();
  }

  async refresh() {
    await this.store.refresh();
  }

  async applySiteStatus(statusMap) {
    await this.store.updateStatus(statusMap);
  }

  setStatusUpdateCallback(callback) {
    this.statusBridge.setUpdateCallback(callback);
  }

  getStatusForBookmark(bookmarkId) {
    return this.statusBridge.getStatus(bookmarkId);
  }

  cacheElements() {
    this.elements.cleanupModal = document.getElementById('cleanupModal');
    this.elements.archiveModal = document.getElementById('archiveModal');
    this.elements.recycleModal = document.getElementById('recycleModal');
    this.elements.headerButton = document.getElementById('cleanup-button');
    this.elements.closeCleanup = document.getElementById('closeCleanup');
    this.elements.closeArchive = document.getElementById('closeArchive');
    this.elements.closeRecycle = document.getElementById('closeRecycle');
    this.elements.openArchiveFromCleanup = document.getElementById('open-archive-from-cleanup');
    this.elements.openRecycleFromCleanup = document.getElementById('open-recycle-from-cleanup');
    this.elements.openArchiveView = document.getElementById('open-archive-view');
    this.elements.openRecycleView = document.getElementById('open-recycle-view');
    this.elements.archiveButton = document.getElementById('cleanup-archive');
    this.elements.deleteButton = document.getElementById('cleanup-delete');
    this.elements.ignoreButton = document.getElementById('cleanup-ignore');
    this.elements.selectionSummary = document.getElementById('cleanup-selection-count');

    this.sectionCounts = {};
    this.sectionLists = {};
    SECTION_KEYS.forEach(section => {
      this.sectionCounts[section] = document.getElementById(`cleanup-${section}-count`);
      this.sectionLists[section] = document.getElementById(`cleanup-${section}-list`);
    });

    this.elements.archiveList = document.getElementById('archive-list');
    this.elements.archiveCount = document.getElementById('archive-count');
    this.elements.recycleList = document.getElementById('recycle-list');
    this.elements.recycleCount = document.getElementById('recycle-count');
  }

  initializeViewControllers() {
    this.view = new CleanupView({
      cleanupModal: this.elements.cleanupModal,
      sectionCounts: this.sectionCounts,
      sectionLists: this.sectionLists,
      selectionSummary: this.elements.selectionSummary,
      archiveButton: this.elements.archiveButton,
      deleteButton: this.elements.deleteButton,
      ignoreButton: this.elements.ignoreButton
    });

    this.actions = new CleanupActions({
      archiveManager: this.archiveManager,
      recycleManager: this.recycleManager,
      store: this.store,
      notificationManager: this.notificationManager,
      afterAction: () => this.handleAfterAction()
    });

    this.archivePanel = new ArchivePanelController({
      modal: this.elements.archiveModal,
      listElement: this.elements.archiveList,
      countElement: this.elements.archiveCount
    });

    this.recyclePanel = new RecyclePanelController({
      modal: this.elements.recycleModal,
      listElement: this.elements.recycleList,
      countElement: this.elements.recycleCount
    });

    this.archivePanel.setHandlers({
      onRestore: (id) => this.handleArchiveRestore([id]),
      onRemove: (id) => this.handleArchiveRemove([id])
    });

    this.recyclePanel.setHandlers({
      onRestore: (id) => this.handleRecycleRestore([id]),
      onPurge: (id) => this.handleRecyclePurge([id])
    });
  }

  bindEvents() {
    const {
      headerButton,
      cleanupModal,
      archiveModal,
      recycleModal,
      closeCleanup,
      closeArchive,
      closeRecycle,
      openArchiveFromCleanup,
      openRecycleFromCleanup,
      openArchiveView,
      openRecycleView,
      archiveButton,
      deleteButton,
      ignoreButton
    } = this.elements;

    headerButton?.addEventListener('click', () => this.openCleanupModal());

    closeCleanup?.addEventListener('click', () => this.closeModal(cleanupModal));
    closeArchive?.addEventListener('click', () => this.closeModal(archiveModal));
    closeRecycle?.addEventListener('click', () => this.closeModal(recycleModal));

    openArchiveFromCleanup?.addEventListener('click', async () => {
      this.closeModal(cleanupModal);
      await this.renderArchivePanel();
      this.openModal(archiveModal);
    });

    openRecycleFromCleanup?.addEventListener('click', async () => {
      this.closeModal(cleanupModal);
      await this.renderRecyclePanel();
      this.openModal(recycleModal);
    });

    openArchiveView?.addEventListener('click', async () => {
      await this.renderArchivePanel();
      this.openModal(archiveModal);
    });

    openRecycleView?.addEventListener('click', async () => {
      await this.renderRecyclePanel();
      this.openModal(recycleModal);
    });

    cleanupModal?.addEventListener('change', (event) => {
      if (!event.target.classList.contains('cleanup-checkbox')) {
        return;
      }
      const checkbox = event.target;
      const section = checkbox.dataset.section;
      const bookmarkId = checkbox.dataset.bookmarkId;
      this.toggleSelection(section, bookmarkId, checkbox.checked);
    });

    cleanupModal?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }
      const bookmarkId = button.dataset.bookmarkId;
      const action = button.dataset.action;
      const section = button.dataset.section;

      if (action === 'view') {
        this.focusBookmark(bookmarkId);
      }

      if (action === 'ignore' && section) {
        this.actions.ignore(section, [bookmarkId]);
      }
    });

    archiveButton?.addEventListener('click', () => this.handleBulkAction('archive'));
    deleteButton?.addEventListener('click', () => this.handleBulkAction('delete'));
    ignoreButton?.addEventListener('click', () => this.handleBulkAction('ignore'));

    [cleanupModal, archiveModal, recycleModal].forEach(modal => {
      modal?.addEventListener('click', (event) => {
        if (event.target === modal) {
          this.closeModal(modal);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        [cleanupModal, archiveModal, recycleModal].forEach(modal => {
          if (modal?.classList.contains('active')) {
            this.closeModal(modal);
          }
        });
      }
    });
  }

  handleStoreUpdate(snapshot) {
    const { counts, sections, statusMap = {} } = snapshot;
    this.view.updateCounts(counts);
    this.view.renderSections(sections);

    SECTION_KEYS.forEach(section => {
      this.selected[section].clear();
    });
    this.view.clearSelection();
    this.updateSelectionState();

    this.statusBridge.update(statusMap);
  }

  openCleanupModal() {
    this.openModal(this.elements.cleanupModal);
    this.clearSelectionState();
  }

  openModal(modalElement) {
    if (!modalElement) {
      return;
    }
    modalElement.classList.add('active', 'show');
  }

  closeModal(modalElement) {
    if (!modalElement) {
      return;
    }
    modalElement.classList.remove('active', 'show');
  }

  toggleSelection(section, bookmarkId, isSelected) {
    if (!SECTION_KEYS.includes(section)) {
      return;
    }
    if (isSelected) {
      this.selected[section].add(bookmarkId);
    } else {
      this.selected[section].delete(bookmarkId);
    }
    this.updateSelectionState();
  }

  updateSelectionState() {
    const totalSelected = this.getTotalSelected();
    this.view.updateSelectionSummary(totalSelected);
    this.view.updateActionState(totalSelected > 0);
  }

  clearSelectionState() {
    SECTION_KEYS.forEach(section => this.selected[section].clear());
    this.view.clearSelection();
    this.updateSelectionState();
  }

  getTotalSelected() {
    return SECTION_KEYS.reduce((total, section) => total + this.selected[section].size, 0);
  }

  collectSelectionSnapshot() {
    const snapshot = {};
    SECTION_KEYS.forEach(section => {
      snapshot[section] = Array.from(this.selected[section]);
    });
    return snapshot;
  }

  collectAllSelectedIds(snapshot) {
    const aggregate = new Set();
    Object.values(snapshot).forEach(ids => {
      ids.forEach(id => aggregate.add(id));
    });
    return Array.from(aggregate);
  }

  async handleBulkAction(action) {
    const selection = this.collectSelectionSnapshot();
    const totalSelected = this.getTotalSelected();
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
      this.clearSelectionState();
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

  async handleAfterAction() {
    await this.store.refresh();
    await this.refreshBinViews();
    this.clearSelectionState();
  }

  async refreshBinViews() {
    await Promise.all([
      this.renderArchivePanel(),
      this.renderRecyclePanel()
    ]);
  }

  async renderArchivePanel() {
    const items = await this.archiveManager.listArchived();
    this.archivePanel.render(items || []);
  }

  async renderRecyclePanel() {
    const items = await this.recycleManager.listTrashed();
    this.recyclePanel.render(items || []);
  }

  async handleArchiveRestore(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.archiveManager.restoreBookmarks(bookmarkIds);
    this.notificationManager?.showToast('Archive items restored');
    await this.refreshBinViews();
    await this.store.refresh();
  }

  async handleArchiveRemove(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.archiveManager.removeEntries(bookmarkIds);
    this.notificationManager?.showWarningToast('Removed from archive');
    await this.refreshBinViews();
  }

  async handleRecycleRestore(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.recycleManager.restoreBookmarks(bookmarkIds);
    this.notificationManager?.showToast('Restored from recycle bin');
    await this.refreshBinViews();
    await this.store.refresh();
  }

  async handleRecyclePurge(bookmarkIds) {
    if (!bookmarkIds?.length) {
      return;
    }
    await this.recycleManager.purgeBookmarks(bookmarkIds);
    this.notificationManager?.showWarningToast('Deleted permanently');
    await this.refreshBinViews();
  }

  focusBookmark(bookmarkId) {
    if (!bookmarkId) {
      return;
    }

    const element = document.querySelector(`[data-bookmark-id="${bookmarkId}"]`);
    if (!element) {
      this.notificationManager?.showWarningToast('Bookmark not visible on board');
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('cleanup-highlight');
    setTimeout(() => {
      element.classList.remove('cleanup-highlight');
    }, 1600);
  }
}
