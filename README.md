# Claude Code Web Session Archiver

> Save the **entire** Claude Code Web session — including history the cloud has already compacted — into a single self-contained HTML file with all screenshots embedded as data URLs.

A small Tampermonkey / Violentmonkey / Greasemonkey userscript that adds a small, draggable green panel to [claude.ai/code](https://claude.ai/code) and [claude.com/code](https://claude.com/code). The panel exposes three controls:

| Button         | What it does                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| ⬇ **Archive**  | Walk the entire session, capture every message, download screenshots, and save one self-contained HTML file.       |
| ⚡ **Fast**     | Toggle. Minimizes scroll and expand delays and parallelizes screenshot downloads. Slightly more aggressive on the page. |
| 📝 **No code** | Toggle. Excludes code blocks Claude writes (tool calls / `<pre>` blocks). Only the conversation is exported.       |

The panel is draggable by the grip on its left edge — its position is remembered between visits.

The UI auto-selects **English** or **Russian** strings based on `navigator.language`.

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
3. Confirm the install.
4. Open any session at `https://claude.ai/code/*` or `https://claude.com/code/*`. The green panel appears in the bottom-right corner.

## Use

1. Open a Claude Code Web session.
2. (Optional) Toggle **⚡ Fast** for faster capture, and / or **📝 No code** to skip code blocks.
3. Click **⬇ Archive** and confirm the prompt.
4. **Do not touch the page** while the archiver runs — interacting with it disrupts auto-scroll and capture.
5. Watch the progress overlay:
   - `Scrolling & capturing... messages: N`
   - `Downloading screenshots... X/Y (Z ok)`
   - `Building HTML...`
   - `Done! Messages: N, images embedded: M.`
6. A file named `<session-title>.html` is saved by your browser.

Press **Cancel** in the progress card at any time to abort.

### Fast mode (⚡)

When enabled, the script switches to an aggressive timing profile and parallelizes image downloads:

|                       | Normal | Fast |
| --------------------- | -----: | ---: |
| Scroll wait (ms)      |    650 |  160 |
| Expand wait (ms)      |    120 |   25 |
| Scroll step (vh)      |   0.6  |  0.9 |
| Stable steps to stop  |      4 |    3 |
| Parallel downloads    |      4 |    8 |

Recommended on fast machines and good networks. On slow connections, leave it off — the page may need more time to render virtualised messages.

### No-code mode (📝)

When enabled, the archiver removes `<pre>` blocks and `data-language` / `code-block` containers from each captured message before storing it. Inline `code` spans inside prose stay. Toggle this **before** clicking Archive — it only affects messages captured after the toggle.

### Draggable panel

Grab the `⋮⋮` grip on the left edge of the panel and drag it anywhere on the page. The position is saved in `localStorage` (`cc-arch-pos`) and restored next time you open Claude Code.

## Output format

- Single `.html` file, self-contained, no external dependencies.
- Dark theme, readable on desktop and mobile.
- Each message is a `<section class="msg user|assistant">` with role label and message number.
- Images are embedded as `data:` URLs so the file works fully offline.
- Code blocks, tables, lists and `<details>` disclosures are preserved (unless **No code** is on).
- Header includes archive timestamp, message count, source URL and parser version.
- `<html lang>` is `en` or `ru` depending on browser locale.

## Configuration

The behaviour knobs live at the top of the script in `CFG_NORMAL` and `CFG_FAST`:

| Key                | Normal | Fast | Meaning                                                      |
| ------------------ | -----: | ---: | ------------------------------------------------------------ |
| `scrollStepRatio`  |   0.6  |  0.9 | Fraction of viewport to scroll per step                      |
| `scrollWaitMs`     |   650  |  160 | Delay after each scroll (ms) — increase on slow networks     |
| `expandWaitMs`     |   120  |   25 | Delay after expanding an `aria-expanded` disclosure          |
| `stableLimit`      |     4  |    3 | Consecutive no-progress steps before stopping                |
| `maxSteps`         |  4000  | 4000 | Hard safety cap on total scroll steps                        |
| `minTextLen`       |     8  |    8 | Ignore nodes shorter than this (filters empty wrappers)      |
| `imgTimeoutMs`     | 20000  | 20000| Per-image download timeout (ms)                              |
| `concurrency`      |     4  |    8 | Parallel screenshot downloads                                |

Edit them in the installed script — your userscript manager applies changes immediately.

## Permissions / network

The script requests `GM_xmlhttpRequest` and `@connect` access to:

- `claude.ai`, `claude.com`, `anthropic.com` — message containers and attachments
- `cloudfront.net`, `amazonaws.com` — image CDNs Claude uses
- `self` — same-origin fetches

No data is sent anywhere. Everything happens locally in your browser and is written to a file you save yourself.

## Compatibility

| Browser            | Tampermonkey | Violentmonkey | Greasemonkey |
| ------------------ | :----------: | :-----------: | :----------: |
| Chrome / Chromium  |      yes     |      yes      |      —       |
| Edge               |      yes     |      yes      |      —       |
| Firefox            |      yes     |      yes      |     yes      |
| Safari             |      yes     |       —       |      —       |
| Opera              |      yes     |      yes      |      —       |

## Limitations

- The script relies on DOM structure exposed by Claude Code Web. Major UI changes upstream may temporarily break selectors. PRs welcome.
- Very long sessions can take minutes to scroll, expand and download screenshots — be patient and don't touch the tab.
- Role detection is heuristic; the role label may occasionally be wrong on highly customised messages.
- Attachments that aren't `<img>` elements (e.g. file downloads) are not embedded.
- **No code** uses heuristics (`<pre>`, `[class*=code-block]`, `[data-language]`). Some rare code containers may slip through.

## Contributing

Pull requests and issues are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Credits

Based on **["Claude Code Web to Markdown"](https://greasyfork.org/scripts/560005)** by **Aiuanyu** (MIT). This fork adds full-session auto-capture, screenshot embedding, a self-contained HTML export, fast / no-code modes and a draggable panel.

## License

[MIT](LICENSE) © Contento-R
