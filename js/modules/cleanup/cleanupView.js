import { SECTION_KEYS } from './cleanupConstants.js';
import { relativeTimeFromNow } from './cleanupUtils.js';

export class CleanupView {
  constructor(options) {
    this.cleanupModal = options.cleanupModal;
    this.sectionCounts = options.sectionCounts;
    this.sectionLists = options.sectionLists;
    this.selectionSummary = options.selectionSummary;
    this.archiveButton = options.archiveButton;
    this.deleteButton = options.deleteButton;
    this.ignoreButton = options.ignoreButton;
    this.groupExpansion = new Map();
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

    if (section === 'duplicates') {
      this.renderDuplicateGroups(listElement, items);
      return;
    }

    items.forEach(item => {
      listElement.appendChild(this.createSectionItem(section, item));
    });
  }

  renderDuplicateGroups(listElement, groups) {
    const activeGroupIds = new Set(groups.map(group => group.groupId));
    Array.from(this.groupExpansion.keys()).forEach(groupId => {
      if (!activeGroupIds.has(groupId)) {
        this.groupExpansion.delete(groupId);
      }
    });

    groups.forEach(group => {
      const wrapper = document.createElement('div');
      wrapper.className = 'cleanup-duplicate-group';
      wrapper.dataset.groupId = group.groupId;

      const expanded = this.groupExpansion.has(group.groupId)
        ? this.groupExpansion.get(group.groupId)
        : false;
      if (expanded) {
        wrapper.classList.add('is-expanded');
      }
      this.groupExpansion.set(group.groupId, expanded);

      const header = document.createElement('div');
      header.className = 'cleanup-duplicate-group-header';

      const groupCheckbox = document.createElement('input');
      groupCheckbox.type = 'checkbox';
      groupCheckbox.className = 'cleanup-checkbox cleanup-group-checkbox';
      groupCheckbox.dataset.section = 'duplicates';
      groupCheckbox.dataset.groupId = group.groupId;
      groupCheckbox.dataset.groupCheckbox = 'true';
      header.appendChild(groupCheckbox);

      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'cleanup-group-toggle';
      toggleButton.dataset.groupToggle = 'true';
      toggleButton.dataset.groupId = group.groupId;
      toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggleButton.setAttribute('aria-label', expanded ? 'Collapse duplicate group' : 'Expand duplicate group');
      toggleButton.textContent = expanded ? '▼' : '▶';
      header.appendChild(toggleButton);

      const url = document.createElement('span');
      url.className = 'cleanup-group-url';
      url.title = group.url;
      url.textContent = group.url;
      header.appendChild(url);

      const count = document.createElement('span');
      count.className = 'cleanup-group-count';
      count.textContent = `(${group.bookmarks.length} item${group.bookmarks.length > 1 ? 's' : ''})`;
      header.appendChild(count);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'cleanup-group-items';
      itemsContainer.hidden = !expanded;

      group.bookmarks.forEach(bookmark => {
        itemsContainer.appendChild(this.createDuplicateGroupItem(bookmark));
      });

      wrapper.appendChild(header);
      wrapper.appendChild(itemsContainer);
      listElement.appendChild(wrapper);
    });
  }

  createSectionItem(section, item) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('cleanup-item', `badge-${section}`);

    const leftSection = document.createElement('div');
    leftSection.className = 'cleanup-item-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cleanup-checkbox';
    checkbox.dataset.section = section;
    checkbox.dataset.bookmarkId = item.id;
    leftSection.appendChild(checkbox);

    const details = document.createElement('div');
    details.className = 'cleanup-item-details';

    const title = document.createElement('div');
    title.className = 'cleanup-item-title cleanup-item-title--clickable';
    title.textContent = item.title || '(Untitled bookmark)';
    title.dataset.action = 'view';
    title.dataset.bookmarkId = item.id;

    const meta = document.createElement('div');
    meta.className = 'cleanup-item-meta';
    meta.textContent = this.buildMetaText(section, item);

    details.appendChild(title);
    details.appendChild(meta);

    leftSection.appendChild(details);

    const ignoreButton = document.createElement('button');
    ignoreButton.type = 'button';
    ignoreButton.className = 'cleanup-item-ignore-button';
    ignoreButton.dataset.action = 'ignore';
    ignoreButton.dataset.section = section;
    ignoreButton.dataset.bookmarkId = item.id;
    ignoreButton.innerHTML = '🚫';
    ignoreButton.title = 'Ignore this bookmark';
    ignoreButton.setAttribute('aria-label', 'Ignore this bookmark');

