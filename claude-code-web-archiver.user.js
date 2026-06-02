// ==UserScript==
// @name         Claude Code Web Session Archiver
// @namespace    https://github.com/Contento-R/claude-code-web-archiver
// @version      1.1.4
// @description  Archive a full Claude Code Web session into one self-contained HTML file: auto-scroll, expand collapsed blocks, download screenshots, optional fast mode and code-strip. Bilingual UI (EN/RU) auto-selected from the browser locale.
// @description:ru Архивирует всю сессию Claude Code Web в один автономный HTML: авто-прокрутка, разворачивание свёрнутых блоков, скачивание скриншотов, режимы ускорения и пропуска кода. UI на EN/RU по локали браузера.
// @author       Contento-R
// @license      MIT
// @homepageURL  https://github.com/Contento-R/claude-code-web-archiver
// @supportURL   https://github.com/Contento-R/claude-code-web-archiver/issues
// @match        https://code.claude.com/*
// @match        https://claude.ai/code
// @match        https://claude.ai/code/*
// @match        https://claude.com/code
// @match        https://claude.com/code/*
// @grant        GM_xmlhttpRequest
// @connect      code.claude.com
// @connect      claude.ai
// @connect      claude.com
// @connect      anthropic.com
// @connect      cloudfront.net
// @connect      amazonaws.com
// @connect      self
// @run-at       document-idle
// ==/UserScript==

// Based on "Claude Code Web to Markdown" by Aiuanyu (MIT License).
// https://greasyfork.org/scripts/560005
// Modified to add full-session auto-capture, screenshot embedding, HTML export,
// a fast mode, a code-strip mode and a draggable 3-button panel.

