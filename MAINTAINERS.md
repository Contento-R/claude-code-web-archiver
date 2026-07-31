# Maintainer's guide

Architecture, host-DOM reference, hard-won invariants, and a register of
approaches that **did not work**. Read the dead-ends register before
attempting any fix to capture, ordering, role detection or scrolling —
most obvious ideas in those areas have already been tried and failed for
non-obvious reasons.

Current version: **1.16.0**. Script: `claude-code-web-archiver.user.js`
(~3300 lines, single file, no build step).

---

## 1. Host DOM reference (Claude Code Web, internal name "epitaxy")

Everything here was established from real DOM diagnostic dumps, not from
guesswork. Guessing at this layer caused the majority of the bugs below.

### Structure

```
[data-testid="epitaxy-virtual-transcript"]   ← THE scroll container
  └ .relative.epitaxy-transcript-typography  ← full-height spacer
      └ .absolute.top-0.left-0.w-full        ← positioned window wrapper
          ├ [data-index="0"]                 ← one transcript entry
          ├ [data-index="1"]
          └ …
```

### Reliable markers

| Purpose | Marker | Notes |
|---|---|---|
| Scroll container | `[data-testid="epitaxy-virtual-transcript"]` | Canonical. Do not infer it by size. |
| Transcript entry | `[data-index="N"]` | Stable chronological index. **Primary sort key.** |
| **User turn** | `.epitaxy-user-turn` | 100 % accurate on the verified sample (6 user / 7 assistant). |
| User turn (secondary) | CSS vars `--ui-user-message-background`, `--ui-user-message-primary-text` | Appear in the Tailwind class string. |
| Assistant turn | `.epitaxy-markdown`, `.text-assistant-primary`, `.text-assistant-secondary` | Never carries `.epitaxy-user-turn`. |
| Tool-call widget | class token `group/tool` | Match with `[class*="group/tool"]` — variants like `group/tool:hover` exist. |
| Host build seen | `{service:'claude-ai', env:'production', version:'4794037c3f'}` | Logged by the page itself. |

### Facts that repeatedly caused wrong assumptions

- **`data-index` numbers *all* transcript events** — tool calls, tool
  results, system notices — while only a subset renders as visible
  entries. **Gaps in the index sequence are normal and are not data
  loss.** A session showed 84 captured entries spanning indexes 0–125.
- **No author-role attributes exist.** `data-message-author-role`,
  `data-author`, `data-role`, `data-actor`, `data-sender`, `data-from`
  were all probed and are all absent in the current build. Code that
  looks for them is dead weight kept only for other Claude UIs.
- **Y coordinates are not stable.** The virtualizer recomputes them:
  entry #12 was observed at Y=3446 *after* #11 was seen at Y=5879.
  Never sort by Y when `data-index` is available.
- **Tool widgets are often already `aria-expanded="true"`.** Do not
  assume collapsed widgets need clicking to mount their bodies.
- **Tool bodies may be nested *inside* the button**, not as a sibling.
  Bash output tends to be a sibling; Read/Glob/Edit bodies are nested.
- **"Mostrar más" / "Show more" are plain `<button>`s** without
  `aria-expanded`. They need text matching, not attribute matching.
- **Older history loads lazily over the network** when the viewport
  sits at the top; a fetch takes hundreds of milliseconds.
- Legacy markers `ml-auto`, `bg-bg-200.rounded-lg` are from a retired
  UI and no longer mean anything.

---

## 2. Browser behaviour facts

These are platform truths that invalidated several "fallback" mechanisms
which looked reasonable but never executed anything.

- **A synthetic `WheelEvent` does not scroll.** Browsers perform native
  scrolling only for trusted (real user) events. `dispatchEvent(new
  WheelEvent(...))` merely notifies JS listeners. Multiple releases
  carried this as a "fallback"; it never moved a pixel.
- **`element.scrollTop = x` silently no-ops** when `element` is not the
  actual scrolling ancestor. This is why manual wheel scrolling reached
  the start of a session while the script never did — the browser
  resolves the right ancestor, a hard-coded guess does not.
- **`scrollIntoView()` is native** and scrolls every ancestor that needs
  to move. It is the correct fallback when a `scrollTop` assignment
  produces no movement.
