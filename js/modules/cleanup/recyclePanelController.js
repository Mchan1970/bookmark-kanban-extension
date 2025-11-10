import { relativeTimeFromNow } from './cleanupUtils.js';

export class RecyclePanelController {
  constructor({ modal, listElement, countElement }) {
    this.modal = modal;
    this.listElement = listElement;
    this.countElement = countElement;
    this.handlers = {
      onRestore: null,
      onPurge: null
    };

    this.modal?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-recycle-action]');
      if (!button) {
        return;
      }
      const bookmarkId = button.dataset.bookmarkId;
      const action = button.dataset.recycleAction;

      if (action === 'restore' && this.handlers.onRestore) {
        this.handlers.onRestore(bookmarkId);
      }
      if (action === 'purge' && this.handlers.onPurge) {
        this.handlers.onPurge(bookmarkId);
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
      empty.textContent = 'Recycle bin is empty.';
      this.listElement.appendChild(empty);
      return;
    }

    items.forEach(item => {
      this.listElement.appendChild(this.buildRow(item, selectedSet));
    });
  }

  buildRow(item, selectedSet = new Set()) {
    const row = document.createElement('div');
    row.className = 'cleanup-item cleanup-item--management';

    const gutter = document.createElement('div');
    gutter.className = 'cleanup-item-gutter';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cleanup-checkbox recycle-checkbox';
    checkbox.dataset.bookmarkId = item.originalId || item.id;
    checkbox.checked = selectedSet.has(checkbox.dataset.bookmarkId);
    gutter.appendChild(checkbox);

    const details = document.createElement('div');
    details.className = 'cleanup-item-details';

    const title = document.createElement('div');
    title.className = 'cleanup-item-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'cleanup-item-meta';
    meta.textContent = `Deleted ${relativeTimeFromNow(item.deletedAt)} • ${item.folderPath}`;

    details.appendChild(title);
    details.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'cleanup-item-actions';

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.dataset.recycleAction = 'restore';
    restoreButton.dataset.bookmarkId = item.originalId || item.id;
    restoreButton.textContent = 'Restore';

    const purgeButton = document.createElement('button');
    purgeButton.type = 'button';
    purgeButton.dataset.recycleAction = 'purge';
    purgeButton.dataset.bookmarkId = item.originalId || item.id;
    purgeButton.textContent = 'Delete';

    actions.appendChild(restoreButton);
    actions.appendChild(purgeButton);

    gutter.appendChild(actions);

    row.appendChild(gutter);
    row.appendChild(details);
    return row;
  }
}
