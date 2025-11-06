/**
 * Modal Factory - 统一模态框解决方案
 *
 * 原则：
 * 1. 架构统一 (Consistency)：所有模态框100%相同的HTML结构
 * 2. 杜绝冲突 (Robustness)：统一的CSS类名，从根本上避免样式冲突
 * 3. 高可维护性 (Maintainability)：集中管理，一次修改，全部升级
 */

import { createElement } from './utils.js';

export class Modal {
  constructor(options = {}) {
    this.id = options.id || `modal-${Date.now()}`;
    this.title = options.title || 'Modal';
    this.content = options.content || '';
    this.width = options.width || '500px';
    this.maxWidth = options.maxWidth || '90vw';
    this.height = options.height || 'auto';
    this.maxHeight = options.maxHeight || '80vh';
    this.closable = options.closable !== false; // 默认可关闭
    this.closeOnBackdrop = options.closeOnBackdrop !== false; // 默认点击背景关闭
    this.closeOnEscape = options.closeOnEscape !== false; // 默认ESC键关闭
    this.showOnInit = options.showOnInit || false;

    // 自定义按钮
    this.buttons = options.buttons || [];

    // 回调函数
    this.onOpen = options.onOpen || null;
    this.onClose = options.onClose || null;
    this.beforeClose = options.beforeClose || null;

    // 内部状态
    this.element = null;
    this.isOpen = false;
    this.boundHandlers = null;

    this._create();
    this._bindGlobalEvents();
  }

  /**
   * 创建模态框DOM结构
   * @private
   */
  _create() {
    // 创建外层容器
    this.element = createElement('div', 'modal');
    this.element.id = this.id;
    this.element.setAttribute('aria-hidden', 'true');
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', `${this.id}-title`);

    // 创建内容容器
    const content = createElement('div', 'modal-content');
    content.style.width = this.width;
    content.style.maxWidth = this.maxWidth;
    content.style.height = this.height;
    content.style.maxHeight = this.maxHeight;

    // 创建头部
    const header = createElement('div', 'modal-header');

    const title = createElement('h2', 'modal-title');
    title.id = `${this.id}-title`;
    title.textContent = this.title;

    header.appendChild(title);

    // 添加关闭按钮（如果可关闭）
    if (this.closable) {
      const closeBtn = createElement('button', 'modal-close');
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Close modal');
      closeBtn.type = 'button';
      header.appendChild(closeBtn);
    }

    // 创建主体内容区域
    const body = createElement('div', 'modal-body');

    // 处理内容
    if (typeof this.content === 'string') {
      body.innerHTML = this.content;
    } else if (this.content instanceof HTMLElement) {
      body.appendChild(this.content);
    }

    // 创建底部按钮区域（如果有按钮）
    let footer = null;
    if (this.buttons.length > 0) {
      footer = createElement('div', 'modal-footer');
      this.buttons.forEach(btnConfig => {
        const button = createElement('button', 'modal-button');
        button.textContent = btnConfig.text;
        button.type = button.type || 'button';

        if (btnConfig.class) {
          button.className = `modal-button ${btnConfig.class}`;
        }

        if (btnConfig.id) {
          button.id = btnConfig.id;
        }

        if (btnConfig.disabled) {
          button.disabled = true;
        }

        // 绑定按钮事件
        if (btnConfig.onClick) {
          button.addEventListener('click', (e) => {
            btnConfig.onClick(e, this);
          });
        }

        footer.appendChild(button);
      });
    }

    // 组装结构
    content.appendChild(header);
    content.appendChild(body);
    if (footer) {
      content.appendChild(footer);
    }

    this.element.appendChild(content);

    // 绑定内部事件处理器
    this.boundHandlers = {
      closeBtn: this._handleCloseBtnClick.bind(this),
      backdrop: this._handleBackdropClick.bind(this),
      keydown: this._handleKeydown.bind(this)
    };

    // 绑定关闭按钮事件
    if (this.closable) {
      const closeBtn = header.querySelector('.modal-close');
      closeBtn.addEventListener('click', this.boundHandlers.closeBtn);
    }

    // 默认隐藏
    this.element.style.display = 'none';

    // 添加到DOM
    document.body.appendChild(this.element);
  }