- **Scroll anchoring** makes the browser compensate scroll position when
  content is prepended above the viewport — which is exactly what
  happens while older history loads. Do not expect to "hold" position 0.
- **`getComputedStyle` does not resolve on detached nodes.** Anything
  style-based must be measured on the live node, then mapped onto the
  clone by parallel index walk.
- **`raw.githubusercontent.com` is CDN-cached for minutes**, and
  `GM_xmlhttpRequest` may additionally serve from browser cache. Update
  checks need a cache-busting query parameter plus `Cache-Control:
  no-cache`.

---

## 3. Capture pipeline

```
run()
 ├─ detectScroller()            empirical: nudge each scrollable ancestor
 │                              of a mounted [data-index] by 40px, keep
 │                              the one that actually moves it on screen
 ├─ scrollToSessionTop()        continuous wall-clock quiet window
 │                              (1000 ms fast / 1500 ms normal), 30 s cap
 ├─ scrollUpAndCapture()        walk UP, capture at every step; progress
 │                              measured by minMountedIndex(), not scrollTop
 ├─ downward sweep              expandInView() + captureVisible() per step
 ├─ buildOrder()                sort by dataIndex → y → seq
 ├─ normalizeRoles()            no-op when the primary detector worked
 ├─ finalizeRawHtml() × N       the one heavy sanitisation pass
 ├─ downloadAllImages()         concurrency pool, one retry each
 └─ buildHtml/Markdown/Json
```

### Design points that matter

- **Capture order is irrelevant.** `buildOrder()` sorts by `data-index`,
  so the up-sweep can capture in reverse. Only *coverage* matters. This
  is what makes the upward pass a valid safety net.
- **Grow-and-recapture.** `lastCapturedLengths` (a `WeakMap` node →
  text length) re-captures an entry whenever its text grows, so bodies
  that mount later (tool expansion) replace earlier truncated captures.
- **Two-tier sanitisation.** During scrolling only `lightCloneHtml()`
  runs (clone + bake image `src`). The expensive pass
  (`heavySanitize`: element walk, attribute strip, `wrapToolCalls`,
  redaction) runs **once per message** after scrolling. Re-running it on
  every growth tick was a major slowdown.
- **Entries are keyed by `data-index`**, falling back to a text prefix
  only when no index exists. Text-prefix keys collide because assistant
  turns routinely open with identical tool summaries.
- **Batched clicks.** All expansion clicks in a scroll step fire in one
  synchronous batch with a single settle wait. One sleep per widget cost
  minutes on long sessions.

---

## 4. Invariants — do not break these

1. **Never sort by Y when `data-index` exists.** Y is unstable.
2. **Never key a message by its text prefix.** Collisions silently drop
   messages.
3. **Never keep per-message bookkeeping keyed by DOM node.** The
   virtualizer recycles nodes, so a node-keyed record silently describes
   a different message later on. Key by the entry key, as `messages`
   does. (Cost: v1.16.0 — early messages dropped from every export.)
4. **Never use message length as a role signal.** Long user prompts get
   misclassified.
5. **Never match role keywords against `outerHTML` or rendered text.**
   An assistant message containing the word "user" will flip.
6. **Never treat MutationObserver wake-ups as a settle signal.** The
   transcript mutates continuously; use wall-clock quiet windows.
7. **Never budget a wait on the network in steps.** A step's sleep is
   tens of milliseconds; a history fetch is hundreds. Use wall-clock.
8. **Never assume a `scrollTop` assignment worked.** Verify movement,
   and fall back to `scrollIntoView`.
9. **Never infer the message list by drilling DOM levels.** Use
   `[data-index]`.
10. **Diagnostics must contain zero session content.** See §6.
11. **Run `node -c claude-code-web-archiver.user.js` before every push.**

---

## 5. Register of dead ends

Every one of these was implemented, shipped, and failed. The value of
this section is negative knowledge — do not spend cycles here again.

### Role detection — five failed strategies

