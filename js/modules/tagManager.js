import { themeManager } from './themeManager.js';
import { tagPalettes } from './tagPalettes.js';

/*** Tag Manager - BookmarkTagDataManager
 * Responsible for parsing, storing, and managing tags
 */
export class TagManager {
  constructor() {
    this.bookmarkTags = new Map();
    this.CUSTOM_PALETTE_KEY = 'bookmark_board_tag_palette_override';
    this.customPalettes = null;
    this.currentTheme = themeManager.getCurrentTheme();
    this.currentPalette = this.resolvePalette(this.currentTheme);

    this.loadCustomPalettes();
    this.unsubscribeThemeChange = themeManager.subscribe((theme) => {
      this.currentTheme = theme;
      this.applyThemePalette(theme);
    });

    if (typeof chrome !== 'undefined' && chrome.runtime?.onSuspend) {
      chrome.runtime.onSuspend.addListener(() => this.dispose());
    }
  }

  /*** Extract tags from a bookmark title */
  extractTags(title) {
    if (!title || typeof title !== 'string') {
      return { cleanTitle: title || '', tags: [] };
    }

    const tagRegex = /#[\w\u4e00-\u9fa5]+/g;
    const tagMatches = title.match(tagRegex) || [];
    const tags = tagMatches.map(match => match.substring(1).toLowerCase());

    let cleanTitle = title.replace(tagRegex, '').trim();
    cleanTitle = cleanTitle.replace(/\s+/g, ' ');

    return { cleanTitle, tags };
  }

  /*** Process a bookmark, extract tags, and cache metadata */
  processBookmark(bookmark) {
    const { cleanTitle, tags } = this.extractTags(bookmark.title);

    const enhancedBookmark = {
      ...bookmark,
      originalTitle: bookmark.title,
      cleanTitle: cleanTitle || bookmark.title,
      tags
    };

    if (tags.length > 0) {
      this.bookmarkTags.set(bookmark.id, tags);
    } else {
      this.bookmarkTags.delete(bookmark.id);
    }

    return enhancedBookmark;
  }

  processBookmarks(bookmarks) {
    return bookmarks.map(bookmark => this.processBookmark(bookmark));
  }

  getBookmarkTags(bookmarkId) {
    return this.bookmarkTags.get(bookmarkId) || [];
  }

  getAllTags() {
    const allTags = new Set();
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }

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

  getTagColor(tag) {
    const palette = this.currentPalette?.length ? this.currentPalette : tagPalettes.default;
    const entry = this.getPaletteEntryForTag(tag, palette);
    return {
      background: entry.bg,
      text: entry.text || this.getContrastColor(entry.bg)
    };
  }

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

  filterBookmarksByTags(bookmarkIds, filterTags) {
    if (!filterTags || filterTags.length === 0) {
      return bookmarkIds;
    }

    return bookmarkIds.filter(bookmarkId => {
      const bookmarkTags = this.getBookmarkTags(bookmarkId);
      return filterTags.some(filterTag => bookmarkTags.includes(filterTag));
    });
  }

  clearCache() {
    this.bookmarkTags.clear();
  }

  getStatistics() {
    const stats = {
      totalBookmarks: this.bookmarkTags.size,
      totalTags: 0,
      tagUsage: new Map()
    };

    const uniqueTags = new Set();
    this.bookmarkTags.forEach(tags => {
      tags.forEach(tag => {
        uniqueTags.add(tag);
        stats.tagUsage.set(tag, (stats.tagUsage.get(tag) || 0) + 1);
      });
    });

    stats.totalTags = uniqueTags.size;
    return stats;
  }

  /*** Palette management ***/
  applyThemePalette(theme) {
    this.currentPalette = this.resolvePalette(theme);
    this.refreshRenderedTagStyles();
  }

  resolvePalette(theme) {
    const themeKey = theme && typeof theme === 'string' ? theme : 'default';
    const overridePalette = this.getCustomPaletteForTheme(themeKey);
    if (overridePalette?.length) {
      return overridePalette;
    }
    if (tagPalettes[themeKey]?.length) {
      return tagPalettes[themeKey];
    }
    return tagPalettes.default;
  }

  getCustomPaletteForTheme(theme) {
    if (!this.customPalettes) {
      return null;
    }
    const palette = this.customPalettes[theme] || this.customPalettes.default;
    return Array.isArray(palette) ? palette : null;
  }

