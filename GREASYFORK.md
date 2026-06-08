# Greasyfork publication kit

Copy-paste fields for [greasyfork.org](https://greasyfork.org/) when
publishing or updating the script. All English; Greasyfork's UI lets
you add a second-language description on a separate tab — paste the
Russian block from `README.ru.md` there.

---

## Name

```
Claude Code Web Session Archiver
```

## Short description (≤80 chars)

```
Save the entire Claude Code Web session as one self-contained HTML with screenshots.
```

## Description (markdown)

```markdown
Save the **entire** Claude Code Web session — including history the cloud has already compacted — as a single self-contained HTML file with all screenshots embedded as `data:` URLs. Also exports Markdown and JSON.

A small, draggable green panel appears on `code.claude.com`, `claude.ai/code` and `claude.com/code` with five controls:

- **⬇ Archive** — walks the whole session, captures every message in chronological order, downloads screenshots, and saves a portable file you can open offline in any browser.
- **⚡ Fast** — toggles an aggressive timing profile and parallelizes screenshot downloads from 4 to 10 concurrent requests.
- **📝 No code** — excludes code blocks Claude writes (tool calls, diffs, file viewers, `<pre>` fences) so only the conversation between you and the agent is exported. Detection uses computed `font-family` on the live DOM, so it works regardless of how the upstream UI wraps its code containers.
- **⚙ Settings** — output format (HTML / Markdown / JSON), "only new" delta mode, range filter, local-only network mode, secret redaction (regex list), and "collapse assistant blocks by default".
- Drag handle (`⋮⋮`) on the left edge — panel position persists in `localStorage` and auto-clamps to the viewport on window resize so it never disappears off-screen.

Hotkeys: **Alt+A** to start, **Esc** to cancel.

## Why

Claude Code Web compacts long sessions — older turns disappear from the live thread and survive only as a summary. This script walks the live DOM while everything is still rendered, so you can save the full transcript (plus screenshots) before the next compaction.

## How it works

1. Jumps to the top, then auto-scrolls down step by step so the virtualizer renders every message. A MutationObserver wakes the loop as soon as new content appears, falling back to a configurable cap.
2. Expands every `<details>` and `aria-expanded="false"` disclosure block in view (skipped for code disclosures when *No code* is on).
3. Records each message's absolute Y position so the chronological order in the output matches what you see on the page, regardless of how the virtualizer interleaves rendering.
4. Detects role (User vs Claude) from `data-message-author-role` / `data-author` / `data-role` / `aria-label` attributes, falling back to computed alignment and geometric heuristics. Detects tool calls (Bash, Edit, Write, Read, Glob, Grep, WebFetch, WebSearch, Task, TodoWrite, NotebookEdit, NotebookRead, MultiEdit, ExitPlanMode, SlashCommand, KillShell) and model name (Opus / Sonnet / Haiku); per-message timestamps when `<time datetime>` or `[title]` provides them.
5. Downloads screenshots in parallel via `fetch` (with a `GM_xmlhttpRequest` fallback for cross-origin CDNs) and inlines each one as a `data:` URL. One automatic retry per image with randomized backoff.
6. Builds the output (HTML with theme toggle, search, jump-to-message TOC, print stylesheet — or Markdown, or JSON) and triggers a browser download. The HTML output is completely self-contained: no remote requests, no missing images, opens in any browser, works fully offline.

## Resume after crash

If the browser tab is closed or refreshed mid-archive, the next archive click offers to resume from the last snapshot (saved every ~5 seconds during scroll, kept for 24 hours).

## Privacy

Everything happens locally in your browser. The script makes **no** network calls beyond fetching the screenshots already shown in the chat (from `code.claude.com`, `claude.ai`, `claude.com`, `anthropic.com`, `cloudfront.net`, `amazonaws.com`). Local-only mode disables even the cross-origin screenshot fallback. The optional secret-redaction feature masks API keys and tokens (OpenAI, Anthropic, GitHub PATs, AWS access keys) before the file is written.

## Compatibility

Tampermonkey on Chrome, Edge, Firefox, Safari, Opera. Violentmonkey on Chromium / Firefox. Greasemonkey on Firefox. UI auto-selects English / Russian / German / French / Spanish from `navigator.language`.

## Source / contributing

Source, issues and PRs: https://github.com/Contento-R/claude-code-web-archiver

## Credits

Based on **"Claude Code Web to Markdown"** by **Aiuanyu** (MIT) — https://greasyfork.org/scripts/560005.

## License

MIT.
```

## Applies to

```
https://code.claude.com/*
https://claude.ai/code/*
https://claude.com/code/*
```

## Tags

```
claude, claude code, archive, backup, export, html, markdown, json, screenshots, session, transcript, compaction, anthropic, userscript, offline, search, redaction
```

---

## Update workflow

After cutting a new release on GitHub:

1. On Greasyfork, open the script page → **New version** (top-right gear menu).
2. Paste the entire userscript content. Greasyfork reads `@version`,
   `@updateURL`, `@downloadURL` from the metadata block — no extra fields
   needed.
3. Save. Existing Tampermonkey installs will pick the new version up
   within their normal poll interval.
