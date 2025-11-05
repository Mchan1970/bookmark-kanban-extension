/**
 * Tag Renderer - 标签UI渲染器
 *
 * 负责标签的视觉展示和交互效果
 */

import { createElement } from './utils.js';
import { tagManager } from './tagManager.js';

export class TagRenderer {
  constructor() {
    this.maxVisibleTags = 3; // 最多显示的标签数量
    this.onTagClick = null;   // 标签点击回调
    this.onTagFilter = null;  // 标签过滤回调
  }

  /**
   * 设置标签点击回调
   * @param {Function} callback 点击回调函数
   */
  setTagClickCallback(callback) {
    this.onTagClick = callback;
  }

  /**
   * 设置标签过滤回调
   * @param {Function} callback 过滤回调函数
   */
  setTagFilterCallback(callback) {
    this.onTagFilter = callback;
  }

  /**
   * 创建标签元素
   * @param {string} tag 标签文本
   * @param {Object} options 选项
   * @returns {HTMLElement} 标签元素
   */
  createTagElement(tag, options = {}) {
    const {
      size = 'small',      // small, medium, large
      clickable = true,    // 是否可点击
      removable = false,   // 是否可删除
      showCount = false    // 是否显示计数
    } = options;

    const tagElement = createElement('span', `bookmark-tag bookmark-tag--${size}`);
    tagElement.textContent = tag;
    tagElement.setAttribute('data-tag', tag);

    // 设置标签颜色
    const color = tagManager.getTagColor(tag);
    tagElement.style.backgroundColor = color;

    // 根据背景色调整文字颜色（确保可读性）
    tagElement.style.color = this.getContrastColor(color);

    // 添加点击事件
    if (clickable) {
      tagElement.classList.add('bookmark-tag--clickable');
      tagElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTagClick(tag, e);
      });
    }

    // 添加删除按钮
    if (removable) {
      const removeButton = createElement('button', 'bookmark-tag__remove');
      removeButton.innerHTML = '×';
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTagRemove(tag, e);
      });
      tagElement.appendChild(removeButton);
    }

    // 添加计数显示
    if (showCount) {
      const count = tagManager.getStatistics().tagUsage.get(tag) || 0;
      if (count > 1) {
        const countElement = createElement('span', 'bookmark-tag__count');
        countElement.textContent = count;
        tagElement.appendChild(countElement);
      }
    }

    return tagElement;
  }

  /**
   * 创建标签容器
   * @param {Array} tags 标签数组
   * @param {Object} options 选项
   * @returns {HTMLElement} 标签容器元素
   */
  createTagContainer(tags, options = {}) {
    const {
      size = 'small',
      clickable = true,
      showMore = true,
      maxTags = this.maxVisibleTags
    } = options;

    if (!tags || tags.length === 0) {
      return null;
    }

    const container = createElement('div', 'bookmark-tags');

    // 显示前N个标签
    const visibleTags = tags.slice(0, maxTags);
    const hiddenTags = tags.slice(maxTags);

    // 渲染可见标签
    visibleTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, { size, clickable });
      container.appendChild(tagElement);
    });

    // 如果有更多标签，显示"更多"指示器
    if (showMore && hiddenTags.length > 0) {
      const moreElement = createElement('span', 'bookmark-tags__more');
      moreElement.textContent = `+${hiddenTags.length}`;
      moreElement.title = hiddenTags.join(', ');

      // 为"更多"指示器添加悬停效果
      moreElement.addEventListener('mouseenter', (e) => {
        this.showHiddenTagsTooltip(e, hiddenTags);
      });

      container.appendChild(moreElement);
    }

    return container;
  }

  /**
   * 创建标签过滤器
   * @param {Array} availableTags 可用标签数组
   * @param {Array} activeTags 当前激活的标签数组
   * @returns {HTMLElement} 标签过滤器元素
   */
  createTagFilter(availableTags, activeTags = []) {
    const filterContainer = createElement('div', 'tag-filter');

    // 创建标题
    const title = createElement('div', 'tag-filter__title');
    title.textContent = '标签筛选';
    filterContainer.appendChild(title);

    // 创建标签列表
    const tagList = createElement('div', 'tag-filter__list');

    // 添加"全部"选项
    const allTag = this.createTagElement('全部', {
      size: 'medium',
      clickable: false,
      showCount: true
    });
    allTag.classList.add('bookmark-tag--clickable');
    allTag.classList.toggle('tag-filter__item--active', activeTags.length === 0);
    allTag.addEventListener('click', () => {
      this.handleFilterClear();
    });
    tagList.appendChild(allTag);

    // 添加各个标签选项
    availableTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, {
        size: 'medium',
        clickable: false,
        showCount: true
      });
      tagElement.classList.add('bookmark-tag--clickable');

      // 标记为激活状态
      if (activeTags.includes(tag)) {
        tagElement.classList.add('tag-filter__item--active');
      }

      // 添加点击事件
      tagElement.addEventListener('click', () => {
        this.handleFilterToggle(tag);
      });

      tagList.appendChild(tagElement);
    });

    filterContainer.appendChild(tagList);

    // 添加清除按钮
    if (activeTags.length > 0) {
      const clearButton = createElement('button', 'tag-filter__clear');
      clearButton.textContent = '清除筛选';
      clearButton.addEventListener('click', () => {
        this.handleFilterClear();
      });
      filterContainer.appendChild(clearButton);
    }

    return filterContainer;
  }

  /**
   * 处理标签点击事件
   * @param {string} tag 标签名称
   * @param {Event} event 点击事件
   */
  handleTagClick(tag, event) {
    if (this.onTagClick) {
      this.onTagClick(tag, event);
    }
  }

  /**
   * 处理标签删除事件
   * @param {string} tag 标签名称
   * @param {Event} event 点击事件
   */
  handleTagRemove(tag, event) {
    // TODO: 实现标签删除逻辑
    console.log(`Remove tag: ${tag}`);
  }

  /**
   * 处理过滤器切换事件
   * @param {string} tag 标签名称
   */
  handleFilterToggle(tag) {
    if (this.onTagFilter) {
      this.onTagFilter(tag);
    }
  }

  /**
   * 处理清除过滤器事件
   */
  handleFilterClear() {
    if (this.onTagFilter) {
      this.onTagFilter(null); // null 表示清除所有筛选
    }
  }

  /**
   * 显示隐藏标签的提示框
   * @param {Event} event 鼠标事件
   * @param {Array} hiddenTags 隐藏的标签数组
   */
  showHiddenTagsTooltip(event, hiddenTags) {
    // TODO: 实现工具提示显示逻辑
    console.log('Hidden tags:', hiddenTags);
  }

  /**
   * 根据背景色获取对比色（确保文字可读性）
   * @param {string} backgroundColor 背景色（HSL格式）
   * @returns {string} 对比色
   */
  getContrastColor(backgroundColor) {
    // 解析HSL颜色
    const match = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return '#ffffff';

    const lightness = parseInt(match[3]);

    // 根据亮度选择合适的文字颜色
    return lightness > 55 ? '#333333' : '#ffffff';
  }

  /**
   * 更新标签激活状态
   * @param {HTMLElement} filterContainer 过滤器容器
   * @param {Array} activeTags 激活的标签数组
   */
  updateFilterActiveState(filterContainer, activeTags) {
    const tagItems = filterContainer.querySelectorAll('.tag-filter__item');

    tagItems.forEach(item => {
      const tag = item.getAttribute('data-tag');
      if (tag === '全部') {
        item.classList.toggle('tag-filter__item--active', activeTags.length === 0);
      } else {
        item.classList.toggle('tag-filter__item--active', activeTags.includes(tag));
      }
    });

    // 更新清除按钮显示状态
    const clearButton = filterContainer.querySelector('.tag-filter__clear');
    if (clearButton) {
      clearButton.style.display = activeTags.length > 0 ? 'block' : 'none';
    }
  }

  /**
   * 创建标签编辑器
   * @param {Array} currentTags 当前标签数组
   * @returns {HTMLElement} 标签编辑器元素
   */
  createTagEditor(currentTags = []) {
    const editorContainer = createElement('div', 'tag-editor');

    // 创建输入框
    const input = createElement('input', 'tag-editor__input');
    input.type = 'text';
    input.placeholder = '输入标签，按回车添加';
    input.setAttribute('data-current-tags', JSON.stringify(currentTags));

    // 创建标签显示区域
    const tagDisplay = createElement('div', 'tag-editor__display');

    // 显示当前标签
    currentTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, {
        size: 'medium',
        removable: true
      });
      tagDisplay.appendChild(tagElement);
    });

    // 添加输入事件处理
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleTagAdd(input.value, tagDisplay, input);
      } else if (e.key === 'Backspace' && input.value === '') {
        // 删除最后一个标签
        const lastTag = tagDisplay.querySelector('.bookmark-tag:last-child');
        if (lastTag) {
          lastTag.remove();
        }
      }
    });

    // 添加失焦事件处理
    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        this.handleTagAdd(input.value, tagDisplay, input);
      }
    });

    editorContainer.appendChild(tagDisplay);
    editorContainer.appendChild(input);

    return editorContainer;
  }

  /**
   * 处理添加标签事件
   * @param {string} inputValue 输入值
   * @param {HTMLElement} tagDisplay 标签显示区域
   * @param {HTMLElement} input 输入框
   */
  handleTagAdd(inputValue, tagDisplay, input) {
    const value = inputValue.trim();
    if (!value) return;

    // 检查是否是标签格式
    let tag = value;
    if (!value.startsWith('#')) {
      tag = '#' + value;
    }

    // 检查是否已存在
    const existingTags = Array.from(tagDisplay.querySelectorAll('.bookmark-tag'))
      .map(el => el.getAttribute('data-tag'));

    if (existingTags.includes(tag)) {
      input.value = '';
      return;
    }

    // 添加新标签
    const tagElement = this.createTagElement(tag, {
      size: 'medium',
      removable: true
    });
    tagDisplay.appendChild(tagElement);

    // 清空输入框
    input.value = '';
    input.focus();
  }
}

// 创建全局单例实例
export const tagRenderer = new TagRenderer();