(function () {
    'use strict';
    const VERSION = '1.1.4';

    // ===== I18N =====
    const I18N = {
        en: {
            htmlLang: 'en',
            confirm: 'The archiver will automatically scroll through the ENTIRE session, expand collapsed blocks, and download screenshots.\n\nDo not touch the page during the process. Continue?',
            noContainer: 'Chat container not found.',
            starting: 'Starting... scrolling to the top of the session.',
            scrolling: (n) => `Scrolling & capturing... messages: ${n}`,
            scrollDone: (n) => `Scrolling complete. Messages: ${n}. Downloading screenshots...`,
            downloading: (d, t, ok) => `Downloading screenshots... ${d}/${t} (${ok} ok)`,
            embedded: (ok, t) => `Screenshots: ${ok}/${t} embedded.`,
            building: 'Building HTML...',
            done: (n, m) => `Done! Messages: ${n}, images embedded: ${m}.`,
            cancelled: 'Cancelled.',
            cancelling: 'Cancelling...',
            startingShort: 'Starting...',
            error: 'Error: ',
            archive: 'Archive',
            fast: 'Fast',
            noCode: 'No code',
            cancel: 'Cancel',
            archiveTitle: 'Archive session — capture all messages and screenshots into one HTML file',
            fastTitleOn: 'Fast mode is ON — delays minimized, downloads parallel',
            fastTitleOff: 'Fast mode is OFF — click to minimize delays and parallelize downloads',
            noCodeTitleOn: 'Skip code blocks is ON — only the conversation will be exported',
            noCodeTitleOff: 'Skip code blocks is OFF — click to exclude code blocks Claude writes',
            dragTitle: 'Drag the panel',
            userLabel: 'User',
            assistantLabel: 'Claude',
            archivedLabel: 'Archived',
            messagesLabel: 'Messages',
            sourceLabel: 'Source',
            parserLabel: 'Parser',
        },
        ru: {
            htmlLang: 'ru',
            confirm: 'Архиватор прокрутит ВСЮ сессию автоматически, развернёт свёрнутые блоки и скачает скриншоты.\n\nНе трогай страницу во время процесса. Продолжить?',
            noContainer: 'Не нашёл контейнер чата.',
            starting: 'Запуск… прокрутка в начало сессии.',
            scrolling: (n) => `Прокрутка и захват… сообщений: ${n}`,
            scrollDone: (n) => `Прокрутка готова. Сообщений: ${n}. Скачиваю скриншоты…`,
            downloading: (d, t, ok) => `Скачиваю скриншоты… ${d}/${t} (${ok} ok)`,
            embedded: (ok, t) => `Скриншоты: ${ok}/${t} встроено.`,
            building: 'Собираю HTML…',
            done: (n, m) => `Готово! Сообщений: ${n}, картинок встроено: ${m}.`,
            cancelled: 'Отменено.',
            cancelling: 'Отмена…',
            startingShort: 'Старт…',
            error: 'Ошибка: ',
            archive: 'Архив',
            fast: 'Быстро',
            noCode: 'Без кода',
            cancel: 'Отмена',
            archiveTitle: 'Архивировать сессию — захватить все сообщения и скриншоты в один HTML',
            fastTitleOn: 'Режим ускорения ВКЛ — задержки минимизированы, загрузка параллельна',
            fastTitleOff: 'Режим ускорения ВЫКЛ — нажмите, чтобы ускорить захват и распараллелить загрузку',
            noCodeTitleOn: 'Пропуск кода ВКЛ — будет выгружена только переписка',
            noCodeTitleOff: 'Пропуск кода ВЫКЛ — нажмите, чтобы исключить блоки кода, которые пишет Claude',
            dragTitle: 'Перетащить панель',
            userLabel: 'Пользователь',
            assistantLabel: 'Claude',
            archivedLabel: 'Архивировано',
            messagesLabel: 'Сообщений',
            sourceLabel: 'Источник',
            parserLabel: 'Парсер',
        },
    };
    function pickLang() {
        const l = (navigator.language || 'en').toLowerCase();
        return l.startsWith('ru') ? 'ru' : 'en';
    }
    const T = I18N[pickLang()];

    // ===== CONFIG =====
    const CFG_NORMAL = {
        scrollStepRatio: 0.6,
        scrollWaitMs: 650,
        expandWaitMs: 120,
        stableLimit: 4,
        maxSteps: 4000,
        minTextLen: 8,
        imgTimeoutMs: 20000,
        concurrency: 4,
    };
    const CFG_FAST = {
        scrollStepRatio: 0.9,
        scrollWaitMs: 160,
        expandWaitMs: 25,
        stableLimit: 3,
        maxSteps: 4000,
        minTextLen: 8,
        imgTimeoutMs: 20000,
        concurrency: 8,
    };

    // ===== STATE =====
    let busy = false;
    let cancelled = false;
    let fastMode = false;
    let skipCode = false;
    // key -> { html, role, y, seq }
    //   y   = absolute Y position inside the chat container at first capture
    //   seq = insertion counter, used as a stable tiebreaker
    const messages = new Map();
    let seqCounter = 0;
    let order = [];               // final chronological order, computed after scroll
    let chatContainer = null;
    const cfg = () => (fastMode ? CFG_FAST : CFG_NORMAL);

    // ===== SMALL UTILS =====
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const keyOf = (t) => t.replace(/\s+/g, ' ').trim().slice(0, 220);
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function getTitle() {
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim()) return h1.textContent.trim();
        return document.title.replace(/\s*\|\s*Claude.*$/i, '').trim() || 'claude-code-session';
    }

    function findChatContainer() {
        const main = document.querySelector('main') || document.body;
        let best = main, bestArea = 0;
        for (const el of main.querySelectorAll('*')) {
            const cs = getComputedStyle(el);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
                el.scrollHeight > el.clientHeight + 50) {
                const area = el.scrollHeight * el.clientWidth;
                if (area > bestArea) { bestArea = area; best = el; }
            }
        }
        return best;
    }

    function findMessageNodes(container) {
        let cur = container;
        for (let d = 0; d < 12; d++) {
            const kids = Array.from(cur.children || []);
            const withText = kids.filter(c => ((c.innerText || c.textContent || '').trim().length > cfg().minTextLen));
            if (withText.length >= 2) return withText;
            if (withText.length === 1) { cur = withText[0]; continue; }
            break;
        }
        return Array.from(container.querySelectorAll(':scope > * > *'))
            .filter(c => ((c.innerText || '').trim().length > cfg().minTextLen));
    }

    // ===== ROLE GUESS =====
    function guessRole(node) {
        const probe = (node.className || '') + ' ' + node.outerHTML.slice(0, 400);
        if (/ml-auto|justify-end|items-end|text-right|self-end/.test(probe)) return 'user';
        if (node.querySelector && node.querySelector('.bg-bg-200.rounded-lg')) return 'user';
        return 'assistant';
    }

    // ===== IMAGE SRC RESOLUTION =====
    function bestImageSrc(img) {
        const a = img.closest && img.closest('a');
        if (a && a.href && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(a.href)) return a.href;
        return img.currentSrc || img.src || img.getAttribute('data-src') || '';
    }

    // ===== STRIP CODE / TOOL-CALL BLOCKS FROM A CLONE =====
    // Claude Code Web puts code in many shapes: <pre> for markdown fences,
    // <details> wrappers for tool calls (Bash/Edit/Write/etc.), and various
    // custom containers. Class names change often, so the primary detector is
    // computed `font-family` on the LIVE DOM — code is rendered with a
    // monospace font regardless of how the container is named.
    const CODE_SELECTORS = [
        'pre',
        'details',
        '[class*="code-block" i]',
        '[class*="codeblock" i]',
        '[class*="code_block" i]',
        '[class*="language-" i]',
        '[class*="hljs" i]',
        '[class*="shiki" i]',
        '[class*="prism" i]',
        '[class*="font-mono" i]',
        '[data-language]',
        '[data-code-block]',
        '[data-testid*="code" i]',
        '[data-testid*="tool" i]',
        '[data-testid*="artifact" i]',
        '[data-testid*="diff" i]',
        '[aria-label*="code" i]',
    ].join(',');
    const MONO_RE = /mono|courier|consolas|menlo|monaco|fira\s*code|jetbrains/i;
    // Anything above this many monospace characters is treated as a code block
    // and stripped; below it we assume it's an inline technical term and keep it.
    const MONO_MIN_LEN = 25;

    function stripCode(clone, liveNode) {
        if (!liveNode || !liveNode.querySelectorAll) return 0;
        const liveAll = [liveNode, ...liveNode.querySelectorAll('*')];
        const cloneAll = [clone, ...clone.querySelectorAll('*')];
        const aligned = liveAll.length === cloneAll.length;
        const toRemove = new Set();

        // Pass 1 — selector match on the clone (cheap, always works).
        clone.querySelectorAll(CODE_SELECTORS).forEach(e => toRemove.add(e));

        // Pass 2 — computed-style scan on the live DOM, mapped to clone by index.
        // This is the catch-all: any container rendered with a monospace font and
        // substantial text is treated as code.
        if (aligned) {
            for (let i = 0; i < liveAll.length; i++) {
                const le = liveAll[i];
                const ce = cloneAll[i];
                if (!le || !ce || !(le instanceof Element)) continue;
                let cs;
                try { cs = getComputedStyle(le); } catch (_) { continue; }
                if (!cs) continue;

                const ff = cs.fontFamily || '';
                if (MONO_RE.test(ff)) {
                    const txt = (le.textContent || '').trim();
                    if (txt.length >= MONO_MIN_LEN) toRemove.add(ce);
                    continue;
                }
                // Block-level <code> outside <pre> — usually an editor / file viewer.
                if (le.tagName === 'CODE') {
                    const d = cs.display;
                    if (d === 'block' || d === 'flex' || d === 'grid') toRemove.add(ce);
                }
            }
        }

        // Remove only the outermost marked element of each subtree so we don't
        // waste work removing children that are already going away with their parent.
        let removed = 0;
        for (const e of toRemove) {
            let p = e.parentElement, nested = false;
            while (p) { if (toRemove.has(p)) { nested = true; break; } p = p.parentElement; }
            if (nested) continue;
            try { e.remove(); removed++; } catch (_) { /* ignore */ }
        }
        if (removed) console.debug('[archiver] skipCode removed', removed, 'code-like element(s)');
        return removed;
    }

    // ===== SANITIZE A LIVE NODE INTO PORTABLE HTML =====
    function sanitizeClone(node) {
        const clone = node.cloneNode(true);
        // Run skipCode FIRST, while the clone is still a 1:1 mirror of the live
        // node — stripCode uses parallel indexing into live/clone to read
        // computed styles.
        if (skipCode) stripCode(clone, node);
        const liveImgs = node.querySelectorAll('img');
        const cloneImgs = clone.querySelectorAll('img');
        for (let i = 0; i < cloneImgs.length; i++) {
            const real = liveImgs[i] ? bestImageSrc(liveImgs[i]) : (cloneImgs[i].src || '');
            if (real) cloneImgs[i].setAttribute('src', real);
            cloneImgs[i].removeAttribute('srcset');
            cloneImgs[i].removeAttribute('data-src');
        }
        clone.querySelectorAll('script,style,svg,noscript,input,textarea').forEach(e => e.remove());
        clone.querySelectorAll('button,[role="button"]').forEach(b => {
            const span = document.createElement('span');
            span.innerHTML = b.innerHTML;
            b.replaceWith(span);
        });
        clone.querySelectorAll('*').forEach(el => {
            [...el.attributes].forEach(at => {
                if (!['src', 'href', 'alt', 'colspan', 'rowspan'].includes(at.name)) el.removeAttribute(at.name);
            });
        });
        return clone;
    }

    // ===== EXPAND SAFE DISCLOSURE ELEMENTS IN VIEW =====
    async function expandInView(container) {
        const toOpen = [];
        // When skipCode is on, <details> blocks are tool-call code and will be
        // dropped anyway — don't pay the time to open them.
        if (!skipCode) {
            container.querySelectorAll('details:not([open])').forEach(d => toOpen.push(['details', d]));
        }
        container.querySelectorAll('[aria-expanded="false"]').forEach(el => toOpen.push(['aria', el]));
        if (toOpen.length === 0) return;
        // Open <details> synchronously in a batch (no per-item wait needed).
        for (const [kind, el] of toOpen) {
            if (cancelled) return;
            if (kind === 'details') {
                try { el.open = true; } catch (e) { /* ignore */ }
            }
        }
        // aria-expanded buttons need clicks; pace them with the configured delay.
        for (const [kind, el] of toOpen) {
            if (cancelled) return;
            if (kind !== 'aria') continue;
            try { el.click(); } catch (e) { /* ignore */ }
            if (cfg().expandWaitMs > 0) await sleep(cfg().expandWaitMs);
        }
    }

    // ===== CAPTURE WHAT'S CURRENTLY IN THE DOM =====
    // For each newly-seen message, record its absolute Y position inside the
    // scrollable chat container. Visual top-to-bottom order = chronological
    // order in the chat, so we sort the whole map by Y once scrolling is done.
    // This avoids relying on DOM child order, which is meaningless in
    // virtualized lists.
    function captureVisible(container) {
        const containerRect = container.getBoundingClientRect();
        const scrollY = container.scrollTop || 0;
        const nodes = findMessageNodes(container);
        for (const node of nodes) {
            const text = (node.innerText || node.textContent || '').trim();
            if (text.length < cfg().minTextLen) continue;
            const k = keyOf(text);
            if (messages.has(k)) continue;
            let y = 0;
            try {
                const rect = node.getBoundingClientRect();
                y = rect.top - containerRect.top + scrollY;
            } catch (e) { y = scrollY; }
            messages.set(k, {
                html: sanitizeClone(node).outerHTML,
                role: guessRole(node),
                y,
                seq: seqCounter++,
            });
        }
    }

    function buildOrder() {
        return [...messages.entries()]
            .sort((a, b) => (a[1].y - b[1].y) || (a[1].seq - b[1].seq))
            .map(([k]) => k);
    }

    // ===== AUTO-SCROLL THROUGH THE WHOLE SESSION =====
    async function autoScroll(container) {
        container.scrollTop = 0;
        await sleep(cfg().scrollWaitMs * 1.5);

        let lastTop = -1, stable = 0, steps = 0;
        while (!cancelled && steps < cfg().maxSteps) {
            await expandInView(container);
            captureVisible(container);
            setProgress(T.scrolling(messages.size));

            const top = container.scrollTop;
            const atBottom = top + container.clientHeight >= container.scrollHeight - 4;
            if (top === lastTop || atBottom) {
                stable++;
                if (stable >= cfg().stableLimit) break;
            } else {
                stable = 0;
            }
            lastTop = top;
            container.scrollTop = top + container.clientHeight * cfg().scrollStepRatio;
            steps++;
            await sleep(cfg().scrollWaitMs);
        }
        await expandInView(container);
        captureVisible(container);
    }

    // ===== IMAGE DOWNLOAD =====
    function blobToDataURL(blob) {
        return new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = rej;
            fr.readAsDataURL(blob);
        });
    }

    function gmGet(url) {
        return new Promise((res, rej) => {
            if (typeof GM_xmlhttpRequest === 'undefined') return rej(new Error('GM_xmlhttpRequest unavailable'));
            GM_xmlhttpRequest({
                method: 'GET', url, responseType: 'blob', timeout: cfg().imgTimeoutMs,
                onload: r => (r.status >= 200 && r.status < 300 && r.response) ? res(r.response) : rej(new Error('HTTP ' + r.status)),
                onerror: () => rej(new Error('network error')),
                ontimeout: () => rej(new Error('timeout')),
            });
        });
    }

    async function urlToDataURL(url) {
        if (!url || url.startsWith('data:')) return url || null;
        try {
            const r = await fetch(url, { credentials: 'include' });
            if (r.ok) return await blobToDataURL(await r.blob());
        } catch (e) { /* fall through */ }
        try {
            return await blobToDataURL(await gmGet(url));
        } catch (e) { /* fall through */ }
        return null;
    }

    function collectImageUrls() {
        const set = new Set();
        for (const k of order) {
            const entry = messages.get(k);
            if (!entry) continue;
            const tmp = document.createElement('div');
            tmp.innerHTML = entry.html;
            tmp.querySelectorAll('img[src]').forEach(img => {
                const s = img.getAttribute('src');
                if (s && !s.startsWith('data:')) set.add(s);
            });
        }
        return [...set];
    }

    async function downloadAllImages() {
        const urls = collectImageUrls();
        const total = urls.length;
        const map = new Map();
        let done = 0, ok = 0, idx = 0;
        const conc = Math.max(1, Math.min(cfg().concurrency, total || 1));
        setProgress(T.downloading(0, total, 0));

        async function worker() {
            while (!cancelled) {
                const i = idx++;
                if (i >= urls.length) return;
                const u = urls[i];
                const data = await urlToDataURL(u);
                if (data && data.startsWith('data:')) { map.set(u, data); ok++; }
                done++;
                setProgress(T.downloading(done, total, ok));
            }
        }
        await Promise.all(Array.from({ length: conc }, worker));
        setProgress(T.embedded(ok, total));
        return map;
    }

    // ===== BUILD FINAL HTML =====
    function buildHtml(imgMap) {
        const title = getTitle();
        const parts = [];
        let n = 0;
        for (const k of order) {
            const entry = messages.get(k);
            if (!entry) continue;
            n++;
            const tmp = document.createElement('div');
            tmp.innerHTML = entry.html;
            tmp.querySelectorAll('img[src]').forEach(img => {
                const s = img.getAttribute('src');
                if (s && imgMap.has(s)) img.setAttribute('src', imgMap.get(s));
                img.setAttribute('loading', 'lazy');
            });
            const roleClass = entry.role === 'user' ? 'msg user' : 'msg assistant';
            const roleLabel = entry.role === 'user' ? T.userLabel : T.assistantLabel;
            parts.push(
                `<section class="${roleClass}"><div class="role">${roleLabel} · #${n}</div>` +
                `<div class="body">${tmp.innerHTML}</div></section>`
            );
        }

        const css = `
:root{--bg:#0f1115;--card:#171a21;--user:#1e2a3a;--text:#e6e8eb;--muted:#9aa4b2;--accent:#6ea8fe;--code:#0b0d12;--border:#2a2f3a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{position:sticky;top:0;background:rgba(15,17,21,.95);backdrop-filter:blur(6px);border-bottom:1px solid var(--border);padding:16px 24px;z-index:10}
header h1{margin:0 0 6px;font-size:20px}
header .meta{color:var(--muted);font-size:13px;word-break:break-all}
main{max-width:980px;margin:0 auto;padding:24px}
.msg{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin:14px 0}
.msg.user{background:var(--user)}
.role{font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}
.body :where(p,ul,ol,table){margin:.5em 0}
.body pre{background:var(--code);border:1px solid var(--border);border-radius:8px;padding:12px;overflow:auto;font:13px/1.5 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace}
.body code{background:rgba(255,255,255,.08);padding:.1em .35em;border-radius:4px;font-family:"SFMono-Regular",Consolas,monospace;font-size:.92em}
.body pre code{background:none;padding:0}
.body img{max-width:100%;height:auto;border:1px solid var(--border);border-radius:8px;margin:8px 0;display:block}
.body a{color:var(--accent)}
.body table{border-collapse:collapse;width:100%}
.body th,.body td{border:1px solid var(--border);padding:6px 10px;text-align:left}
.body details{border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0}
.body summary{cursor:pointer;color:var(--muted)}
`;
        const meta = `${T.archivedLabel}: ${new Date().toLocaleString()} · ${T.messagesLabel}: ${n} · ${T.sourceLabel}: ${esc(location.href)} · ${T.parserLabel}: ${VERSION}`;
        return `<!DOCTYPE html>
<html lang="${T.htmlLang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${css}</style></head>
<body>
<header><h1>${esc(title)}</h1><div class="meta">${meta}</div></header>
<main>${parts.join('\n')}</main>
</body></html>`;
    }

    function download(content, ext, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safe = getTitle().replace(/[^\wÀ-￿\s\-]/g, '_').replace(/\s+/g, '_').slice(0, 80);
        a.download = (safe || 'claude-code-session') + '.' + ext;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== RUN =====
    async function run() {
        if (busy) return;
        if (!confirm(T.confirm)) return;
        busy = true; cancelled = false;
        messages.clear(); seqCounter = 0; order = [];
        showOverlay();
        try {
            chatContainer = findChatContainer();
            if (!chatContainer) { alert(T.noContainer); return; }

            setProgress(T.starting);
            await autoScroll(chatContainer);
            if (cancelled) { setProgress(T.cancelled); return; }

            // Sort all captured messages by their visual Y position — that's
            // the only signal that reliably matches conversation order in a
            // virtualized chat.
            order = buildOrder();

            setProgress(T.scrollDone(order.length));
            const imgMap = await downloadAllImages();
            if (cancelled) { setProgress(T.cancelled); return; }

            setProgress(T.building);
            const html = buildHtml(imgMap);
            download(html, 'html', 'text/html;charset=utf-8');
            setProgress(T.done(order.length, imgMap.size));
            await sleep(1500);
        } catch (e) {
            console.error('[archiver]', e);
            alert(T.error + (e.message || e));
        } finally {
            busy = false;
            hideOverlay();
        }
    }

    // ===== UI =====
    let overlay, progressEl, panel, fastBtn, noCodeBtn;
    function addStyles() {
        if (document.getElementById('cc-arch-styles')) return;
        const s = document.createElement('style');
        s.id = 'cc-arch-styles';
        s.textContent = `
.cc-arch-panel{position:fixed;bottom:20px;right:20px;background:#16a34a;color:#fff;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.4);z-index:2147483647;display:flex;align-items:stretch;padding:2px;font:600 11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none}
.cc-arch-drag{width:12px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);cursor:grab;font-size:10px;line-height:1;letter-spacing:-1px}
.cc-arch-drag:active{cursor:grabbing}
.cc-arch-panel button{background:rgba(255,255,255,.14);color:#fff;border:none;border-radius:5px;height:24px;padding:0 8px;margin:1px;cursor:pointer;font:inherit;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.cc-arch-panel button:hover{background:rgba(255,255,255,.26)}
.cc-arch-panel button.active{background:#052e1a;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.cc-arch-panel button:disabled{opacity:.6;cursor:not-allowed}
.cc-arch-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;padding-bottom:90px;pointer-events:none}
.cc-arch-card{background:#171a21;color:#e6e8eb;border:1px solid #2a2f3a;border-radius:12px;padding:14px 18px;min-width:320px;max-width:80vw;font:14px sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:auto;position:relative}
.cc-arch-card .p{margin-bottom:10px}
.cc-arch-card .ver{position:absolute;top:8px;right:12px;font-size:11px;color:#6b7280;letter-spacing:.02em}
.cc-arch-card button{background:#d93025;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-weight:700}
`;
        document.head.appendChild(s);
    }
    function showOverlay() {
        overlay = document.createElement('div');
        overlay.className = 'cc-arch-overlay';
        overlay.innerHTML = `<div class="cc-arch-card"><div class="ver">v${esc(VERSION)}</div><div class="p" id="cc-arch-progress">${esc(T.startingShort)}</div><button id="cc-arch-cancel">${esc(T.cancel)}</button></div>`;
        document.body.appendChild(overlay);
        progressEl = overlay.querySelector('#cc-arch-progress');
        overlay.querySelector('#cc-arch-cancel').onclick = () => { cancelled = true; setProgress(T.cancelling); };
    }
    function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
    function setProgress(t) { if (progressEl) progressEl.textContent = t; }

    function syncToggles() {
        if (fastBtn) {
            fastBtn.classList.toggle('active', fastMode);
            fastBtn.title = fastMode ? T.fastTitleOn : T.fastTitleOff;
        }
        if (noCodeBtn) {
            noCodeBtn.classList.toggle('active', skipCode);
            noCodeBtn.title = skipCode ? T.noCodeTitleOn : T.noCodeTitleOff;
        }
    }

    function makeDraggable(p, handle) {
        let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
        handle.addEventListener('mousedown', (e) => {
            const rect = p.getBoundingClientRect();
            p.style.left = rect.left + 'px';
            p.style.top = rect.top + 'px';
            p.style.right = 'auto';
            p.style.bottom = 'auto';
            startLeft = rect.left;
            startTop = rect.top;
            startX = e.clientX;
            startY = e.clientY;
            dragging = true;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const nl = Math.max(0, Math.min(window.innerWidth - p.offsetWidth, startLeft + (e.clientX - startX)));
            const nt = Math.max(0, Math.min(window.innerHeight - p.offsetHeight, startTop + (e.clientY - startY)));
            p.style.left = nl + 'px';
            p.style.top = nt + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            try { localStorage.setItem('cc-arch-pos', JSON.stringify({ left: p.style.left, top: p.style.top })); } catch (e) {}
        });
        try {
            const saved = JSON.parse(localStorage.getItem('cc-arch-pos') || 'null');
            if (saved && saved.left && saved.top) {
                p.style.left = saved.left;
                p.style.top = saved.top;
                p.style.right = 'auto';
                p.style.bottom = 'auto';
            }
        } catch (e) { /* ignore */ }
    }

    function makePanel() {
        if (document.querySelector('.cc-arch-panel')) return;
        panel = document.createElement('div');
        panel.className = 'cc-arch-panel';

        const drag = document.createElement('div');
        drag.className = 'cc-arch-drag';
        drag.textContent = '⋮⋮';
        drag.title = T.dragTitle;
        panel.appendChild(drag);

        const archiveBtn = document.createElement('button');
        archiveBtn.type = 'button';
        archiveBtn.title = T.archiveTitle;
        archiveBtn.innerHTML = `⬇ <span>${esc(T.archive)}</span>`;
        archiveBtn.onclick = run;
        panel.appendChild(archiveBtn);

        fastBtn = document.createElement('button');
        fastBtn.type = 'button';
        fastBtn.innerHTML = `⚡ <span>${esc(T.fast)}</span>`;
        fastBtn.onclick = () => { fastMode = !fastMode; syncToggles(); };
        panel.appendChild(fastBtn);

        noCodeBtn = document.createElement('button');
        noCodeBtn.type = 'button';
        noCodeBtn.innerHTML = `📝 <span>${esc(T.noCode)}</span>`;
        noCodeBtn.onclick = () => { skipCode = !skipCode; syncToggles(); };
        panel.appendChild(noCodeBtn);

        document.body.appendChild(panel);
        makeDraggable(panel, drag);
        syncToggles();
    }

    function init() { addStyles(); makePanel(); }
    if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
    setInterval(() => { if (document.body && !document.querySelector('.cc-arch-panel')) makePanel(); }, 2000);
})();
