# Contributing

Thanks for considering a contribution! This project is a single-file userscript, so the workflow is intentionally lightweight.

## Ground rules

- Keep the userscript a **single file** with no build step. Anything that requires bundling or transpilation should be discussed in an issue first.
- All UI strings live in the `I18N` object at the top of the script. When you add a new string:
  - add it to `I18N_EN` first (it's used as the fallback for every locale),
  - then add it to `ru`, `de`, `fr`, `es` where you're able to translate.
  - missing keys in any non-English locale transparently fall back to English via the Proxy in `pickT()`.
- All persistent state is stored in `localStorage` under the `cc-arch-*` prefix. If you add new keys, prefix them.
- Don't add tracking, analytics or external network calls. The only outbound request the script makes (besides screenshots already shown in the chat) is a daily `@version` check against `raw.githubusercontent.com`; keep it that way.
- Keep `@grant` and `@connect` lists minimal — only add a host if you truly need it.

## How to propose a change

1. Open an issue describing the bug or feature first if the change is non-trivial.
2. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feature/short-description
   ```
3. Make your changes. Bump `@version` in the userscript header and the `VERSION` constant when the change is user-visible. The two must agree — CI validates the metadata block on every push.
4. Test manually in a real Claude Code Web session:
   - Install your modified script in Tampermonkey / Violentmonkey.
   - Open a session and click **⬇ Archive**.
   - Verify the resulting file opens, all messages are present in chronological order, screenshots are inlined, and roles are labelled correctly.
   - Repeat with **⚡ Fast**, **📝 No code**, **⚙ Settings → Output format** toggled on if you touched their code paths.
   - For locale changes, set `navigator.language` (or temporarily flip `pickLang()`) and confirm UI strings render.
5. Run the project's checks locally:
   ```bash
   node --check claude-code-web-archiver.user.js
   ```
   Same check runs in CI on push and PR.
6. Commit with a clear message and open a Pull Request describing what changed and how you tested it.

## Architecture notes

- **`captureVisible`** runs many times during the scroll loop; keep it cheap. New nodes only — the `seenNodes` WeakSet skips already-processed nodes for O(1).
- **`guessRole`** uses signals strongest-first (data attributes → ancestor attributes → class names → computed style → geometry). The post-pass **`normalizeRoles`** runs once after capture and fixes degenerate splits using background-color clustering and structure heuristics.
- **`stripCode`** detects code via computed `font-family` on the LIVE DOM, mapped to the clone by parallel-index walk. Selectors are the cheap first pass.
- **Image downloads** use `fetch` first, fall back to `GM_xmlhttpRequest` for cross-origin, with one retry. `concurrency` controls the worker pool.
- **HTML output** is returned as a chunk array so the browser can stream the file into the Blob.
- **Resume** snapshots are saved every ~5 s during scroll and cleared on success.

## Style

- Plain modern JavaScript, no dependencies.
- 4-space indentation, single quotes, semicolons.
- Keep helpers small and named — the script is read by humans more than machines.
- Comments explain **why**, not **what**.

## Reporting bugs

Include in your issue:

- Browser and userscript manager (with version).
- Tampermonkey logs / DevTools Console output filtered by `[archiver]`.
- A short description of what you did, what you expected, and what happened.
- If possible, a sanitised screenshot of the page state.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