    wrapper.appendChild(leftSection);
    wrapper.appendChild(ignoreButton);

    return wrapper;
  }

  createDuplicateGroupItem(item) {
    const row = document.createElement('div');
    row.className = 'cleanup-duplicate-item';

    const leftSection = document.createElement('div');
    leftSection.className = 'cleanup-duplicate-item-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cleanup-checkbox';
    checkbox.dataset.section = 'duplicates';
    checkbox.dataset.bookmarkId = item.id;

    const details = document.createElement('div');
    details.className = 'cleanup-duplicate-item-details';

    const title = document.createElement('div');
    title.className = 'cleanup-duplicate-item-title cleanup-duplicate-item-title--clickable';
    title.textContent = item.title || '(Untitled bookmark)';
    title.dataset.action = 'view';
    title.dataset.bookmarkId = item.id;

    const meta = document.createElement('div');
    meta.className = 'cleanup-duplicate-item-meta';
    if (item.folderPath) {
      meta.textContent = `In: "${item.folderPath}"`;
    } else {
      meta.textContent = 'Location unavailable';
    }

    details.appendChild(title);
    details.appendChild(meta);

    leftSection.appendChild(checkbox);
    leftSection.appendChild(details);

    const ignoreButton = document.createElement('button');
    ignoreButton.type = 'button';
    ignoreButton.className = 'cleanup-item-ignore-button';
    ignoreButton.dataset.action = 'ignore';
    ignoreButton.dataset.section = 'duplicates';
    ignoreButton.dataset.bookmarkId = item.id;
    ignoreButton.innerHTML = '🚫';
    ignoreButton.title = 'Ignore this bookmark';
    ignoreButton.setAttribute('aria-label', 'Ignore this bookmark');

    row.appendChild(leftSection);
    row.appendChild(ignoreButton);

    return row;
  }

  buildMetaText(section, item) {
    if (section === 'duplicates') {
      return `Group of ${item.duplicateCount} • ${item.url}`;
    }

    if (section === 'stale') {
      let timeText = '';
      if (item.neverVisited) {
        // Case B: Never visited - show addition time
        const addedTime = item.dateAdded ? relativeTimeFromNow(item.dateAdded) : 'unknown';
        timeText = `Never visited • Added ${addedTime}`;
      } else if (item.lastVisitedAt) {
        // Case A: Has visit records - show last visit time
        const visitTime = relativeTimeFromNow(item.lastVisitedAt);
        const visitText = item.visitCount > 0
          ? `${item.visitCount} visit${item.visitCount > 1 ? 's' : ''}`
          : '1 visit';
        timeText = `Last visited ${visitTime} • ${visitText}`;
      } else {
        // Fallback - should not happen with new logic
        timeText = 'No recorded visits';
      }
      return `${timeText} • ${item.folderPath}`;
    }

    return item.folderPath || '';
  }

  emptyTextForSection(section) {
    switch (section) {
      case 'duplicates':
        return 'No duplicate bookmarks found.';
      case 'stale':
        return 'No long-unvisited bookmarks found.';
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
      if (checkbox.dataset.groupCheckbox === 'true') {
        checkbox.indeterminate = false;
      }
    });
  }

  setGroupExpansion(groupId, expanded) {
    if (!groupId) {
      return;
    }
    this.groupExpansion.set(groupId, expanded);
  }

  syncGroupCheckboxState(groupElement) {
    if (!groupElement) {
      return;
    }

    const groupCheckbox = groupElement.querySelector('.cleanup-group-checkbox');
    if (!groupCheckbox) {
      return;
    }

    const itemCheckboxes = groupElement.querySelectorAll('.cleanup-group-items .cleanup-checkbox[data-bookmark-id]');
    if (!itemCheckboxes.length) {
      groupCheckbox.checked = false;
      groupCheckbox.indeterminate = false;
      return;
    }

    const checkedItems = Array.from(itemCheckboxes).filter(checkbox => checkbox.checked).length;

    if (checkedItems === 0) {
      groupCheckbox.checked = false;
      groupCheckbox.indeterminate = false;
      return;
    }

    if (checkedItems === itemCheckboxes.length) {
      groupCheckbox.checked = true;
      groupCheckbox.indeterminate = false;
      return;
    }

    groupCheckbox.checked = false;
    groupCheckbox.indeterminate = true;
  }
}
