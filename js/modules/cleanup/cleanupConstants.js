export const SECTION_KEYS = ['duplicates', 'stale'];

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_STALE_THRESHOLD_DAYS = 180;
export const MIN_STALE_THRESHOLD_DAYS = 7;
export const MAX_STALE_THRESHOLD_DAYS = 3650;

export const DEFAULT_STALE_THRESHOLD_MS = DEFAULT_STALE_THRESHOLD_DAYS * DAY_IN_MS;

export const ACCESS_STATS_STORAGE_KEY = 'kanbanAccessStats';
export const STALE_THRESHOLD_STORAGE_KEY = 'kanbanCleanupStaleDays';