| Version | Approach | Why it failed |
|---|---|---|
| ≤1.1.4 | Tailwind classes `ml-auto`, `bg-bg-200.rounded-lg` | Classes belonged to a retired UI. Result: 2 of 63 messages labelled user. |
| 1.1.5 | Keyword regex over `outerHTML.slice(0, 2000)` | That string contains rendered **text**, so "the user asked" flipped an assistant message. Also `you`/`ai`/`bot`/`response` matched ordinary prose. |
| 1.7.0 | `backgroundColor` clustering + "<600 chars ⇒ user" | Length signal misclassified long user prompts; colour clustering picked the wrong cluster when palettes overlapped. |
| 1.8.0 | Purely structural (tool/`<pre>`/headings/system phrases ⇒ assistant, else user) | Reported by the user as *worse*. |
| 1.9.0 | Anchor first message as user + match others by its background colour, gated on that colour being a ≤50 % minority | When user and assistant backgrounds look similar the gate never opens, so **only** the anchor is ever user. |
| **1.11.0** | **`.epitaxy-user-turn` class** | **Works.** Found only after collecting a real DOM dump. |

**Lesson:** four releases were spent inventing signals without ever
looking at the actual markup. The debug-mode dump should have been the
*first* step, not the fifth.

### Scrolling to the session start — five failed strategies

| Version | Approach | Why it failed |
|---|---|---|
| 1.11.9 | Loop `scrollTop = 0` until `scrollHeight` stops growing, counting MutationObserver wake-ups | `waitForMutationOrTimeout` resolves on the *first* mutation, and the transcript mutates constantly (spinners, node recycling). Rounds completed in 1–5 ms, so the whole 3–4 round budget burned out in milliseconds while the history fetch was still in flight. |
| 1.12.1 | Same, but requiring a continuous wall-clock quiet window | Correct measurement, but still built on "park at 0 and hold", which is not achievable — the UI re-pins, scroll anchoring compensates, expansion changes heights. |
| 1.12.2 | Upward sweep capturing along the way | Right idea, but still driving a guessed element. |
| 1.13.0 | Blamed the `onlyNew` / `rangeFrom` export filters | **Wrong hypothesis entirely.** The user's settings were clean. Cost a full release cycle and introduced a TDZ regression that killed the settings modal. |
| 1.14.0 + 1.14.2 | Fixed `getMessageNodes()` and the scroll container | **The two actual causes.** |
| 1.15.0 | Empirical scroller detection + index-based progress | Reported by the user as **still broken**. |
| 1.16.0 | Entry-keyed grow-and-recapture, wall-clock stuck budget, `indexRenumbered` measurement | Two real defects fixed (below). Did not fix the symptom by itself — but the measurement it added identified the root cause on the next run. |
| 1.17.0 | Stop trusting `data-index` for arrival; page-up-sized steps; nudge a pinned scroller; finish on "pinned + nothing arriving" | Current approach. Built on the measured fact that the host renumbers indexes. |

**The v1.16.0 defects, both of which drop early messages:**

1. **Grow-and-recapture was keyed by DOM node.** `captureVisible` skipped
   any node whose text had not grown since last time — but the length it
   compared against was stored per *node*, and a virtualized list recycles
   nodes. A node that held a long tail message, re-used for an older,
   shorter one, fails that test forever, so the older entry never enters
   the export. This is invariant 2 in a different disguise.
2. **The up-sweep gave up after ~1.1 s** (8 steps × 140 ms in fast mode)
   while the history fetch it was waiting for — hundreds of ms, more on a
   long session — was still in flight. Budgets for waiting on the network
   must be wall-clock.

**ANSWERED in the field (v1.16.0 measurement, real session):
`indexRenumbered: 2`. `data-index` is renumbered as older history is
prepended.** It numbers entries within the **loaded window**, not within
the session. Consequences, all of which were live bugs:

- `minDataIndex: 0` never proved the export started at the beginning. It
  meant "top of what had loaded". The RUN REPORT was reporting success
  for runs that began mid-session — including the `captured: 84,
  minDataIndex: 0` run that v1.14.3 recorded as the fix landing.
- Every arrival test since v1.14.0 (`mi === 0`) stopped at the first
  loaded chunk.
- Index-keyed entries can be overwritten by a different message when the
  numbering shifts under them.