  getPaletteEntryForTag(tag, palette) {
    const normalizedPalette = palette?.length ? palette : tagPalettes.default;
    const hash = this.hashTag(tag);
    const index = Math.abs(hash) % normalizedPalette.length;
    return normalizedPalette[index];
  }

  hashTag(tag) {
    const value = tag || '';
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  getContrastColor(backgroundColor) {
    if (!backgroundColor) {
      return '#1f2937';
    }
    const rgb = this.hexToRgb(backgroundColor);
    if (!rgb) {
      return '#1f2937';
    }
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#111827' : '#f8fafc';
  }

  hexToRgb(color) {
    const hex = color.replace('#', '');
    if (!(hex.length === 3 || hex.length === 6)) {
      return null;
    }
    const normalized = hex.length === 3
      ? hex.split('').map(char => char + char).join('')
      : hex;
    const bigint = parseInt(normalized, 16);
    if (Number.isNaN(bigint)) {
      return null;
    }
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  refreshRenderedTagStyles() {
    if (typeof document === 'undefined') {
      return;
    }
    const tags = document.querySelectorAll('.bookmark-tag');
    tags.forEach(tagElement => {
      const tag = tagElement.dataset.tag;
      if (!tag) {
        return;
      }
      const { background, text } = this.getTagColor(tag);
      tagElement.style.backgroundColor = background;
      tagElement.style.color = text;
    });
  }

  /*** Custom palette API ***/
  getCustomPaletteJSON() {
    return this.customPalettes ? JSON.stringify(this.customPalettes, null, 2) : '';
  }

  getDefaultPaletteTemplate() {
    return JSON.stringify(tagPalettes, null, 2);
  }

  async saveCustomPaletteConfig(input) {
    const trimmed = (input || '').trim();
    if (!trimmed) {
      await this.clearCustomPaletteConfig();
      return { success: true, message: 'Custom palette cleared' };
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return { success: false, message: 'Invalid JSON format' };
    }

    const validated = this.validatePaletteConfig(parsed);
    if (!validated) {
      return { success: false, message: 'Invalid palette structure' };
    }

    try {
      await this.storePaletteOverrides(validated);
      this.customPalettes = validated;
      this.applyThemePalette(this.currentTheme);
      return { success: true };
    } catch (error) {
      console.error('Failed to save custom palette:', error);
      return { success: false, message: 'Failed to save palette to storage' };
    }
  }

  async clearCustomPaletteConfig() {
    try {
      await this.removePaletteOverrides();
      this.customPalettes = null;
      this.applyThemePalette(this.currentTheme);
    } catch (error) {
      console.error('Failed to clear custom palette:', error);
    }
  }

  validatePaletteConfig(config) {
    if (!config || typeof config !== 'object') {
      return null;
    }
    const normalized = {};
    Object.entries(config).forEach(([theme, palette]) => {
      if (!Array.isArray(palette)) {
        return;
      }
      const normalizedPalette = palette
        .map(entry => this.normalizePaletteEntry(entry))
        .filter(Boolean);
      if (normalizedPalette.length > 0) {
        normalized[theme] = normalizedPalette;
      }
    });
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  normalizePaletteEntry(entry) {
    if (typeof entry === 'string') {
      return { bg: entry, text: null };
    }
    if (entry && typeof entry.bg === 'string') {
      return {
        bg: entry.bg,
        text: typeof entry.text === 'string' ? entry.text : null
      };
    }
    return null;
  }

  loadCustomPalettes() {
    if (!this.canUseChromeStorage()) {
      return;
    }
    chrome.storage.sync.get([this.CUSTOM_PALETTE_KEY], (result) => {
      const stored = result?.[this.CUSTOM_PALETTE_KEY];
      const validated = this.validatePaletteConfig(stored);
      this.customPalettes = validated;
      this.applyThemePalette(this.currentTheme);
    });
  }

  storePaletteOverrides(palettes) {
    if (!this.canUseChromeStorage()) {
      this.customPalettes = palettes;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [this.CUSTOM_PALETTE_KEY]: palettes }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  removePaletteOverrides() {
    if (!this.canUseChromeStorage()) {
      this.customPalettes = null;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(this.CUSTOM_PALETTE_KEY, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  canUseChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage?.sync;
  }

  dispose() {
    if (typeof this.unsubscribeThemeChange === 'function') {
      this.unsubscribeThemeChange();
      this.unsubscribeThemeChange = null;
    }
  }
}

export const tagManager = new TagManager();