  /**
   * 绑定全局事件监听器
   * @private
   */
  _bindGlobalEvents() {
    // 这些事件监听器在实例创建时绑定一次，避免重复绑定
    if (this.closeOnBackdrop) {
      this.element.addEventListener('click', this.boundHandlers.backdrop);
    }

    if (this.closeOnEscape) {
      document.addEventListener('keydown', this.boundHandlers.keydown);
    }
  }

  /**
   * 处理关闭按钮点击
   * @private
   */
  _handleCloseBtnClick(e) {
    e.preventDefault();
    this.close();
  }

  /**
   * 处理背景点击关闭
   * @private */
  _handleBackdropClick(e) {
    if (e.target === this.element) {
      this.close();
    }
  }

  /**
   * 处理ESC键关闭
   * @private
   */
  _handleKeydown(e) {
    if (e.key === 'Escape' && this.isOpen) {
      e.preventDefault();
      this.close();
    }
  }

  /**
   * 显示模态框
   */
  show() {
    if (this.isOpen) return;

    // 执行打开前回调
    if (this.onOpen) {
      this.onOpen(this);
    }

    // 更新状态
    this.isOpen = true;
    this.element.setAttribute('aria-hidden', 'false');

    // 显示模态框
    this.element.style.display = 'flex';
    this.element.classList.add('show');

    // 防止背景滚动
    document.body.style.overflow = 'hidden';

    // 焦点管理
    this._manageFocus('enter');

    return this;
  }

  /**
   * 隐藏模态框
   */
  close() {
    if (!this.isOpen) return;

    // 执行关闭前回调
    if (this.beforeClose) {
      const result = this.beforeClose(this);
      if (result === false) {
        return false; // 阻止关闭
      }
    }

    // 更新状态
    this.isOpen = false;
    this.element.setAttribute('aria-hidden', 'true');

    // 隐藏模态框
    this.element.classList.remove('show');

    // 恢复背景滚动
    document.body.style.overflow = '';

    // 焦点管理
    this._manageFocus('exit');

    // 执行关闭后回调
    if (this.onClose) {
      this.onClose(this);
    }

    return this;
  }

  /**
   * 销毁模态框
   */
  destroy() {
    if (this.isOpen) {
      this.close();
    }

    // 移除事件监听器
    if (this.boundHandlers) {
      if (this.closeOnEscape) {
        document.removeEventListener('keydown', this.boundHandlers.keydown);
      }

      if (this.closable) {
        const closeBtn = this.element?.querySelector('.modal-close');
        if (closeBtn) {
          closeBtn.removeEventListener('click', this.boundHandlers.closeBtn);
        }
      }

      if (this.closeOnBackdrop) {
        this.element?.removeEventListener('click', this.boundHandlers.backdrop);
      }
    }

    // 从DOM中移除
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // 清理引用
    this.element = null;
    this.boundHandlers = null;
  }

  /**
   * 更新模态框内容
   * @param {string|HTMLElement} content 新内容
   */
  updateContent(content) {
    const body = this.element.querySelector('.modal-body');
    if (!body) return;

    // 清空现有内容
    body.innerHTML = '';

    // 添加新内容
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }

