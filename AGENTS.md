# Repository Guidelines

## Project Structure & Module Organization
Top-level entry points (`manifest.json`, `newtab.html`, `popup.html`) bind Chrome to the JavaScript under `js/`. `js/AppCoordinator.js` wires background, popup, and new-tab flows, while feature logic lives in `js/modules/`—UI components in `js/modules/ui/`, shared helpers in `js/modules/utils.js`, and data handlers such as `bookmarkManager.js` or `storageManager.js`. Styles are split between `css/newtab.css`, `css/popup.css`, and modular assets in `css/modules/`. Third-party code (currently `Sortable.min.js`) sits in `lib/`, and visual assets live in `icons/` and `screenshots/`.

## Build, Test, and Development Commands
- `chrome://extensions` → Load unpacked → select the repository root: reloads the extension for manual testing.
- `zip -r dist/kanbanmark.zip . -x "dist/*" "screenshots/*"`: create a submission bundle; ensure `dist/` exists.
- `npx web-ext lint --source-dir .`: optional manifest and permissions lint before publishing.
Keep the Chrome DevTools console open for `newtab.html` to watch for runtime issues while iterating.

## Coding Style & Naming Conventions
JavaScript uses ES modules, two-space indentation, and single quotes unless a string itself contains a quote. File names are lowerCamelCase when exporting functions (`bookmarkManager.js`) and UpperCamelCase for classes (`AppCoordinator.js`). Avoid global variables in modules; rely on exported factories or singleton instances like `faviconLoader`. CSS follows BEM-like block prefixes (`.bookmark-item`, `.kanban-column`); prefer component-specific selectors inside `css/modules/`. Remove temporary `console.log` statements before shipping, keeping `console.error` for actionable failures.

## Testing Expectations
No automated suite exists, so rely on manual regression passes. After changes, reload the unpacked extension and validate bookmark CRUD, drag-and-drop ordering, theme changes, popup toggles (e.g., “Open in new tab”), and background reactions to Chrome bookmark edits. Summarize the scenarios you exercised in the pull request.

## Commit & Pull Request Guidelines
Follow the Conventional Commits style observed in history (`feat:`, `fix:`, `chore:`). Keep commits scoped to a single concern and include context in the body when touching multiple modules. Pull requests should provide a concise summary, reproduction steps for fixes, screenshots or screen recordings for UI updates, and links to related issues. Coordinate `manifest.json` version bumps with release-ready PRs and call out any new permissions or host matches for reviewer attention.

## Security & Release Tips
Limit scope to permissions already declared in `manifest.json`; justify additions. When introducing third-party scripts, place the minified asset in `lib/` and note its source in the PR. Chrome’s CSP blocks remote inline scripts, so keep logic in ES modules. Before packaging, confirm `manifest.json` icons match files in `icons/` and scrub personal data from `screenshots/`.
