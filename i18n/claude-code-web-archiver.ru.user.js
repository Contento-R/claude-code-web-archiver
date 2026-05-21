// ==UserScript==
// @name         Claude Code Web Session Archiver (RU)
// @namespace    https://github.com/Contento-R/claude-code-web-archiver
// @version      1.0.0
// @description  Архивирует всю сессию Claude Code Web: авто-прокрутка, разворачивание свёрнутых блоков, скачивание скриншотов и сборка одного самодостаточного HTML со всей перепиской в хронологическом порядке. Восстанавливает историю, которую облако уже сжало.
// @description:en Archive a full Claude Code Web session: auto-scrolls, expands collapsed blocks, downloads screenshots, and builds one self-contained HTML file with the whole conversation in chronological order.
// @author       Contento-R
// @license      MIT
// @homepageURL  https://github.com/Contento-R/claude-code-web-archiver
// @supportURL   https://github.com/Contento-R/claude-code-web-archiver/issues
// @match        https://claude.ai/code/*
// @match        https://claude.com/code/*
// @grant        GM_xmlhttpRequest
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
// Modified to add full-session auto-capture, screenshot embedding, and HTML export.
//
// Russian-language build. The default English version lives at the repository root:
// https://github.com/Contento-R/claude-code-web-archiver/blob/main/claude-code-web-archiver.user.js

