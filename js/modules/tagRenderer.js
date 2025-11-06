/*** Tag Renderer - Tag UI Renderer
 *
 * Handles visual display and interaction effects for tags
 */

import { createElement } from './utils.js';
import { tagManager } from './tagManager.js';

export class TagRenderer {
  constructor() {
    this.maxVisibleTags = 3; //Maximum number of visible tags
    this.onTagClick = null;   //Tag click callback
    this.onTagFilter = null;  //Tag filter callback
  }

  /*** Set tag click callback
   * @param {Function} callback ClickCallbackFunction
   */
  setTagClickCallback(callback) {
    this.onTagClick = callback;
  }

  /*** SettingsTag过滤Callback
   * @param {Function} callback 过滤CallbackFunction
   */
  setTagFilterCallback(callback) {
    this.onTagFilter = callback;
  }

  /*** CreateTagElement
   * @param {string} tag TagText
   * @param {Object} options Options
   * @returns {HTMLElement} TagElement
   */
  createTagElement(tag, options = {}) {
    const {
      size = 'small',      //small, medium, large
      clickable = true,    //Whether可Click
      removable = false,   //Whether可Delete
      showCount = false    //WhetherShowCount
    } = options;

    const tagElement = createElement('span', `bookmark-tag bookmark-tag--${size}`);
    tagElement.textContent = tag;
    tagElement.setAttribute('data-tag', tag);

    //SettingsTagColor
    const color = tagManager.getTagColor(tag);
    tagElement.style.backgroundColor = color;

    //根据Background色调整文字Color（确保可读性）
    tagElement.style.color = this.getContrastColor(color);

    //AddClickEvent
    if (clickable) {
      tagElement.classList.add('bookmark-tag--clickable');
      tagElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTagClick(tag, e);
      });
    }

    //AddDeleteButton
    if (removable) {
      const removeButton = createElement('button', 'bookmark-tag__remove');
      removeButton.innerHTML = '×';
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTagRemove(tag, e);
      });
      tagElement.appendChild(removeButton);
    }

    //AddCountShow
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

  /*** CreateTagContainer
   * @param {Array} tags TagArray
   * @param {Object} options Options
   * @returns {HTMLElement} TagContainerElement
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

    //Show前N个Tag
    const visibleTags = tags.slice(0, maxTags);
    const hiddenTags = tags.slice(maxTags);

    //渲染VisibleTag
    visibleTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, { size, clickable });
      container.appendChild(tagElement);
    });

    //If有MoreTag，Show"More"Indicator
    if (showMore && hiddenTags.length > 0) {
      const moreElement = createElement('span', 'bookmark-tags__more');
      moreElement.textContent = `+${hiddenTags.length}`;
      moreElement.title = hiddenTags.join(', ');

      //为"More"IndicatorAddHover效果
      moreElement.addEventListener('mouseenter', (e) => {
        this.showHiddenTagsTooltip(e, hiddenTags);
      });

      container.appendChild(moreElement);
    }

    return container;
  }

  /*** CreateTagFilter
   * @param {Array} availableTags 可用TagArray
   * @param {Array} activeTags When前Active的TagArray
   * @returns {HTMLElement} TagFilterElement
   */
  createTagFilter(availableTags, activeTags = []) {
    const filterContainer = createElement('div', 'tag-filter');

    //CreateTitle
    const title = createElement('div', 'tag-filter__title');
    title.textContent = 'Filter by Tags';
    filterContainer.appendChild(title);

    //CreateTagList
    const tagList = createElement('div', 'tag-filter__list');

    //Add"All"Options
    const allTag = this.createTagElement('All', {
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

    //Add各个TagOptions
    availableTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, {
        size: 'medium',
        clickable: false,
        showCount: true
      });
      tagElement.classList.add('bookmark-tag--clickable');

      //Mark为ActiveState
      if (activeTags.includes(tag)) {
        tagElement.classList.add('tag-filter__item--active');
      }

      //AddClickEvent
      tagElement.addEventListener('click', () => {
        this.handleFilterToggle(tag);
      });

      tagList.appendChild(tagElement);
    });

    filterContainer.appendChild(tagList);

    //Add清除Button
    if (activeTags.length > 0) {
      const clearButton = createElement('button', 'tag-filter__clear');
      clearButton.textContent = 'Clear Filter';
      clearButton.addEventListener('click', () => {
        this.handleFilterClear();
      });
      filterContainer.appendChild(clearButton);
    }

    return filterContainer;
  }

  /*** HandleTagClickEvent
   * @param {string} tag TagName
   * @param {Event} event ClickEvent
   */
  handleTagClick(tag, event) {
    if (this.onTagClick) {
      this.onTagClick(tag, event);
    }
  }

  /*** HandleTagDeleteEvent
   * @param {string} tag TagName
   * @param {Event} event ClickEvent
   */
  handleTagRemove(tag, event) {
    //TODO: 实现TagDelete逻辑
    console.log(`Remove tag: ${tag}`);
  }

  /*** HandleFilter切换Event
   * @param {string} tag TagName
   */
  handleFilterToggle(tag) {
    if (this.onTagFilter) {
      this.onTagFilter(tag);
    }
  }

  /*** Handle清除FilterEvent
   */
  handleFilterClear() {
    if (this.onTagFilter) {
      this.onTagFilter(null); //null 表示清除所有Filter
    }
  }

  /*** ShowHiddenTag的Tooltip框
   * @param {Event} event 鼠标Event
   * @param {Array} hiddenTags Hidden的TagArray
   */
  showHiddenTagsTooltip(event, hiddenTags) {
    //TODO: 实现工具TooltipShow逻辑
    console.log('Hidden tags:', hiddenTags);
  }

  /*** 根据Background色Get对比色（确保文字可读性）
   * @param {string} backgroundColor Background色（HSL格式）
   * @returns {string} 对比色
   */
  getContrastColor(backgroundColor) {
    //解析HSLColor
    const match = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return '#ffffff';

    const lightness = parseInt(match[3]);

    //根据亮度Select合适的文字Color
    return lightness > 55 ? '#333333' : '#ffffff';
  }

  /*** UpdateTagActiveState
   * @param {HTMLElement} filterContainer FilterContainer
   * @param {Array} activeTags Active的TagArray
   */
  updateFilterActiveState(filterContainer, activeTags) {
    const tagItems = filterContainer.querySelectorAll('.tag-filter__item');

    tagItems.forEach(item => {
      const tag = item.getAttribute('data-tag');
      if (tag === 'All') {
        item.classList.toggle('tag-filter__item--active', activeTags.length === 0);
      } else {
        item.classList.toggle('tag-filter__item--active', activeTags.includes(tag));
      }
    });

    //Update清除ButtonShowState
    const clearButton = filterContainer.querySelector('.tag-filter__clear');
    if (clearButton) {
      clearButton.style.display = activeTags.length > 0 ? 'block' : 'none';
    }
  }

  /*** CreateTagEdit器
   * @param {Array} currentTags When前TagArray
   * @returns {HTMLElement} TagEdit器Element
   */
  createTagEditor(currentTags = []) {
    const editorContainer = createElement('div', 'tag-editor');

    //CreateInput
    const input = createElement('input', 'tag-editor__input');
    input.type = 'text';
    input.placeholder = '输入标签，按回车添加';
    input.setAttribute('data-current-tags', JSON.stringify(currentTags));

    //CreateTagShow区域
    const tagDisplay = createElement('div', 'tag-editor__display');

    //ShowWhen前Tag
    currentTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, {
        size: 'medium',
        removable: true
      });
      tagDisplay.appendChild(tagElement);
    });

    //Add输入EventHandle
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleTagAdd(input.value, tagDisplay, input);
      } else if (e.key === 'Backspace' && input.value === '') {
        //DeleteFinally一个Tag
        const lastTag = tagDisplay.querySelector('.bookmark-tag:last-child');
        if (lastTag) {
          lastTag.remove();
        }
      }
    });

    //Add失焦EventHandle
    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        this.handleTagAdd(input.value, tagDisplay, input);
      }
    });

    editorContainer.appendChild(tagDisplay);
    editorContainer.appendChild(input);

    return editorContainer;
  }

  /*** HandleAddTagEvent
   * @param {string} inputValue 输入Value
   * @param {HTMLElement} tagDisplay TagShow区域
   * @param {HTMLElement} input Input
   */
  handleTagAdd(inputValue, tagDisplay, input) {
    const value = inputValue.trim();
    if (!value) return;

    //CheckWhether是Tag格式
    let tag = value;
    if (!value.startsWith('#')) {
      tag = '#' + value;
    }

    //CheckWhether已存在
    const existingTags = Array.from(tagDisplay.querySelectorAll('.bookmark-tag'))
      .map(el => el.getAttribute('data-tag'));

    if (existingTags.includes(tag)) {
      input.value = '';
      return;
    }

    //Add新Tag
    const tagElement = this.createTagElement(tag, {
      size: 'medium',
      removable: true
    });
    tagDisplay.appendChild(tagElement);

    //ClearInput
    input.value = '';
    input.focus();
  }
}

//Create全局单例实例
export const tagRenderer = new TagRenderer();
