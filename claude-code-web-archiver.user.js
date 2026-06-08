// ==UserScript==
// @name         Claude Code Web Session Archiver
// @namespace    https://github.com/Contento-R/claude-code-web-archiver
// @version      1.7.0
// @description  Archive a full Claude Code Web session into one self-contained HTML file: auto-scroll, expand collapsed blocks, download screenshots, optional fast mode and code-strip. Multi-locale UI (EN/RU/DE/FR/ES) auto-selected from the browser locale.
// @description:ru Архивирует всю сессию Claude Code Web в один автономный HTML: авто-прокрутка, разворачивание свёрнутых блоков, скачивание скриншотов, режимы ускорения и пропуска кода. UI на EN/RU/DE/FR/ES по локали браузера.
// @author       Contento-R
// @license      MIT
// @homepageURL  https://github.com/Contento-R/claude-code-web-archiver
// @supportURL   https://github.com/Contento-R/claude-code-web-archiver/issues
// @updateURL    https://raw.githubusercontent.com/Contento-R/claude-code-web-archiver/main/claude-code-web-archiver.user.js
// @downloadURL  https://raw.githubusercontent.com/Contento-R/claude-code-web-archiver/main/claude-code-web-archiver.user.js
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
// @connect      raw.githubusercontent.com
// @connect      self
// @run-at       document-idle
// ==/UserScript==

// Based on "Claude Code Web to Markdown" by Aiuanyu (MIT License).
// https://greasyfork.org/scripts/560005
// Modified to add full-session auto-capture, screenshot embedding, HTML export,
// a fast mode, a code-strip mode and a draggable 3-button panel.

