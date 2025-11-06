/*** Tag Manager - BookmarkTagDataManager
 *
 * 负责Tag的解析、Storage、管理等功能
 */

export class TagManager {
  constructor() {
    this.tagCache = new Map();
    this.bookmarkTags = new Map();
    this.tagColors = new Map();
  }

  /*** 从BookmarkTitle中提取Tag
   * @param {string} title BookmarkTitle
   * @returns {{cleanTitle: string, tags: string[]}} 清理后的Title和TagArray
   */
  extractTags(title) {
    if (!title || typeof title !== 'string') {
      return { cleanTitle: title || '', tags: [] };
    }

    //匹配 #Tag 格式，Support中英文和Number
    const tagRegex = /#[\w\u4e00-\u9fa5]+/g;
    const tagMatches = title.match(tagRegex) || [];

    //提取Tag（去掉#号）
    const tags = tagMatches.map(match => match.substring(1));

    //从Title中RemoveTag，清理多余Empty格
    let cleanTitle = title.replace(tagRegex, '').trim();
    cleanTitle = cleanTitle.replace(/\s+/g, ' '); //合并多个Empty格

    return { cleanTitle, tags };
  }

  /*** HandleBookmarkData，提取并CacheTag信息
   * @param {Object} bookmark BookmarkObject
   * @returns {Object} Handle后的BookmarkData（包含Tag信息）
   */
  processBookmark(bookmark) {
    const { cleanTitle, tags } = this.extractTags(bookmark.title);

    //Create增强的BookmarkObject
    const enhancedBookmark = {
      ...bookmark,
      originalTitle: bookmark.title,
      cleanTitle: cleanTitle || bookmark.title,
      tags: tags
    };

    //CacheTag信息
    if (tags.length > 0) {
      this.bookmarkTags.set(bookmark.id, tags);

      //为每个Tag生成/GetColor
      tags.forEach(tag => {
        if (!this.tagColors.has(tag)) {
          this.tagColors.set(tag, this.generateTagColor(tag));
        }
      });
    } else {
      //NoneTag时清理Cache，避免残留旧Data
      this.bookmarkTags.delete(bookmark.id);
    }

    return enhancedBookmark;
  }

  /*** 批量HandleBookmarkArray
   * @param {Array} bookmarks BookmarkArray
   * @returns {Array} Handle后的BookmarkArray
   */
  processBookmarks(bookmarks) {
    return bookmarks.map(bookmark => this.processBookmark(bookmark));
  }

  /*** GetBookmark的Tag
   * @param {string} bookmarkId BookmarkID
   * @returns {Array} TagArray
   */
  getBookmarkTags(bookmarkId) {
    return this.bookmarkTags.get(bookmarkId) || [];
  }

  /*** Get所有唯一Tag
   * @returns {Array} TagArray
   */
  getAllTags() {
    const allTags = new Set();
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }

  /*** 按TagGroupBookmarkID
   * @returns {Map} Tag到BookmarkIDArray的映射
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

  /*** 生成Tag的统一Color
   * @param {string} tag TagName
   * @returns {string} HSLColorValue
   */
  generateTagColor(tag) {
    //使用简单的哈希算法生成一致的Color
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }

    //生成HSLColor
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 20); //60-80%
    const lightness = 45 + (Math.abs(hash) % 15);  //45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /*** GetTag的Color
   * @param {string} tag TagName
   * @returns {string} HSLColorValue
   */
  getTagColor(tag) {
    return this.tagColors.get(tag) || this.generateTagColor(tag);
  }

  /*** Search包含指定Tag的Bookmark
   * @param {Array} tags 要Search的TagArray
   * @returns {Array} 匹配的BookmarkIDArray
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

  /*** 过滤包含任一指定Tag的Bookmark
   * @param {Array} bookmarkIds BookmarkIDArray
   * @param {Array} filterTags 过滤TagArray
   * @returns {Array} 过滤后的BookmarkIDArray
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

  /*** GetStatistics信息
   * @returns {Object} TagStatistics信息
   */
  getStatistics() {
    const stats = {
      totalBookmarks: this.bookmarkTags.size,
      totalTags: this.tagColors.size,
      tagUsage: new Map()
    };

    //Statistics每个Tag的使用次数
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => {
        stats.tagUsage.set(tag, (stats.tagUsage.get(tag) || 0) + 1);
      });
    });

    return stats;
  }
}

//Create全局单例实例
export const tagManager = new TagManager();
