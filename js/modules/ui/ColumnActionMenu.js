export class ColumnActionMenu {
  constructor(onAction) {
    this.onAction = onAction;
    this.currentColumn = null;
    this.visible = false;
    this.menuElement = this.createMenuElement();
    document.body.appendChild(this.menuElement);
    this.bindGlobalListeners();
  }

  createMenuElement() {
    const menu = document.createElement('div');
    menu.className = 'column-action-menu';
    menu.setAttribute('role', 'menu');
    menu.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || !this.currentColumn) {
        return;
      }
      event.preventDefault();
      const action = button.dataset.action;
      if (typeof this.onAction === 'function') {
        this.onAction(action, this.currentColumn);
      }
      this.hide();
    });
    return menu;
  }

  bindGlobalListeners() {
    document.addEventListener('click', (event) => {
      if (!this.visible) {
        return;
      }
      if (event.target.closest('.column-action-menu')) {
        return;
      }
      this.hide();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.visible) {
        this.hide();
      }
    });

    window.addEventListener('resize', () => this.hide());
    window.addEventListener('scroll', () => this.hide(), true);
  }

  show(options) {
    if (!options?.columnElement) {
      return;
    }
    this.hide();
    this.currentColumn = {
      element: options.columnElement,
      folderId: options.folderId,
      columnType: options.columnType,
      title: options.title
    };
    this.renderMenu();
    this.positionMenu(options);
    this.menuElement.classList.add('visible');
    this.visible = true;
  }

  hide() {
    if (!this.visible) {
      return;
    }
    this.menuElement.classList.remove('visible');
    this.visible = false;
    this.currentColumn = null;
  }

  renderMenu() {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(this.createMenuButton('Rename column', 'rename-column'));
    fragment.appendChild(this.createMenuButton('Delete column', 'delete-column', { danger: true }));
    this.menuElement.innerHTML = '';
    this.menuElement.appendChild(fragment);
  }

  createMenuButton(label, action, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.textContent = label;
    if (options.danger) {
      button.classList.add('danger');
    }
    if (options.disabled) {
      button.disabled = true;
    }
    return button;
  }

  positionMenu(options) {
    const menu = this.menuElement;
    const { anchorRect } = options;

    if (!anchorRect) {
      return;
    }

    const menuWidth = menu.offsetWidth || 160;
    let top = anchorRect.bottom + 6 + window.scrollY;
    let left = anchorRect.right - menuWidth + window.scrollX;

    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - 12;
    }
    if (left < 8) {
      left = 8;
    }

    if (top + menuRect.height > viewportHeight + window.scrollY) {
      top = viewportHeight + window.scrollY - menuRect.height - 12;
    }
    if (top < window.scrollY + 8) {
      top = window.scrollY + 8;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }
}
