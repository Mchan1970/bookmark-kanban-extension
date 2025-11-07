export class BookmarkActionMenu {
  constructor(onAction) {
    this.onAction = onAction;
    this.currentBookmark = null;
    this.menuElement = this.createMenuElement();
    document.body.appendChild(this.menuElement);
    this.visible = false;

    document.addEventListener('click', (event) => {
      if (!this.visible) return;
      if (event.target.closest('.bookmark-action-menu')) {
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

  createMenuElement() {
    const menu = document.createElement('div');
    menu.className = 'bookmark-action-menu';
    menu.setAttribute('role', 'menu');
    menu.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }
      event.preventDefault();
      const action = button.dataset.action;
      if (typeof this.onAction === 'function' && this.currentBookmark) {
        this.onAction(action, this.currentBookmark);
      }
      this.hide();
    });
    return menu;
  }

  show(options) {
    if (!options) {
      return;
    }
    this.hide();
    this.currentBookmark = {
      id: options.id,
      url: options.url
    };
    this.renderMenu();
    this.positionMenu(options);
    this.menuElement.classList.add('visible');
    this.visible = true;
    document.body.classList.add('bookmark-menu-open');
  }

  hide() {
    if (!this.visible) return;
    this.menuElement.classList.remove('visible');
    this.visible = false;
    document.body.classList.remove('bookmark-menu-open');
  }

  renderMenu() {
    const fragment = document.createDocumentFragment();

    fragment.appendChild(this.createMenuButton('Edit', 'edit'));
    fragment.appendChild(this.createMenuButton('Archive', 'archive'));
    fragment.appendChild(this.createMenuButton('Delete', 'delete', { danger: true }));
    fragment.appendChild(this.createDivider());

    fragment.appendChild(this.createMenuButton('Copy link', 'copy-link'));

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

  createDivider() {
    const divider = document.createElement('div');
    divider.className = 'bookmark-action-menu__divider';
    return divider;
  }

  positionMenu(options) {
    const menu = this.menuElement;
    const { anchorRect, position } = options;

    let top = 0;
    let left = 0;

    if (anchorRect) {
      const rect = anchorRect;
      const menuWidth = menu.offsetWidth || 180;
      top = rect.bottom + 6 + window.scrollY;
      left = rect.right - menuWidth + window.scrollX;
    } else if (position) {
      top = position.y + window.scrollY;
      left = position.x + window.scrollX;
    }

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