**Never use `data-index` as evidence of reaching the session start.** It
remains correct as a *sort key within a single settled snapshot*, which
is why ordering still works once loading has finished — and that is
exactly why the manual workaround (page up to the true start, then
archive) always produced a complete file.

**Lesson:** the five scroll releases could not have worked. They tuned
exit conditions of a loop that (a) was driving an element which does not
scroll the transcript, and (b) read `data-index` as `null` for every
node, so every "are we at the start?" signal was noise. **Measure the
pipeline before theorising about it.**

### Code / tool-body capture

| Version | Approach | Why it failed |
|---|---|---|
| 1.1.0–1.1.1 | Enumerate code CSS classes | Host class names change between releases; something always slips through. |
| 1.1.2 | Detect code by computed `font-family` monospace on the live DOM | **Works.** |
| 1.11.2 | Removed auto-resume, added `stripCode` warning | Correctly *ruled out* stale `skipCode` state, but was not the cause. |
| 1.11.5 | `wrapToolCalls` via `btn.replaceWith(details)` | **Actively destroyed data**: the button's own children were discarded, and file bodies are nested inside the button. |
| 1.11.6–1.11.7 | Click tool widgets to mount their bodies; then widen selectors and lengthen pauses | Aimed at a non-existent problem — the widgets were already `aria-expanded="true"`, so the click code never even ran. |
| 1.11.8 | Preserve button children when wrapping | Fixed the real defect. |

### Other

- **Timestamp-based ordering** was evaluated and rejected: locale/format
  variance, coarse granularity (many messages share "1m ago"), missing on
  tool/service blocks, and it is only a noisier proxy for the order
  already encoded in the layout. `data-index` supersedes this entirely.
- **`mergeOrder` neighbour heuristic** (guessing a new message's slot
  from its nearest known neighbours) failed because a virtualized list
  appends nodes in render order, not visual order.
- **Auto-resume** (v1.6.0–v1.11.1) was removed outright in v1.11.2. It
  persisted `skipCode`/`fastMode` in its snapshot and force-restored
  them, so one accidental "No code" click silently stripped code from
  every archive for the next 24 h. Not worth reintroducing.
- **`confirm()` before archiving** was removed in v1.8.0 — replaced by a
  3-second non-blocking banner and an Archive→Stop button toggle.

---

## 6. Debugging playbook

When something is wrong, **measure first**. Two instruments exist and
neither leaks conversation content.

### RUN REPORT (always on, console)

Printed at the end of every run as `[archiver] RUN REPORT`. Numeric only.

| Field | Meaning |
|---|---|
| `captured` | Entries stored. Compare with the visible session size. |
| `minDataIndex` | **0 ⇒ the export starts at the true beginning.** |
| `maxDataIndex`, `indexSpan`, `indexesMissingInSpan` | Coverage and hole size. Some holes are normal (§1). |
| `withoutDataIndex` | **Non-zero ⇒ the node selection is wrong**, ordering is running blind. |
| `container` | `data-testid`, class head, live `scrollTop`/`scrollHeight`/`clientHeight`, whether `[data-index]` is inside. Confirms the right element is being driven. |
| `topReach` | `settled` / `timeout`. |
| `upSweep` | `reached-top` / `stuck` / `maxsteps`. |
| `upSweepLowestIndex`, `scrollerRedetected` | How far back the up-sweep reached; whether the scroller had to be re-probed. |
| `indexRenumbered` | **Non-zero ⇒ `data-index` is a position in the loaded window, not in the session.** The same entry was observed under two different indexes. `minDataIndex` then proves nothing about reaching the start, and index-keyed entries can overwrite one another. Check this first. |
| `nodeRecycled` | The host re-uses DOM nodes for different entries. Expected for a virtualized list; recorded because any per-node bookkeeping is unsafe when it is non-zero. |

Reference values from a real broken run (v1.13.2):
`captured: 5, minDataIndex: null, withoutDataIndex: 5` — this single line
identified both root causes.
After the fixes: `captured: 84, minDataIndex: 0, withoutDataIndex: 0`.

### Debug mode (opt-in, Settings → Debug mode)

