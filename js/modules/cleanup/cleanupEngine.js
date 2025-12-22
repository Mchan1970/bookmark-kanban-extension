export function flattenBookmarks(tree) {
  const index = {};
  if (!Array.isArray(tree)) {
    return index;
  }

  const stack = tree.map(node => ({ node, path: [] }));

  while (stack.length > 0) {
    const { node, path } = stack.pop();

    if (node.url) {
      index[node.id] = {
        id: node.id,
        title: node.title || '(No title)',
        url: node.url,
        parentId: node.parentId || null,
        folderPath: path.join(' / ') || 'Bookmarks Bar',
        dateAdded: node.dateAdded || Date.now()
      };
      continue;
    }

    if (node.children && node.children.length > 0) {
      const nextPath = node.title ? [...path, node.title] : [...path];
      node.children.forEach(child => {
        stack.push({ node: child, path: nextPath });
      });
    }
  }

  return index;
}

export function buildSections(bookmarkIndex, { ignore, accessStats = {}, staleThreshold }) {
  const duplicates = computeDuplicateItems(bookmarkIndex, ignore.duplicates || new Set());
  const stale = computeStaleItems(bookmarkIndex, accessStats, ignore.stale || new Set(), staleThreshold);
  return { duplicates, stale };
}

function computeDuplicateItems(bookmarkIndex, ignoreSet) {
  const groups = new Map();

  Object.values(bookmarkIndex).forEach(bookmark => {
    if (!bookmark.url) {
      return;
    }

    const groupId = normalizeUrl(bookmark.url);
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        allBookmarks: [],
        displayUrl: bookmark.url
      });
    }
    const group = groups.get(groupId);
    group.allBookmarks.push(bookmark);
    if (!group.displayUrl && bookmark.url) {
      group.displayUrl = bookmark.url;
    }
  });

  const duplicateGroups = [];

  groups.forEach((group, groupId) => {
    if (group.allBookmarks.length < 2) {
      return;
    }

    const activeBookmarks = group.allBookmarks.filter(bookmark => !ignoreSet.has(bookmark.id));
    if (activeBookmarks.length < 2) {
      return;
    }

    duplicateGroups.push({
      type: 'duplicates',
      groupId,
      url: activeBookmarks[0].url || group.displayUrl,
      totalCount: activeBookmarks.length,
      bookmarks: activeBookmarks.map(bookmark => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        folderPath: bookmark.folderPath
      }))
    });
  });

  duplicateGroups.sort((a, b) => a.url.localeCompare(b.url));
  return duplicateGroups;
}

function computeStaleItems(bookmarkIndex, accessStats, ignoreSet, threshold = 180 * 24 * 60 * 60 * 1000) {
  if (!threshold) {
    return [];
  }

  const items = [];
  const now = Date.now();

  Object.values(bookmarkIndex).forEach(bookmark => {
    const bookmarkId = bookmark.id;

    if (ignoreSet.has(bookmarkId)) {
      return;
    }

    const stats = accessStats[bookmarkId];
    let isStale = false;
    let age = 0;
    let lastVisitedAt = null;
    let visitCount = 0;
    let neverVisited = false;

    if (stats?.lastVisitedAt) {
      // Case A: Has access records - check last visit time
      age = now - stats.lastVisitedAt;
      if (age > threshold) {
        isStale = true;
        lastVisitedAt = stats.lastVisitedAt;
        visitCount = stats.visitCount || 0;
      }
    } else {
      // Case B: No access records - check addition time
      const addedAge = now - (bookmark.dateAdded || 0);
      if (addedAge > threshold) {
        isStale = true;
        age = addedAge;
        neverVisited = true;
      }
    }

    if (isStale) {
      items.push({
        id: bookmarkId,
        type: 'stale',
        title: bookmark.title,
        url: bookmark.url,
        folderPath: bookmark.folderPath,
        lastVisitedAt,
        visitCount,
        age,
        neverVisited
      });
    }
  });

  items.sort((a, b) => b.age - a.age);
  return items;
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+/g, '/');

    const params = Array.from(url.searchParams.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const queryPart = params ? `?${params}` : '';
    return `${host}${path}${queryPart}`;
  } catch (error) {
    return rawUrl.trim().toLowerCase();
  }
}
