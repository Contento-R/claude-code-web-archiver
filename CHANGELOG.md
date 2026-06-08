# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.1] - 2026-06-08

### Fixed
- **"No code" toggle was stuck "on" silently between runs.** The
  resume system stored `skipCode` / `fastMode` in its localStorage
  snapshot and v1.6.0 onwards forcibly restored them on every Archive
  click. A snapshot left over from one earlier accidental click of
  No-code kept re-applying code stripping to every subsequent archive
  — and because the snapshot's messages were already pre-stripped, the
  output stayed stripped even after panel toggles flipped back.
  - Resume now ONLY kicks in when the snapshot's saved toggles match
    the user's current panel state. Otherwise the snapshot is treated
    as stale and discarded.
  - `skipCode` / `fastMode` are no longer forcibly read from the
    snapshot — the user's current panel toggles are authoritative.
  - Cancelling an archive (Esc, Stop button, or overlay Cancel) now
    clears the resume snapshot. Previously a cancel left stale state
    behind for the next click to silently resume.

### Changed
- **"View releases" button now opens the CHANGELOG** instead of the
  `/releases` page on GitHub, which is empty until proper releases
  with notes are cut. Renamed to "View changelog" / "История версий"
  to match. The CHANGELOG on `main` is the canonical version history.

## [1.11.0] - 2026-06-08

### Fixed (role detection — verified against real DOM)
- **Discovered the actual marker** the host uses. A DOM diagnostic dump
  collected via the v1.10.0 debug mode revealed Claude Code Web's
  "epitaxy" UI:
  - every user prompt is wrapped in a container with class
    **`epitaxy-user-turn`**
  - user bubbles additionally reference the CSS variables
    `--ui-user-message-background` and `--ui-user-message-primary-text`
  - assistant turns never carry the user wrapper; they expose
    `epitaxy-markdown`, `text-assistant-primary`, `text-assistant-secondary`
  - 100% accuracy on the 13-message sample (6 user, 7 assistant)
- `guessRole` now has a new step 0 that checks these markers FIRST,
  short-circuiting before the speculative heuristics that kept
  misfiring. The old logic is retained as fallback for other Claude UI
  variants (claude.ai chat, ChatGPT-style mirrors).
- `normalizeRoles` is now a no-op whenever the primary detector
  produced a healthy user/assistant split.

### Fixed (message ordering)
- The virtualizer's visual Y position is **not stable** across renders
  — in the debug dump, message #12 had Y=3446 captured AFTER #11 at
  Y=5879. Y-based sort would put them in the wrong order.
- Each top-level message wrapper carries a stable
  **`data-index="N"`** attribute reflecting the host's chronological
  ordering. `buildOrder` now uses that as the primary sort key, with
  Y position as a secondary fallback (for non-epitaxy UIs).

## [1.10.0] - 2026-06-02

### Added
- **Debug mode (DOM diagnostic export).** New toggle in Settings —
  off by default. When enabled, the next archive additionally saves a
  `<title>.debug.txt` file containing, for every captured message:
  - text preview (200 chars)
  - node tag + every `data-*` / `aria-*` / `role` / `class` / `id` attribute
  - 20+ computed CSS properties (`backgroundColor`, `alignSelf`,
    `textAlign`, `margin*`, `width`, `fontFamily`, etc.)
  - geometry (`rect.left/right/width` for the node and its parent)
  - all `<img>` elements (alt, src, class) and avatar-like containers
  - all `<button>` / `[role=button]` (aria-label, title, text, class)
  - ancestor chain up to 4 levels (tag + interesting attributes)
  - first 700 chars of `outerHTML`

  Purpose: rather than continue guessing at how Claude Code Web marks
  user vs assistant turns, the user can enable debug, run one archive,
  and share the `.debug.txt`. The author then writes a detector against
  the real DOM signals instead of speculative selectors.

  Privacy note in the file header reminds the user that text previews
  are included; review before sharing.

## [1.9.0] - 2026-06-02