Writes `<title>.debug.txt` alongside the archive. Since v1.13.3 it
contains **no session content**:

- message text → character counts only;
- `outerHTML` → a *structure skeleton*: every text node collapsed to
  `«text:N»`, and `src` / `href` / `alt` / `title` / `value` /
  `placeholder` / `srcset` / `style` replaced with `«redacted»`;
- images → `data-url` vs `remote-url` plus lengths;
- buttons → `aria-expanded`, `aria-controls`, label/text **lengths**,
  `isToolWidget`, class.

Tag / class / `data-*` / `aria-*` / nesting structure is preserved, which
is everything needed to tune selectors. Turn it off afterwards: it costs
roughly 10 % capture time and writes an extra file.

---

## 7. Environment and release process

### Sandbox limitations discovered

- The git proxy accepts **only `refs/heads/*`**. `git push --tags`
  returns HTTP 403.
- Direct `api.github.com` access returns 403.
- The GitHub MCP tools are **read-only** — no create-release, no
  create-tag, and `workflow_dispatch` returns 403.

### Working release flow

Because tags cannot be pushed from the sandbox, releases are created by
CI using the workflow's own `GITHUB_TOKEN`:

- `.github/workflows/release.yml` runs on **push to `main`**. It walks
  `git log --reverse`, matches `vX.Y.Z` anywhere in each commit subject,
  skips releases that already exist, and runs `gh release create` with
  notes taken from the matching `CHANGELOG.md` section. Tags are created
  as a side effect. This backfilled all 19 historical releases in ~70 s.
- `.github/workflows/check.yml` runs `node --check` plus metadata
  validation on push and PR.

### Branches

- Development branch: `claude/add-tampermonkey-script-lCSKU`
- Ship a release: `git push origin claude/add-tampermonkey-script-lCSKU:main`
- `@updateURL` / `@downloadURL` point at `main`. **Until `main` existed,
  update checks 404'd silently for seven releases** — Tampermonkey
  reports a 404 as "no update available".

### Updating a local install

`https://raw.githubusercontent.com/Contento-R/claude-code-web-archiver/main/claude-code-web-archiver.user.js?v=N`
— the query parameter defeats the CDN cache. Or use Tampermonkey's own
Dashboard → *Check for userscript updates*, which is unaffected by any
in-script bug.

---

## 8. Open items

- **Is `data-index` per-session or per-loaded-window?** The one question
  that decides whether the current keying/ordering design is sound at
  all. v1.16.0 instruments it: read `indexRenumbered` from the RUN
  REPORT. Non-zero ⇒ every "we reached the start" signal since v1.14.0
  has been measuring the wrong thing, and entry identity must be rebuilt
  on something other than the raw index.
- **v1.17.0 is unverified.** Confirm against a long session with **no
  manual pre-scrolling**. The decisive field is `topReachGrowths`: it
  counts the times older history actually arrived. **Zero means the
  script never caused any loading**, so the export can only contain what
  was already mounted — the failure mode this release exists to remove.
  Also check `topReachSteps`, `topReachNudges` and `topReach`
  (`settled` vs `timeout`).
- **Compaction was ruled out for the reported session:** the user
  confirmed that paging up by hand reaches the first message and that
  archiving from there produces a complete file. So the early turns are
  in the DOM and reachable — the script's job is purely to get there on
  its own.
- The nudge (bounce 80 px down and back when pinned and silent) is a
  guess at what provokes the host's next fetch, informed by the fact that
  manual PageUp works. If `topReachNudges` is high while
  `topReachGrowths` stays 0, the nudge is not the right provocation and
  the next thing to measure is what the host actually listens to
  (`scroll` handler on which element, IntersectionObserver on a sentinel
  node near the top, etc.).
- **`indexGaps: 12`** on an 84/0–125 run is *believed* normal (unrendered
  transcript events) but was never proven. `indexSpan` and
  `indexesMissingInSpan` exist to quantify it.
- **Collapsed tool bodies in the export** (`<details>` wrapping, v1.11.5
  + v1.11.8) were never explicitly confirmed correct by inspection —
  attention moved to the scroll bug.
- The Greasyfork listing (`GREASYFORK.md`) has not been published.