(function () {
    'use strict';
    const VERSION = '1.7.0';

    // ===== I18N =====
    // Default English dictionary; other locales fall back to English for
    // missing keys via the proxy in pickT().
    const I18N_EN = {
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
        archiving: 'Archiving...',
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
        hotkeysHint: 'Hotkeys: Alt+A archive, Esc cancel',
        historyTitle: 'Recent archives',
        historyEmpty: 'No archives yet',
        historyItem: (when, n) => `${when} — ${n} messages`,
        settings: 'Settings',
        settingsTitleAttr: 'Open archive settings',
        settingsTitle: 'Archive settings',
        settingsSave: 'Save',
        settingsClose: 'Cancel',
        settingsOnlyNew: 'Only archive new messages since the previous run for this session',
        settingsOnlyNewHint: 'Skips messages already captured in earlier archives for this URL.',
        settingsRangeFrom: 'From #',
        settingsRangeTo: 'To #',
        settingsRangeHint: 'Export only messages whose number is in this range. Leave blank for no limit.',
        settingsLocalOnly: 'Local-only network mode',
        settingsLocalOnlyHint: 'Skip the cross-origin screenshot fallback (GM_xmlhttpRequest). Images that need it will not be embedded.',
        settingsRedact: 'Redact secrets matching the patterns below',
        settingsRedactHint: 'One JavaScript regular expression per line. Each match is replaced with asterisks in the exported HTML.',
        settingsFormat: 'Output format',
        settingsFormatHtml: 'HTML — interactive, self-contained',
        settingsFormatMd: 'Markdown — plain text',
        settingsFormatJson: 'JSON — for machine processing',
        settingsCollapse: 'Collapse assistant messages by default in HTML output',
        searchPlaceholder: 'Search messages...',
        tocJump: 'Jump to message...',
        toggleTheme: 'Toggle theme',
        toggleCollapse: 'Toggle assistant blocks',
        showResponse: 'Show response',
        hideResponse: 'Hide response',
        resumePrompt: (n, minutes) => `An interrupted archive was found for this session (${n} messages, ${minutes} min ago).\n\nResume from where it stopped?`,
        updateAvailable: (v) => `New version available: v${v}`,
        updateInstall: 'Install',
        updateDismiss: 'Dismiss',
        updateBadgeTitle: (v) => `Update available — v${v}. Open settings to install.`,
    };
    const I18N = {
        en: I18N_EN,
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
            archiving: 'Архивирую…',
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
            hotkeysHint: 'Горячие клавиши: Alt+A — архив, Esc — отмена',
            historyTitle: 'Последние архивы',
            historyEmpty: 'Архивов пока нет',
            historyItem: (when, n) => `${when} — сообщений: ${n}`,
            settings: 'Настройки',
            settingsTitleAttr: 'Открыть настройки архивации',
            settingsTitle: 'Настройки архивации',
            settingsSave: 'Сохранить',
            settingsClose: 'Отмена',
            settingsOnlyNew: 'Архивировать только новые сообщения с прошлого запуска для этой сессии',
            settingsOnlyNewHint: 'Пропускает сообщения, уже захваченные в предыдущих архивах этого URL.',
            settingsRangeFrom: 'С номера #',
            settingsRangeTo: 'По номер #',
            settingsRangeHint: 'Выгружать только сообщения с номерами в этом диапазоне. Пусто = без ограничения.',
            settingsLocalOnly: 'Локальный режим сети',
            settingsLocalOnlyHint: 'Не использовать cross-origin fallback (GM_xmlhttpRequest). Картинки, которым он нужен, не будут встроены.',
            settingsRedact: 'Скрывать секреты по паттернам ниже',
            settingsRedactHint: 'Одно JavaScript-регулярное выражение в строке. Каждое совпадение заменяется на звёздочки в HTML.',
            settingsFormat: 'Формат вывода',
            settingsFormatHtml: 'HTML — интерактивный, автономный',
            settingsFormatMd: 'Markdown — простой текст',
            settingsFormatJson: 'JSON — для машинной обработки',
            settingsCollapse: 'Сворачивать ответы Claude по умолчанию в HTML',
            searchPlaceholder: 'Поиск по сообщениям…',
            tocJump: 'Перейти к сообщению…',
            toggleTheme: 'Переключить тему',
            toggleCollapse: 'Свернуть/развернуть ответы',
            showResponse: 'Показать ответ',
            hideResponse: 'Скрыть ответ',
            resumePrompt: (n, minutes) => `Найден прерванный архив для этой сессии (${n} сообщений, ${minutes} мин назад).\n\nПродолжить с того места?`,
            updateAvailable: (v) => `Доступна новая версия: v${v}`,
            updateInstall: 'Установить',
            updateDismiss: 'Скрыть',
            updateBadgeTitle: (v) => `Доступна обновлённая версия — v${v}. Открой настройки, чтобы установить.`,
        },
        de: {
            htmlLang: 'de',
            confirm: 'Der Archivierer scrollt die GESAMTE Sitzung automatisch durch, klappt eingeklappte Blöcke auf und lädt Screenshots herunter.\n\nBerühre die Seite während des Vorgangs nicht. Fortfahren?',
            noContainer: 'Chat-Container nicht gefunden.',
            starting: 'Starte … scrolle zum Anfang der Sitzung.',
            scrolling: (n) => `Scrolle und erfasse … Nachrichten: ${n}`,
            scrollDone: (n) => `Scrollen abgeschlossen. Nachrichten: ${n}. Lade Screenshots …`,
            downloading: (d, t, ok) => `Lade Screenshots … ${d}/${t} (${ok} ok)`,
            embedded: (ok, t) => `Screenshots: ${ok}/${t} eingebettet.`,
            building: 'Baue HTML …',
            done: (n, m) => `Fertig! Nachrichten: ${n}, eingebettete Bilder: ${m}.`,
            cancelled: 'Abgebrochen.',
            cancelling: 'Breche ab …',
            startingShort: 'Start …',
            error: 'Fehler: ',
            archive: 'Archivieren',
            archiving: 'Archiviere …',
            fast: 'Schnell',
            noCode: 'Ohne Code',
            cancel: 'Abbrechen',
            archiveTitle: 'Sitzung archivieren — alle Nachrichten und Screenshots in eine HTML-Datei',
            fastTitleOn: 'Schnellmodus AN — Verzögerungen minimiert, parallele Downloads',
            fastTitleOff: 'Schnellmodus AUS — klicken, um Verzögerungen zu minimieren',
            noCodeTitleOn: 'Code überspringen AN — nur die Konversation wird exportiert',
            noCodeTitleOff: 'Code überspringen AUS — klicken, um Code-Blöcke auszuschließen',
            dragTitle: 'Panel ziehen',
            userLabel: 'Benutzer',
            assistantLabel: 'Claude',
            archivedLabel: 'Archiviert',
            messagesLabel: 'Nachrichten',
            sourceLabel: 'Quelle',
            parserLabel: 'Parser',
            hotkeysHint: 'Tastenkürzel: Alt+A archivieren, Esc abbrechen',
            historyTitle: 'Letzte Archive',
            historyEmpty: 'Noch keine Archive',
            historyItem: (when, n) => `${when} — ${n} Nachrichten`,
        },
        fr: {
            htmlLang: 'fr',
            confirm: "L'archiveur fera défiler TOUTE la session automatiquement, dépliera les blocs réduits et téléchargera les captures.\n\nNe touchez pas à la page pendant le processus. Continuer ?",
            noContainer: 'Conteneur de chat introuvable.',
            starting: 'Démarrage… défilement vers le début de la session.',
            scrolling: (n) => `Défilement et capture… messages : ${n}`,
            scrollDone: (n) => `Défilement terminé. Messages : ${n}. Téléchargement des captures…`,
            downloading: (d, t, ok) => `Téléchargement des captures… ${d}/${t} (${ok} ok)`,
            embedded: (ok, t) => `Captures : ${ok}/${t} intégrées.`,
            building: 'Construction du HTML…',
            done: (n, m) => `Terminé ! Messages : ${n}, images intégrées : ${m}.`,
            cancelled: 'Annulé.',
            cancelling: 'Annulation…',
            startingShort: 'Démarrage…',
            error: 'Erreur : ',
            archive: 'Archiver',
            archiving: 'Archivage…',
            fast: 'Rapide',
            noCode: 'Sans code',
            cancel: 'Annuler',
            archiveTitle: 'Archiver la session — capturer tous les messages et captures dans un HTML',
            fastTitleOn: 'Mode rapide ACTIVÉ — délais minimisés, téléchargements parallèles',
            fastTitleOff: 'Mode rapide DÉSACTIVÉ — cliquez pour accélérer',
            noCodeTitleOn: 'Sans code ACTIVÉ — seule la conversation sera exportée',
            noCodeTitleOff: 'Sans code DÉSACTIVÉ — cliquez pour exclure le code',
            dragTitle: 'Déplacer le panneau',
            userLabel: 'Utilisateur',
            assistantLabel: 'Claude',
            archivedLabel: 'Archivé',
            messagesLabel: 'Messages',
            sourceLabel: 'Source',
            parserLabel: 'Analyseur',
            hotkeysHint: 'Raccourcis : Alt+A archiver, Esc annuler',
            historyTitle: 'Archives récentes',
            historyEmpty: 'Aucune archive',
            historyItem: (when, n) => `${when} — ${n} messages`,
        },
        es: {
            htmlLang: 'es',
            confirm: 'El archivador desplazará TODA la sesión automáticamente, expandirá los bloques contraídos y descargará las capturas.\n\nNo toques la página durante el proceso. ¿Continuar?',
            noContainer: 'Contenedor de chat no encontrado.',
            starting: 'Iniciando… desplazándose al principio de la sesión.',
            scrolling: (n) => `Desplazando y capturando… mensajes: ${n}`,
            scrollDone: (n) => `Desplazamiento completo. Mensajes: ${n}. Descargando capturas…`,
            downloading: (d, t, ok) => `Descargando capturas… ${d}/${t} (${ok} ok)`,
            embedded: (ok, t) => `Capturas: ${ok}/${t} incrustadas.`,
            building: 'Construyendo HTML…',
            done: (n, m) => `¡Listo! Mensajes: ${n}, imágenes incrustadas: ${m}.`,
            cancelled: 'Cancelado.',
            cancelling: 'Cancelando…',
            startingShort: 'Iniciando…',
            error: 'Error: ',
            archive: 'Archivar',
            archiving: 'Archivando…',
            fast: 'Rápido',
            noCode: 'Sin código',
            cancel: 'Cancelar',
            archiveTitle: 'Archivar sesión — capturar todos los mensajes y capturas en un HTML',
            fastTitleOn: 'Modo rápido ACTIVADO — demoras minimizadas, descargas paralelas',
            fastTitleOff: 'Modo rápido DESACTIVADO — haga clic para acelerar',
            noCodeTitleOn: 'Sin código ACTIVADO — solo se exportará la conversación',
            noCodeTitleOff: 'Sin código DESACTIVADO — haga clic para excluir el código',
            dragTitle: 'Arrastrar el panel',
            userLabel: 'Usuario',
            assistantLabel: 'Claude',
            archivedLabel: 'Archivado',
            messagesLabel: 'Mensajes',
            sourceLabel: 'Fuente',
            parserLabel: 'Analizador',
            hotkeysHint: 'Atajos: Alt+A archivar, Esc cancelar',
            historyTitle: 'Archivos recientes',
            historyEmpty: 'Sin archivos aún',
            historyItem: (when, n) => `${when} — ${n} mensajes`,
        },
    };
    function pickLang() {
        const l = (navigator.language || 'en').toLowerCase();
        if (l.startsWith('ru')) return 'ru';
        if (l.startsWith('de')) return 'de';
        if (l.startsWith('fr')) return 'fr';
        if (l.startsWith('es')) return 'es';
        return 'en';
    }
    // Proxy: undefined keys in the chosen locale fall back to the English
    // dictionary so partial translations never break the UI.
    function pickT() {
        const lang = pickLang();
        const dict = I18N[lang] || I18N.en;
        return new Proxy(dict, {
            get(target, prop) {
                if (prop in target) return target[prop];
                return I18N_EN[prop];
            },
        });
    }
    const T = pickT();

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
    const messages = new Map();
    let seqCounter = 0;
    let order = [];
    let chatContainer = null;
    let messagesParent = null;
    let seenNodes = new WeakSet();
    const cfg = () => (fastMode ? CFG_FAST : CFG_NORMAL);

    // ===== SETTINGS (persisted to localStorage) =====
    const SETTINGS_KEY = 'cc-arch-settings';
    const DEFAULT_SECRET_PATTERNS = [
        'sk-[A-Za-z0-9_\\-]{20,}',
        'sk-ant-[A-Za-z0-9_\\-]{20,}',
        'ghp_[A-Za-z0-9]{20,}',
        'gho_[A-Za-z0-9]{20,}',
        'ghu_[A-Za-z0-9]{20,}',
        'ghs_[A-Za-z0-9]{20,}',
        'github_pat_[A-Za-z0-9_]{20,}',
        'AKIA[0-9A-Z]{16}',
    ].join('\n');
    const DEFAULT_SETTINGS = {
        onlyNew: false,
        rangeFrom: null,
        rangeTo: null,
        localOnly: false,
        redactSecrets: false,
        secretPatterns: DEFAULT_SECRET_PATTERNS,
        outputFormat: 'html', // 'html' | 'md' | 'json'
        collapseAssistant: false,
    };
    function loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            const obj = raw ? JSON.parse(raw) : {};
            return Object.assign({}, DEFAULT_SETTINGS, obj || {});
        } catch (_) { return { ...DEFAULT_SETTINGS }; }
    }
    function saveSettings(s) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
    }
    let settings = loadSettings();
    let compiledRedactPatterns = [];
    function recompileRedact() {
        compiledRedactPatterns = [];
        if (!settings.redactSecrets) return;
        const lines = String(settings.secretPatterns || '').split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            try { compiledRedactPatterns.push(new RegExp(line, 'g')); } catch (_) { /* skip invalid */ }
        }
    }
    recompileRedact();

    // ===== KNOWN KEYS (per-URL, for the "only new" mode) =====
    function knownKeysStorageKey() {
        return 'cc-arch-known:' + location.host + location.pathname;
    }
    function loadKnownKeys() {
        try {
            const raw = localStorage.getItem(knownKeysStorageKey());
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch (_) { return new Set(); }
    }
    function saveKnownKeys(set) {
        try {
            // Keep at most 5000 keys per URL (each up to 220 chars) → ~1 MB.
            const arr = [...set].slice(-5000);
            localStorage.setItem(knownKeysStorageKey(), JSON.stringify(arr));
        } catch (_) { /* quota exceeded etc. — silently skip */ }
    }
    let knownKeys = new Set();
    let onlyNewActiveForRun = false;

    // ===== RESUME STATE (per-URL, expires after 24h) =====
    // Periodically snapshot the captured-but-not-yet-built archive so a
    // crashed/closed tab can pick up where it left off. We store only the
    // message map; settings live in their own key and image data is fetched
    // fresh on resume.
    const RESUME_KEY = 'cc-arch-resume';
    const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
    const RESUME_MAX_BYTES = 4_000_000; // safety cap below typical 5 MB localStorage quota
    let lastResumeSaveTs = 0;
    function saveResumeSnapshot() {
        if (!chatContainer) return;
        const now = Date.now();
        // Throttle to once per ~5s during scroll.
        if (now - lastResumeSaveTs < 5000) return;
        try {
            const payload = {
                url: location.href,
                ts: now,
                version: VERSION,
                seqCounter,
                fastMode,
                skipCode,
                messages: [...messages.entries()],
            };
            const json = JSON.stringify(payload);
            if (json.length > RESUME_MAX_BYTES) return; // skip silently — too big to persist
            localStorage.setItem(RESUME_KEY, json);
            lastResumeSaveTs = now;
        } catch (_) { /* quota etc. — best-effort */ }
    }
    function loadResumeSnapshot() {
        try {
            const raw = localStorage.getItem(RESUME_KEY);
            if (!raw) return null;
            const s = JSON.parse(raw);
            if (!s || typeof s !== 'object') return null;
            if (s.url !== location.href) return null;
            if (Date.now() - (s.ts || 0) > RESUME_TTL_MS) return null;
            if (!Array.isArray(s.messages)) return null;
            return s;
        } catch (_) { return null; }
    }
    function clearResumeSnapshot() {
        try { localStorage.removeItem(RESUME_KEY); } catch (_) {}
        lastResumeSaveTs = 0;
    }

    // ===== UPDATE CHECK =====
    // Daily check of the published userscript on GitHub `main`. If a newer
    // semver is found, a small dot is added to the panel and to the
    // settings button; a notice with an "Install" link appears at the top
    // of the settings modal.
    const UPDATE_CHECK_KEY = 'cc-arch-last-update-check';
    const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
    const UPDATE_RAW_URL = 'https://raw.githubusercontent.com/Contento-R/claude-code-web-archiver/main/claude-code-web-archiver.user.js';
    let updateAvailableVersion = null;
    function compareVersions(a, b) {
        const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
        const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const av = pa[i] || 0, bv = pb[i] || 0;
            if (av > bv) return 1;
            if (av < bv) return -1;
        }
        return 0;
    }
    function showUpdateBadge() {
        if (panel) panel.classList.add('has-update');
        if (settingsBtn) {
            settingsBtn.classList.add('has-update');
            try { settingsBtn.title = T.updateBadgeTitle(updateAvailableVersion); } catch (_) {}
        }
    }
    function checkForUpdate() {
        if (typeof GM_xmlhttpRequest === 'undefined') return;
        let last = 0;
        try { last = parseInt(localStorage.getItem(UPDATE_CHECK_KEY) || '0', 10) || 0; } catch (_) {}
        if (Date.now() - last < UPDATE_CHECK_INTERVAL_MS) {
            // Skip network — but still surface the badge if we already
            // remembered a newer version from an earlier check.
            try {
                const cached = localStorage.getItem('cc-arch-latest-version') || '';
                if (cached && compareVersions(cached, VERSION) > 0) {
                    updateAvailableVersion = cached;
                    showUpdateBadge();
                }
            } catch (_) {}
            return;
        }
        try { localStorage.setItem(UPDATE_CHECK_KEY, String(Date.now())); } catch (_) {}
        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: UPDATE_RAW_URL,
                timeout: 10000,
                onload: (r) => {
                    if (!r || r.status < 200 || r.status >= 300 || !r.responseText) return;
                    const m = r.responseText.match(/^\/\/\s*@version\s+(\d+\.\d+\.\d+)/m);
                    if (!m) return;
                    const latest = m[1];
                    try { localStorage.setItem('cc-arch-latest-version', latest); } catch (_) {}
                    if (compareVersions(latest, VERSION) > 0) {
                        updateAvailableVersion = latest;
                        showUpdateBadge();
                    }
                },
                onerror: () => {},
                ontimeout: () => {},
            });
        } catch (_) { /* ignore */ }
    }

    // ===== PER-MESSAGE METADATA DETECTION =====
    // The list mirrors the public Claude Code tool set. The leading-text
    // regex is anchored so we don't match a tool name appearing later in
    // an assistant's prose.
    const TOOL_NAMES = [
        'Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
        'Task', 'TodoWrite', 'NotebookEdit', 'NotebookRead', 'MultiEdit',
        'ExitPlanMode', 'SlashCommand', 'KillShell',
    ];
    const TOOL_RE = new RegExp('^\\s*(' + TOOL_NAMES.join('|') + ')\\s*[\\(:\\-\\u2013\\u2014]', 'i');
    function detectTool(text, node) {
        const head = (text || '').slice(0, 80);
        const m = head.match(TOOL_RE);
        if (m) {
            const lower = m[1].toLowerCase();
            for (const name of TOOL_NAMES) if (name.toLowerCase() === lower) return name;
            return m[1];
        }
        if (node && node.querySelector) {
            const el = node.querySelector('[data-testid*="tool" i]');
            if (el) {
                const t = (el.getAttribute('data-testid') || '').toLowerCase();
                for (const name of TOOL_NAMES) if (t.includes(name.toLowerCase())) return name;
            }
        }
        return null;
    }

    function detectTimestamp(node) {
        if (!node || !node.querySelector) return null;
        const t = node.querySelector('time[datetime]');
        if (t) {
            const dt = t.getAttribute('datetime');
            if (dt) return dt;
        }
        // [title] or [aria-label] attributes that look like a timestamp.
        const TS_HINT = /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/;
        const list = node.querySelectorAll('[title],[aria-label]');
        for (let i = 0; i < list.length && i < 30; i++) {
            const el = list[i];
            const v = el.getAttribute('title') || el.getAttribute('aria-label') || '';
            if (TS_HINT.test(v)) return v;
        }
        return null;
    }

    // Formats whatever string we captured into a clean "YYYY-MM-DD HH:MM"
    // when possible; falls back to the raw value.
    function formatTimestamp(s) {
        if (!s) return '';
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        return s.slice(0, 40);
    }

    let detectedModel = null;
    function extractModelName() {
        const KNOWN = /\b(?:Claude\s+)?(Opus|Sonnet|Haiku)(?:\s+\d+(?:\.\d+)?)?\b/i;
        const sels = [
            '[data-testid*="model" i]',
            '[aria-label*="model" i]',
            '[title*="model" i]',
            '[aria-label*="opus" i]', '[aria-label*="sonnet" i]', '[aria-label*="haiku" i]',
            '[title*="opus" i]', '[title*="sonnet" i]', '[title*="haiku" i]',
            'button[class*="model" i]',
        ];
        const seen = new Set();
        for (const sel of sels) {
            let list;
            try { list = document.querySelectorAll(sel); } catch (_) { continue; }
            for (const el of list) {
                if (seen.has(el)) continue;
                seen.add(el);
                const t = ((el.getAttribute('aria-label') || '') + ' ' +
                           (el.getAttribute('title') || '') + ' ' +
                           (el.textContent || '')).trim();
                const m = t.match(KNOWN);
                if (m) {
                    // Take the matched substring up to a comma or end.
                    const i = t.indexOf(m[0]);
                    return t.slice(i, i + 40).replace(/[,;:].*$/, '').trim();
                }
            }
        }
        return null;
    }

    // ===== ARCHIVE HISTORY =====
    const HISTORY_KEY = 'cc-arch-history';
    const HISTORY_MAX = 10;
    function loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (_) { return []; }
    }
    function saveHistory(arr) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, HISTORY_MAX))); } catch (_) {}
    }
    function recordArchive(messageCount, imageCount) {
        const arr = loadHistory();
        arr.unshift({
            url: location.href,
            title: getTitle().slice(0, 120),
            at: Date.now(),
            messages: messageCount,
            images: imageCount,
            version: VERSION,
        });
        saveHistory(arr);
        updateArchiveTooltip();
    }
    function formatRelative(ms) {
        const now = Date.now();
        const diff = Math.max(0, now - ms);
        const s = Math.floor(diff / 1000);
        if (s < 60) return s + 's ago';
        const m = Math.floor(s / 60);
        if (m < 60) return m + 'm ago';
        const h = Math.floor(m / 60);
        if (h < 24) return h + 'h ago';
        const d = Math.floor(h / 24);
        return d + 'd ago';
    }
    function buildHistoryTooltip() {
        const items = loadHistory();
        if (items.length === 0) return T.archiveTitle + '\n\n' + T.historyTitle + ': ' + T.historyEmpty;
        const lines = [T.archiveTitle, '', T.historyTitle + ':'];
        for (let i = 0; i < Math.min(3, items.length); i++) {
            const it = items[i];
            lines.push('• ' + T.historyItem(formatRelative(it.at), it.messages || 0));
        }
        lines.push('', T.hotkeysHint);
        return lines.join('\n');
    }
    function updateArchiveTooltip() {
        if (archiveBtn) archiveBtn.title = buildHistoryTooltip();
    }

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
            const t = c.textContent;
            if (!t || t.length <= min) continue;
            if (t.trim().length <= min) continue;
            out.push(c);
        }
        if (out.length >= 2) return out;
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
        return el.getAttribute('class') || '';
    }
    function guessRole(node) {
        let r = roleFromAttrs(node);
        if (r) return r;
        for (let p = node.parentElement, i = 0; p && i < 10; p = p.parentElement, i++) {
            if (p === chatContainer) break;
            r = roleFromAttrs(p);
            if (r) return r;
            const cs = classifyRoleString(classOf(p));
            if (cs) return cs;
        }
        if (node.querySelectorAll) {
            const sel = ROLE_ATTRS.map(a => `[${a}]`).join(',') + ',[data-testid],[aria-label]';
            const list = node.querySelectorAll(sel);
            for (let i = 0; i < list.length && i < 20; i++) {
                r = roleFromAttrs(list[i]);
                if (r) return r;
            }
        }
        r = classifyRoleString(classOf(node));
        if (r) return r;
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

    // ===== SECRET REDACTION =====
    // Walks every text node in the clone and replaces matches of compiled
    // redact patterns with asterisks. We walk text nodes (not raw HTML)
    // so a regex can never corrupt tag markup or attribute values.
    function applyRedaction(clone) {
        if (!settings.redactSecrets || compiledRedactPatterns.length === 0) return;
        const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        for (const node of nodes) {
            let text = node.nodeValue;
            let changed = false;
            for (const re of compiledRedactPatterns) {
                re.lastIndex = 0;
                const next = text.replace(re, (m) => '*'.repeat(Math.min(m.length, 40)));
                if (next !== text) { text = next; changed = true; }
            }
            if (changed) node.nodeValue = text;
        }
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
        applyRedaction(clone);
        return clone;
    }

    // ===== EXPAND DISCLOSURE ELEMENTS IN VIEW =====
    async function expandInView(container) {
        const detailsToOpen = [];
        if (!skipCode) {
            for (const d of container.querySelectorAll('details:not([open])')) {
                if (inViewport(d.getBoundingClientRect())) detailsToOpen.push(d);
            }
        }
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
            if (seenNodes.has(node)) continue;
            const text = (node.textContent || '').trim();
            if (text.length < min) continue;
            const k = keyOf(text);
            if (messages.has(k)) { seenNodes.add(node); continue; }
            // "Only new" mode: skip messages already captured in prior runs
            // for this URL. We still mark the node as seen so we don't keep
            // re-examining it during scroll.
            if (onlyNewActiveForRun && knownKeys.has(k)) { seenNodes.add(node); continue; }
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
                tool: detectTool(text, node),
                time: detectTimestamp(node),
                signals: captureSignals(node, text),
            });
            seenNodes.add(node);
        }
    }

    // ===== POST-CAPTURE SIGNALS FOR ROLE NORMALIZATION =====
    function captureSignals(node, text) {
        let bg = '', textAlign = '', alignSelf = '';
        try {
            const cs = getComputedStyle(node);
            bg = cs.backgroundColor || '';
            textAlign = cs.textAlign || '';
            alignSelf = cs.alignSelf || '';
        } catch (_) { /* ignore */ }
        return {
            bg,
            textAlign,
            alignSelf,
            len: (text || '').length,
            hasPre: !!(node.querySelector && node.querySelector('pre')),
            hasH: !!(node.querySelector && node.querySelector('h1,h2,h3,h4,h5,h6')),
            hasList: !!(node.querySelector && node.querySelector('ul,ol')),
            hasImg: !!(node.querySelector && node.querySelector('img')),
            hasCode: !!(node.querySelector && node.querySelector('code')),
            hasTable: !!(node.querySelector && node.querySelector('table')),
        };
    }

    // ===== ROLE NORMALIZATION =====
    // Post-capture pass that re-classifies messages when the capture-time
    // detector failed (typically when Claude Code Web exposes no role
    // attributes and visual alignment is identical for both sides).
    //
    // Strategy:
    //   1. If we already have a healthy mix of user / assistant, trust
    //      the capture-time detection.
    //   2. Otherwise rebuild roles from cross-message signals:
    //      - tool calls / markdown structure / code = strong assistant
    //      - background-color clusters split user vs assistant
    //      - if no bg differentiation: short plain text = user
    //   3. As a last guarantee against an all-assistant output, force
    //      the very first message in chronological order to "user"
    //      (every Claude Code session starts with a user prompt).
    function normalizeRoles() {
        const entries = [...messages.values()];
        if (entries.length < 2) return 0;

        const userCount = entries.filter(e => e.role === 'user').length;
        const total = entries.length;
        const balanced = userCount >= Math.max(1, Math.floor(total * 0.05))
                      && userCount <= total - 1;
        if (balanced) return 0;

        let changed = 0;
        const isStrongAssistant = (e) => {
            if (e.tool) return true;
            const s = e.signals;
            if (!s) return false;
            return s.hasPre || s.hasH || s.hasList || s.hasTable;
        };

        // Step 1: mark every message with a strong assistant signal.
        for (const e of entries) {
            if (isStrongAssistant(e)) {
                if (e.role !== 'assistant') { e.role = 'assistant'; changed++; }
            }
        }

        // Step 2: differentiate by background-color cluster.
        const TRANSPARENT_BG = new Set(['', 'transparent', 'rgba(0, 0, 0, 0)', 'rgba(0,0,0,0)']);
        const bgCount = new Map();
        for (const e of entries) {
            const bg = e.signals && e.signals.bg;
            if (!bg || TRANSPARENT_BG.has(bg)) continue;
            bgCount.set(bg, (bgCount.get(bg) || 0) + 1);
        }
        if (bgCount.size >= 2) {
            const sorted = [...bgCount.entries()].sort((a, b) => b[1] - a[1]);
            const majorityBg = sorted[0][0];
            for (const e of entries) {
                if (isStrongAssistant(e)) continue;
                const bg = e.signals && e.signals.bg;
                if (!bg || TRANSPARENT_BG.has(bg)) continue;
                if (bg !== majorityBg) {
                    if (e.role !== 'user') { e.role = 'user'; changed++; }
                } else {
                    if (e.role !== 'assistant') { e.role = 'assistant'; changed++; }
                }
            }
        } else {
            // Step 2b: no color differentiation — use plain-text length
            // heuristic. Short plain-text-only blocks = user prompts.
            for (const e of entries) {
                if (isStrongAssistant(e)) continue;
                const s = e.signals;
                if (!s) continue;
                if (!s.hasPre && !s.hasH && !s.hasList && !s.hasTable && !s.hasImg && s.len < 600) {
                    if (e.role !== 'user') { e.role = 'user'; changed++; }
                }
            }
        }

        // Step 3: guarantee at least one user message — the conversation
        // had to start with one.
        const newUserCount = entries.filter(e => e.role === 'user').length;
        if (newUserCount === 0) {
            const first = entries.slice().sort((a, b) => a.y - b.y || a.seq - b.seq)[0];
            if (first) { first.role = 'user'; changed++; }
        }

        console.debug('[archiver] normalizeRoles updated', changed, 'of', total, 'messages');
        return changed;
    }

    function buildOrder() {
        return [...messages.entries()]
            .sort((a, b) => (a[1].y - b[1].y) || (a[1].seq - b[1].seq))
            .map(([k]) => k);
    }

    // ===== MUTATION-OBSERVER-DRIVEN WAIT =====
    // Resolves as soon as a DOM mutation is seen in the target subtree,
    // OR after `timeoutMs`, whichever comes first. Lets autoScroll move
    // to the next step the instant new content appears, instead of
    // sleeping a fixed delay every time.
    function waitForMutationOrTimeout(target, timeoutMs) {
        return new Promise((resolve) => {
            if (!target || target.nodeType !== 1) {
                setTimeout(resolve, timeoutMs);
                return;
            }
            let resolved = false;
            const finish = () => {
                if (resolved) return;
                resolved = true;
                try { obs.disconnect(); } catch (_) {}
                clearTimeout(timer);
                resolve();
            };
            const obs = new MutationObserver(finish);
            try {
                obs.observe(target, { childList: true, subtree: true });
            } catch (_) {
                setTimeout(resolve, timeoutMs);
                return;
            }
            const timer = setTimeout(finish, timeoutMs);
        });
    }

    // ===== AUTO-SCROLL THROUGH THE WHOLE SESSION =====
    async function autoScroll(container) {
        container.scrollTop = 0;
        await sleep(Math.min(cfg().scrollWaitMs * 1.5, 600));
        // Resolve the messages parent up front so MO-wait can attach to it.
        ensureMessagesParent(container);
        let lastTop = -1, stable = 0, steps = 0, stuckTries = 0;
        while (!cancelled && steps < cfg().maxSteps) {
            await expandInView(container);
            captureVisible(container);
            saveResumeSnapshot();
            setProgress(T.scrolling(messages.size));
            const top = container.scrollTop;
            const atBottom = top + container.clientHeight >= container.scrollHeight - 4;
            if (top === lastTop || atBottom) {
                stable++;
                // Stuck-scroll mitigation: scrollTop assignment was ignored.
                // Try a wheel event and scrollIntoView on the last child.
                if (!atBottom && top === lastTop && stuckTries < 2) {
                    stuckTries++;
                    try {
                        container.dispatchEvent(new WheelEvent('wheel', {
                            deltaY: container.clientHeight * cfg().scrollStepRatio,
                            bubbles: true, cancelable: true,
                        }));
                    } catch (_) {}
                    try {
                        const last = messagesParent && messagesParent.lastElementChild;
                        if (last && last.scrollIntoView) last.scrollIntoView({ block: 'end' });
                    } catch (_) {}
                    await sleep(cfg().scrollWaitMs);
                }
                if (stable >= cfg().stableLimit) break;
            } else {
                stable = 0;
                stuckTries = 0;
            }
            lastTop = top;
            container.scrollTop = top + container.clientHeight * cfg().scrollStepRatio;
            steps++;
            // Event-driven wait — wakes up as soon as the virtualizer
            // adds a new node, or after the configured cap, whichever
            // comes first.
            await waitForMutationOrTimeout(messagesParent || container, cfg().scrollWaitMs);
        }
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
        // Local-only mode: skip the cross-origin GM_xmlhttpRequest fallback.
        // The image URL stays in the HTML but isn't inlined as data:.
        if (settings.localOnly) return null;
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
                let data = await urlToDataURL(u);
                if (!data && !cancelled) {
                    // One retry with a small randomized backoff. Most
                    // transient CDN failures clear up within ~0.5s.
                    await sleep(400 + Math.random() * 250);
                    data = await urlToDataURL(u);
                }
                if (data && data.startsWith('data:')) { map.set(u, data); ok++; }
                done++;
                setProgress(T.downloading(done, total, ok));
            }
        }
        await Promise.all(Array.from({ length: conc }, worker));
        setProgress(T.embedded(ok, total), true);
        return map;
    }

    // ===== ITERATION OVER MESSAGES IN EXPORT RANGE =====
    function eachInRange(callback) {
        let n = 0;
        const rangeFrom = settings.rangeFrom;
        const rangeTo = settings.rangeTo;
        for (const k of order) {
            const entry = messages.get(k);
            if (!entry) continue;
            n++;
            if (rangeFrom && n < rangeFrom) continue;
            if (rangeTo && n > rangeTo) continue;
            callback(entry, n);
        }
    }

    // Replace remote image URLs in an HTML string with embedded data: URLs.
    function inlineImages(html, imgMap) {
        if (!imgMap || imgMap.size === 0) return html;
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        tmp.querySelectorAll('img[src]').forEach((img) => {
            const s = img.getAttribute('src');
            if (s && imgMap.has(s)) img.setAttribute('src', imgMap.get(s));
            img.setAttribute('loading', 'lazy');
        });
        return tmp.innerHTML;
    }

    // ===== HTML -> MARKDOWN =====
    // Pragmatic, not exhaustive. Covers the elements Claude Code Web
    // actually emits in messages: paragraphs, headings, lists, blockquotes,
    // code (inline and block), tables, images, links, emphasis.
    function htmlToMarkdown(htmlStr) {
        const root = document.createElement('div');
        root.innerHTML = htmlStr;
        const out = walkNodeToMd(root).replace(/\n{3,}/g, '\n\n');
        return out.trim();
    }
    function walkNodeToMd(node) {
        if (node.nodeType === 3) return node.textContent;
        if (node.nodeType !== 1) return '';
        const tag = node.tagName.toLowerCase();
        const kids = () => Array.from(node.childNodes).map(walkNodeToMd).join('');
        switch (tag) {
            case 'br': return '\n';
            case 'p': return '\n\n' + kids() + '\n\n';
            case 'h1': return '\n\n# ' + kids().trim() + '\n\n';
            case 'h2': return '\n\n## ' + kids().trim() + '\n\n';
            case 'h3': return '\n\n### ' + kids().trim() + '\n\n';
            case 'h4': return '\n\n#### ' + kids().trim() + '\n\n';
            case 'h5': return '\n\n##### ' + kids().trim() + '\n\n';
            case 'h6': return '\n\n###### ' + kids().trim() + '\n\n';
            case 'strong': case 'b': return '**' + kids() + '**';
            case 'em': case 'i': return '*' + kids() + '*';
            case 'del': case 's': return '~~' + kids() + '~~';
            case 'code': {
                if (node.parentElement && node.parentElement.tagName === 'PRE') return node.textContent || '';
                return '`' + (node.textContent || '') + '`';
            }
            case 'pre': return '\n\n```\n' + (node.textContent || '').replace(/\n+$/, '') + '\n```\n\n';
            case 'a': {
                const href = node.getAttribute('href') || '';
                const text = kids().trim();
                return href ? `[${text}](${href})` : text;
            }
            case 'img': {
                const src = node.getAttribute('src') || '';
                const alt = node.getAttribute('alt') || '';
                return src ? `![${alt}](${src})` : '';
            }
            case 'ul': {
                const items = Array.from(node.children).filter(c => c.tagName === 'LI');
                const lines = items.map(li => '- ' + walkNodeToMd(li).trim().replace(/\n/g, '\n  '));
                return '\n\n' + lines.join('\n') + '\n\n';
            }
            case 'ol': {
                const items = Array.from(node.children).filter(c => c.tagName === 'LI');
                const lines = items.map((li, i) => (i + 1) + '. ' + walkNodeToMd(li).trim().replace(/\n/g, '\n   '));
                return '\n\n' + lines.join('\n') + '\n\n';
            }
            case 'li': return kids();
            case 'blockquote': return '\n\n> ' + kids().trim().replace(/\n/g, '\n> ') + '\n\n';
            case 'hr': return '\n\n---\n\n';
            case 'table': {
                const rows = Array.from(node.querySelectorAll('tr'));
                if (rows.length === 0) return '';
                const lines = rows.map(tr =>
                    '| ' + Array.from(tr.children).map(td => (td.textContent || '').trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |'
                );
                if (rows[0].querySelector('th')) {
                    const cellCount = Math.max(1, (lines[0].match(/\|/g) || []).length - 1);
                    lines.splice(1, 0, '| ' + Array(cellCount).fill('---').join(' | ') + ' |');
                }
                return '\n\n' + lines.join('\n') + '\n\n';
            }
            case 'details': return '\n\n' + kids() + '\n\n';
            case 'summary': return '**' + kids().trim() + '**\n\n';
            default: return kids();
        }
    }

    // ===== BUILD MARKDOWN =====
    function buildMarkdown(imgMap) {
        const title = getTitle();
        const lines = [
            `# ${title}`,
            '',
            `*${T.archivedLabel}: ${new Date().toLocaleString()} · ${T.sourceLabel}: ${location.href} · ${T.parserLabel}: ${VERSION}${detectedModel ? ' · ' + detectedModel : ''}*`,
            '',
            '---',
            '',
        ];
        eachInRange((entry, n) => {
            const roleLabel = entry.role === 'user' ? T.userLabel : T.assistantLabel;
            const tags = [];
            if (entry.tool) tags.push(`\`${entry.tool}\``);
            if (entry.time) tags.push(`*${formatTimestamp(entry.time)}*`);
            const header = `## #${n} · ${roleLabel}${tags.length ? ' — ' + tags.join(' ') : ''}`;
            const body = htmlToMarkdown(inlineImages(entry.html, imgMap));
            lines.push(header, '', body, '', '');
        });
        return lines.join('\n');
    }

    // ===== BUILD JSON =====
    function buildJson(imgMap) {
        const items = [];
        eachInRange((entry, n) => {
            const tmp = document.createElement('div');
            tmp.innerHTML = entry.html;
            const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
            items.push({
                number: n,
                role: entry.role,
                tool: entry.tool || null,
                time: entry.time || null,
                text,
                html: inlineImages(entry.html, imgMap),
            });
        });
        return JSON.stringify({
            title: getTitle(),
            archivedAt: new Date().toISOString(),
            source: location.href,
            parserVersion: VERSION,
            model: detectedModel || null,
            messageCount: items.length,
            messages: items,
        }, null, 2);
    }

    // ===== BUILD FINAL HTML =====
    function buildHtml(imgMap) {
        const title = getTitle();
        const collapse = !!settings.collapseAssistant;
        const parts = [];
        const tocEntries = [];
        let exported = 0;
        eachInRange((entry, n) => {
            exported++;
            const id = 'msg-' + n;
            const bodyHtml = inlineImages(entry.html, imgMap);
            const roleClass = entry.role === 'user' ? 'msg user' : 'msg assistant';
            const roleLabel = entry.role === 'user' ? T.userLabel : T.assistantLabel;
            const toolBadge = entry.tool
                ? `<span class="tool-badge">${esc(entry.tool)}</span>` : '';
            const modelBadge = (detectedModel && entry.role === 'assistant')
                ? `<span class="model-badge">${esc(detectedModel)}</span>` : '';
            const timeBadge = entry.time
                ? `<span class="timestamp" title="${esc(entry.time)}">${esc(formatTimestamp(entry.time))}</span>` : '';
            const tmp = document.createElement('div');
            tmp.innerHTML = entry.html;
            const snippet = ((tmp.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)) || roleLabel;
            tocEntries.push({ id, n, role: entry.role, snippet });
            let body;
            if (entry.role === 'assistant' && collapse) {
                body = `<details><summary>${esc(T.showResponse)} — ${esc(snippet)}</summary><div class="body">${bodyHtml}</div></details>`;
            } else {
                body = `<div class="body">${bodyHtml}</div>`;
            }
            parts.push(
                `<section id="${id}" class="${roleClass}" data-role="${entry.role}"><div class="role">${roleLabel} · #${n}${toolBadge}${modelBadge}${timeBadge}</div>${body}</section>`
            );
        });
        const tocHtml = tocEntries
            .filter(e => e.role === 'user')
            .map(e => `<option value="${esc(e.id)}">#${e.n} · ${esc(e.snippet)}</option>`)
            .join('');
        const css = `
:root{--bg:#0f1115;--card:#171a21;--user:#1e2a3a;--text:#e6e8eb;--muted:#9aa4b2;--accent:#6ea8fe;--code:#0b0d12;--border:#2a2f3a}
body[data-theme="light"]{--bg:#f9fafb;--card:#ffffff;--user:#dbeafe;--text:#111827;--muted:#6b7280;--accent:#1d4ed8;--code:#f3f4f6;--border:#e5e7eb}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{position:sticky;top:0;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(6px);border-bottom:1px solid var(--border);padding:14px 24px;z-index:10}
header h1{margin:0 0 6px;font-size:20px}
header .meta{color:var(--muted);font-size:13px;word-break:break-all;margin-bottom:10px}
.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.controls input,.controls select,.controls button{background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font:inherit}
.controls input{flex:1;min-width:180px}
.controls select{max-width:380px}
.controls button{cursor:pointer}
.controls button:hover{filter:brightness(1.15)}
main{max-width:980px;margin:0 auto;padding:24px}
.msg{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin:14px 0}
.msg.user{background:var(--user)}
.role{font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}
.tool-badge{display:inline-block;padding:1px 8px;background:color-mix(in srgb,var(--accent) 22%,transparent);color:var(--accent);border-radius:4px;font-size:10px;font-weight:700;margin-left:8px;letter-spacing:.04em;vertical-align:middle}
.model-badge{display:inline-block;padding:1px 8px;background:rgba(155,127,255,.2);color:#bba9ff;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px;letter-spacing:.04em;vertical-align:middle}
.timestamp{display:inline-block;color:var(--muted);font-size:11px;font-weight:400;margin-left:10px;text-transform:none;letter-spacing:0;vertical-align:middle}
.body :where(p,ul,ol,table){margin:.5em 0}
.body pre{background:var(--code);border:1px solid var(--border);border-radius:8px;padding:12px;overflow:auto;font:13px/1.5 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace}
.body code{background:color-mix(in srgb,var(--text) 8%,transparent);padding:.1em .35em;border-radius:4px;font-family:"SFMono-Regular",Consolas,monospace;font-size:.92em}
.body pre code{background:none;padding:0}
.body img{max-width:100%;height:auto;border:1px solid var(--border);border-radius:8px;margin:8px 0;display:block}
.body a{color:var(--accent)}
.body table{border-collapse:collapse;width:100%}
.body th,.body td{border:1px solid var(--border);padding:6px 10px;text-align:left}
.body details{border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0}
.body summary{cursor:pointer;color:var(--muted)}
.msg > details > summary{cursor:pointer;color:var(--muted);font-size:13px;margin:-4px 0 0}
.msg > details[open] > summary{margin-bottom:10px}
.msg.hidden{display:none}
@media print {
  header{position:static;background:#fff;color:#000;border-bottom:1px solid #ccc}
  .controls{display:none}
  body{background:#fff;color:#000}
  .msg{break-inside:avoid;page-break-inside:avoid;background:#fff;border:1px solid #ccc;color:#000}
  .msg.user{background:#f1f5f9}
  .body pre,.body code{background:#f3f4f6;color:#111}
  .body img{border:1px solid #ccc}
  details{break-inside:avoid}
  details > summary{display:none}
  details > *:not(summary){display:block !important}
}
`;
        // Inline JS: search, jump-to TOC, theme toggle, expand/collapse all.
        const inlineScript = `(function(){
var sections=Array.prototype.slice.call(document.querySelectorAll('main > section'));
var search=document.getElementById('cc-search');
var toc=document.getElementById('cc-toc');
var themeBtn=document.getElementById('cc-theme-toggle');
var collapseBtn=document.getElementById('cc-collapse-toggle');
if(search){
  search.addEventListener('input',function(){
    var q=search.value.toLowerCase().trim();
    sections.forEach(function(s){
      if(!q){ s.classList.remove('hidden'); return; }
      var t=(s.textContent||'').toLowerCase();
      s.classList.toggle('hidden', t.indexOf(q)===-1);
    });
  });
}
if(toc){
  toc.addEventListener('change',function(){
    var id=toc.value;
    if(!id) return;
    var el=document.getElementById(id);
    if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}); }
    toc.value='';
  });
}
function applyTheme(t){
  document.body.dataset.theme=t;
  try{ localStorage.setItem('cc-arch-theme', t); }catch(e){}
}
try{ var saved=localStorage.getItem('cc-arch-theme'); if(saved) applyTheme(saved); }catch(e){}
if(themeBtn){
  themeBtn.addEventListener('click',function(){
    var cur=document.body.dataset.theme||'dark';
    applyTheme(cur==='dark'?'light':'dark');
  });
}
if(collapseBtn){
  collapseBtn.addEventListener('click',function(){
    var dets=document.querySelectorAll('section.msg.assistant > details');
    if(!dets.length) return;
    var anyOpen=Array.prototype.some.call(dets,function(d){return d.open;});
    dets.forEach(function(d){ d.open=!anyOpen; });
  });
}
})();`;
        const meta = `${T.archivedLabel}: ${new Date().toLocaleString()} · ${T.messagesLabel}: ${exported} · ${T.sourceLabel}: ${esc(location.href)} · ${T.parserLabel}: ${VERSION}${detectedModel ? ' · ' + esc(detectedModel) : ''}`;
        const controls = `<div class="controls">
  <input id="cc-search" type="search" placeholder="${esc(T.searchPlaceholder)}">
  <select id="cc-toc"><option value="">${esc(T.tocJump)}</option>${tocHtml}</select>
  <button id="cc-collapse-toggle" type="button" title="${esc(T.toggleCollapse)}">▾▴</button>
  <button id="cc-theme-toggle" type="button" title="${esc(T.toggleTheme)}">🌓</button>
</div>`;
        // Stream the file as an array of chunks. Blob will assemble them
        // without forcing us to concatenate a single huge string.
        const head = `<!DOCTYPE html>
<html lang="${T.htmlLang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${css}</style></head>
<body>
<header><h1>${esc(title)}</h1><div class="meta">${meta}</div>${controls}</header>
<main>`;
        const tail = `</main>
<script>${inlineScript}</script>
</body></html>`;
        const out = [head];
        for (const p of parts) { out.push(p); out.push('\n'); }
        out.push(tail);
        return out;
    }

    function download(content, ext, mime) {
        // `content` can be either a string or an array of strings/Blobs.
        // Passing an array directly to Blob lets the browser stream the
        // pieces internally instead of forcing us to concatenate ~10s of
        // MB of HTML in JS memory.
        const parts = Array.isArray(content) ? content : [content];
        const blob = new Blob(parts, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safe = getTitle().replace(/[^\wÀ-ÿĀ-�\s\-]/g, '_').replace(/\s+/g, '_').slice(0, 80);
        a.download = (safe || 'claude-code-session') + '.' + ext;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // ===== RUN =====
    async function run() {
        if (busy) return;
        // Resume offer — if there's a recent unfinished archive for this
        // URL, ask first. If the user declines, drop the snapshot and ask
        // the normal start-confirmation.
        const snapshot = loadResumeSnapshot();
        let resuming = false;
        if (snapshot) {
            const minutes = Math.max(1, Math.round((Date.now() - snapshot.ts) / 60000));
            if (confirm(T.resumePrompt(snapshot.messages.length, minutes))) {
                resuming = true;
            } else {
                clearResumeSnapshot();
                if (!confirm(T.confirm)) return;
            }
        } else {
            if (!confirm(T.confirm)) return;
        }
        busy = true; cancelled = false;
        messages.clear(); seqCounter = 0; order = [];
        messagesParent = null;
        seenNodes = new WeakSet();
        // Refresh settings each run so changes from the modal apply
        // immediately, and refresh redact patterns in case they changed.
        settings = loadSettings();
        recompileRedact();
        knownKeys = loadKnownKeys();
        onlyNewActiveForRun = !!settings.onlyNew;
        if (resuming) {
            // Restore the captured-message map; image map is recomputed.
            for (const [k, v] of snapshot.messages) messages.set(k, v);
            seqCounter = snapshot.seqCounter || messages.size;
            // Honour the original fast/skip toggles from the snapshot so
            // the output is consistent with what the user originally chose.
            if (typeof snapshot.fastMode === 'boolean') fastMode = snapshot.fastMode;
            if (typeof snapshot.skipCode === 'boolean') skipCode = snapshot.skipCode;
            syncToggles();
        }
        setArchiveBtnBusy(true);
        showOverlay();
        let imgMap = new Map();
        try {
            chatContainer = findChatContainer();
            if (!chatContainer) { alert(T.noContainer); return; }
            detectedModel = extractModelName();
            if (resuming) {
                setProgress(T.scrolling(messages.size), true);
            } else {
                setProgress(T.starting, true);
                await autoScroll(chatContainer);
                if (cancelled) { setProgress(T.cancelled, true); return; }
            }
            order = buildOrder();
            // Re-classify roles if capture-time detection produced no mix
            // (e.g. every message ended up as "assistant"). Uses bg-color
            // clusters + structure heuristics, plus a final guarantee that
            // at least one message is "user".
            normalizeRoles();
            setProgress(T.scrollDone(order.length), true);
            imgMap = await downloadAllImages();
            if (cancelled) { setProgress(T.cancelled, true); return; }
            setProgress(T.building, true);
            // Dispatch to the configured output format.
            let content, ext, mime;
            switch (settings.outputFormat) {
                case 'md':
                    content = buildMarkdown(imgMap);
                    ext = 'md';
                    mime = 'text/markdown;charset=utf-8';
                    break;
                case 'json':
                    content = buildJson(imgMap);
                    ext = 'json';
                    mime = 'application/json;charset=utf-8';
                    break;
                default:
                    content = buildHtml(imgMap);
                    ext = 'html';
                    mime = 'text/html;charset=utf-8';
            }
            download(content, ext, mime);
            setProgress(T.done(order.length, imgMap.size), true);
            recordArchive(order.length, imgMap.size);
            // Always remember which keys we've now archived for this URL,
            // regardless of whether `onlyNew` was on this run — so toggling
            // it on later still picks up where we left off.
            const merged = new Set([...knownKeys, ...order]);
            saveKnownKeys(merged);
            // Archive completed successfully — wipe the resume snapshot so
            // it doesn't haunt the next session.
            clearResumeSnapshot();
            await sleep(1500);
        } catch (e) {
            console.error('[archiver]', e);
            alert(T.error + (e.message || e));
        } finally {
            busy = false;
            onlyNewActiveForRun = false;
            setArchiveBtnBusy(false);
            hideOverlay();
        }
    }

    // ===== UI =====
    let overlay, progressEl, panel, archiveBtn, fastBtn, noCodeBtn, settingsBtn;
    let pendingProgressText = null;
    let lastProgressFlush = 0;

    function addStyles() {
        if (document.getElementById('cc-arch-styles')) return;
        const s = document.createElement('style');
        s.id = 'cc-arch-styles';
        s.textContent = `
.cc-arch-panel{position:fixed;bottom:18px;right:18px;background:#16a34a;color:#fff;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.4);z-index:2147483647;display:flex;align-items:stretch;padding:1px;font:600 11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;touch-action:none;transition:width .18s ease,height .18s ease,border-radius .18s ease,padding .18s ease;overflow:hidden}
.cc-arch-drag{width:8px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.55);cursor:grab;font-size:9px;line-height:1;letter-spacing:-1px;touch-action:none;flex:none}
.cc-arch-drag:active{cursor:grabbing}
.cc-arch-panel button{background:rgba(255,255,255,.14);color:#fff;border:none;border-radius:3px;height:20px;width:24px;padding:0;margin:1px;cursor:pointer;font:14px/1 inherit;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;position:relative;flex:none}
.cc-arch-panel button#cc-arch-archive{width:28px}
.cc-arch-panel button:hover{background:rgba(255,255,255,.28)}
.cc-arch-panel button.active{background:#052e1a;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.cc-arch-panel button:disabled{opacity:.7;cursor:not-allowed}
.cc-arch-panel button.busy{background:#0b3a25}
.cc-arch-panel button.has-update::after{content:'';position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:#fbbf24;border-radius:50%;border:1px solid #14532d;box-sizing:border-box}
.cc-arch-spinner{display:inline-block;width:10px;height:10px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:cc-arch-spin 700ms linear infinite}
@keyframes cc-arch-spin{to{transform:rotate(360deg)}}
.cc-arch-panel.collapsed{width:34px;height:34px;border-radius:50%;padding:0;align-items:center;justify-content:center;cursor:grab;position:fixed}
.cc-arch-panel.collapsed:active{cursor:grabbing}
.cc-arch-panel.collapsed > *{display:none !important}
.cc-arch-panel.collapsed::before{content:'⬇';color:#fff;font-size:17px;font-weight:700;display:block;pointer-events:none}
.cc-arch-panel.collapsed.has-update::after{content:'';position:absolute;top:-2px;right:-2px;width:10px;height:10px;background:#fbbf24;border-radius:50%;border:2px solid #14532d;box-sizing:border-box;display:block !important}
.cc-arch-update-notice{background:rgba(251,191,36,.16);border:1px solid #fbbf24;color:#fde68a;padding:8px 12px;border-radius:6px;margin:0 0 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px}
.cc-arch-update-notice button{background:#fbbf24;color:#0f1115;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-weight:700;font-size:12px}
.cc-arch-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;padding-bottom:90px;pointer-events:none}
.cc-arch-card{background:#171a21;color:#e6e8eb;border:1px solid #2a2f3a;border-radius:12px;padding:14px 18px;min-width:320px;max-width:80vw;font:14px sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:auto;position:relative}
.cc-arch-card .p{margin-bottom:10px}
.cc-arch-card .ver{position:absolute;top:8px;right:12px;font-size:11px;color:#6b7280;letter-spacing:.02em}
.cc-arch-card button{background:#d93025;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-weight:700}
.cc-arch-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.cc-arch-modal-card{background:#171a21;color:#e6e8eb;border:1px solid #2a2f3a;border-radius:12px;padding:20px 22px;width:min(540px,92vw);max-height:88vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.cc-arch-modal h2{margin:0 0 14px;font-size:16px;font-weight:700}
.cc-arch-modal label{display:flex;align-items:center;gap:8px;margin:12px 0 2px;font-size:13px;cursor:pointer}
.cc-arch-modal label.block{flex-direction:column;align-items:stretch;gap:4px;cursor:default}
.cc-arch-modal input[type=text],.cc-arch-modal input[type=number],.cc-arch-modal textarea,.cc-arch-modal select{background:#0b0d12;border:1px solid #2a2f3a;color:#e6e8eb;border-radius:6px;padding:6px 8px;font:inherit;width:100%;box-sizing:border-box}
.cc-arch-modal input[type=number]{width:100px}
.cc-arch-modal textarea{min-height:96px;font:12px/1.4 "SFMono-Regular",Consolas,Menlo,monospace;resize:vertical}
.cc-arch-modal .row{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}
.cc-arch-modal .hint{color:#9aa4b2;font-size:11px;margin:2px 0 6px;line-height:1.4}
.cc-arch-modal .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.cc-arch-modal .actions button{background:#16a34a;border:none;color:#fff;border-radius:6px;padding:8px 16px;cursor:pointer;font-weight:600}
.cc-arch-modal .actions button.secondary{background:#374151}
.cc-arch-modal .actions button:hover{filter:brightness(1.1)}
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

    function setArchiveBtnBusy(isBusy) {
        if (!archiveBtn) return;
        archiveBtn.disabled = isBusy;
        archiveBtn.classList.toggle('busy', isBusy);
        if (isBusy) {
            archiveBtn.innerHTML = `<span class="cc-arch-spinner"></span>`;
            archiveBtn.title = T.archiving;
            // Keep the panel expanded during the run so the user can see
            // the progress overlay and reach the Cancel button.
            expandPanel();
        } else {
            archiveBtn.textContent = '⬇';
            updateArchiveTooltip();
            // Run is over — let the panel return to its idle circle.
            scheduleCollapse();
        }
    }

    // ===== SETTINGS MODAL =====
    function showSettingsModal() {
        if (document.querySelector('.cc-arch-modal')) return;
        const modal = document.createElement('div');
        modal.className = 'cc-arch-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        const updateNotice = updateAvailableVersion
            ? `<div class="cc-arch-update-notice">
                <span>${esc(T.updateAvailable(updateAvailableVersion))}</span>
                <button type="button" data-act="install-update">${esc(T.updateInstall)}</button>
              </div>`
            : '';
        modal.innerHTML = `<div class="cc-arch-modal-card">
  <h2>${esc(T.settingsTitle)}</h2>
  ${updateNotice}
  <label class="block"><span>${esc(T.settingsFormat)}</span>
    <select data-k="outputFormat">
      <option value="html">${esc(T.settingsFormatHtml)}</option>
      <option value="md">${esc(T.settingsFormatMd)}</option>
      <option value="json">${esc(T.settingsFormatJson)}</option>
    </select>
  </label>
  <label><input type="checkbox" data-k="collapseAssistant"> <span>${esc(T.settingsCollapse)}</span></label>
  <label><input type="checkbox" data-k="onlyNew"> <span>${esc(T.settingsOnlyNew)}</span></label>
  <div class="hint">${esc(T.settingsOnlyNewHint)}</div>
  <div class="row">
    <label class="block"><span>${esc(T.settingsRangeFrom)}</span><input type="number" min="1" data-k="rangeFrom"></label>
    <label class="block"><span>${esc(T.settingsRangeTo)}</span><input type="number" min="1" data-k="rangeTo"></label>
  </div>
  <div class="hint">${esc(T.settingsRangeHint)}</div>
  <label><input type="checkbox" data-k="localOnly"> <span>${esc(T.settingsLocalOnly)}</span></label>
  <div class="hint">${esc(T.settingsLocalOnlyHint)}</div>
  <label><input type="checkbox" data-k="redactSecrets"> <span>${esc(T.settingsRedact)}</span></label>
  <label class="block"><textarea data-k="secretPatterns" spellcheck="false"></textarea></label>
  <div class="hint">${esc(T.settingsRedactHint)}</div>
  <div class="actions">
    <button type="button" class="secondary" data-act="cancel">${esc(T.settingsClose)}</button>
    <button type="button" data-act="save">${esc(T.settingsSave)}</button>
  </div>
</div>`;
        document.body.appendChild(modal);
        const q = (sel) => modal.querySelector(sel);
        // Populate from current settings (use a fresh load so concurrent
        // tabs don't show stale values).
        const cur = loadSettings();
        modal.querySelectorAll('[data-k]').forEach(el => {
            const k = el.getAttribute('data-k');
            if (el.type === 'checkbox') el.checked = !!cur[k];
            else if (el.type === 'number') el.value = cur[k] == null ? '' : cur[k];
            else if (el.tagName === 'SELECT') el.value = cur[k] || 'html';
            else el.value = cur[k] == null ? '' : cur[k];
        });

        function close() {
            modal.remove();
            // Modal blocked the collapse timer; restart it so the panel
            // can shrink back into its idle circle.
            scheduleCollapse();
        }
        function commit() {
            const next = { ...cur };
            modal.querySelectorAll('[data-k]').forEach(el => {
                const k = el.getAttribute('data-k');
                if (el.type === 'checkbox') next[k] = el.checked;
                else if (el.type === 'number') {
                    const v = parseInt(el.value, 10);
                    next[k] = Number.isFinite(v) && v > 0 ? v : null;
                } else if (el.tagName === 'SELECT') {
                    next[k] = el.value || 'html';
                } else {
                    next[k] = el.value;
                }
            });
            // Validate redact patterns by trying to compile each line.
            const bad = [];
            for (const line of String(next.secretPatterns || '').split('\n')) {
                const t = line.trim();
                if (!t) continue;
                try { new RegExp(t); } catch (_) { bad.push(t); }
            }
            if (bad.length) {
                alert('Invalid regex:\n' + bad.slice(0, 5).join('\n'));
                return;
            }
            settings = next;
            saveSettings(settings);
            recompileRedact();
            close();
        }
        q('[data-act=cancel]').onclick = close;
        q('[data-act=save]').onclick = commit;
        const installUpdate = q('[data-act=install-update]');
        if (installUpdate) installUpdate.onclick = () => {
            // Open the raw userscript URL — Tampermonkey/Violentmonkey
            // intercepts it and offers the reinstall prompt.
            window.open(UPDATE_RAW_URL, '_blank', 'noopener');
        };
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        // Esc closes the modal (don't conflict with cancel-archive, which
        // only triggers when `busy` is true).
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                window.removeEventListener('keydown', escHandler, true);
            }
        };
        window.addEventListener('keydown', escHandler, true);
    }

    // ===== KEEP THE PANEL ON-SCREEN =====
    // When the window is resized / minimized / restored, or the visual
    // viewport changes (mobile keyboard, zoom, browser chrome appearing),
    // a panel that was positioned with explicit left/top may end up off
    // screen. Clamp it to viewport bounds and persist the new position.
    function clampPanelToViewport() {
        if (!panel || !panel.isConnected) return;
        // Panels still in the default bottom-right corner have right:20px
        // and bottom:20px — that's always visible, no clamping needed.
        const usingExplicit = panel.style.left && panel.style.top &&
            panel.style.right === 'auto' && panel.style.bottom === 'auto';
        if (!usingExplicit) return;
        const w = panel.offsetWidth || 0;
        const h = panel.offsetHeight || 0;
        if (w === 0 || h === 0) return;
        // Use visualViewport when available so we account for mobile
        // pinch-zoom and on-screen keyboards correctly.
        const vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth;
        const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
        const maxLeft = Math.max(0, vw - w);
        const maxTop = Math.max(0, vh - h);
        let left = parseFloat(panel.style.left);
        let top = parseFloat(panel.style.top);
        if (!Number.isFinite(left)) left = panel.getBoundingClientRect().left;
        if (!Number.isFinite(top)) top = panel.getBoundingClientRect().top;
        const clampedLeft = Math.max(0, Math.min(maxLeft, left));
        const clampedTop = Math.max(0, Math.min(maxTop, top));
        if (clampedLeft !== left || clampedTop !== top) {
            panel.style.left = clampedLeft + 'px';
            panel.style.top = clampedTop + 'px';
            try {
                localStorage.setItem('cc-arch-pos', JSON.stringify({
                    left: panel.style.left,
                    top: panel.style.top,
                }));
            } catch (_) { /* ignore */ }
        }
    }
    function installViewportWatchers() {
        if (installViewportWatchers._done) return;
        installViewportWatchers._done = true;
        // rAF-coalesced: many resize events can fire in quick succession.
        let scheduled = false;
        const schedule = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                clampPanelToViewport();
            });
        };
        window.addEventListener('resize', schedule, { passive: true });
        window.addEventListener('orientationchange', schedule, { passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', schedule, { passive: true });
            window.visualViewport.addEventListener('scroll', schedule, { passive: true });
        }
    }

    // ===== DRAGGING =====
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
        // Drag from the whole panel (including the collapsed circle), but
        // skip presses that hit an interactive child (button/input/etc.) so
        // clicks still work normally.
        p.addEventListener('pointerdown', (e) => {
            if (e.target && e.target.closest && e.target.closest('button, input, select, textarea, a')) return;
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
            try { p.setPointerCapture(e.pointerId); } catch (_) {}
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

        archiveBtn = document.createElement('button');
        archiveBtn.type = 'button';
        archiveBtn.id = 'cc-arch-archive';
        archiveBtn.textContent = '⬇';
        archiveBtn.onclick = run;
        panel.appendChild(archiveBtn);

        fastBtn = document.createElement('button');
        fastBtn.type = 'button';
        fastBtn.textContent = '⚡';
        fastBtn.onclick = () => { fastMode = !fastMode; syncToggles(); };
        panel.appendChild(fastBtn);

        noCodeBtn = document.createElement('button');
        noCodeBtn.type = 'button';
        noCodeBtn.textContent = '📝';
        noCodeBtn.onclick = () => { skipCode = !skipCode; syncToggles(); };
        panel.appendChild(noCodeBtn);

        settingsBtn = document.createElement('button');
        settingsBtn.type = 'button';
        settingsBtn.title = T.settingsTitleAttr;
        settingsBtn.textContent = '⚙';
        settingsBtn.onclick = showSettingsModal;
        panel.appendChild(settingsBtn);

        document.body.appendChild(panel);
        makeDraggable(panel, drag);
        syncToggles();
        updateArchiveTooltip();
        if (updateAvailableVersion) showUpdateBadge();
        // Auto-collapse: when the mouse leaves the panel and it isn't busy
        // or modal-open, shrink to a small green circle. Re-expand on hover
        // or keyboard focus.
        panel.addEventListener('pointerenter', expandPanel);
        panel.addEventListener('pointerleave', scheduleCollapse);
        panel.addEventListener('focusin', expandPanel);
        panel.addEventListener('focusout', scheduleCollapse);
        scheduleCollapse();
        // Saved position from a previous (possibly larger) window may now be
        // off-screen; clamp on next animation frame after the panel has been
        // measured.
        requestAnimationFrame(clampPanelToViewport);
    }

    // ===== AUTO-COLLAPSE =====
    let collapseTimer = null;
    const COLLAPSE_DELAY_MS = 3000;
    function scheduleCollapse() {
        if (!panel) return;
        if (collapseTimer) clearTimeout(collapseTimer);
        collapseTimer = setTimeout(() => {
            collapseTimer = null;
            if (!panel) return;
            // Don't shrink during a run, when a modal is open, or while the
            // user is still hovering.
            if (busy) return;
            if (document.querySelector('.cc-arch-modal')) return;
            try { if (panel.matches(':hover')) return; } catch (_) {}
            panel.classList.add('collapsed');
        }, COLLAPSE_DELAY_MS);
    }
    function expandPanel() {
        if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
        if (panel) panel.classList.remove('collapsed');
    }

    // Keep the panel alive across SPA-style re-renders.
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

    // ===== HOTKEYS =====
    // Alt+A — start archive. Esc — cancel an ongoing run.
    function installHotkeys() {
        if (installHotkeys._done) return;
        installHotkeys._done = true;
        window.addEventListener('keydown', (e) => {
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
                // Skip when the user is typing in an editable area unrelated to us.
                const t = e.target;
                const isEditable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.isContentEditable));
                if (isEditable) return;
                if (busy) return;
                e.preventDefault();
                run();
                return;
            }
            if (e.key === 'Escape' && busy) {
                cancelled = true;
                setProgress(T.cancelling, true);
                e.preventDefault();
            }
        }, true);
    }

    function init() {
        addStyles();
        installGlobalDragListeners();
        installViewportWatchers();
        installHotkeys();
        makePanel();
        installPanelKeepalive();
        // Defer the network check briefly so we don't compete with the
        // host page's own load.
        setTimeout(checkForUpdate, 4000);
    }
    if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