### Fixed
- **Role detection — third rewrite, anchor-based.** The previous
  "structure-based" detector still labelled the first user prompt as
  assistant whenever the user wrote a long message, and labelled
  Claude's plain-text replies as user. The new strategy follows what
  the user asked for: identify a single anchor user message and
  default everything else to assistant. Specifically:
  - **Anchor**: walk messages in chronological order and pick the
    first one that isn't *definitely* assistant (i.e. doesn't have a
    tool call and doesn't match a multilingual system-phrase pattern).
    That message is forced to **user** — every Claude Code session
    starts with one by definition.
  - **Visual-signature matching**: the anchor's `backgroundColor` is
    used to find other user prompts in the same session, but ONLY if
    it's both non-transparent AND a clear minority (≤50% of messages).
    Prevents the failure mode where all messages share a colour and
    everything gets labelled user.
  - **Default to assistant**: per the user's spec, any message we
    can't confidently identify as user is treated as assistant.
- Expanded `SYSTEM_PATTERNS` to recognize the tool-call status lines
  Claude Code Web emits (`Editado un archivo, ejecutado un comando`,
  `Pushed`, `Запушил`, `Datei bearbeitet`, `Fichier modifié`, etc.).

### Added
- **Release section in Settings.** A bordered panel near the top of
  the settings modal showing the current version (`v1.9.0`) plus two
  buttons:
  - **Check for updates** — forces an update check ignoring the daily
    throttle, reports the result inline (`latest version` /
    `update available` / error), and injects the install banner if a
    newer version is found.
  - **View releases** — opens
    `https://github.com/Contento-R/claude-code-web-archiver/releases`
    in a new tab.
- New `currentVersion` / `checkUpdates` / `checkingUpdates` /
  `noUpdates` / `viewReleases` strings in EN + RU dictionaries
  (other locales fall back to English via the i18n Proxy).

## [1.8.0] - 2026-05-21

### Fixed
- **Role detection — flipped/wrong labels.** v1.7.0's `normalizeRoles`
  still used message length as one of the signals (a plain-text block
  ≥600 chars stayed as assistant), which misclassified long user prompts.
  It also relied on background-color clustering that picked the wrong
  cluster when user prompts shared a colour with Claude's most common
  message style. Detector is now purely **structure-based**:
  - tool call, `<pre>`, headings, lists or tables → assistant
  - text matching a multilingual system-message pattern → assistant
    (covers Spanish / English / Russian / German / French phrases like
    `Sesión inicializada`, `Session resumed`, `Completado`, `Done`,
    `Repositorios clonados`, `Claude Code iniciado`, etc.)
  - anything else → user
  Length is no longer used — a long plain-text prompt is correctly user.
  The final guarantee (force the first message to user) still applies.

### Changed
- **No more blocking start dialog.** The old `confirm()` (`The archiver
  will scroll the ENTIRE session…`) is gone. Clicking Archive (or
  pressing `Alt+A`) starts the run immediately. A non-blocking green
  banner appears at the top of the page for 3 s explaining the run; if
  the user has an unfinished snapshot, the banner reads "Resuming…"
  instead and the run picks up from where it stopped (auto-resume).
- **Archive button doubles as Stop.** During a run the button switches
  to a red ⏹ icon and "Stop archiving" tooltip; clicking it cancels.
  Stays clickable the whole time — no more disabled state with spinner.

### Notes
- `T.confirm` and `T.resumePrompt` strings are kept in the i18n dictionary
  for now (unused) so out-of-tree translations don't error.

## [1.7.0] - 2026-05-21

### Fixed (critical)
- **Role detection: all-Claude failure mode.** On the current Claude Code
  Web build, the capture-time detector returned `assistant` for every
  message because the page exposes no role attributes and both sides use
  identical visual alignment. A new `normalizeRoles()` post-pass kicks
  in whenever the user/assistant split is degenerate:
  1. messages with a strong assistant signal (`tool`, `<pre>`, headings,
     lists, tables) are pinned to assistant first;
  2. remaining messages are clustered by computed `backgroundColor` —
     the majority colour is assistant, the minority is user;
  3. if there's only one background colour, plain-text-only blocks under
     ~600 chars become user;
  4. a final guarantee: if no message ended up as user, the very first
     in chronological order is forced to user (every session starts
     with a user prompt).

