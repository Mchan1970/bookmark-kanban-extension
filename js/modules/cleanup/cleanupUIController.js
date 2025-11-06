import { CleanupView } from './cleanupView.js';
import { ArchivePanelController } from './archivePanelController.js';
import { RecyclePanelController } from './recyclePanelController.js';
import { SECTION_KEYS } from './cleanupConstants.js';

const noopAsync = async () => {};

export class CleanupUIController {
  constructor(notificationManager, callbacks = {}) {
    this.notificationManager = notificationManager;
    this.callbacks = {
      handleBulkAction: noopAsync,
      ignoreSingle: noopAsync,
      fetchArchiveItems: async () => [],
      fetchRecycleItems: async () => [],
      archiveRestore: noopAsync,
      archiveRemove: noopAsync,
      recycleRestore: noopAsync,
      recyclePurge: noopAsync,
      ...callbacks
    };

    this.selected = {};
    SECTION_KEYS.forEach(section => {
      this.selected[section] = new Set();
    });

    this.elements = {};
    this.view = null;
    this.archivePanel = null;
    this.recyclePanel = null;
  }

  async initialize() {
    this.cacheElements();
    if (!this.elements.headerButton) {
      return false;
    }

    this.initializeViewControllers();
    this.bindEvents();
    await this.refreshPanels();
    return true;
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
      onRestore: (id) => this.callbacks.archiveRestore([id]),
      onRemove: (id) => this.callbacks.archiveRemove([id])
    });

    this.recyclePanel.setHandlers({
      onRestore: (id) => this.callbacks.recycleRestore([id]),
      onPurge: (id) => this.callbacks.recyclePurge([id])
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
      await this.refreshPanels({ archiveOnly: true });
      this.openModal(archiveModal);
    });

    openRecycleFromCleanup?.addEventListener('click', async () => {
      this.closeModal(cleanupModal);
      await this.refreshPanels({ recycleOnly: true });
      this.openModal(recycleModal);
    });

    openArchiveView?.addEventListener('click', async () => {
      await this.refreshPanels({ archiveOnly: true });
      this.openModal(archiveModal);
    });

    openRecycleView?.addEventListener('click', async () => {
      await this.refreshPanels({ recycleOnly: true });
      this.openModal(recycleModal);
    });

    cleanupModal?.addEventListener('change', async (event) => {
      if (!event.target.classList.contains('cleanup-checkbox')) {
        return;
      }
      const checkbox = event.target;
      const section = checkbox.dataset.section;
      const bookmarkId = checkbox.dataset.bookmarkId;
      this.toggleSelection(section, bookmarkId, checkbox.checked);
    });

    cleanupModal?.addEventListener('click', async (event) => {
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
        await this.callbacks.ignoreSingle(section, bookmarkId);
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

  renderSnapshot(snapshot) {
    const { counts, sections } = snapshot;
    this.view.updateCounts(counts);
    this.view.renderSections(sections);
    this.clearSelectionState();
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

  async handleBulkAction(action) {
    const selection = this.collectSelectionSnapshot();
    const totalSelected = this.getTotalSelected();
    if (totalSelected === 0) {
      return;
    }

    try {
      await this.callbacks.handleBulkAction(action, selection);
      this.clearSelectionState();
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  }

  async refreshPanels(options = {}) {
    const requests = [];
    if (!options.recycleOnly) {
      requests.push(this.callbacks.fetchArchiveItems());
    } else {
      requests.push(Promise.resolve(null));
    }
    if (!options.archiveOnly) {
      requests.push(this.callbacks.fetchRecycleItems());
    } else {
      requests.push(Promise.resolve(null));
    }

    const [archiveItems, recycleItems] = await Promise.all(requests);

    if (archiveItems) {
      this.archivePanel.render(archiveItems || []);
    }
    if (recycleItems) {
      this.recyclePanel.render(recycleItems || []);
    }
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
