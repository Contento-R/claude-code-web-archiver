// ==UserScript==
// @name         Claude Code Web Session Archiver
// @namespace    https://github.com/Contento-R/claude-code-web-archiver
// @version      1.1.6
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
    const VERSION = '1.1.6';

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
        scrollStepRatio: 0.7,
        scrollWaitMs: 500,
        expandWaitMs: 90,
        stableLimit: 4,
        maxSteps: 4000,
        minTextLen: 8,
        imgTimeoutMs: 20000,
        concurrency: 6,
        progressThrottleMs: 80,
    };
    const CFG_FAST = {
        scrollStepRatio: 0.9,
        scrollWaitMs: 140,
        expandWaitMs: 20,
        stableLimit: 3,
        maxSteps: 4000,
        minTextLen: 8,
        imgTimeoutMs: 20000,
        concurrency: 10,
        progressThrottleMs: 100,
    };

    // ===== STATE =====
    let busy = false;
    let cancelled = false;
    let fastMode = false;
    let skipCode = false;
    // key -> { html, role, y, seq }
    const messages = new Map();
    let seqCounter = 0;
    let order = [];
    let chatContainer = null;
    let messagesParent = null;        // cached parent that holds message nodes
    let seenNodes = new WeakSet();    // DOM nodes we've already extracted text from
    const cfg = () => (fastMode ? CFG_FAST : CFG_NORMAL);

    // ===== SMALL UTILS =====
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const keyOf = (t) => t.replace(/\s+/g, ' ').trim().slice(0, 220);
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inViewport = (rect) => rect.bottom > 0 && rect.top < (window.innerHeight || document.documentElement.clientHeight);

    function getTitle() {
        const h1 = document.querySelector('main h1') || document.querySelector('h1');
        if (h1 && h1.textContent.trim()) return h1.textContent.trim();
        return document.title.replace(/\s*\|\s*Claude.*$/i, '').trim() || 'claude-code-session';
    }

    function findChatContainer() {
        const main = document.querySelector('main') || document.body;
        let best = main, bestArea = 0;
        // querySelectorAll('*') is unavoidable here, but it only runs once per
        // archive run, so the one-time cost is acceptable.
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

    // Locate the wrapper that holds individual message nodes, then cache it.
    // The wrapper is stable for the lifetime of the chat — drilling 12 levels
    // deep on every scroll step (as v1.1.5 did) is pure waste.
    function ensureMessagesParent(container) {
        if (messagesParent && messagesParent.isConnected) return messagesParent;
        const min = cfg().minTextLen;
        let cur = container;
        for (let d = 0; d < 12; d++) {
            const kids = Array.from(cur.children || []);
            const withText = kids.filter(c => ((c.textContent || '').trim().length > min));
            if (withText.length >= 2) { messagesParent = cur; return cur; }
            if (withText.length === 1) { cur = withText[0]; continue; }
            break;
        }
        messagesParent = container;
        return container;
    }

    function getMessageNodes() {
        const parent = ensureMessagesParent(chatContainer);
        const min = cfg().minTextLen;
        const out = [];
        for (const c of parent.children) {
            // textContent doesn't force layout; innerText does. We only need
            // length here, so textContent is both faster and correct.
            const t = c.textContent;
            if (!t || t.length <= min) continue;
            if (t.trim().length <= min) continue;
            out.push(c);
        }
        if (out.length >= 2) return out;
        // Fallback for unusual layouts.
        return Array.from(parent.querySelectorAll(':scope > * > *'))
            .filter(c => ((c.textContent || '').trim().length > min));
    }

    // ===== ROLE DETECTION =====
    const ROLE_ATTRS = [
        'data-message-author-role',
        'data-author-role',
        'data-author',
        'data-role',
        'data-actor',
        'data-sender',
        'data-from',
    ];
    // Word-bounded keyword sets. "you" was deliberately removed — it appears
    // in almost every assistant message ("you can...", "if you...") and caused
    // huge false-positive rates. Same for "ai", "bot", "response" which are
    // too common in CSS/test ids to be reliable signals.
    const USER_RE = /(^|[\s"'_./:-])(user|human|user[_-]?message|user[_-]?prompt)([\s"'_./:-]|$)/i;
    const ASSISTANT_RE = /(^|[\s"'_./:-])(assistant|claude|agent|assistant[_-]?message)([\s"'_./:-]|$)/i;
    function classifyRoleString(s) {
        if (!s) return null;
        const v = String(s);
        if (USER_RE.test(v)) return 'user';
        if (ASSISTANT_RE.test(v)) return 'assistant';
        return null;
    }
    function roleFromAttrs(el) {
        if (!el || !el.getAttribute) return null;
        for (const a of ROLE_ATTRS) {
            const r = classifyRoleString(el.getAttribute(a));
            if (r) return r;
        }
        const tid = classifyRoleString(el.getAttribute('data-testid'));
        if (tid) return tid;
        const aria = classifyRoleString(el.getAttribute('aria-label'));
        if (aria) return aria;
        return null;
    }
    function classOf(el) {
        if (!el || !el.getAttribute) return '';
        // For SVG elements `className` is SVGAnimatedString, not a string;
        // getAttribute is always a string or null.
        return el.getAttribute('class') || '';
    }
    function guessRole(node) {
        // 1) Explicit role attributes on the node itself.
        let r = roleFromAttrs(node);
        if (r) return r;

        // 2) Walk ancestors up to chatContainer; UI often puts role on a
        //    wrapper several levels above. Cap depth to 10.
        for (let p = node.parentElement, i = 0; p && i < 10; p = p.parentElement, i++) {
            if (p === chatContainer) break;
            r = roleFromAttrs(p);
            if (r) return r;
            const cs = classifyRoleString(classOf(p));
            if (cs) return cs;
        }

        // 3) A bounded sweep inside the node — first match wins.
        if (node.querySelectorAll) {
            const sel = ROLE_ATTRS.map(a => `[${a}]`).join(',') + ',[data-testid],[aria-label]';
            const list = node.querySelectorAll(sel);
            for (let i = 0; i < list.length && i < 20; i++) {
                r = roleFromAttrs(list[i]);
                if (r) return r;
            }
        }

        // 4) Class names on the node itself. Crucially we DO NOT scan the
        //    raw outerHTML text (v1.1.5 bug) — that matched user/Claude words
        //    in actual message prose and mislabelled messages.
        r = classifyRoleString(classOf(node));
        if (r) return r;

        // 5) Visual alignment on the live node and its first child.
        try {
            const cs = getComputedStyle(node);
            if (cs.alignSelf === 'flex-end' || cs.alignSelf === 'end') return 'user';
            if (cs.textAlign === 'right' || cs.textAlign === 'end') return 'user';
            if (cs.marginLeft === 'auto' && cs.marginRight !== 'auto') return 'user';
        } catch (e) { /* ignore */ }
        try {
            const inner = node.firstElementChild;
            if (inner) {
                const cs = getComputedStyle(inner);
                if (cs.alignSelf === 'flex-end' || cs.alignSelf === 'end') return 'user';
                if (cs.marginLeft === 'auto' && cs.marginRight !== 'auto') return 'user';
                if (cs.justifyContent === 'flex-end' || cs.justifyContent === 'end') return 'user';
            }
        } catch (e) { /* ignore */ }

        // 6) Geometric fallback.
        try {
            const rect = node.getBoundingClientRect();
            const parent = node.parentElement;
            if (parent && rect.width > 0) {
                const prect = parent.getBoundingClientRect();
                const leftGap = rect.left - prect.left;
                const rightGap = prect.right - rect.right;
                if (leftGap > 80 && leftGap > rightGap * 1.5) return 'user';
            }
        } catch (e) { /* ignore */ }

        // 7) Legacy Tailwind hints (last resort, checked against class only).
        if (/ml-auto|justify-end|items-end|text-right|self-end/i.test(classOf(node))) return 'user';

        return 'assistant';
    }

    // ===== IMAGE SRC RESOLUTION =====
    function bestImageSrc(img) {
        const a = img.closest && img.closest('a');
        if (a && a.href && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(a.href)) return a.href;
        return img.currentSrc || img.src || img.getAttribute('data-src') || '';
    }

    // ===== STRIP CODE / TOOL-CALL BLOCKS FROM A CLONE =====
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
    const MONO_MIN_LEN = 25;

    function stripCode(clone, liveNode) {
        if (!liveNode || !liveNode.querySelectorAll) return 0;
        const toRemove = new Set();
        clone.querySelectorAll(CODE_SELECTORS).forEach(e => toRemove.add(e));

        const liveAll = [liveNode, ...liveNode.querySelectorAll('*')];
        const cloneAll = [clone, ...clone.querySelectorAll('*')];
        if (liveAll.length === cloneAll.length) {
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
                if (le.tagName === 'CODE') {
                    const d = cs.display;
                    if (d === 'block' || d === 'flex' || d === 'grid') toRemove.add(ce);
                }
            }
        }

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
        const keep = new Set(['src', 'href', 'alt', 'colspan', 'rowspan']);
        clone.querySelectorAll('*').forEach(el => {
            const attrs = el.attributes;
            for (let i = attrs.length - 1; i >= 0; i--) {
                const n = attrs[i].name;
                if (!keep.has(n)) el.removeAttribute(n);
            }
        });
        return clone;
    }

    // ===== EXPAND DISCLOSURE ELEMENTS IN VIEW =====
    // Only act on widgets that are actually within (or near) the viewport, so
    // we don't sledgehammer the whole chat tree on every scroll step.
    async function expandInView(container) {
        const detailsToOpen = [];
        if (!skipCode) {
            for (const d of container.querySelectorAll('details:not([open])')) {
                if (inViewport(d.getBoundingClientRect())) detailsToOpen.push(d);
            }
        }
        // Synchronous batch open — no per-item wait needed.
        for (const d of detailsToOpen) {
            if (cancelled) return;
            try { d.open = true; } catch (_) {}
        }

        const ariaToClick = [];
        for (const el of container.querySelectorAll('[aria-expanded="false"]')) {
            if (inViewport(el.getBoundingClientRect())) ariaToClick.push(el);
        }
        const wait = cfg().expandWaitMs;
        for (const el of ariaToClick) {
            if (cancelled) return;
            try { el.click(); } catch (_) {}
            if (wait > 0) await sleep(wait);
        }
    }

    // ===== CAPTURE WHAT'S CURRENTLY IN THE DOM =====
    function captureVisible(container) {
        const containerRect = container.getBoundingClientRect();
        const scrollY = container.scrollTop || 0;
        const nodes = getMessageNodes();
        const min = cfg().minTextLen;
        for (const node of nodes) {
            // Skip nodes we've already extracted to avoid recomputing text
            // and Y for unchanged messages.
            if (seenNodes.has(node)) continue;
            const text = (node.textContent || '').trim();
            if (text.length < min) continue;
            const k = keyOf(text);
            if (messages.has(k)) { seenNodes.add(node); continue; }
            let y = 0;
            try {
                const rect = node.getBoundingClientRect();
                y = rect.top - containerRect.top + scrollY;
            } catch (_) { y = scrollY; }
            messages.set(k, {
                html: sanitizeClone(node).outerHTML,
                role: guessRole(node),
                y,
                seq: seqCounter++,
            });
            seenNodes.add(node);
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
        // Final sweep, force-flush progress.
        await expandInView(container);
        captureVisible(container);
        setProgress(T.scrolling(messages.size), true);
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
        } catch (_) { /* fall through */ }
        try {
            return await blobToDataURL(await gmGet(url));
        } catch (_) { /* fall through */ }
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
        setProgress(T.downloading(0, total, 0), true);

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
        setProgress(T.embedded(ok, total), true);
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
        const safe = getTitle().replace(/[^\wÀ-ÿĀ-�\s\-]/g, '_').replace(/\s+/g, '_').slice(0, 80);
        a.download = (safe || 'claude-code-session') + '.' + ext;
        document.body.appendChild(a); a.click(); a.remove();
        // Defer revocation so slow browsers actually start the download first.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // ===== RUN =====
    async function run() {
        if (busy) return;
        if (!confirm(T.confirm)) return;
        busy = true; cancelled = false;
        messages.clear(); seqCounter = 0; order = [];
        messagesParent = null;
        seenNodes = new WeakSet();
        showOverlay();
        try {
            chatContainer = findChatContainer();
            if (!chatContainer) { alert(T.noContainer); return; }

            setProgress(T.starting, true);
            await autoScroll(chatContainer);
            if (cancelled) { setProgress(T.cancelled, true); return; }

            order = buildOrder();

            setProgress(T.scrollDone(order.length), true);
            const imgMap = await downloadAllImages();
            if (cancelled) { setProgress(T.cancelled, true); return; }

            setProgress(T.building, true);
            const html = buildHtml(imgMap);
            download(html, 'html', 'text/html;charset=utf-8');
            setProgress(T.done(order.length, imgMap.size), true);
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
    let pendingProgressText = null;
    let lastProgressFlush = 0;

    function addStyles() {
        if (document.getElementById('cc-arch-styles')) return;
        const s = document.createElement('style');
        s.id = 'cc-arch-styles';
        s.textContent = `
.cc-arch-panel{position:fixed;bottom:20px;right:20px;background:#16a34a;color:#fff;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.4);z-index:2147483647;display:flex;align-items:stretch;padding:2px;font:600 11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;touch-action:none}
.cc-arch-drag{width:12px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);cursor:grab;font-size:10px;line-height:1;letter-spacing:-1px;touch-action:none}
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
        overlay.querySelector('#cc-arch-cancel').onclick = () => { cancelled = true; setProgress(T.cancelling, true); };
        pendingProgressText = null;
        lastProgressFlush = 0;
    }
    function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; progressEl = null; } }

    // Throttled progress writer. Inner loop calls this dozens of times per
    // second; only flush to the DOM once every `progressThrottleMs` (or
    // immediately when `force` is true, for terminal messages).
    function setProgress(text, force) {
        if (!progressEl) return;
        pendingProgressText = text;
        const now = performance.now();
        const interval = cfg().progressThrottleMs;
        if (!force && now - lastProgressFlush < interval) return;
        lastProgressFlush = now;
        progressEl.textContent = pendingProgressText;
        pendingProgressText = null;
    }

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

    // ===== DRAGGING =====
    // Listeners on document are installed ONCE for the whole script's lifetime.
    // Previous versions re-installed them every time the panel was rebuilt,
    // leaking pointermove/pointerup handlers indefinitely.
    let dragState = null;
    function installGlobalDragListeners() {
        if (installGlobalDragListeners._done) return;
        installGlobalDragListeners._done = true;
        document.addEventListener('pointermove', (e) => {
            if (!dragState) return;
            const { p, startX, startY, startLeft, startTop } = dragState;
            const nl = Math.max(0, Math.min(window.innerWidth - p.offsetWidth, startLeft + (e.clientX - startX)));
            const nt = Math.max(0, Math.min(window.innerHeight - p.offsetHeight, startTop + (e.clientY - startY)));
            p.style.left = nl + 'px';
            p.style.top = nt + 'px';
        }, { passive: true });
        const endDrag = () => {
            if (!dragState) return;
            try {
                localStorage.setItem('cc-arch-pos', JSON.stringify({
                    left: dragState.p.style.left,
                    top: dragState.p.style.top,
                }));
            } catch (_) { /* ignore */ }
            dragState = null;
        };
        document.addEventListener('pointerup', endDrag, { passive: true });
        document.addEventListener('pointercancel', endDrag, { passive: true });
    }

    function makeDraggable(p, handle) {
        handle.addEventListener('pointerdown', (e) => {
            const rect = p.getBoundingClientRect();
            p.style.left = rect.left + 'px';
            p.style.top = rect.top + 'px';
            p.style.right = 'auto';
            p.style.bottom = 'auto';
            dragState = {
                p,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: rect.left,
                startTop: rect.top,
            };
            try { handle.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        });
        try {
            const saved = JSON.parse(localStorage.getItem('cc-arch-pos') || 'null');
            if (saved && saved.left && saved.top) {
                p.style.left = saved.left;
                p.style.top = saved.top;
                p.style.right = 'auto';
                p.style.bottom = 'auto';
            }
        } catch (_) { /* ignore */ }
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

    // Keep the panel alive across SPA-style re-renders. MutationObserver on
    // <body> is event-driven; the v1.1.5 setInterval polled every 2s for no
    // good reason.
    let panelObserver = null;
    function installPanelKeepalive() {
        if (panelObserver) return;
        panelObserver = new MutationObserver(() => {
            if (document.body && !document.querySelector('.cc-arch-panel')) makePanel();
        });
        panelObserver.observe(document.documentElement, { childList: true, subtree: false });
        if (document.body) {
            panelObserver.observe(document.body, { childList: true, subtree: false });
        }
    }

    function init() {
        addStyles();
        installGlobalDragListeners();
        makePanel();
        installPanelKeepalive();
    }
    if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
