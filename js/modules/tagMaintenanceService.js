import { tagManager } from './tagManager.js';

const TAG_REGEX = /#[\w\u4e00-\u9fa5-]+/g;

export class TagMaintenanceService {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
  }

  normalizeTagInput(tag) {
    if (!tag) {
      return '';
    }
    const trimmed = tag.trim();
    if (!trimmed) {
      return '';
    }
    const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    return withoutHash.toLowerCase();
  }

  sanitizeTagLabel(tag) {
    if (!tag) {
      return '';
    }
    const trimmed = tag.trim();
    if (!trimmed) {
      return '';
    }
    const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    return withoutHash;
  }

  validateTagName(tag) {
    const sanitized = this.sanitizeTagLabel(tag);
    if (!sanitized) {
      return { valid: false, message: 'Tag name cannot be empty.' };
    }
    const tagPattern = /^[\w\u4e00-\u9fa5-]+$/;
    if (!tagPattern.test(sanitized)) {
      return { valid: false, message: 'Tag name contains invalid characters.' };
    }
    return { valid: true, value: sanitized };
  }

  async renameTag(oldTag, newTag, onProgress) {
    const normalizedOld = this.normalizeTagInput(oldTag);
    const validation = this.validateTagName(newTag);
    if (!normalizedOld) {
      throw new Error('Select a tag to rename.');
    }
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    const sanitizedNew = validation.value;
    const normalizedNew = sanitizedNew.toLowerCase();
    if (normalizedOld === normalizedNew) {
      throw new Error('New tag name must be different.');
    }

    const replacements = {
      [normalizedOld]: `#${sanitizedNew}`
    };

    return this.applyTagTransform(replacements, onProgress);
  }

  async mergeTags(sourceTags, targetTag, onProgress) {
    if (!Array.isArray(sourceTags) || sourceTags.length < 2) {
      throw new Error('Select at least two tags to merge.');
    }
    const validation = this.validateTagName(targetTag);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    const sanitizedTarget = validation.value;
    const normalizedTarget = sanitizedTarget.toLowerCase();

    const replacements = {};
    sourceTags.forEach(tag => {
      const normalized = this.normalizeTagInput(tag);
      if (normalized && normalized !== normalizedTarget) {
        replacements[normalized] = `#${sanitizedTarget}`;
      }
    });

    if (Object.keys(replacements).length === 0) {
      throw new Error('Nothing to merge.');
    }

    return this.applyTagTransform(replacements, onProgress);
  }

  async deleteTags(tags, onProgress) {
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error('Select tags to delete.');
    }
    const replacements = {};
    tags.forEach(tag => {
      const normalized = this.normalizeTagInput(tag);
      if (normalized) {
        replacements[normalized] = '';
      }
    });

    if (Object.keys(replacements).length === 0) {
      throw new Error('No valid tags selected for deletion.');
    }

    return this.applyTagTransform(replacements, onProgress);
  }

  async applyTagTransform(replacements, onProgress) {
    const bookmarks = await this.collectAllBookmarks();
    const total = bookmarks.length;
    let processed = 0;
    let updated = 0;

    for (const bookmark of bookmarks) {
      const { changed, title } = this.transformTitle(bookmark.title, replacements);
      if (changed) {
        await this.bookmarkManager.updateBookmark(bookmark.id, { title });
        updated++;
      }
      processed++;
      if (typeof onProgress === 'function') {
        onProgress(processed, total, updated);
      }
    }

    if (updated > 0) {
      tagManager.clearCache();
      await this.bookmarkManager.refreshBookmarkTree();
    }

    return { processed, updated };
  }

  transformTitle(title, replacements) {
    if (!title) {
      return { changed: false, title };
    }
    const tagRegex = new RegExp(TAG_REGEX.source, TAG_REGEX.flags);
    let changed = false;
    const newTitle = title.replace(tagRegex, (match) => {
      const normalized = match.substring(1).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(replacements, normalized)) {
        changed = true;
        return replacements[normalized];
      }
      return match;
    });

    if (!changed) {
      return { changed: false, title };
    }

    return {
      changed: true,
      title: this.cleanupTitle(newTitle)
    };
  }

  cleanupTitle(value) {
    if (!value) {
      return value;
    }
    return value
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.!?:;])/g, '$1')
      .trim();
  }

  async collectAllBookmarks() {
    const tree = await this.bookmarkManager.getBookmarkTree();
    const bookmarks = [];

    const traverse = (nodes) => {
      if (!nodes) {
        return;
      }
      nodes.forEach(node => {
        if (node.url) {
          bookmarks.push({ id: node.id, title: node.title || '' });
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };

    traverse(tree);
    return bookmarks;
  }
}