(function () {
    'use strict';
    const VERSION = '1.0.0';

    // ===== CONFIG =====
    const CFG = {
        scrollStepRatio: 0.6,
        scrollWaitMs: 650,
        expandWaitMs: 120,
        stableLimit: 4,
        maxSteps: 4000,
        minTextLen: 8,
        imgTimeoutMs: 20000,
    };

    // ===== STATE =====
    let busy = false;
    let cancelled = false;
    const messages = new Map();
    let order = [];
    let chatContainer = null;

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
            const withText = kids.filter(c => ((c.innerText || c.textContent || '').trim().length > CFG.minTextLen));
            if (withText.length >= 2) return withText;
            if (withText.length === 1) { cur = withText[0]; continue; }
            break;
        }
        return Array.from(container.querySelectorAll(':scope > * > *'))
            .filter(c => ((c.innerText || '').trim().length > CFG.minTextLen));
    }

    function guessRole(node) {
        const probe = (node.className || '') + ' ' + node.outerHTML.slice(0, 400);
        if (/ml-auto|justify-end|items-end|text-right|self-end/.test(probe)) return 'user';
        if (node.querySelector && node.querySelector('.bg-bg-200.rounded-lg')) return 'user';
        return 'assistant';
    }

    function bestImageSrc(img) {
        const a = img.closest && img.closest('a');
        if (a && a.href && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(a.href)) return a.href;
        return img.currentSrc || img.src || img.getAttribute('data-src') || '';
    }

    function sanitizeClone(node) {
        const clone = node.cloneNode(true);
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

    async function expandInView(container) {
        const toOpen = [];
        container.querySelectorAll('details:not([open])').forEach(d => toOpen.push(['details', d]));
        container.querySelectorAll('[aria-expanded="false"]').forEach(el => toOpen.push(['aria', el]));
        for (const [kind, el] of toOpen) {
            if (cancelled) return;
            try {
                if (kind === 'details') el.open = true;
                else el.click();
                await sleep(CFG.expandWaitMs);
            } catch (e) { /* ignore */ }
        }
    }

    function captureVisible(container) {
        const nodes = findMessageNodes(container);
        const curKeys = [];
        for (const node of nodes) {
            const text = (node.innerText || node.textContent || '').trim();
            if (text.length < CFG.minTextLen) continue;
            const k = keyOf(text);
            curKeys.push(k);
            if (!messages.has(k)) {
                messages.set(k, { html: sanitizeClone(node).outerHTML, role: guessRole(node) });
            }
        }
        mergeOrder(curKeys);
    }

    function mergeOrder(curKeys) {
        if (order.length === 0) {
            const seen = new Set();
            for (const k of curKeys) if (!seen.has(k)) { order.push(k); seen.add(k); }
            return;
        }
        const known = new Set(order);
        for (let i = 0; i < curKeys.length; i++) {
            const k = curKeys[i];
            if (known.has(k)) continue;
            let left = null, right = null;
            for (let j = i - 1; j >= 0; j--) if (known.has(curKeys[j])) { left = curKeys[j]; break; }
            for (let j = i + 1; j < curKeys.length; j++) if (known.has(curKeys[j])) { right = curKeys[j]; break; }
            if (left) order.splice(order.indexOf(left) + 1, 0, k);
            else if (right) order.splice(order.indexOf(right), 0, k);
            else order.push(k);
            known.add(k);
        }
    }

    async function autoScroll(container) {
        container.scrollTop = 0;
        await sleep(CFG.scrollWaitMs * 1.5);

        let lastTop = -1, stable = 0, steps = 0;
        while (!cancelled && steps < CFG.maxSteps) {
            await expandInView(container);
            captureVisible(container);
            setProgress(`Прокрутка и захват… сообщений: ${order.length}`);

            const top = container.scrollTop;
            const atBottom = top + container.clientHeight >= container.scrollHeight - 4;
            if (top === lastTop || atBottom) {
                stable++;
                if (stable >= CFG.stableLimit) break;
            } else {
                stable = 0;
            }
            lastTop = top;
            container.scrollTop = top + container.clientHeight * CFG.scrollStepRatio;
            steps++;
            await sleep(CFG.scrollWaitMs);
        }
        await expandInView(container);
        captureVisible(container);
    }

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
                method: 'GET', url, responseType: 'blob', timeout: CFG.imgTimeoutMs,
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
        const map = new Map();
        let done = 0, ok = 0;
        for (const u of urls) {
            if (cancelled) break;
            setProgress(`Скачиваю скриншоты… ${done}/${urls.length} (${ok} ok)`);
            const data = await urlToDataURL(u);
            if (data && data.startsWith('data:')) { map.set(u, data); ok++; }
            done++;
        }
        setProgress(`Скриншоты: ${ok}/${urls.length} встроено.`);
        return map;
    }

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
            const roleLabel = entry.role === 'user' ? 'Пользователь' : 'Claude';
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
        const meta = `Архивировано: ${new Date().toLocaleString()} · Сообщений: ${n} · Источник: ${esc(location.href)} · Парсер: ${VERSION}`;
        return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
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

    async function run() {
        if (busy) return;
        if (!confirm('Архиватор прокрутит ВСЮ сессию автоматически, развернёт свёрнутые блоки и скачает скриншоты.\n\nНе трогай страницу во время процесса. Продолжить?')) return;
        busy = true; cancelled = false;
        messages.clear(); order = [];
        showOverlay();
        try {
            chatContainer = findChatContainer();
            if (!chatContainer) { alert('Не нашёл контейнер чата.'); return; }

            setProgress('Запуск… прокрутка в начало сессии.');
            await autoScroll(chatContainer);
            if (cancelled) { setProgress('Отменено.'); return; }

            setProgress(`Прокрутка готова. Сообщений: ${order.length}. Скачиваю скриншоты…`);
            const imgMap = await downloadAllImages();
            if (cancelled) { setProgress('Отменено.'); return; }

            setProgress('Собираю HTML…');
            const html = buildHtml(imgMap);
            download(html, 'html', 'text/html;charset=utf-8');
            setProgress(`Готово! Сообщений: ${order.length}, картинок встроено: ${imgMap.size}.`);
            await sleep(1500);
        } catch (e) {
            console.error('[archiver]', e);
            alert('Ошибка: ' + (e.message || e));
        } finally {
            busy = false;
            hideOverlay();
        }
    }

    let overlay, progressEl, btn;
    function addStyles() {
        if (document.getElementById('cc-arch-styles')) return;
        const s = document.createElement('style');
        s.id = 'cc-arch-styles';
        s.textContent = `
.cc-arch-btn{position:fixed;bottom:20px;right:20px;background:#1a73e8;color:#fff;border:none;border-radius:30px;height:56px;padding:0 20px;font:700 14px sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);z-index:2147483647}
.cc-arch-btn:hover{filter:brightness(1.1)}
.cc-arch-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;padding-bottom:90px;pointer-events:none}
.cc-arch-card{background:#171a21;color:#e6e8eb;border:1px solid #2a2f3a;border-radius:12px;padding:14px 18px;min-width:320px;max-width:80vw;font:14px sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:auto}
.cc-arch-card .p{margin-bottom:10px}
.cc-arch-card button{background:#d93025;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-weight:700}
`;
        document.head.appendChild(s);
    }
    function showOverlay() {
        overlay = document.createElement('div');
        overlay.className = 'cc-arch-overlay';
        overlay.innerHTML = `<div class="cc-arch-card"><div class="p" id="cc-arch-progress">Старт…</div><button id="cc-arch-cancel">Отмена</button></div>`;
        document.body.appendChild(overlay);
        progressEl = overlay.querySelector('#cc-arch-progress');
        overlay.querySelector('#cc-arch-cancel').onclick = () => { cancelled = true; setProgress('Отмена…'); };
    }
    function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
    function setProgress(t) { if (progressEl) progressEl.textContent = t; }

    function makeButton() {
        if (document.querySelector('.cc-arch-btn')) return;
        btn = document.createElement('button');
        btn.className = 'cc-arch-btn';
        btn.textContent = '⬇ Архивировать сессию';
        btn.title = 'Авто-прокрутка, захват всех сообщений и скриншотов, экспорт автономного HTML';
        btn.onclick = run;
        document.body.appendChild(btn);
    }

    function init() { addStyles(); makeButton(); }
    if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
    setInterval(() => { if (document.body && !document.querySelector('.cc-arch-btn')) makeButton(); }, 2000);
})();
