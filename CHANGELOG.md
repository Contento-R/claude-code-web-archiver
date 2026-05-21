# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-05-21

### Fixed
- **No-code mode now actually strips tool-call code.** v1.1.0 only removed `<pre>` and a
  couple of class-name patterns, which missed Claude Code Web's real shapes (tool calls
  rendered as `<details>` blocks, `font-mono` containers, `data-testid="tool-*"` /
  `artifact` / `diff` containers, block-level `<code>`). The selector list now covers
  these and we also detect block-level `<code>` via `getComputedStyle` on the live DOM.
- When No-code is on, the auto-scroll no longer wastes time expanding `<details>`
  tool-call blocks (they're stripped anyway).

## [1.1.0] - 2026-05-21

### Added
- **Single-file build.** UI strings live in an `I18N` table and are auto-selected from
  `navigator.language` (Russian for `ru*`, English otherwise). The separate
  `i18n/claude-code-web-archiver.ru.user.js` file is gone.
- **Three-button panel.** The single floating button is replaced by a compact green
  panel hosting **⬇ Archive**, **⚡ Fast** and **📝 No code**.
- **Draggable panel.** Grab the `⋮⋮` grip on the left edge to move the panel; position
  is persisted in `localStorage` (`cc-arch-pos`).
- **Fast mode (⚡).** Toggle that switches to an aggressive timing profile
  (`scrollWaitMs` 650 → 160, `expandWaitMs` 120 → 25, `scrollStepRatio` 0.6 → 0.9,
  `stableLimit` 4 → 3) and raises the screenshot download concurrency from 4 to 8.
- **No-code mode (📝).** Toggle that strips `<pre>` blocks and `data-language` /
  `code-block` containers from captured messages, exporting only the conversation.
- **Parallel screenshot downloads** with a configurable concurrency pool (default 4,
  fast 8) replace the previous sequential loop.

### Changed
- The Archive button is now smaller (24 px tall vs 56 px) and green.
- `expandInView` opens all `<details>` synchronously in one pass and only paces
  `aria-expanded` clicks, cutting expand time on large sessions.
- README split into `README.md` (English) and `README.ru.md` (Russian), kept in sync.

### Removed
- `i18n/claude-code-web-archiver.ru.user.js` — folded into the main script.

## [1.0.0] - 2026-05-21

### Added
- Initial public release.
- Auto-scroll through an entire Claude Code Web session, expanding collapsed blocks.
- Chronological message capture with content-based deduplication.
- Screenshot download and embedding as `data:` URLs.
- Self-contained HTML export with dark theme.
- English userscript build (default) at the repository root.
- Russian userscript build under `i18n/`.
- Cancel button in the progress overlay.
