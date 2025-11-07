import { SECTION_KEYS } from './cleanupConstants.js';

export class CleanupView {
  constructor(options) {
    this.cleanupModal = options.cleanupModal;
    this.sectionCounts = options.sectionCounts;
    this.sectionLists = options.sectionLists;
    this.selectionSummary = options.selectionSummary;
    this.archiveButton = options.archiveButton;
    this.deleteButton = options.deleteButton;
    this.ignoreButton = options.ignoreButton;
  }

  updateCounts(counts) {
    SECTION_KEYS.forEach(section => {
      const element = this.sectionCounts[section];
      if (element) {
        element.textContent = counts[section]?.toString() ?? '0';
      }
    });
  }

  renderSections(sections) {
    SECTION_KEYS.forEach(section => {
      const listElement = this.sectionLists[section];
      if (listElement) {
        this.renderSection(listElement, section, sections[section] || []);
      }
    });
  }

  renderSection(listElement, section, items) {
    listElement.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'cleanup-empty';
      empty.textContent = this.emptyTextForSection(section);
      listElement.appendChild(empty);
      return;
    }

    items.forEach(item => {
      listElement.appendChild(this.createSectionItem(section, item));
    });
  }

  createSectionItem(section, item) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('cleanup-item', `badge-${section}`);

    const actionColumn = document.createElement('div');
    actionColumn.className = 'cleanup-item-gutter';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cleanup-checkbox';
    checkbox.dataset.section = section;
    checkbox.dataset.bookmarkId = item.id;
    actionColumn.appendChild(checkbox);

    const details = document.createElement('div');
    details.className = 'cleanup-item-details';

    const title = document.createElement('div');
    title.className = 'cleanup-item-title';
    title.textContent = item.title || '(Untitled bookmark)';

    const meta = document.createElement('div');
    meta.className = 'cleanup-item-meta';
    meta.textContent = this.buildMetaText(section, item);

    details.appendChild(title);
    details.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'cleanup-item-actions';

    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.dataset.action = 'view';
    viewButton.dataset.bookmarkId = item.id;
    viewButton.textContent = 'View';
    actions.appendChild(viewButton);

    const ignoreButton = document.createElement('button');
    ignoreButton.type = 'button';
    ignoreButton.dataset.action = 'ignore';
    ignoreButton.dataset.section = section;
    ignoreButton.dataset.bookmarkId = item.id;
    ignoreButton.textContent = 'Ignore';
    actions.appendChild(ignoreButton);

    actionColumn.appendChild(actions);

    wrapper.appendChild(actionColumn);
    wrapper.appendChild(details);

    return wrapper;
  }

  buildMetaText(section, item) {
    if (section === 'duplicates') {
      return `Group of ${item.duplicateCount} • ${item.url}`;
    }

    return item.folderPath || '';
  }

  emptyTextForSection(section) {
    switch (section) {
      case 'duplicates':
        return 'No duplicate bookmarks found.';
      default:
        return 'Nothing to clean up here.';
    }
  }

  updateSelectionSummary(totalSelected) {
    if (!this.selectionSummary) {
      return;
    }

    if (totalSelected === 0) {
      this.selectionSummary.textContent = 'No items selected';
    } else {
      this.selectionSummary.textContent = `${totalSelected} item${totalSelected > 1 ? 's' : ''} selected`;
    }
  }

  updateActionState(hasSelection) {
    if (this.archiveButton) {
      this.archiveButton.disabled = !hasSelection;
    }
    if (this.deleteButton) {
      this.deleteButton.disabled = !hasSelection;
    }
    if (this.ignoreButton) {
      this.ignoreButton.disabled = !hasSelection;
    }
  }

  clearSelection() {
    const checkboxes = this.cleanupModal?.querySelectorAll('.cleanup-checkbox');
    checkboxes?.forEach(checkbox => {
      checkbox.checked = false;
    });
  }
}