### Added
- **Update notifier (#2 follow-up).** Daily background check fetches
  the userscript on GitHub `main`, compares `@version`, and on a newer
  release surfaces (a) a yellow dot on the gear button, (b) a notice
  with an "Install" button at the top of the settings modal. The
  install button opens the raw URL — Tampermonkey then offers the
  normal reinstall prompt. `@connect raw.githubusercontent.com` added.
- **Auto-collapse to a circle (#3).** 3 s after the cursor / focus
  leaves the panel, it shrinks to a small green circle with the ⬇
  glyph. Hover or focus expands it back. Auto-collapse is suspended
  while an archive run is in progress and while the settings modal is
  open. Drag still works (whole circle is a drag handle).

### Changed
- **Compact panel (#1).** Buttons are now icon-only squares (~20–28 px
  wide), drag handle is thinner, padding tightened. Reduces the panel
  footprint by ~60% while keeping all five controls accessible.
- The Archive button's tooltip switches to "Archiving…" during a run
  and back to the recent-archives history afterwards.
- Drag now starts on `pointerdown` anywhere on the panel except
  interactive children, so the collapsed circle is draggable as a
  single unit.

## [1.6.0] - 2026-05-21

### Added
- **Resume after crash (#17).** A snapshot of the captured message map is
  saved to `localStorage` every ~5 seconds during the scroll phase
  (per-URL, 24 h TTL, capped at ~4 MB so it stays well under the quota).
  If the browser tab is closed, refreshed or the archive is aborted,
  the next Archive click for the same URL offers to resume from the
  snapshot — skipping the entire scroll step and jumping straight to
  screenshot download + build. Snapshot is wiped on successful archive.
- **Greasyfork publication kit (#25).** `GREASYFORK.md` ships a
  ready-to-copy name / short description / full description / tags
  block, plus a small update workflow.

### Changed
- **Streaming HTML build (#16).** `buildHtml` now returns an array of
  chunks (head, per-message sections, tail) and `download` passes it
  directly to `new Blob(parts, …)`. The browser assembles the file
  internally instead of forcing us to concatenate a single ~10s-MB
  string in JS memory. Large multi-screenshot sessions no longer spike
  memory at export time.

## [1.5.0] - 2026-05-21

### Added
- **Output format selector (#6).** Settings modal now has a dropdown for
  HTML / Markdown / JSON. The Markdown builder converts the captured DOM
  (headings, lists, code, tables, links, images, blockquotes, emphasis)
  into a clean text file. The JSON builder emits a structured document
  with per-message `number`, `role`, `tool`, `time`, `text` and `html`
  fields plus a session-level `model` field.
- **TOC + search in exported HTML (#7).** The HTML output now ships with
  a sticky controls bar carrying a search input (filters messages live
  as you type), a "Jump to message…" dropdown over all user prompts, an
  expand/collapse-all button for assistant blocks, and a theme toggle.
- **Light / dark theme toggle in exported HTML (#8).** A 🌓 button in the
  header flips between the existing dark palette and a new light palette,
  persisted to `localStorage` so re-opens remember the choice.
- **Collapse assistant blocks (#9).** New setting wraps every assistant
  message body in `<details>` with a preview summary; combined with the
  toggle-all button it makes long sessions browsable.
- **Print stylesheet (#10).** `@media print` rules hide controls, expand
  all collapsed blocks, force-light the palette and use
  `break-inside: avoid` on each message so PDF exports look right.

### Notes
- Range filter and inlined screenshots apply identically to all three
  output formats.
- The exported HTML's inline script has no external dependencies and
  works fully offline.

## [1.4.0] - 2026-05-21

### Added
- **Tool-call badges (#11).** Each captured message is checked against
  the public Claude Code tool list (Bash / Edit / Write / Read / Glob /
  Grep / WebFetch / WebSearch / Task / TodoWrite / NotebookEdit /
  NotebookRead / MultiEdit / ExitPlanMode / SlashCommand / KillShell).
  Matches are rendered as a coloured badge next to the role label.
  Detection is anchored to the leading text so a tool name appearing
  later in prose doesn't false-positive; falls back to a
  `data-testid*="tool"` lookup.
- **Model name (#12).** Best-effort extraction from page chrome
  (`[data-testid*="model"]`, `[aria-label*="opus|sonnet|haiku"]`, etc.)
  at the start of each run; stamped as a badge on assistant messages.
- **Date/time per message (#13).** Reads `<time datetime>` first, then
  falls back to `[title]` / `[aria-label]` attributes containing a
  timestamp pattern. Rendered in a clean `YYYY-MM-DD HH:MM` form (with
  the raw value preserved in the `title` for hover).

### Performance / reliability
- **MutationObserver-driven scroll (#15).** `autoScroll` no longer
  sleeps a fixed `scrollWaitMs` every step. Instead it waits for the
  first DOM mutation in the messages-parent subtree, or the cap,
  whichever comes first. On fast machines this is often <50 ms vs the
  full 500 ms; on slow ones it falls back to the cap as before.
- **Stuck-scroll mitigation (#19).** If `scrollTop` assignment is
  ignored two times in a row, the script dispatches a synthetic
  `wheel` event and calls `scrollIntoView` on the last message-parent
  child. This recovers sessions where Claude Code Web's own scroll
  handler intercepts assignments.
- **Image retry (#18).** Each failed screenshot fetch is retried once
  with a 400-650 ms randomized backoff before giving up.

## [1.3.0] - 2026-05-21

### Added
- **Settings cog (⚙).** A 4th button on the panel opens a modal where you
  can configure all of the new options below; saved to `localStorage`,
  re-read on each archive run.
- **"Only new" mode (#21).** When enabled, skips messages already captured
  in earlier archives of the same URL. Known keys are stored per-URL in
  `localStorage` (capped at 5000 keys, ~1 MB) and updated after every
  successful run regardless of the toggle, so toggling it on later picks
  up where you left off.
- **Range archiving (#22).** "From #" and "To #" inputs in settings export
  only the messages whose chronological number falls in the range. Empty
  fields mean no limit on that side.
- **Local-only network mode (#23).** Toggling this disables the
  cross-origin `GM_xmlhttpRequest` fallback for image fetches. Images
  that need it stay as remote URLs in the HTML instead of being inlined.
- **Secret redaction (#24).** Toggle plus a textarea of newline-separated
  regular expressions. Each match in the captured text is replaced with
  asterisks. Defaults cover common API keys (OpenAI/Anthropic `sk-*`,
  GitHub PATs `ghp_*/gho_*/ghu_*/ghs_*/github_pat_*`, AWS `AKIA*`). Regex
  validation runs on save — invalid patterns are rejected with a list.

### Implementation notes
- Redaction walks text nodes via `TreeWalker` so a regex can never corrupt
  tag markup or attribute values.
- Range filtering happens at HTML-build time, not at capture, so the
  underlying message store stays complete (useful if you want to re-run
  with a different range without re-scrolling).

## [1.2.0] - 2026-05-21

### Added
- **Hotkeys.** `Alt+A` triggers archive from anywhere, `Esc` cancels an
  ongoing run. Skipped inside text inputs / contenteditable so it doesn't
  interfere with typing.
- **Auto-update via `@updateURL` / `@downloadURL`.** Tampermonkey will pick
  up new releases automatically once the script is merged to `main`.
- **Busy state on the Archive button.** During a run the button is disabled
  and shows a spinner with the localized "Archiving…" label, preventing
  double-starts.
- **Archive history tooltip.** Hovering the Archive button now shows the
  last few archive runs from `localStorage` with relative timestamps.
- **Locales DE / FR / ES.** Auto-selected from `navigator.language` alongside
  EN / RU. Missing translations transparently fall back to English via a
  Proxy over the locale dict.
- **CI smoke test.** GitHub Actions workflow runs `node --check` on the
  userscript and validates the `==UserScript==` metadata block on every
  push and PR to `main`.
- **Panel stays on-screen on window resize.** Window resize, orientation
  change, and visualViewport changes (mobile keyboard, pinch-zoom) all
  trigger a rAF-coalesced clamp that keeps the panel within viewport
  bounds and persists the corrected position to `localStorage`. The panel
  remains user-draggable; only positions that would be off-screen are
  pulled back in.

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
