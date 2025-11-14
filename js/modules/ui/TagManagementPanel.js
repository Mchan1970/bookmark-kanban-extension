import { Modal } from '../Modal.js';
import { tagManager } from '../tagManager.js';

export class TagManagementPanel {
  constructor(options = {}) {
    this.container = options.container;
    this.bookmarkManager = options.bookmarkManager;
    this.tagService = options.tagService;
    this.showToast = options.showToast || (() => {});
    this.allTags = [];
    this.filteredTags = [];
    this.selectedTags = new Set();
    this.initialized = false;
    this.loading = false;
  }

  async initialize() {
    if (!this.container || this.initialized) {
      if (!this.initialized) {
        await this.reloadTagData();
      }
      return;
    }
    this.renderSkeleton();
    await this.reloadTagData();
    this.initialized = true;
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="tag-manager-panel">
        <div class="tag-manager-toolbar">
          <input type="text" class="tag-manager-search" placeholder="Search tags" />
          <div class="tag-manager-summary">
            <span class="tag-count">0 tags</span>
          </div>
        </div>
        <div class="tag-manager-actions">
          <button type="button" class="btn-secondary tag-action-btn" data-action="rename" disabled>Rename</button>
          <button type="button" class="btn-secondary tag-action-btn" data-action="merge" disabled>Merge</button>
          <button type="button" class="btn-warning tag-action-btn" data-action="delete" disabled>Delete</button>
        </div>
        <div class="tag-manager-status" aria-live="polite"></div>
        <div class="tag-manager-list-wrapper">
          <table class="tag-manager-table">
            <thead>
              <tr>
                <th></th>
                <th>Tag</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody class="tag-manager-list"></tbody>
          </table>
          <div class="tag-manager-empty">No tags available.</div>
        </div>
      </div>
    `;

    this.searchInput = this.container.querySelector('.tag-manager-search');
    this.summaryElement = this.container.querySelector('.tag-count');
    this.statusElement = this.container.querySelector('.tag-manager-status');
    this.tableBody = this.container.querySelector('.tag-manager-list');
    this.emptyState = this.container.querySelector('.tag-manager-empty');
    this.actionButtons = Array.from(this.container.querySelectorAll('.tag-action-btn'));

    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.applyFilter());
    }

    this.actionButtons.forEach(button => {
      button.addEventListener('click', () => this.handleAction(button.dataset.action));
    });
  }

  async reloadTagData(forceRebuild = false) {
    if (!this.container) {
      return;
    }
    this.setLoading(true);
    try {
      if (forceRebuild) {
        await this.rebuildTagCache();
      } else {
        await this.ensureTagCache();
      }
      const stats = tagManager.getStatistics();
      const entries = Array.from(stats.tagUsage.entries()).map(([name, count]) => ({
        name,
        count
      }));
      entries.sort((a, b) => {
        if (b.count === a.count) {
          return a.name.localeCompare(b.name);
        }
        return b.count - a.count;
      });
      this.allTags = entries;
      this.selectedTags.clear();
      this.applyFilter();
      this.updateSummary();
      this.updateActionButtons();
      if (entries.length === 0) {
        this.statusElement.textContent = 'No tags detected yet. Add tags by including #tagname in bookmark titles.';
      } else {
        this.statusElement.textContent = '';
      }
    } catch (error) {
      console.error('Failed to load tag data:', error);
      this.statusElement.textContent = 'Failed to load tags.';
    } finally {
      this.setLoading(false);
    }
  }

  async ensureTagCache() {
    const stats = tagManager.getStatistics();
    if (stats.totalTags > 0) {
      return;
    }
    await this.rebuildTagCache();
  }

  async rebuildTagCache() {
    const tree = await this.bookmarkManager.getBookmarkTree();
    const bookmarks = [];
    const traverse = (nodes) => {
      if (!nodes) {
        return;
      }
      nodes.forEach(node => {
        if (node.url) {
          bookmarks.push(node);
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    tagManager.clearCache();
    tagManager.processBookmarks(bookmarks);
  }

  applyFilter() {
    const query = (this.searchInput?.value || '').trim().toLowerCase();
    if (!query) {
      this.filteredTags = [...this.allTags];
    } else {
      this.filteredTags = this.allTags.filter(tag => tag.name.includes(query));
    }
    this.renderTagList();
  }

  renderTagList() {
    if (!this.tableBody) {
      return;
    }
    this.tableBody.innerHTML = '';
    if (this.filteredTags.length === 0) {
      this.emptyState.style.display = 'block';
      return;
    }
    this.emptyState.style.display = 'none';
    this.filteredTags.forEach(entry => {
      const row = document.createElement('tr');
      row.dataset.tag = entry.name;

      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.selectedTags.has(entry.name);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedTags.add(entry.name);
        } else {
          this.selectedTags.delete(entry.name);
        }
        this.updateActionButtons();
      });
      checkboxCell.appendChild(checkbox);

      const tagCell = document.createElement('td');
      tagCell.textContent = `#${entry.name}`;

      const countCell = document.createElement('td');
      countCell.textContent = entry.count;

      row.appendChild(checkboxCell);
      row.appendChild(tagCell);
      row.appendChild(countCell);
      this.tableBody.appendChild(row);
    });
  }

  updateSummary() {
    if (!this.summaryElement) {
      return;
    }
    const count = this.allTags.length;
    this.summaryElement.textContent = `${count} tag${count === 1 ? '' : 's'}`;
  }

  updateActionButtons() {
    const selectionCount = this.selectedTags.size;
    this.actionButtons.forEach(button => {
      const action = button.dataset.action;
      if (action === 'rename') {
        button.disabled = selectionCount !== 1 || this.loading;
      } else if (action === 'merge') {
        button.disabled = selectionCount < 2 || this.loading;
      } else if (action === 'delete') {
        button.disabled = selectionCount === 0 || this.loading;
      }
    });
  }

  setLoading(isLoading) {
    this.loading = Boolean(isLoading);
    if (this.searchInput) {
      this.searchInput.disabled = this.loading;
    }
    this.updateActionButtons();
  }

  async handleAction(action) {
    if (this.loading) {
      return;
    }
    switch (action) {
      case 'rename':
        await this.handleRename();
        break;
      case 'merge':
        await this.handleMerge();
        break;
      case 'delete':
        await this.handleDelete();
        break;
      default:
        break;
    }
  }

  async handleRename() {
    if (this.selectedTags.size !== 1) {
      return;
    }
    const [target] = Array.from(this.selectedTags);
    const input = await this.promptForTagInput({
      title: 'Rename Tag',
      label: `Rename "#${target}" to:`,
      submitText: 'Rename',
      defaultValue: `#${target}`
    });
    if (!input) {
      return;
    }
    await this.runOperation(async (onProgress) => {
      const result = await this.tagService.renameTag(target, input, onProgress);
      this.showToast(`Renamed tag to ${input}. Updated ${result.updated} bookmarks.`);
      await this.reloadTagData(true);
    });
  }

  async handleMerge() {
    if (this.selectedTags.size < 2) {
      return;
    }
    const input = await this.promptForTagInput({
      title: 'Merge Tags',
      label: 'Merge selected tags into:',
      submitText: 'Merge',
      defaultValue: ''
    });
    if (!input) {
      return;
    }
    const tags = Array.from(this.selectedTags);
    await this.runOperation(async (onProgress) => {
      const result = await this.tagService.mergeTags(tags, input, onProgress);
      this.showToast(`Merged tags into ${input}. Updated ${result.updated} bookmarks.`);
      await this.reloadTagData(true);
    });
  }

  async handleDelete() {
    if (this.selectedTags.size === 0) {
      return;
    }
    const confirmed = await this.confirmAction({
      title: 'Delete Tags',
      message: `Remove ${this.selectedTags.size} tag${this.selectedTags.size > 1 ? 's' : ''} from all bookmarks?`,
      confirmText: 'Delete'
    });
    if (!confirmed) {
      return;
    }
    const tags = Array.from(this.selectedTags);
    await this.runOperation(async (onProgress) => {
      const result = await this.tagService.deleteTags(tags, onProgress);
      this.showToast(`Deleted tags from ${result.updated} bookmarks.`);
      await this.reloadTagData(true);
    });
  }

  async runOperation(executor) {
    this.setLoading(true);
    this.statusElement.textContent = 'Processing tags...';
    try {
      await executor((processed, total, updated) => {
        this.statusElement.textContent = `Processing ${processed}/${total} bookmarks · Updated ${updated}`;
      });
      this.statusElement.textContent = 'Operation completed.';
    } catch (error) {
      console.error('Tag operation failed:', error);
      this.statusElement.textContent = error?.message || 'Tag operation failed.';
      this.showToast(error?.message || 'Tag operation failed', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  promptForTagInput({ title, label, submitText, defaultValue }) {
    return new Promise((resolve) => {
      const modal = new Modal({
        id: `tag-input-${Date.now()}`,
        title,
        content: `
          <div class="tag-action-modal">
            <label>${label}</label>
            <input type="text" id="tag-action-input" value="${defaultValue || ''}" placeholder="#example-tag" />
          </div>
        `,
        buttons: [
          {
            text: 'Cancel',
            class: 'btn-secondary',
            onClick: (_event, instance) => {
              instance.close();
              resolve(null);
            }
          },
          {
            text: submitText || 'Confirm',
            class: 'btn-primary',
            onClick: (_event, instance) => {
              const input = instance.element.querySelector('#tag-action-input');
              const value = input?.value?.trim();
              if (!value) {
                input.classList.add('input-error');
                return;
              }
              instance.close();
              resolve(value);
            }
          }
        ]
      });
      modal.show();
      const input = modal.element.querySelector('#tag-action-input');
      if (input) {
        setTimeout(() => input.focus(), 50);
      }
    });
  }

  confirmAction({ title, message, confirmText }) {
    return new Promise((resolve) => {
      const modal = new Modal({
        id: `tag-confirm-${Date.now()}`,
        title,
        content: `<p>${message}</p>`,
        buttons: [
          {
            text: 'Cancel',
            class: 'btn-secondary',
            onClick: (_event, instance) => {
              instance.close();
              resolve(false);
            }
          },
          {
            text: confirmText || 'Confirm',
            class: 'btn-warning',
            onClick: (_event, instance) => {
              instance.close();
              resolve(true);
            }
          }
        ]
      });
      modal.show();
    });
  }
}
