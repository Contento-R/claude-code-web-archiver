# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.6] - 2026-05-21

### Fixed (correctness)
- **Role detection no longer matches words inside message prose.** v1.1.5 ran
  its class-name regex against `outerHTML.slice(0, 2000)` — that string
  contains the rendered text, so an assistant message saying "the user said"
  was relabelled as User. Now we only inspect class/role attributes on the
  node and its ancestors.
- Removed `you`, `ai`, `bot`, `response` from the User/Assistant keyword sets.
  They appeared in normal prose ("if you do X...") and triggered massive
  false positives.
- **Drag event-listener leak.** v1.1.5 added `mousemove`/`mouseup` listeners
  to `document` every time the panel was created, and the v1.1.5 setInterval
  could create the panel many times per session. Listeners now live in a
  single global install pass; the per-handle code only attaches `pointerdown`.
- **`URL.revokeObjectURL` race.** Revoking the blob URL immediately after
  `a.click()` could abort the download on slow browsers. Revocation is now
  deferred by 60 seconds.

### Performance
- **`textContent` instead of `innerText`** in hot paths. `innerText` forces a
  synchronous layout reflow on every read; `textContent` doesn't. Scrolling
  through a long session no longer thrashes layout.
- **Cached messages-parent.** v1.1.5 drilled 12 levels into the chat tree on
  every scroll step. That wrapper is stable, so we resolve it once and
  enumerate `parent.children` directly thereafter.
- **`WeakSet` of seen DOM nodes** skips re-extraction of text/Y/role for
  message nodes we've already captured — a big win on long sessions where
  the same nodes stay visible across many scroll steps.
- **Throttled progress overlay.** `setProgress` was hitting the DOM on every
  iteration; now it flushes at most once per `progressThrottleMs` (80 ms in
  normal, 100 ms in fast), with a `force` flag for terminal messages.
- **`expandInView` is viewport-scoped.** Previously it called
  `querySelectorAll` for the whole chat tree on every step. Now it opens /
  clicks only disclosure widgets currently in the viewport.
- **MutationObserver replaces the panel-keepalive `setInterval`** — no more
  polling every 2 seconds for the lifetime of the page.
- Slightly relaxed defaults in `CFG_NORMAL`: `scrollWaitMs` 650 → 500,
  `expandWaitMs` 120 → 90, `concurrency` 4 → 6. Fast mode tuned to
  `scrollWaitMs` 140 and `concurrency` 10.

### UX
- Drag now uses **pointer events**, so the panel is draggable on touch
  devices and styluses, not just mice. Added `touch-action: none` so the
  page doesn't try to scroll while you're dragging the handle.

## [1.1.5] - 2026-05-21

### Fixed
- **Role detection (User vs Claude) is no longer stuck on stale Tailwind
  classes.** The previous detector matched a couple of class names from an
  older UI (`ml-auto`, `bg-bg-200.rounded-lg`) and read only the first 400
  chars of `outerHTML`, so on the current Claude Code Web it labelled almost
  everything as "Claude" (e.g. 2 out of 63 messages were User).
  New detector tries signals in this order:
  1. Explicit role attributes on the node (`data-message-author-role`,
     `data-author`, `data-role`, `data-actor`, `data-sender`, `data-from`,
     plus `data-testid` and `aria-label` classified by keyword).
  2. Same attributes on ancestor wrappers up to the chat container.
  3. Same attributes on descendants.
  4. Word-bounded class-name patterns for `user|human` vs
     `assistant|claude|agent|model`.
  5. Computed style on the live node: `align-self: flex-end`,
     `text-align: right/end`, `margin-left: auto` only.
  6. Computed style on the first child (same checks plus `justify-content`).
  7. Geometric fallback: visual offset of the bubble from its parent's
     centre.
  8. Legacy Tailwind hints as a last resort.

## [1.1.4] - 2026-05-21

### Fixed
- **Messages now appear in chronological order in the exported HTML.**
  v1.1.3 used a left/right-neighbour heuristic over DOM child order to merge
  successive scroll batches into a single sequence. In Claude Code Web's
  virtualized list, DOM child order doesn't match visual order — messages
  came out shuffled. The new strategy:
  - On first capture of a message, record its absolute Y position inside
    the scrollable container (`rect.top - containerRect.top + scrollTop`).
  - After scrolling completes, sort all captured messages by Y (with
    insertion sequence as a stable tiebreaker) to build the final order.
- Removed the `mergeOrder` helper; order is computed once at the end.

## [1.1.3] - 2026-05-21

### Fixed
- **Script now actually loads on Claude Code Web pages.** Claude Code is
  hosted at `code.claude.com`, not `claude.ai/code` — the previous `@match`
  list didn't cover the real domain so the userscript was never injected.
  Added `https://code.claude.com/*` to `@match` and `code.claude.com` to
  `@connect`. Also added bare `https://claude.ai/code` and
  `https://claude.com/code` (no trailing slash) so the matcher fires on the
  index URL too, not only on `/code/<something>`.

## [1.1.2] - 2026-05-21

### Fixed
- **No-code mode now strips code regardless of how Claude Code Web wraps it.**
  Class names changed often enough that selectors alone kept missing code. The
  primary detector is now `getComputedStyle(...).fontFamily` on the LIVE DOM:
  any container rendered with a monospace font and ≥25 chars of text is treated
  as code and removed. Selector list is kept as a fast first pass.
- Moved `stripCode` to run BEFORE `script/style/svg` removal so the clone is
  still a 1:1 mirror of the live node — needed for the parallel index walk
  that maps live computed styles to clone elements.
- Only the outermost matched element of each subtree is removed (saves work,
  cleaner output).

### Added
- Script version (e.g. `v1.1.2`) is displayed in the top-right corner of the
  progress overlay popup.

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