    return this;
  }

  /**
   * 更新模态框标题
   * @param {string} title 新标题
   */
  updateTitle(title) {
    const titleElement = this.element.querySelector('.modal-title');
    if (titleElement) {
      titleElement.textContent = title;
    }

    return this;
  }

  /**
   * 获取模态框内的按钮
   * @param {string} selector 按钮选择器
   * @returns {HTMLElement|null} 按钮元素
   */
  getButton(selector) {
    return this.element.querySelector(selector);
  }

  /**
   * 禁用/启用按钮
   * @param {string} selector 按钮选择器
   * @param {boolean} disabled 是否禁用
   */
  setButtonDisabled(selector, disabled = true) {
    const button = this.getButton(selector);
    if (button) {
      button.disabled = disabled;
    }
    return this;
  }

  /**
   * 焦点管理
   * @param {string} action 'enter' | 'exit'
   * @private
   */
  _manageFocus(action) {
    if (action === 'enter') {
      // 保存当前焦点元素
      this._previousFocusElement = document.activeElement;

      // 将焦点设置到模态框内第一个可聚焦元素
      const focusableElement = this.element.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElement) {
        setTimeout(() => focusableElement.focus(), 100);
      }
    } else if (action === 'exit') {
      // 恢复之前的焦点
      if (this._previousFocusElement && this._previousFocusElement.focus) {
        setTimeout(() => this._previousFocusElement.focus(), 100);
      }
    }
  }

  /**
   * 静态工厂方法：快速创建常用类型的模态框
   */
  static createAlert(options = {}) {
    return new Modal({
      title: options.title || 'Alert',
      content: options.message || '',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      buttons: [
        {
          text: options.buttonText || 'OK',
          class: 'btn-primary',
          onClick: () => {
            if (options.onConfirm) options.onConfirm();
            return true; // 关闭模态框
          }
        }
      ],
      ...options
    });
  }

  static createConfirm(options = {}) {
    return new Modal({
      title: options.title || 'Confirm',
      content: options.message || '',
      closable: true,
      closeOnBackdrop: false, // 确认框通常不允许点击背景关闭
      closeOnEscape: true,
      buttons: [
        {
          text: options.cancelText || 'Cancel',
          class: 'btn-secondary',
          onClick: () => {
            if (options.onCancel) options.onCancel();
            return true; // 关闭模态框
          }
        },
        {
          text: options.confirmText || 'Confirm',
          class: 'btn-primary',
          onClick: () => {
            if (options.onConfirm) options.onConfirm();
            return true; // 关闭模态框
          }
        }
      ],
      ...options
    });
  }

  static createPrompt(options = {}) {
    const input = createElement('input');
    input.type = options.inputType || 'text';
    input.className = 'modal-input';
    input.placeholder = options.placeholder || '';
    input.value = options.defaultValue || '';

    return new Modal({
      title: options.title || 'Prompt',
      content: input,
      closable: true,
      closeOnBackdrop: false,
      closeOnEscape: true,
      buttons: [
        {
          text: options.cancelText || 'Cancel',
          class: 'btn-secondary',
          onClick: () => {
            if (options.onCancel) options.onCancel();
            return true;
          }
        },
        {
          text: options.confirmText || 'OK',
          class: 'btn-primary',
          onClick: () => {
            if (options.onConfirm) options.onConfirm(input.value);
            return true;
          }
        }
      ],
      ...options
    });
  }
}

// 全局模态框管理器
export class ModalManager {
  constructor() {
    this.activeModals = new Set();
    this.globalKeydownHandler = null;
    this._bindGlobalEvents();
  }

  /**
   * 绑定全局事件
   * @private
   */
  _bindGlobalEvents() {
    this.globalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        // 关闭最后打开的模态框
        const modals = Array.from(this.activeModals);
        if (modals.length > 0) {
          const lastModal = modals[modals.length - 1];
          if (lastModal.closeOnEscape) {
            lastModal.close();
          }
        }
      }
    };

    document.addEventListener('keydown', this.globalKeydownHandler);
  }

  /**
   * 注册模态框
   * @param {Modal} modal
   */
  register(modal) {
    this.activeModals.add(modal);
  }

  /**
   * 注销模态框
   * @param {Modal} modal
   */
  unregister(modal) {
    this.activeModals.delete(modal);
  }

  /**
   * 关闭所有模态框
   */
  closeAll() {
    const modals = Array.from(this.activeModals);
    modals.forEach(modal => modal.close());
  }

  /**
   * 销毁管理器
   */
  destroy() {
    document.removeEventListener('keydown', this.globalKeydownHandler);
    this.closeAll();
    this.activeModals.clear();
  }
}

// 创建全局实例
export const modalManager = new ModalManager();

// 向后兼容的便捷函数
export function createModal(options) {
  return new Modal(options);
}

export function showAlert(options) {
  return Modal.createAlert(options).show();
}

export function showConfirm(options) {
  return Modal.createConfirm(options).show();
}

export function showPrompt(options) {
  return Modal.createPrompt(options).show();
}