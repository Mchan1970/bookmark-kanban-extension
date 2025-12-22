import { ACCESS_STATS_STORAGE_KEY } from './cleanup/cleanupConstants.js';

export class AccessTracker {
  constructor() {
    this.urlToBookmarks = new Map(); // normalized URL -> Set of bookmarkIds
    this.bookmarkUrls = new Map();   // bookmarkId -> normalized URL
    this.accessStats = {};
    this.STATS_KEY = ACCESS_STATS_STORAGE_KEY;
    this.saveTimer = null;
  }

  async initialize() {
    await Promise.all([
      this.buildBookmarkIndex(),
      this.loadAccessStats()
    ]);
    this.registerListeners();
  }

  async buildBookmarkIndex() {
    const tree = await chrome.bookmarks.getTree();
    const traverse = (nodes) => {
      nodes.forEach(node => {
        if (node.url) {
          this.addBookmarkToIndex(node.id, node.url);
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    console.log(`[AccessTracker] Built bookmark index: ${this.bookmarkUrls.size} bookmarks, ${this.urlToBookmarks.size} unique URLs`);
  }

  async loadAccessStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STATS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          this.accessStats = {};
          resolve();
          return;
        }
        this.accessStats = result[this.STATS_KEY] || {};
        resolve();
      });
    });
  }

  registerListeners() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab?.url) {
        // DEBUG: Trigger info
        console.log(`[AccessTracker] Tracker triggered for URL: ${tab.url}`);
        this.recordVisit(tab.url);
      }
    });

    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      if (bookmark?.url) {
        this.addBookmarkToIndex(id, bookmark.url);
      }
    });

    chrome.bookmarks.onRemoved.addListener((id) => {
      this.removeBookmarkFromIndex(id);
      if (this.accessStats[id]) {
        delete this.accessStats[id];
        this.scheduleSave();
      }
    });

    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      if (changeInfo?.url) {
        this.updateBookmarkUrl(id, changeInfo.url);
      }
    });

    chrome.bookmarks.onImportBegan?.addListener(() => {
      // optional hook if available; just clear map to rebuild after import
      this.urlToBookmarks.clear();
      this.bookmarkUrls.clear();
    });

    chrome.bookmarks.onImportEnded?.addListener(() => {
      this.buildBookmarkIndex();
    });
  }

  addBookmarkToIndex(bookmarkId, rawUrl) {
    const normalized = this.normalizeUrl(rawUrl);
    if (!normalized) {
      return;
    }
    this.bookmarkUrls.set(bookmarkId, normalized);
    if (!this.urlToBookmarks.has(normalized)) {
      this.urlToBookmarks.set(normalized, new Set());
    }
    this.urlToBookmarks.get(normalized).add(bookmarkId);
  }

  removeBookmarkFromIndex(bookmarkId) {
    const url = this.bookmarkUrls.get(bookmarkId);
    if (!url) {
      return;
    }
    const idSet = this.urlToBookmarks.get(url);
    if (idSet) {
      idSet.delete(bookmarkId);
      if (idSet.size === 0) {
        this.urlToBookmarks.delete(url);
      }
    }
    this.bookmarkUrls.delete(bookmarkId);
  }

  updateBookmarkUrl(bookmarkId, newUrl) {
    this.removeBookmarkFromIndex(bookmarkId);
    this.addBookmarkToIndex(bookmarkId, newUrl);
  }

  recordVisit(rawUrl) {
    // DEBUG: Normalization info
    const normalized = this.normalizeUrl(rawUrl);
    console.log(`[AccessTracker] Normalized URL: ${normalized}`);

    if (!normalized) {
      console.log(`[AccessTracker] Normalization failed for URL: ${rawUrl}`);
      return;
    }

    // DEBUG: Map status
    console.log(`[AccessTracker] Current Bookmark Map Size: ${this.urlToBookmarks.size}`);

    // Try direct match first
    let bookmarkIds = this.urlToBookmarks.get(normalized);
    console.log(`[AccessTracker] Direct lookup result: ${bookmarkIds ? Array.from(bookmarkIds) : undefined}`);

    // If no direct match, try fuzzy matching
    if (!bookmarkIds || bookmarkIds.size === 0) {
      bookmarkIds = this.findMatchingBookmarks(normalized);
      console.log(`[AccessTracker] Fuzzy lookup result: ${bookmarkIds ? Array.from(bookmarkIds) : undefined}`);
    }

    if (!bookmarkIds || bookmarkIds.size === 0) {
      console.log(`[AccessTracker] No bookmarks found for URL: ${normalized}`);
      return;
    }

    const timestamp = Date.now();
    let changed = false;
    bookmarkIds.forEach((bookmarkId) => {
      const stats = this.accessStats[bookmarkId] || { visitCount: 0, lastVisitedAt: 0 };
      stats.visitCount = (stats.visitCount || 0) + 1;
      stats.lastVisitedAt = timestamp;
      this.accessStats[bookmarkId] = stats;
      changed = true;
      console.log(`[AccessTracker] Updated stats for bookmark ${bookmarkId}:`, stats);
    });
    if (changed) {
      this.scheduleSave();
    }
  }

  scheduleSave() {
    if (this.saveTimer) {
      return;
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      chrome.storage.local.set({ [this.STATS_KEY]: this.accessStats }, () => {
        // ignore errors; storage writes are best-effort
      });
    }, 1000);
  }

  findMatchingBookmarks(normalizedUrl) {
    const visitingUrl = new URL(normalizedUrl);
    const visitingDomain = visitingUrl.hostname;
    const visitingPath = visitingUrl.pathname + visitingUrl.search;

    console.log(`[AccessTracker] Looking for matches with domain: ${visitingDomain}, path: ${visitingPath}`);

    // Find potential matches
    const matches = new Set();

    for (const [bookmarkUrl, bookmarkIds] of this.urlToBookmarks.entries()) {
      try {
        const bookmarkUrlObj = new URL(bookmarkUrl);
        const bookmarkDomain = bookmarkUrlObj.hostname;
        const bookmarkPath = bookmarkUrlObj.pathname + bookmarkUrlObj.search;

        // Check if domains are related (remove www, check subdomains)
        const isDomainMatch = this.isDomainMatch(visitingDomain, bookmarkDomain);

        // Check if paths are similar
        const isPathMatch = this.isPathMatch(visitingPath, bookmarkPath);

        // NEW: Check for subdomain-to-path redirect (e.g., koutu.gaoding.com vs gaoding.com/koutu)
        const isSubdomainMatch = this.isSubdomainMatch(bookmarkUrlObj, visitingUrl);

        // NEW STRATEGY: Check if bookmark's subdomain became visit's path
        const isSubdomainToPathMatch = this.isSubdomainToPathMatch(bookmarkUrl, normalizedUrl);

        console.log(`[AccessTracker] Comparing with ${bookmarkUrl}: domain=${isDomainMatch}, path=${isPathMatch}, subdomain=${isSubdomainMatch}, subdomain-to-path=${isSubdomainToPathMatch}`);

        if ((isDomainMatch && isPathMatch) || isSubdomainMatch || isSubdomainToPathMatch) {
          console.log(`[AccessTracker] MATCH FOUND: ${bookmarkUrl} (domain=${isDomainMatch}, path=${isPathMatch}, subdomain=${isSubdomainMatch}, subdomain-to-path=${isSubdomainToPathMatch})`);
          bookmarkIds.forEach(id => matches.add(id));
        }
      } catch (error) {
        console.log(`[AccessTracker] Error parsing bookmark URL: ${bookmarkUrl}`);
      }
    }

    return matches.size > 0 ? matches : null;
  }

  isDomainMatch(domain1, domain2) {
    // Remove www. prefix
    const cleanDomain1 = domain1.replace(/^www\./, '');
    const cleanDomain2 = domain2.replace(/^www\./, '');

    // Direct match
    if (cleanDomain1 === cleanDomain2) {
      return true;
    }

    // Check if one is subdomain of the other
    const parts1 = cleanDomain1.split('.');
    const parts2 = cleanDomain2.split('.');

    // Get the last 2 parts (domain + tld)
    const baseDomain1 = parts1.slice(-2).join('.');
    const baseDomain2 = parts2.slice(-2).join('.');

    return baseDomain1 === baseDomain2;
  }

  // Helper: Detect if bookmark's subdomain matches the visit's path
  // e.g. Bookmark "koutu.gaoding.com" vs Visit "gaoding.com/koutu"
  isSubdomainMatch(bookmarkUrlObj, visitUrlObj) {
    try {
      // 1. Check Base Domain Match first
      if (!this.isDomainMatch(bookmarkUrlObj.hostname, visitUrlObj.hostname)) {
        return false;
      }

      // 2. Extract Subdomain from Bookmark
      // Remove 'www.' first to be safe
      const cleanHost = bookmarkUrlObj.hostname.replace(/^www\./, '');
      const parts = cleanHost.split('.');

      // Needs at least 3 parts to have a subdomain (e.g. koutu.gaoding.com)
      // If it's just 'gaoding.com', parts.length is 2.
      if (parts.length < 3) return false;

      // Assume the first part is the specific subdomain (e.g. 'koutu')
      const subdomain = parts[0];

      // Ignore generic subdomains like 'm', 'mobile', 'app' if you want, or keep them.
      // Definitely ignore 'www' (though stripped above)
      if (subdomain === 'www') return false;

      // 3. Check if Visit Path starts with this subdomain
      // Visit path: "/koutu" or "/koutu/..."
      const visitPath = visitUrlObj.pathname.toLowerCase();
      if (visitPath === `/${subdomain}` || visitPath.startsWith(`/${subdomain}/`)) {
        console.log(`[AccessTracker] Subdomain redirect match: ${subdomain} -> ${visitPath}`);
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * 策略：检查书签的子域名是否变成了访问链接的路径
   * Case: Bookmark="https://koutu.gaoding.com/" vs Visit="https://www.gaoding.com/koutu"
   */
  isSubdomainToPathMatch(bookmarkUrlStr, visitUrlStr) {
    try {
      const bm = new URL(bookmarkUrlStr);
      const visit = new URL(visitUrlStr);

      // 1. 基础域名必须一致 (gaoding.com === gaoding.com)
      if (!this.isDomainMatch(bm.hostname, visit.hostname)) {
        return false;
      }

      // 2. 提取书签的有效子域名
      // 移除 www, 移除主域名部分
      // koutu.gaoding.com -> [koutu, gaoding, com] -> subdomain = koutu
      const bmHost = bm.hostname.replace(/^www\./, '');
      const parts = bmHost.split('.');

      // 如果没有子域名 (如 gaoding.com)，则不适用此策略
      if (parts.length < 3) return false;

      const subdomain = parts[0]; // 获取第一个部分作为子域名

      // 3. 检查访问路径是否以该子域名开头
      // visit path: /koutu OR /koutu/edit
      const visitPath = visit.pathname;

      // 匹配逻辑：路径就是 "/koutu" 或者路径以 "/koutu/" 开头
      if (visitPath === `/${subdomain}` || visitPath.startsWith(`/${subdomain}/`)) {
        console.log(`[AccessTracker] 🎯 Subdomain-to-Path Hit! Subdomain "${subdomain}" matches path "${visitPath}"`);
        return true;
      }

      return false;
    } catch (e) {
      console.error('[AccessTracker] Subdomain check error', e);
      return false;
    }
  }

  isPathMatch(visitPath, bookmarkPath) {
    // Helper: Normalize path (remove trailing slash, ensure empty becomes /)
    const normalize = (p) => {
      if (!p || p === '/') return '/';
      // Remove all trailing slashes
      const cleaned = p.replace(/\/+$/, '');
      return cleaned || '/';
    };

    const pVisit = normalize(visitPath);
    const pBookmark = normalize(bookmarkPath);

    console.log(`[AccessTracker] Path comparison: visit="${pVisit}" vs bookmark="${pBookmark}"`);

    // 1. Direct match
    if (pVisit === pBookmark) {
      console.log(`[AccessTracker] Direct path match`);
      return true;
    }

    // 2. Root Bookmark Strategy (The Fix)
    // If the bookmark points to the root (/), then ANY visit to this domain matches.
    // Example: Bookmark "https://site.com/" matches visit "https://site.com/subpage"
    if (pBookmark === '/') {
      console.log(`[AccessTracker] Bookmark is root (/), allowing match for subpath`);
      return true;
    }

    // 3. Parent/Child Match
    // Check if visit path starts with bookmark path + '/'
    // Example: Visit "/blog/post-1", Bookmark "/blog" -> Matches
    if (pVisit.startsWith(pBookmark + '/')) {
      console.log(`[AccessTracker] Parent/Child path match`);
      return true;
    }

    return false;
  }

  normalizeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }

      // Handle special case for root path
      let normalizedPath = url.pathname.replace(/\/+/g, '/');
      if (normalizedPath === '' || normalizedPath === '/') {
        normalizedPath = '/';
      } else {
        // Remove trailing slash for non-root paths
        normalizedPath = normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) : normalizedPath;
      }

      return `${url.origin}${normalizedPath}${url.search}`.toLowerCase();
    } catch (error) {
      return null;
    }
  }
}
