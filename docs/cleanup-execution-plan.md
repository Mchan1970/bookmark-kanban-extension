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

