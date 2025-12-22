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

  /*** Set the tag filter callback
   * @param {Function} callback Filter callback function
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
      size = 'small',      // small, medium, large
      clickable = true,    // Whether the tag is clickable
      removable = false,   // Whether the tag can be removed
      showCount = false    // Whether to display usage count
    } = options;

    const tagElement = createElement('span', `bookmark-tag bookmark-tag--${size}`);
    tagElement.textContent = tag;
    tagElement.setAttribute('data-tag', tag);

    // Apply tag color
    const { background, text } = tagManager.getTagColor(tag);
    tagElement.style.backgroundColor = background;
    tagElement.style.color = text;

    // Attach click handler if applicable
    if (clickable) {
      tagElement.classList.add('bookmark-tag--clickable');
      tagElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTagClick(tag, e);
      });
    }

    // Append a remove button when tags are removable
    if (removable) {
      const removeButton = createElement('button', 'bookmark-tag__remove');
      removeButton.innerHTML = '×';
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTagRemove(tag, e);
      });
      tagElement.appendChild(removeButton);
    }

    // Show usage count when requested
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

    // Render the first N tags
    const visibleTags = tags.slice(0, maxTags);
    const hiddenTags = tags.slice(maxTags);

    // Render visible tags
    visibleTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, { size, clickable });
      container.appendChild(tagElement);
    });

    // If there are hidden tags, display a “more” indicator
    if (showMore && hiddenTags.length > 0) {
      const moreElement = createElement('span', 'bookmark-tags__more');
      moreElement.textContent = `+${hiddenTags.length}`;
      moreElement.title = hiddenTags.join(', ');

      // Show hidden tags on hover
      moreElement.addEventListener('mouseenter', (e) => {
        this.showHiddenTagsTooltip(e, hiddenTags);
      });

      container.appendChild(moreElement);
    }

    return container;
  }

  /*** Create the tag filter markup
   * @param {Array} availableTags Available tag list
   * @param {Array} activeTags Currently active tag list
   * @returns {HTMLElement} Tag filter element
  */
  createTagFilter(availableTags, activeTags = []) {
    const filterContainer = createElement('div', 'tag-filter');

    // Create title element
    const title = createElement('div', 'tag-filter__title');
    title.textContent = 'Filter by Tags';
    filterContainer.appendChild(title);

    // Container for tag chips
    const tagList = createElement('div', 'tag-filter__list');

    // Add the “All” option
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

    // Add each tag option
    availableTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, {
        size: 'medium',
        clickable: false,
        showCount: true
      });
      tagElement.classList.add('bookmark-tag--clickable');

      // Mark as active when currently selected
      if (activeTags.includes(tag)) {
        tagElement.classList.add('tag-filter__item--active');
      }

      // Wire up click handler
      tagElement.addEventListener('click', () => {
        this.handleFilterToggle(tag);
      });

      tagList.appendChild(tagElement);
    });

    filterContainer.appendChild(tagList);

    // Append a clear button when filters are active
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

  /*** Handle a request to remove a tag chip
   * @param {string} tag Tag name
   * @param {Event} event Click event
  */
  handleTagRemove(tag, event) {
    // TODO: Implement tag removal logic when tag editing is enabled
  }

  /*** Handle tag filter toggles
   * @param {string} tag Tag name
  */
  handleFilterToggle(tag) {
    if (this.onTagFilter) {
      this.onTagFilter(tag);
    }
  }

  /*** Clear the active tag filter
  */
  handleFilterClear() {
    if (this.onTagFilter) {
      this.onTagFilter(null); // null means clear all filters
    }
  }

  /*** Show a tooltip for hidden tags
   * @param {Event} event Mouse event
   * @param {Array} hiddenTags Hidden tag array
  */
  showHiddenTagsTooltip(event, hiddenTags) {
    // TODO: Provide a richer tooltip UI if needed
  }

  /*** Update the active-state styling and clear button
   * @param {HTMLElement} filterContainer Filter container element
  * @param {Array} activeTags Active tag array
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

    // Toggle the visibility of the clear button
    const clearButton = filterContainer.querySelector('.tag-filter__clear');
    if (clearButton) {
      clearButton.style.display = activeTags.length > 0 ? 'block' : 'none';
    }
  }

  /*** Create the inline tag editor
   * @param {Array} currentTags Current tag array
   * @returns {HTMLElement} Tag editor element
  */
  createTagEditor(currentTags = []) {
    const editorContainer = createElement('div', 'tag-editor');

    // Create input element
    const input = createElement('input', 'tag-editor__input');
    input.type = 'text';
    input.placeholder = 'Enter a tag and press Enter';
    input.setAttribute('data-current-tags', JSON.stringify(currentTags));

    // Container to display current tags
    const tagDisplay = createElement('div', 'tag-editor__display');

    // Render existing tags
    currentTags.forEach(tag => {
      const tagElement = this.createTagElement(tag, {
        size: 'medium',
        removable: true
      });
      tagDisplay.appendChild(tagElement);
    });

    // Handle keyboard input
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleTagAdd(input.value, tagDisplay, input);
      } else if (e.key === 'Backspace' && input.value === '') {
        // Remove the last tag when backspace is pressed on empty input
        const lastTag = tagDisplay.querySelector('.bookmark-tag:last-child');
        if (lastTag) {
          lastTag.remove();
        }
      }
    });

    // Remove the editor when it loses focus
    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        this.handleTagAdd(input.value, tagDisplay, input);
      }
    });

    editorContainer.appendChild(tagDisplay);
    editorContainer.appendChild(input);

    return editorContainer;
  }

  /*** Handle manual tag additions
   * @param {string} inputValue Raw input value
   * @param {HTMLElement} tagDisplay Tag display container
   * @param {HTMLElement} input Input element
  */
  handleTagAdd(inputValue, tagDisplay, input) {
    const value = inputValue.trim();
    if (!value) return;

    // Ensure the value is formatted as a tag
    let tag = value;
    if (!value.startsWith('#')) {
      tag = '#' + value;
    }

    // Avoid adding duplicates
    const existingTags = Array.from(tagDisplay.querySelectorAll('.bookmark-tag'))
      .map(el => el.getAttribute('data-tag'));

    if (existingTags.includes(tag)) {
      input.value = '';
      return;
    }

    // Append the new tag
    const tagElement = this.createTagElement(tag, {
      size: 'medium',
      removable: true
    });
    tagDisplay.appendChild(tagElement);

    // Reset the input field
    input.value = '';
    input.focus();
  }
}

// Export a shared singleton instance
export const tagRenderer = new TagRenderer();
