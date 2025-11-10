import { CleanupView } from './cleanupView.js';
import { ArchivePanelController } from './archivePanelController.js';
import { RecyclePanelController } from './recyclePanelController.js';
import { SECTION_KEYS } from './cleanupConstants.js';
import { Modal } from '../Modal.js';

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
    this.archiveSelection = new Set();
    this.recycleSelection = new Set();

    this.elements = {};
    this.view = null;
    this.archivePanel = null;
    this.recyclePanel = null;
    this.cleanupModal = null;
    this.archiveModal = null;
    this.recycleModal = null;
  }

  createCleanupModals() {
    if (this.cleanupModal && this.archiveModal && this.recycleModal) {
      return;
    }

    this.cleanupModal = this.createModalInstance({
      id: 'cleanupModal',
      title: 'Cleanup Suggestions',
      content: this.buildCleanupContent(),
      width: '660px',
      maxWidth: '95vw',
      onOpen: () => this.clearSelectionState()
    });

    this.archiveModal = this.createModalInstance({
      id: 'archiveModal',
      title: 'Archived Bookmarks',
      content: this.buildArchiveContent(),
      width: '600px',
      maxWidth: '95vw'
    });

    this.recycleModal = this.createModalInstance({
      id: 'recycleModal',
      title: 'Recycle Bin',
      content: this.buildRecycleContent(),
      width: '600px',
      maxWidth: '95vw'
    });
  }

  async initialize() {
    this.createCleanupModals();
    this.cacheElements();
    if (!this.elements.headerButton) {
      return false;
    }

    this.initializeViewControllers();
    this.bindEvents();
    await this.refreshPanels();
    return true;
  }

  createModalInstance(options) {
    const modal = new Modal({
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      ...options
    });

    modal.element.classList.add('cleanup-modal');
    const content = modal.element.querySelector('.modal-content');
    content?.classList.add('cleanup-content');
    return modal;
  }

  buildCleanupContent() {
    return `
      <div class="cleanup-body">
        <div class="cleanup-section" data-section="duplicates">
          <div class="cleanup-section-header">
            <h3>Duplicates</h3>
            <span class="cleanup-count" id="cleanup-duplicates-count">0</span>
          </div>
          <div class="cleanup-section-list" id="cleanup-duplicates-list"></div>
        </div>
        <div class="cleanup-section" data-section="stale">
          <div class="cleanup-section-header">
            <h3>Stale Bookmarks</h3>
            <span class="cleanup-count" id="cleanup-stale-count">0</span>
          </div>
          <div class="cleanup-section-list" id="cleanup-stale-list"></div>
        </div>
      </div>
      <div class="cleanup-footer">
        <div class="cleanup-selection" id="cleanup-selection-count">No items selected</div>
        <div class="cleanup-actions">
          <button id="cleanup-archive" class="btn-secondary" disabled>Archive</button>
          <button id="cleanup-delete" class="btn-warning" disabled>Delete</button>
          <button id="cleanup-ignore" class="btn-secondary" disabled>Ignore</button>
        </div>
        <div class="cleanup-links">
          <button id="open-archive-from-cleanup" class="link-button">View Archive</button>
          <button id="open-recycle-from-cleanup" class="link-button">View Recycle Bin</button>
        </div>
      </div>
    `;
  }

  buildArchiveContent() {
    return `
      <div class="cleanup-body">
        <div class="cleanup-section">
          <div class="cleanup-section-header">
            <h3>Archive</h3>
            <span class="cleanup-count" id="archive-count">0</span>
          </div>
          <div class="cleanup-section-list" id="archive-list"></div>
        </div>
      </div>
      <div class="cleanup-footer">
        <div class="cleanup-actions">
          <button id="archive-restore" class="btn-secondary" disabled>Restore</button>
        </div>
      </div>
    `;
  }

  buildRecycleContent() {
    return `
      <div class="cleanup-body">
        <div class="cleanup-section">
          <div class="cleanup-section-header">
            <h3>Deleted Items</h3>
            <span class="cleanup-count" id="recycle-count">0</span>
          </div>
          <div class="cleanup-section-list" id="recycle-list"></div>
        </div>
      </div>
      <div class="cleanup-footer">
        <div class="cleanup-actions">
          <button id="recycle-restore" class="btn-secondary" disabled>Restore</button>
          <button id="recycle-delete-permanent" class="btn-warning" disabled>Delete Permanently</button>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.elements.cleanupModal = document.getElementById('cleanupModal');
    this.elements.archiveModal = document.getElementById('archiveModal');
    this.elements.recycleModal = document.getElementById('recycleModal');
    this.elements.headerButton = document.getElementById('cleanup-button');
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
    this.elements.archiveRestoreButton = document.getElementById('archive-restore');
    this.elements.recycleRestoreButton = document.getElementById('recycle-restore');
    this.elements.recycleDeleteButton = document.getElementById('recycle-delete-permanent');
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
      onRestore: (id) => this.handleArchiveQuickAction('restore', id),
      onRemove: (id) => this.handleArchiveQuickAction('remove', id)
    });

    this.recyclePanel.setHandlers({
      onRestore: (id) => this.handleRecycleQuickAction('restore', id),
      onPurge: (id) => this.handleRecycleQuickAction('purge', id)
    });
  }

  bindEvents() {
    const {
      headerButton,
      cleanupModal,
      openArchiveFromCleanup,
      openRecycleFromCleanup,
      openArchiveView,
      openRecycleView,
      archiveButton,
      deleteButton,
      ignoreButton,
      archiveModal,
      recycleModal,
      archiveRestoreButton,
      recycleRestoreButton,
      recycleDeleteButton
    } = this.elements;

    headerButton?.addEventListener('click', () => this.openCleanupModal());

    openArchiveFromCleanup?.addEventListener('click', async () => {
      await this.openArchiveModal({ fromCleanup: true });
    });

    openRecycleFromCleanup?.addEventListener('click', async () => {
      await this.openRecycleModal({ fromCleanup: true });
    });

    openArchiveView?.addEventListener('click', async () => {
      await this.openArchiveModal();
    });

    openRecycleView?.addEventListener('click', async () => {
      await this.openRecycleModal();
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

    archiveModal?.addEventListener('change', (event) => {
      if (!event.target.classList.contains('archive-checkbox')) {
        return;
      }
      const checkbox = event.target;
      const bookmarkId = checkbox.dataset.bookmarkId;
      this.toggleArchiveSelection(bookmarkId, checkbox.checked);
    });

    recycleModal?.addEventListener('change', (event) => {
      if (!event.target.classList.contains('recycle-checkbox')) {
        return;
      }
      const checkbox = event.target;
      const bookmarkId = checkbox.dataset.bookmarkId;
      this.toggleRecycleSelection(bookmarkId, checkbox.checked);
    });

    archiveRestoreButton?.addEventListener('click', () => this.handleArchiveBulkRestore());
    recycleRestoreButton?.addEventListener('click', () => this.handleRecycleBulkAction('restore'));
    recycleDeleteButton?.addEventListener('click', () => this.handleRecycleBulkAction('purge'));
  }

  renderSnapshot(snapshot) {
    const { counts, sections } = snapshot;
    this.view.updateCounts(counts);
    this.view.renderSections(sections);
    this.clearSelectionState();
  }

  openCleanupModal() {
    this.clearSelectionState();
    this.cleanupModal?.show();
  }

  async openArchiveModal(options = {}) {
    if (options.fromCleanup) {
      this.cleanupModal?.close();
    }
    this.clearArchiveSelection();
    await this.refreshPanels({ archiveOnly: true });
    this.archiveModal?.show();
  }

  async openRecycleModal(options = {}) {
    if (options.fromCleanup) {
      this.cleanupModal?.close();
    }
    this.clearRecycleSelection();
    await this.refreshPanels({ recycleOnly: true });
    this.recycleModal?.show();
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
    this.view?.updateSelectionSummary(totalSelected);
    this.view?.updateActionState(totalSelected > 0);
  }

  clearSelectionState() {
    SECTION_KEYS.forEach(section => this.selected[section].clear());
    this.view?.clearSelection();
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
      this.archivePanel.render(archiveItems || [], this.archiveSelection);
      this.updateArchiveSelectionUI();
    }
    if (recycleItems) {
      this.recyclePanel.render(recycleItems || [], this.recycleSelection);
      this.updateRecycleSelectionUI();
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

  toggleArchiveSelection(bookmarkId, isSelected) {
    if (!bookmarkId) {
      return;
    }
    if (isSelected) {
      this.archiveSelection.add(bookmarkId);
    } else {
      this.archiveSelection.delete(bookmarkId);
    }
    this.updateArchiveSelectionUI();
  }

  toggleRecycleSelection(bookmarkId, isSelected) {
    if (!bookmarkId) {
      return;
    }
    if (isSelected) {
      this.recycleSelection.add(bookmarkId);
    } else {
      this.recycleSelection.delete(bookmarkId);
    }
    this.updateRecycleSelectionUI();
  }

  updateArchiveSelectionUI() {
    const hasSelection = this.archiveSelection.size > 0;
    this.elements.archiveRestoreButton && (this.elements.archiveRestoreButton.disabled = !hasSelection);
    const archiveElement = this.elements.archiveModal;
    const checkboxes = archiveElement?.querySelectorAll('.archive-checkbox');
    checkboxes?.forEach(checkbox => {
      const id = checkbox.dataset.bookmarkId;
      checkbox.checked = !!id && this.archiveSelection.has(id);
    });
  }

  updateRecycleSelectionUI() {
    const hasSelection = this.recycleSelection.size > 0;
    this.elements.recycleRestoreButton && (this.elements.recycleRestoreButton.disabled = !hasSelection);
    this.elements.recycleDeleteButton && (this.elements.recycleDeleteButton.disabled = !hasSelection);
    const recycleElement = this.elements.recycleModal;
    const checkboxes = recycleElement?.querySelectorAll('.recycle-checkbox');
    checkboxes?.forEach(checkbox => {
      const id = checkbox.dataset.bookmarkId;
      checkbox.checked = !!id && this.recycleSelection.has(id);
    });
  }

  clearArchiveSelection() {
    this.archiveSelection.clear();
    this.updateArchiveSelectionUI();
  }

  clearRecycleSelection() {
    this.recycleSelection.clear();
    this.updateRecycleSelectionUI();
  }

  async handleArchiveBulkRestore() {
    const ids = Array.from(this.archiveSelection);
    if (!ids.length) {
      return;
    }
    try {
      await this.callbacks.archiveRestore(ids);
      this.clearArchiveSelection();
    } catch (error) {
      console.error('Failed to restore archive selection:', error);
    }
  }

  async handleRecycleBulkAction(action) {
    const ids = Array.from(this.recycleSelection);
    if (!ids.length) {
      return;
    }
    try {
      if (action === 'restore') {
        await this.callbacks.recycleRestore(ids);
      } else if (action === 'purge') {
        await this.callbacks.recyclePurge(ids);
      }
      this.clearRecycleSelection();
    } catch (error) {
      console.error('Recycle bulk action failed:', error);
    }
  }

  async handleArchiveQuickAction(action, bookmarkId) {
    if (!bookmarkId) {
      return;
    }
    try {
      if (action === 'restore') {
        await this.callbacks.archiveRestore([bookmarkId]);
      } else if (action === 'remove') {
        await this.callbacks.archiveRemove([bookmarkId]);
      }
      this.archiveSelection.delete(bookmarkId);
      this.updateArchiveSelectionUI();
    } catch (error) {
      console.error('Archive action failed:', error);
    }
  }

  async handleRecycleQuickAction(action, bookmarkId) {
    if (!bookmarkId) {
      return;
    }
    try {
      if (action === 'restore') {
        await this.callbacks.recycleRestore([bookmarkId]);
      } else if (action === 'purge') {
        await this.callbacks.recyclePurge([bookmarkId]);
      }
      this.recycleSelection.delete(bookmarkId);
      this.updateRecycleSelectionUI();
    } catch (error) {
      console.error('Recycle action failed:', error);
    }
  }
}
