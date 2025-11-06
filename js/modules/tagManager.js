/*** Tag Manager - BookmarkTagDataManager
 *
 * Responsible for parsing, storing, and managing tags
 */

export class TagManager {
  constructor() {
    this.tagCache = new Map();
    this.bookmarkTags = new Map();
    this.tagColors = new Map();
  }

  /*** Extract tags from a bookmark title
   * @param {string} title Bookmark title
   * @returns {{cleanTitle: string, tags: string[]}} Cleaned title and tag list
  */
  extractTags(title) {
    if (!title || typeof title !== 'string') {
      return { cleanTitle: title || '', tags: [] };
    }

    // Match the #tag pattern, supporting alphanumeric and CJK characters
    const tagRegex = /#[\w\u4e00-\u9fa5]+/g;
    const tagMatches = title.match(tagRegex) || [];

    // Remove the leading # character
    const tags = tagMatches.map(match => match.substring(1).toLowerCase());

    // Remove tags from the title and collapse consecutive spaces
    let cleanTitle = title.replace(tagRegex, '').trim();
    cleanTitle = cleanTitle.replace(/\s+/g, ' '); // Collapse multiple spaces

    return { cleanTitle, tags };
  }

  /*** Process a bookmark, extract tags, and cache metadata
   * @param {Object} bookmark Bookmark object
   * @returns {Object} Processed bookmark data including tag info
  */
  processBookmark(bookmark) {
    const { cleanTitle, tags } = this.extractTags(bookmark.title);

    // Create an enhanced bookmark object
    const enhancedBookmark = {
      ...bookmark,
      originalTitle: bookmark.title,
      cleanTitle: cleanTitle || bookmark.title,
      tags: tags
    };

    // Cache tag data
    if (tags.length > 0) {
      this.bookmarkTags.set(bookmark.id, tags);

      // Generate or reuse colors for each tag
      tags.forEach(tag => {
        if (!this.tagColors.has(tag)) {
          this.tagColors.set(tag, this.generateTagColor(tag));
        }
      });
    } else {
      // Clear stale cache entries when the bookmark no longer has tags
      this.bookmarkTags.delete(bookmark.id);
    }

    return enhancedBookmark;
  }

  /*** Process an array of bookmarks
   * @param {Array} bookmarks Bookmark array
   * @returns {Array} Processed bookmark array
  */
  processBookmarks(bookmarks) {
    return bookmarks.map(bookmark => this.processBookmark(bookmark));
  }

  /*** Get tags for a bookmark
   * @param {string} bookmarkId Bookmark ID
   * @returns {Array} Tag array
  */
  getBookmarkTags(bookmarkId) {
    return this.bookmarkTags.get(bookmarkId) || [];
  }

  /*** Get all unique tags
   * @returns {Array} Tag array
  */
  getAllTags() {
    const allTags = new Set();
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }

  /*** Group bookmark IDs by tag
   * @returns {Map} Mapping from tag to bookmark ID array
  */
  groupBookmarksByTags() {
    const tagGroups = new Map();

    this.bookmarkTags.forEach((tags, bookmarkId) => {
      tags.forEach(tag => {
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag).push(bookmarkId);
      });
    });

    return tagGroups;
  }

  /*** Generate a deterministic color for a tag
   * @param {string} tag Tag name
   * @returns {string} HSL color value
  */
  generateTagColor(tag) {
    // Use a simple hash to provide consistent colors
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert the hash into an HSL color
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 20); //60-80%
    const lightness = 45 + (Math.abs(hash) % 15);  //45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /*** Get the color associated with a tag
   * @param {string} tag Tag name
   * @returns {string} HSL color value
  */
  getTagColor(tag) {
    return this.tagColors.get(tag) || this.generateTagColor(tag);
  }

  /*** Find bookmarks containing any of the provided tags
   * @param {Array} tags Tags to search for
   * @returns {Array} Matching bookmark IDs
  */
  findBookmarksByTags(tags) {
    const matchingBookmarks = new Set();

    tags.forEach(tag => {
      this.bookmarkTags.forEach((bookmarkTags, bookmarkId) => {
        if (bookmarkTags.includes(tag)) {
          matchingBookmarks.add(bookmarkId);
        }
      });
    });

    return Array.from(matchingBookmarks);
  }

  /*** Filter bookmark IDs by tags
   * @param {Array} bookmarkIds Bookmark ID array
   * @param {Array} filterTags Tag filter array
   * @returns {Array} Filtered bookmark IDs
  */
  filterBookmarksByTags(bookmarkIds, filterTags) {
    if (!filterTags || filterTags.length === 0) {
      return bookmarkIds;
    }

    return bookmarkIds.filter(bookmarkId => {
      const bookmarkTags = this.getBookmarkTags(bookmarkId);
      return filterTags.some(filterTag => bookmarkTags.includes(filterTag));
    });
  }

  /*** ClearCacheData
   */
  clearCache() {
    this.tagCache.clear();
    this.bookmarkTags.clear();
    this.tagColors.clear();
  }

  /*** Get aggregated statistics for tag usage
   * @returns {Object} Tag usage statistics
   */
  getStatistics() {
    const stats = {
      totalBookmarks: this.bookmarkTags.size,
      totalTags: this.tagColors.size,
      tagUsage: new Map()
    };

    // Count how many times each tag is used
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => {
        stats.tagUsage.set(tag, (stats.tagUsage.get(tag) || 0) + 1);
      });
    });

    return stats;
  }
}

// Export a singleton instance for reuse throughout the app
export const tagManager = new TagManager();
