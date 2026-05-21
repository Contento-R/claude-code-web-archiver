# Claude Code Web Session Archiver

> Save the **entire** Claude Code Web session — including history the cloud has already compacted — into a single self-contained HTML file with all screenshots embedded as data URLs.

A small Tampermonkey / Violentmonkey / Greasemonkey userscript that adds an **⬇ Archive session** button to [claude.ai/code](https://claude.ai/code) and [claude.com/code](https://claude.com/code). When clicked, it:

1. Scrolls the conversation to the very top.
2. Auto-scrolls down step by step, letting the virtualizer render every message.
3. Expands every collapsed `<details>` and `aria-expanded="false"` disclosure block in view.
4. Captures every message in chronological order (de-duplicated by content).
5. Downloads every screenshot referenced by the conversation and **inlines it as a `data:` URL**.
6. Builds one portable HTML file (dark theme, mobile-friendly) and triggers a download.

The output file is fully self-contained: no remote requests, no missing images, opens in any browser.

[Русская версия README →](README.ru.md)

---

## Why

Claude Code Web compacts long sessions. Older turns disappear from the live thread and are only summarised. This script walks the live DOM while everything is still rendered, so you can save the full transcript (plus screenshots) before any further compaction.

## Install

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Safari, Opera)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chromium / Firefox)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
2. Open the raw userscript and your manager will pick it up:
   - **English (default):** [`claude-code-web-archiver.user.js`](https://github.com/Contento-R/claude-code-web-archiver/raw/main/claude-code-web-archiver.user.js)
   - **Russian build:** [`i18n/claude-code-web-archiver.ru.user.js`](https://github.com/Contento-R/claude-code-web-archiver/raw/main/i18n/claude-code-web-archiver.ru.user.js)
3. Confirm the install in your userscript manager.
4. Open any session at `https://claude.ai/code/*` or `https://claude.com/code/*`. A blue **⬇ Archive session** button appears in the bottom-right corner.

## Use

1. Open a Claude Code Web session.
2. Click **⬇ Archive session**.
3. Confirm the prompt. **Do not touch the page** while the archiver runs — interacting with the page disrupts auto-scroll and capture.
4. Watch the progress overlay:
   - `Scrolling & capturing… messages: N`
   - `Downloading screenshots… X/Y (Z ok)`
   - `Building HTML…`
   - `Done! Messages: N, images embedded: M.`
5. A file named `<session-title>.html` is saved by your browser.

Press **Cancel** in the progress card at any time to abort.

## Output format

- Single `.html` file, self-contained, no external dependencies.
- Dark theme, readable on desktop and mobile.
- Each message is a `<section class="msg user|assistant">` with role label and message number.
- Images are embedded as `data:` URLs so the file works fully offline.
- Code blocks, tables, lists and `<details>` disclosures are preserved.
- Header includes archive timestamp, message count, source URL and parser version.

## Configuration

The behaviour knobs live at the top of the script in the `CFG` object:

| Key                | Default | Meaning                                                      |
| ------------------ | ------: | ------------------------------------------------------------ |
| `scrollStepRatio`  |   `0.6` | Fraction of viewport to scroll per step                      |
| `scrollWaitMs`     |   `650` | Delay after each scroll (ms) — increase on slow networks     |
| `expandWaitMs`     |   `120` | Delay after expanding a disclosure block                     |
| `stableLimit`      |     `4` | Consecutive no-progress steps before stopping                |
| `maxSteps`         |  `4000` | Hard safety cap on total scroll steps                        |
| `minTextLen`       |     `8` | Ignore nodes shorter than this (filters empty wrappers)      |
| `imgTimeoutMs`     | `20000` | Per-image download timeout (ms)                              |

Edit them in the installed script and your userscript manager will apply the change immediately.

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

## Contributing

Pull requests and issues are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Credits

Based on **["Claude Code Web to Markdown"](https://greasyfork.org/scripts/560005)** by **Aiuanyu** (MIT). This fork adds full-session auto-capture, screenshot embedding and a self-contained HTML export.

## License

[MIT](LICENSE) © Contento-R
