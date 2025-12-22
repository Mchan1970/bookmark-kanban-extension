import { relativeTimeFromNow } from './cleanupUtils.js';

export class ArchivePanelController {
  constructor({ modal, listElement, countElement }) {
    this.modal = modal;
    this.listElement = listElement;
    this.countElement = countElement;
    this.handlers = {
      onRestore: null,
      onRemove: null
    };

    this.modal?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-archive-action]');
      if (!button) {
        return;
      }
      const bookmarkId = button.dataset.bookmarkId;
      const action = button.dataset.archiveAction;

      if (action === 'restore' && this.handlers.onRestore) {
        this.handlers.onRestore(bookmarkId);
      }
      if (action === 'remove' && this.handlers.onRemove) {
        this.handlers.onRemove(bookmarkId);
      }
    });
  }

  setHandlers(handlers) {
    this.handlers = {
      ...this.handlers,
      ...handlers
    };
  }

  render(items = [], selectedIds = new Set()) {
    const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    if (this.countElement) {
      this.countElement.textContent = items.length.toString();
    }

    if (!this.listElement) {
      return;
    }

    this.listElement.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'cleanup-empty';
      empty.textContent = 'Archive is empty.';
      this.listElement.appendChild(empty);
      return;
    }

    items.forEach(item => {
      this.listElement.appendChild(this.buildRow(item, selectedSet));
    });
  }

  buildRow(item, selectedSet = new Set()) {
    const row = document.createElement('div');
    row.className = 'cleanup-item archive-item';

    const leftSection = document.createElement('div');
    leftSection.className = 'cleanup-item-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cleanup-checkbox archive-checkbox';
    checkbox.dataset.bookmarkId = item.originalId || item.id;
    checkbox.checked = selectedSet.has(checkbox.dataset.bookmarkId);

    const details = document.createElement('div');
    details.className = 'cleanup-item-details';

    const title = document.createElement('div');
    title.className = 'cleanup-item-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'cleanup-item-meta';
    meta.textContent = `Archived ${relativeTimeFromNow(item.archivedAt)} • ${item.folderPath}`;

    details.appendChild(title);
    details.appendChild(meta);

    leftSection.appendChild(checkbox);
    leftSection.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'archive-item-actions';

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'archive-action-button archive-action-button--restore';
    restoreButton.dataset.archiveAction = 'restore';
    restoreButton.dataset.bookmarkId = item.originalId || item.id;
    restoreButton.innerHTML = '↩️';
    restoreButton.title = 'Restore bookmark';
    restoreButton.setAttribute('aria-label', 'Restore bookmark');

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'archive-action-button archive-action-button--remove';
    removeButton.dataset.archiveAction = 'remove';
    removeButton.dataset.bookmarkId = item.originalId || item.id;
    removeButton.innerHTML = '🗑️';
    removeButton.title = 'Permanently remove';
    removeButton.setAttribute('aria-label', 'Permanently remove');

    actions.appendChild(restoreButton);
    actions.appendChild(removeButton);

    row.appendChild(leftSection);
    row.appendChild(actions);
    return row;
  }
}
