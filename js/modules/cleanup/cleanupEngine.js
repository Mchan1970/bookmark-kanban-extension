export const STALE_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000; // 6 months
export const STATUS_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

export function buildSections(bookmarkIndex, { metadata, ignore, staleThreshold = STALE_THRESHOLD_MS }) {
  const dead = computeDeadItems(bookmarkIndex, metadata, ignore.dead);
  const duplicates = computeDuplicateItems(bookmarkIndex, ignore.duplicates);
  const stale = computeStaleItems(bookmarkIndex, metadata, ignore.stale, staleThreshold);
  return { dead, duplicates, stale };
}

export function buildStatusMap(metadata, ignore, expiration = STATUS_EXPIRATION_MS) {
  const statuses = {};
  const now = Date.now();

  Object.entries(metadata.lastKnownStatus || {}).forEach(([bookmarkId, rawStatus]) => {
    const lastChecked = metadata.lastCheckedAt?.[bookmarkId];
    if (!lastChecked) {
      return;
    }

    if (now - lastChecked > expiration) {
      return;
    }

    const normalized = normalizeStatusValue(rawStatus);
    if (!normalized) {
      return;
    }

    if (normalized === 'dead' && ignore.dead.has(bookmarkId)) {
      return;
    }

    if ((normalized === 'cert-error' || normalized === 'no-https') && ignore.dead.has(bookmarkId)) {
      return;
    }

    statuses[bookmarkId] = normalized;
  });

  return statuses;
}

export function normalizeStatusValue(status) {
  if (status === false) {
    return 'dead';
  }
  if (status === 'certificate-error') {
    return 'cert-error';
  }
  if (status === 'no-https') {
    return 'no-https';
  }
  return null;
}

function computeDeadItems(bookmarkIndex, metadata, ignoreSet) {
  const items = [];

  Object.keys(bookmarkIndex).forEach(bookmarkId => {
    if (ignoreSet.has(bookmarkId)) {
      return;
    }

    const status = metadata.lastKnownStatus?.[bookmarkId];
    if (status === undefined || status === true) {
      return;
    }

    const bookmark = bookmarkIndex[bookmarkId];
    const severity = status === false ? 'error' : 'warning';

    items.push({
      id: bookmark.id,
      type: 'dead',
      severity,
      status,
      title: bookmark.title,
      url: bookmark.url,
      folderPath: bookmark.folderPath,
      lastCheckedAt: metadata.lastCheckedAt?.[bookmarkId] || null
    });
  });

  items.sort((a, b) => {
    const timeA = a.lastCheckedAt || 0;
    const timeB = b.lastCheckedAt || 0;
    return timeB - timeA;
  });

  return items;
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

function computeStaleItems(bookmarkIndex, metadata, ignoreSet, threshold) {
  const items = [];
  const now = Date.now();

  Object.values(bookmarkIndex).forEach(bookmark => {
    const bookmarkId = bookmark.id;

    if (ignoreSet.has(bookmarkId)) {
      return;
    }

    const lastChecked = metadata.lastCheckedAt?.[bookmarkId];
    if (!lastChecked) {
      return;
    }

    const age = now - lastChecked;
    if (age < threshold) {
      return;
    }

    items.push({
      id: bookmarkId,
      type: 'stale',
      title: bookmark.title,
      url: bookmark.url,
      folderPath: bookmark.folderPath,
      lastCheckedAt: lastChecked,
      age
    });
  });

  items.sort((a, b) => b.age - a.age);
  return items;
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
