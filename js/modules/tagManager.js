/**
 * Tag Manager - 书签标签数据管理器
 *
 * 负责标签的解析、存储、管理等功能
 */

export class TagManager {
  constructor() {
    this.tagCache = new Map();
    this.bookmarkTags = new Map();
    this.tagColors = new Map();
  }

  /**
   * 从书签标题中提取标签
   * @param {string} title 书签标题
   * @returns {{cleanTitle: string, tags: string[]}} 清理后的标题和标签数组
   */
  extractTags(title) {
    if (!title || typeof title !== 'string') {
      return { cleanTitle: title || '', tags: [] };
    }

    // 匹配 #标签 格式，支持中英文和数字
    const tagRegex = /#[\w\u4e00-\u9fa5]+/g;
    const tagMatches = title.match(tagRegex) || [];

    // 提取标签（去掉#号）
    const tags = tagMatches.map(match => match.substring(1));

    // 从标题中移除标签，清理多余空格
    let cleanTitle = title.replace(tagRegex, '').trim();
    cleanTitle = cleanTitle.replace(/\s+/g, ' '); // 合并多个空格

    return { cleanTitle, tags };
  }

  /**
   * 处理书签数据，提取并缓存标签信息
   * @param {Object} bookmark 书签对象
   * @returns {Object} 处理后的书签数据（包含标签信息）
   */
  processBookmark(bookmark) {
    const { cleanTitle, tags } = this.extractTags(bookmark.title);

    // 创建增强的书签对象
    const enhancedBookmark = {
      ...bookmark,
      originalTitle: bookmark.title,
      cleanTitle: cleanTitle || bookmark.title,
      tags: tags
    };

    // 缓存标签信息
    if (tags.length > 0) {
      this.bookmarkTags.set(bookmark.id, tags);

      // 为每个标签生成/获取颜色
      tags.forEach(tag => {
        if (!this.tagColors.has(tag)) {
          this.tagColors.set(tag, this.generateTagColor(tag));
        }
      });
    } else {
      // 无标签时清理缓存，避免残留旧数据
      this.bookmarkTags.delete(bookmark.id);
    }

    return enhancedBookmark;
  }

  /**
   * 批量处理书签数组
   * @param {Array} bookmarks 书签数组
   * @returns {Array} 处理后的书签数组
   */
  processBookmarks(bookmarks) {
    return bookmarks.map(bookmark => this.processBookmark(bookmark));
  }

  /**
   * 获取书签的标签
   * @param {string} bookmarkId 书签ID
   * @returns {Array} 标签数组
   */
  getBookmarkTags(bookmarkId) {
    return this.bookmarkTags.get(bookmarkId) || [];
  }

  /**
   * 获取所有唯一标签
   * @returns {Array} 标签数组
   */
  getAllTags() {
    const allTags = new Set();
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }

  /**
   * 按标签分组书签ID
   * @returns {Map} 标签到书签ID数组的映射
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

  /**
   * 生成标签的统一颜色
   * @param {string} tag 标签名称
   * @returns {string} HSL颜色值
   */
  generateTagColor(tag) {
    // 使用简单的哈希算法生成一致的颜色
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }

    // 生成HSL颜色
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
    const lightness = 45 + (Math.abs(hash) % 15);  // 45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * 获取标签的颜色
   * @param {string} tag 标签名称
   * @returns {string} HSL颜色值
   */
  getTagColor(tag) {
    return this.tagColors.get(tag) || this.generateTagColor(tag);
  }

  /**
   * 搜索包含指定标签的书签
   * @param {Array} tags 要搜索的标签数组
   * @returns {Array} 匹配的书签ID数组
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

  /**
   * 过滤包含任一指定标签的书签
   * @param {Array} bookmarkIds 书签ID数组
   * @param {Array} filterTags 过滤标签数组
   * @returns {Array} 过滤后的书签ID数组
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

  /**
   * 清空缓存数据
   */
  clearCache() {
    this.tagCache.clear();
    this.bookmarkTags.clear();
    this.tagColors.clear();
  }

  /**
   * 获取统计信息
   * @returns {Object} 标签统计信息
   */
  getStatistics() {
    const stats = {
      totalBookmarks: this.bookmarkTags.size,
      totalTags: this.tagColors.size,
      tagUsage: new Map()
    };

    // 统计每个标签的使用次数
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => {
        stats.tagUsage.set(tag, (stats.tagUsage.get(tag) || 0) + 1);
      });
    });

    return stats;
  }
}

// 创建全局单例实例
export const tagManager = new TagManager();
