# Cleanup Feature – Execution Plan

This document converts the approved product proposal into actionable work items, aligned with our existing styling/system.

---

## 1. Component Breakdown (existing style system)
| Module | Notes | Owner |
| ------ | ----- | ----- |
| Header extension | Add `[Cleanup]` button + badge in existing header layout; reuse current button/badge styles | Frontend |
| Cleanup modal | Build `CleanupPanel` using existing modal structure (header/title/body/footer). List rows inherit current list/table styles | Frontend |
| Suggestion items | Leverage existing typography, icons; warning/error palette reuse | Frontend |
| Toast & Undo | Extend `notificationManager` toast messages for archive/delete | Frontend |
| Archive / Recycle views | Within Settings page, add sections displaying archived/deleted bookmarks | Frontend |

---

## 2. Engineering Tasks
1. **Cleanup data layer**
   - Aggregation store for dead, duplicate, stale; handle ignore lists.
   - Duplicate detection (normalized URL).
   - Stale detection using `siteChecker.lastSuccessfulCheck`.
   - Persistence via `chrome.storage.local`.

2. **UI interactions**
   - Header badge, cleanup panel, category list, selection, actions.
   - Archive/delete/ignore buttons invoking new APIs.
   - Toast + Undo integration.
   - Scroll/highlight on “View on board”.

3. **Archive & recycle logic**
   - Implement archive manager (hidden column/folder).
   - Implement recycle bin manager.
   - Provide restore/permanent delete flows.

4. **Analytics logging**
   - Events: `cleanup_panel_opened`, `cleanup_action_taken` with payload (`type`, `action`, `count`), `cleanup_undo_clicked`.

5. **Testing & feature flag**
   - QA for clean-up flows, undo, archive view.
   - Feature flag for staged rollout.

---

## 3. Outstanding Decisions (PM direction/reference)
1. Archive & Recycle access: Settings page + link in cleanup panel footer.
2. Iconography: reuse existing assets (Archive = box, Delete = trash bin); ensure consistent messaging (“Archive” vs “Delete”).
3. Event schema (see analytics logging).
4. Rollout via feature flag (1% → 100%).

---

## 4. Milestones
1. Spec/tickets created & assigned.
2. API/data aggregation layer ready.
3. UI integration (header, modal) complete.
4. QA pass (manual + automated).
5. Feature flag rollout (1%).
6. Monitor & ramp up to 100%.

---

## 5. Immediate Next Steps
1. Create Story/Sub-tasks per engineering item above.
2. Kick off UI component work (header, modal).
3. Align QA on regression scope.
4. Plan feature-flag rollout + monitoring.

---

## Appendix: System Status Badges (Phase 1 Spec)

### Goal
Surface bookmark health (dead link, HTTPS issue, certificate issue) directly on the board without mutating user-authored data such as titles or `#tags`. Badges act as read-only system metadata that mirrors Cleanup results.

### UX Principles
- **Do not modify user-facing text**: no auto-appended `#dead` tags or title edits.
- **Consistent lifecycle**: detection → badge appears → user resolves in Cleanup (or ignores) → badge disappears.
- **High visibility, low intrusion**: small icon + tooltip near existing site-status affordances.

### Badge Placement & Styles
- Render a compact status chip on each bookmark card, right-aligned inside the metadata row (reuse `.bookmark-status` styling; add variants for dead/cert/http).
- Iconography:
  - Dead (`status === false`): red dot + “Dead link” tooltip.
  - Certificate issue: amber warning triangle + “Certificate issue detected”.
  - HTTP-only: neutral grey shield + “HTTPS unavailable (HTTP only)”.
- Provide `data-status-badge` attribute for styling (`[data-status-badge="dead"]` etc.).

### Interaction Flow
1. User presses **Check Sites**.
2. Background stores latest status in `kanbanCleanupMetadata`; message bus notifies front-end.
3. CleanupStore updates sections **and** emits status map to UI layer.
4. UIManager re-renders bookmark cards, applying badges via new helper (`statusBadgeRenderer` or extension of `BookmarkRenderer`).
5. When a bookmark is archived/deleted/ignored from Cleanup, controller triggers badge refresh; cleanupStore removes entries so badge disappears.
6. Badges also clear when the next successful check marks a bookmark healthy.

### Filter Support (Phase 1.5)
- Extend tag filter bar with read-only pills (`Dead Links`, `HTTPS only`, `Cert issues`) that simply toggle CleanupStore filters; mark visually distinct (e.g., lock icon) to signal “system generated”.
- Pills map to the same state data as badges; no need to persist in user tagging.

### Technical Notes
- Add `statusBadges` map to CleanupStore; expose `getStatusFor(id)` returning status enum (`dead`, `cert`, `http`, `ok`).
- BookmarkRenderer: inject badge span when `status !== 'ok'`; tooltip text from controller constants.
- Ensure badge state refreshes on:
  - Site check completion.
  - Bookmark restore/archive/delete undo.
  - Ignore/unignore actions.
- Persist ignore decisions so badges remain cleared until next explicit check.

### Analytics
- Emit `status_badge_displayed` (type, count per render) and `status_badge_resolved` when user clears via Cleanup; piggyback on existing analytics workstream.
