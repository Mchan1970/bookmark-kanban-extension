# Cleanup Feature Plan

## Overview

Add a "Cleanup" entry to the top bar that surfaces suggestions for maintaining the bookmark board. The focus is on dead links, duplicate bookmarks, and stale (long-unchecked) entries. The goal is to surface actionable recommendations without cluttering the main board, while avoiding any new sensitive permissions.

## Categories & Signals

### Dead Links
- Source existing `siteChecker` results (`false` status).
- Each entry should include bookmark id, title, column id/title.
- Actions: Delete (move to recycle/undo queue), Ignore, View on board.

### Duplicate Bookmarks
- Build a URL → bookmark-id list while traversing bookmarks.
- Groups with more than one entry become duplicate suggestions.
- Actions: Keep selected / Delete selected / Ignore group.

### Stale Bookmarks
- Rationale: replace the “long-unused” concept to avoid requesting `chrome.history` or similar sensitive permissions.
- Signal: rely on the `siteChecker` timestamp (`lastSuccessfulCheck`); if a bookmark has not been verified for more than N months (e.g., 6), flag it as stale.
- Actions: Archive (move to a hidden archive column), Delete, Ignore.

## UI & Flow

1. **Cleanup Button**
   - Placed near the search bar in the header.
   - Displays a badge indicating total suggestions.
   - Tooltip: “Cleanup suggestions available”.

2. **Cleanup Panel**
   - Modal or side panel listing categories and counts.
   - Each category shows collapsible sections with selectable rows.
   - Top/bottom toolbar shows selected count and available actions.
   - Clicking an item highlights the bookmark on the board.

3. **Operations**
   - Bulk select per category.
   - Confirm destructive actions with a dialog.
   - Provide toast feedback plus Undo; deletions/archives always route through a soft-delete (Recycle Bin).
   - Ignored suggestions stored in `chrome.storage.local` to prevent repeat prompts.

## Data Requirements

```json
{
  "deadLinks": [{ "id": "...", "title": "...", "url": "...", "columnId": "...", "columnTitle": "..." }],
  "duplicates": [
    {
      "url": "...",
      "bookmarks": [{ "id": "...", "title": "...", "columnId": "...", "columnTitle": "..." }]
    }
  ],
  "stale": [{ "id": "...", "title": "...", "url": "...", "columnId": "...", "columnTitle": "...", "lastAccessed": "ISO string" }]
}
```

## Implementation Phases

1. **Phase 1 (MVP)**
   - Dead links and duplicate detection using current data.
   - Cleanup modal with bulk delete/ignore/archive.
   - Soft-delete: deleted items move to a Recycle Bin; provide contextual Undo.
   - Highlight bookmark when “View” is triggered.

2. **Phase 2**
   - Stale detection based on `lastSuccessfulCheck`.
   - Dedicated Archive column management UI（view & restore archived items）.
   - Ignore-list persistence and basic analytics.

3. **Phase 3 (Optional Enhancements)**
   - Smart suggestions (auto-tagging).
   - Export filtered lists or cleanup reports.
   - Scheduled reminders (e.g., monthly cleanup prompt).

## Notes

- All destructive operations should funnel through a recycle/undo mechanism to avoid accidental loss.
- Archive provides a “soft” alternative to delete; communicate clearly that archived items can be restored.
- Keep the cleanup logic decoupled so future categories can be appended.
- Maintain minimal visual disruption: the board UI remains untouched until the user acts on suggestions.
