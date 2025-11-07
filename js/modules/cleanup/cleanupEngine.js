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
        folderPath: path.join(' / ') || 'Bookmarks Bar'
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

export function buildSections(bookmarkIndex, { ignore }) {
  const duplicates = computeDuplicateItems(bookmarkIndex, ignore.duplicates || new Set());
  return { duplicates };
}

function computeDuplicateItems(bookmarkIndex, ignoreSet) {
  const groups = new Map();

  Object.values(bookmarkIndex).forEach(bookmark => {
    if (!bookmark.url) {
      return;
    }

    const groupId = normalizeUrl(bookmark.url);
    if (!groups.has(groupId)) {
      groups.set(groupId, []);
    }
    groups.get(groupId).push(bookmark);
  });

  const duplicateItems = [];

  groups.forEach((bookmarks, groupId) => {
    if (bookmarks.length < 2) {
      return;
    }

    bookmarks.forEach(bookmark => {
      if (ignoreSet.has(bookmark.id)) {
        return;
      }

      duplicateItems.push({
        id: bookmark.id,
        type: 'duplicates',
        groupId,
        title: bookmark.title,
        url: bookmark.url,
        folderPath: bookmark.folderPath,
        duplicateCount: bookmarks.length
      });
    });
  });

  duplicateItems.sort((a, b) => a.title.localeCompare(b.title));
  return duplicateItems;
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');

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
