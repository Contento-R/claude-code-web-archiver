# Claude Code Web Session Archiver

> Save the **entire** Claude Code Web session — including history the cloud has already compacted — into a single self-contained HTML file (or Markdown / JSON) with all screenshots embedded as data URLs.

A Tampermonkey / Violentmonkey / Greasemonkey userscript that adds a small, **auto-collapsing** green panel to [code.claude.com](https://code.claude.com), [claude.ai/code](https://claude.ai/code) and [claude.com/code](https://claude.com/code). The panel exposes five controls:

| Button         | What it does                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| ⬇ **Archive**  | Walk the entire session, capture every message, download screenshots, and save one self-contained file.            |
| ⚡ **Fast**     | Toggle. Aggressive scroll/expand delays and 10 parallel screenshot downloads instead of 6.                          |
| 📝 **No code** | Toggle. Excludes code blocks Claude writes (tool calls, diffs, file viewers, `<pre>` fences) — only conversation.   |
| ⚙ **Settings** | Output format (HTML/MD/JSON), only-new mode, range, local-only network, secret redaction, collapse assistant.       |

A drag handle (`⋮⋮`) on the left edge lets you reposition the panel anywhere on the page; position persists in `localStorage` and auto-clamps to the viewport on window resize so the panel can't disappear off-screen.

**3 seconds** after the cursor / focus leaves the panel it shrinks to a small green circle. Hover or focus expands it back. Auto-collapse is suspended while an archive is in progress or the settings modal is open. The whole circle is also draggable.

**Hotkeys:** `Alt+A` start, `Esc` cancel.

The UI auto-selects **English / Russian / German / French / Spanish** strings based on `navigator.language` (missing translations transparently fall back to English).

[Русская версия README →](README.ru.md)

---

## Why

Claude Code Web compacts long sessions. Older turns disappear from the live thread and are only summarised. This script walks the live DOM while everything is still rendered, so you can save the full transcript (plus screenshots) before any further compaction.

## Install

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Safari, Opera)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chromium / Firefox)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
2. Open the raw userscript — your manager will pick it up:
   [`claude-code-web-archiver.user.js`](https://github.com/Contento-R/claude-code-web-archiver/raw/main/claude-code-web-archiver.user.js)
3. Confirm the install. Subsequent updates are picked up automatically via `@updateURL`.
4. Open any session at `https://code.claude.com/*`, `https://claude.ai/code/*` or `https://claude.com/code/*`. The green panel appears in the bottom-right corner.

## Use

1. Open a Claude Code Web session.
2. (Optional) Click ⚙ to choose output format and toggle features.
3. Click **⬇ Archive** (or press `Alt+A`) and confirm the prompt.
4. **Do not touch the page** while the archiver runs — interacting with it disrupts auto-scroll and capture.
5. Watch the progress overlay:
   - `Scrolling & capturing... messages: N`
   - `Downloading screenshots... X/Y (Z ok)`
   - `Building HTML...`
   - `Done! Messages: N, images embedded: M.`
6. A file named `<session-title>.html` (or `.md` / `.json`) is saved by your browser.

Press **Cancel** in the progress card — or `Esc` — at any time to abort.

### Output formats

Picked in **Settings → Output format**:

- **HTML** — interactive self-contained file. Includes live search, jump-to-message dropdown, light/dark theme toggle, collapse-all button for assistant blocks, and a print stylesheet for clean PDF exports.
- **Markdown** — clean text with headings, lists, fenced code blocks, blockquotes, tables, links and image data URLs. For Obsidian, GitHub, etc.
- **JSON** — structured document with per-message `number / role / tool / time / text / html` plus session-level `model`. For machine processing.

### Fast mode (⚡)

|                       | Normal | Fast |
| --------------------- | -----: | ---: |
| Scroll wait (ms)      |    500 |  140 |
| Expand wait (ms)      |     90 |   20 |
| Scroll step (vh)      |   0.7  |  0.9 |
| Stable steps to stop  |      4 |    3 |
| Parallel downloads    |      6 |   10 |

### No-code mode (📝)

Removes code blocks Claude writes — tool calls (Bash, Edit, Write, …), `<pre>` fences, file viewers, monospace containers. Inline `code` spans inside prose stay. Detection uses computed `font-family` on the live DOM, so it works regardless of the upstream UI's class names.

### Settings

- **Only new** — skip messages already archived for the same URL on previous runs. Per-URL known-key set, capped at 5000 entries.
- **Range from/to** — export only the messages whose chronological number is in this range.
- **Local-only network** — disable the cross-origin `GM_xmlhttpRequest` fallback. Images that need it stay as remote URLs instead of being inlined.
- **Redact secrets** — newline-separated regex list. Defaults cover OpenAI/Anthropic keys, GitHub PATs, AWS access keys. Each match is replaced with asterisks at HTML build time, walked via `TreeWalker` so the regex can't corrupt tags.
- **Collapse assistant** — wrap assistant message bodies in `<details>` so the exported HTML opens with conversation visible and responses collapsed.

### Tool & metadata badges

Each message in the output carries optional badges next to the role label:
- **Tool call** (Bash / Edit / Write / Read / Glob / Grep / WebFetch / WebSearch / Task / TodoWrite / NotebookEdit / NotebookRead / MultiEdit / ExitPlanMode / SlashCommand / KillShell).
- **Model name** (Opus / Sonnet / Haiku, extracted from page chrome).
- **Timestamp** (`<time datetime>` or `[title]` containing a date/time pattern; formatted as `YYYY-MM-DD HH:MM`).

### Resume after crash

If the browser tab is closed, refreshed or the archive is aborted mid-scroll, the next Archive click for the same URL offers to resume from the last snapshot (saved every ~5 seconds during the scroll phase, kept for 24 hours).

### Update notifier

The script does a daily background check against `main` on GitHub. When a newer version is published, a yellow dot appears on the ⚙ button and the settings modal shows a banner with an "Install" action that opens the raw URL — Tampermonkey then offers its normal reinstall prompt.

## Permissions / network

The script requests `GM_xmlhttpRequest` and `@connect` access to:

- `code.claude.com`, `claude.ai`, `claude.com`, `anthropic.com` — message containers and attachments
- `cloudfront.net`, `amazonaws.com` — image CDNs Claude uses
- `raw.githubusercontent.com` — once a day, to read `@version` from the published userscript
- `self` — same-origin fetches

No data is sent anywhere except the GitHub raw URL above for update detection.

## Compatibility

| Browser            | Tampermonkey | Violentmonkey | Greasemonkey |
| ------------------ | :----------: | :-----------: | :----------: |
| Chrome / Chromium  |      yes     |      yes      |      —       |
| Edge               |      yes     |      yes      |      —       |
| Firefox            |      yes     |      yes      |     yes      |
| Safari             |      yes     |       —       |      —       |
| Opera              |      yes     |      yes      |      —       |

## Contributing

Pull requests and issues are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

Based on **["Claude Code Web to Markdown"](https://greasyfork.org/scripts/560005)** by **Aiuanyu** (MIT).

## License

[MIT](LICENSE) © Contento-R
