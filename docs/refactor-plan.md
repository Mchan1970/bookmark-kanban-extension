# Refactor Plan – Cleanup & UI Layer

## Goals
- Improve maintainability and testability by breaking down large multi-role modules.
- Keep feature parity while creating clear seams for future work (status badges, cleanup categories, UI expansions).
- Reduce coupling so individual concerns (data, rendering, state) can evolve independently.

---

## Phase 1 – Cleanup Data Layer

### 1. Split `cleanupStore.js`

| New Module | Responsibility |
|------------|----------------|
| `cleanupRepository.js` | Storage I/O (`chrome.storage` read/write, ignore lists, metadata persistence). |
| `cleanupEngine.js` | Aggregation logic: tree flattening, duplicate grouping, stale detection, status normalization. No storage calls. |
| `cleanupState.js` | In-memory state + subscriptions (`counts`, `sections`, `statusMap`). Bridges repository ↔ engine. |

**Migration steps**
1. Identify pure data operations in `cleanupStore` (flatten tree, compute Dead/Duplicate/Stale, status map).
2. Move persistence helpers (`readFromStorage`, `writeToStorage`, metadata sync) into `cleanupRepository`.
3. Implement `cleanupEngine` functions returning plain objects; they should accept raw bookmark trees and metadata.
4. `cleanupState` orchestrates: on init, load metadata via repository → call engine → publish snapshot.
5. Update `cleanupController` to depend on `cleanupState` instead of monolithic store.

**Benefits**
- Unit tests for engine functions without mocking storage.
- Future categories (e.g., “stale tags”) add via engine extension.
- Storage strategy changes (sync vs local) isolated in repository.

### 2. Expose granular APIs
- `cleanupState.subscribe(listener)` returns `counts`, `sections`, `statusMap`.
- `cleanupState.updateStatus(map)` orchestrates repository + engine.
- `cleanupState.ignore(section, ids)` delegates to repository, then recomputes via engine.
- `cleanupState.clearStatuses(ids)` becomes thin wrapper instead of embedded logic.

---

## Phase 2 – Cleanup Controller & UI

### 1. Refine Controller structure
Current `CleanupController` already uses `CleanupView`, `CleanupActions`, etc., but still handles menu callbacks and bridging to UI manager.

**Enhancements**
- Introduce `CleanupMediator` in `js/modules/cleanup/mediator.js` to own:
  - Status bridge updates (currently in controller).
  - Archive/recycle coordination (currently mixed into controller).
  - Integration hooks (UI Manager, Event Manager).
- Controller focuses on modal lifecycle + user interactions.

### 2. Separate archive & recycle services
- Replace direct calls (`archiveManager`, `recycleManager`) with `archiveService`/`recycleService` that encapsulate storage + notification copy.
- Result: controller only orchestrates UI feedback, not data operations.

---

## Phase 3 – UI Layer Decomposition

### 1. `UIManager.js`
Split into:
| Module | Purpose |
|--------|---------|
| `boardRenderer.js` | Build Kanban columns, delegate to column manager/bookmark renderer. No filtering logic. |
| `tagFilterService.js` | Tag extraction, active tag state, filter results caching. |
| `statusBadgeService.js` | Map from status map → DOM updates (currently inline in UIManager/BookmarkRenderer). |
| `timeDisplay.js` | Clock/date updates; can be simple helper invoked by UIManager bootstrap. |

Implementation idea:
- Keep `UIManager` as lightweight facade constructing services, wiring events, and exposing methods like `renderKanban(options)`, `updateBookmarkStatuses`.
- Move existing filtering logic (`filterBookmarkTree`, `collectTags`) into `tagFilterService`.
- `bookmarkRenderer` requests status via `statusBadgeService` instead of accessing controller directly.

### 2. `BookmarkRenderer.js`
- Extract DOM creation into `bookmarkTemplates.js` (pure functions returning nodes).
- Move status badge & menu wiring into dedicated helpers inside `/ui/bookmarks/`.
- Event hookups (menu button, open new tab) should rely on injected callbacks rather than inline `addEventListener` that need to access global state. Allows unit testing by passing mocks.

---

## Phase 4 – Dependency & Testing

### 1. Dependency Injection
- Pass repositories/engines into controllers/mediators via constructor parameters; avoid hard-coded imports inside `CleanupController`.
- For UI layer, allow injecting `statusBadgeService` so tests can provide stub data.

### 2. Unit test scaffolding
- Add `tests/cleanup/engine.spec.js` verifying duplicate/stale detection.
- Add `tests/cleanup/repository.spec.js` mocking `chrome.storage`.
- Add `tests/ui/tagFilterService.spec.js` verifying filtering behavior.

---

## Rollout Strategy
1. **Refactor behind feature flags**? Not needed if external API remains same; ensure incremental commits keep functionality.
2. **Migration steps per phase**:
   - Phase 1: Introduce new modules, adjust imports, ensure CleanupController still works.
   - Phase 2: Move mediator responsibilities gradually; update EventManager integration.
   - Phase 3: Extract UI services one by one; start with tag filter to minimize risk.
3. **Regression**: After each phase run manual tests (Cleanup modal, status badges, drag & drop).

---

## Appendix – Module Map (Target)
```
js/modules/cleanup/
  repository/
    cleanupRepository.js
    metadataRepository.js
  engine/
    cleanupEngine.js
    duplicateDetector.js
    staleDetector.js
  state/
    cleanupState.js
    statusBridge.js
  ui/
    cleanupController.js
    cleanupView.js
    cleanupActions.js
    archivePanelController.js
    recyclePanelController.js
    mediator.js
```

```
js/modules/ui/
  services/
    boardRenderer.js
    tagFilterService.js
    statusBadgeService.js
    timeDisplay.js
  bookmarks/
    bookmarkRenderer.js
    bookmarkTemplates.js
    bookmarkMenu.js
```
