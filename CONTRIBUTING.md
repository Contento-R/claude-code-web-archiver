# Contributing

Thanks for considering a contribution! This project is a single-file userscript, so the workflow is intentionally lightweight.

## Ground rules

- Keep the userscript a **single file** with no build step. Anything that requires bundling or transpilation should be discussed in an issue first.
- Preserve the **English-default / Russian-localised** split:
  - `claude-code-web-archiver.user.js` — English UI, default.
  - `i18n/claude-code-web-archiver.ru.user.js` — Russian UI, kept in sync.
  - When you change behaviour, update **both** files.
- Don't add tracking, analytics or external network calls. The script must remain local-only.
- Keep `@grant` and `@connect` lists minimal — only add a host if you truly need it.

## How to propose a change

1. Open an issue describing the bug or feature first if the change is non-trivial.
2. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feature/short-description
   ```
3. Make your changes. Bump `@version` in the userscript header and the `VERSION` constant when the change is user-visible.
4. Test manually:
   - Install your modified script in Tampermonkey / Violentmonkey.
   - Open a real Claude Code Web session and click **Archive session**.
   - Verify the resulting HTML opens, all messages are present, screenshots are inlined, and ordering is correct.
   - Repeat for the Russian build if you touched localised strings.
5. Commit with a clear message and open a Pull Request describing what changed and how you tested it.

## Style

- Plain modern JavaScript, no dependencies.
- 4-space indentation, single quotes, semicolons.
- Keep helpers small and named — the script is read by humans more than machines.
- Comments explain **why**, not **what**.

## Reporting bugs

Include in your issue:

- Browser and userscript manager (with version).
- A short description of what you did, what you expected, and what happened.
- Any console errors (open DevTools → Console, filter by `[archiver]`).
- If possible, a sanitised screenshot of the page state.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
