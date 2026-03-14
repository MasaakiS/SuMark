// showMermaidInsertDialog(), insertMermaidBlock() は src/mermaidManager.js に移動済み

// insertTextAtCursor: カーソル位置にテキストを挿入するユーティリティ
function insertTextAtCursor(text) {
    const sel = window.getSelection();

    // 選択範囲がない場合は editor 末尾へ挿入
    if (!sel.rangeCount) {
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    // 挿入したテキストの後ろにカーソルを移動
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
}
// =====================================================
// SuMark - Main Application Logic
// =====================================================

// Global error banner management
let errorBanner = null;
let errorBannerTimeout = null;
// editorZoom, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, applyEditorZoom, changeEditorZoom, resetEditorZoom
// → modules/editorZoom.js に移動済み
let lastErrorTime = 0;
const ERROR_THROTTLE_MS = 500;  // Prevent rapid-fire error spam

// Global error handler for debugging
window.onerror = function(msg, url, line, col, error) {
    console.error('Global error:', msg, 'at', url, ':', line, ':', col);
    
    // Throttle: ignore errors within ERROR_THROTTLE_MS ms of the last error
    const now = Date.now();
    if (now - lastErrorTime < ERROR_THROTTLE_MS) {
        return;  // Ignore this error
    }
    lastErrorTime = now;
    
    // Create or reuse error banner
    if (!errorBanner) {
        errorBanner = document.createElement('div');
        errorBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc3545;color:white;padding:12px;z-index:99999;font-size:14px;display:flex;justify-content:space-between;align-items:center';
        errorBanner.innerHTML = '';
        document.body.appendChild(errorBanner);
    }
    
    // Update error message
    const errorMsg = 'JS Error: ' + msg + ' (line ' + line + ')';
    errorBanner.textContent = errorMsg;
    
    // Clear existing timeout and set new one
    if (errorBannerTimeout) {
        clearTimeout(errorBannerTimeout);
    }
    errorBannerTimeout = setTimeout(function() {
        if (errorBanner && errorBanner.parentNode) {
            errorBanner.remove();
            errorBanner = null;
        }
        errorBannerTimeout = null;
    }, 5000);  // Auto-dismiss after 5 seconds
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    // Trigger error handler for unhandled rejections
    window.onerror('Unhandled Promise Rejection: ' + String(event.reason), window.location.href, 0, 0, event.reason);
});

// ========== Toast Banner ==========
// type: 'warn' (yellow, 3s) | 'error' (red, 5s)
function showBanner(message, type) {
    const isWarn = type !== 'error';
    const bg = isWarn ? '#ffc107' : '#dc3545';
    const color = isWarn ? '#333' : '#fff';
    const duration = isWarn ? 3000 : 5000;

    const banner = document.createElement('div');
    banner.setAttribute('data-banner-type', type || 'warn');
    banner.style.cssText = [
        'position:fixed',
        'top:8px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:' + bg,
        'color:' + color,
        'padding:10px 20px',
        'border-radius:6px',
        'z-index:99998',
        'font-size:14px',
        'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
        'min-width:200px',
        'max-width:480px',
        'text-align:center',
        'pointer-events:none',
    ].join(';');
    banner.textContent = message;
    document.body.appendChild(banner);

    setTimeout(function() {
        if (banner.parentNode) banner.remove();
    }, duration);
}

function showWarn(message) { showBanner(message, 'warn'); }
function showError(message) { showBanner(message, 'error'); }

// ========== State ==========
let isConverting = false; // Guard for auto-conversion recursion
// codeHighlightTimer → codeHighlight.js に移動済み
let isComposing = false; // IME composition state
let initRetryCount = 0;
const INIT_RETRY_MAX = 50;
const INIT_RETRY_DELAY_MS = 100;


// Tab management → tabManager.js に移動済み
// let tabs, activeTabId, tabIdCounter は tabManager.js で定義

// undoStack, redoStack, currentState, MAX_UNDO_STACK, isUndoRedoOperation, saveStateTimer
// → modules/undoRedo.js に移動済み
let inputCharCount = 0; // 連続入力カウンタ
let isProcessingDrop = false; // Guard to prevent duplicate drop processing

// ========== Emoji Map ==========
const EMOJI_MAP = {
    'smile': '😄', 'laughing': '😆', 'blush': '😊', 'smiley': '😃',
    'relaxed': '☺️', 'smirk': '😏', 'heart_eyes': '😍', 'kissing_heart': '😘',
    'flushed': '😳', 'relieved': '😌', 'grin': '😁', 'wink': '😉',
    'stuck_out_tongue_winking_eye': '😜', 'stuck_out_tongue': '😛',
    'grinning': '😀', 'kissing': '😗', 'sleeping': '😴',
    'worried': '😟', 'open_mouth': '😮', 'grimacing': '😬', 'confused': '😕',
    'hushed': '😯', 'expressionless': '😑', 'unamused': '😒',
    'sweat_smile': '😅', 'sweat': '😓', 'weary': '😩', 'pensive': '😔',
    'disappointed': '😞', 'fearful': '😨', 'cold_sweat': '😰', 'cry': '😢',
    'sob': '😭', 'joy': '😂', 'astonished': '😲', 'scream': '😱',
    'angry': '😠', 'rage': '😡', 'triumph': '😤', 'sleepy': '😪',
    'yum': '😋', 'mask': '😷', 'sunglasses': '😎', 'dizzy_face': '😵',
    'imp': '👿', 'smiling_imp': '😈', 'neutral_face': '😐', 'no_mouth': '😶',
    'innocent': '😇', 'alien': '👽', 'thinking': '🤔', 'nerd': '🤓',
    'rolling_eyes': '🙄', 'upside_down': '🙃', 'robot': '🤖',
    'heart': '❤️', 'broken_heart': '💔', 'star': '⭐', 'star2': '🌟',
    'sparkles': '✨', 'fire': '🔥', 'thumbsup': '👍', '+1': '👍',
    'thumbsdown': '👎', '-1': '👎', 'ok_hand': '👌', 'punch': '👊',
    'fist': '✊', 'v': '✌️', 'wave': '👋', 'hand': '✋',
    'raised_hands': '🙌', 'pray': '🙏', 'clap': '👏', 'muscle': '💪',
    'point_up': '☝️', 'point_down': '👇', 'point_left': '👈', 'point_right': '👉',
    'dog': '🐶', 'cat': '🐱', 'mouse': '🐭', 'rabbit': '🐰',
    'tiger': '🐯', 'bear': '🐻', 'pig': '🐷', 'monkey': '🐵',
    'bird': '🐦', 'penguin': '🐧', 'fish': '🐟', 'whale': '🐳',
    'sunny': '☀️', 'cloud': '☁️', 'umbrella': '☂️', 'snowflake': '❄️',
    'zap': '⚡', 'rainbow': '🌈', 'cyclone': '🌀',
    'apple': '🍎', 'cherries': '🍒', 'grapes': '🍇', 'watermelon': '🍉',
    'pizza': '🍕', 'hamburger': '🍔', 'coffee': '☕', 'beer': '🍺',
    'wine_glass': '🍷', 'cocktail': '🍸',
    'tada': '🎉', 'balloon': '🎈', 'gift': '🎁', 'trophy': '🏆',
    'gem': '💎', 'bulb': '💡', 'wrench': '🔧', 'hammer': '🔨',
    'rocket': '🚀', 'airplane': '✈️', 'car': '🚗', 'bus': '🚌', 'bike': '🚲',
    'warning': '⚠️', 'x': '❌', 'o': '⭕', 'check': '✅',
    'heavy_check_mark': '✔️', 'question': '❓', 'exclamation': '❗',
    'lock': '🔒', 'unlock': '🔓', 'key': '🔑', 'bell': '🔔',
    'link': '🔗', 'pencil': '✏️', 'memo': '📝', 'book': '📖',
    'books': '📚', 'clipboard': '📋', 'calendar': '📅',
    'chart': '📊', 'email': '📧', 'phone': '📱', 'computer': '💻',
    'globe': '🌍', 'earth': '🌎', 'earth_asia': '🌏',
    'white_check_mark': '✅', 'hundred': '💯', 'eyes': '👀',
    'skull': '💀', 'ghost': '👻', 'poop': '💩',
    'red_circle': '🔴', 'blue_circle': '🔵', 'white_circle': '⚪', 'black_circle': '⚫',
    'arrow_up': '⬆️', 'arrow_down': '⬇️', 'arrow_left': '⬅️', 'arrow_right': '➡️',
};

// Tauri APIs
let invoke, tauriOpen, tauriSave, readTextFile, writeTextFile, readBinaryFile, writeBinaryFile, createDir, readDir, exists, shellOpen, convertFileSrc;

// DOM
let editor, wordCountSpan;
// tabList, currentFileSpan → tabManager.js に移動済み

// turndownService, DOMPURIFY_URI_REGEXP → modules/markdown.js に移動済み

// ========== Debug Helper ==========
function testConvertFileSrc(path) {
    // Use the native Tauri convertFileSrc function which generates asset:// URLs
    // This is more secure and recommended by Tauri
    const assetUrl = convertFileSrc(path);
    console.log('[TEST convertFileSrc] input path:', path);
    console.log('[TEST convertFileSrc] output asset URL:', assetUrl);
    return assetUrl;
}

/**
 * グローバル状態をリセット（ページロード後など）
 * 複数テスト連続実行時のメモリリーク・グローバル状態競合を防止
 */
function resetGlobalState() {
    // Mermaid レンダリングのリトライカウンターをリセット
    if (typeof renderMermaidBlocks !== 'undefined' && renderMermaidBlocks.retryCount) {
        renderMermaidBlocks.retryCount = 0;
    }
    
    // IME 合成フラグをリセット
    isComposing = false;
    
    // 自動変換フラグをリセット
    isConverting = false;
    
    console.log('[resetGlobalState] グローバル状態をリセット完了');
}

// ========== Initialization ==========
function init() {
    console.log('=== WYSIWYG Editor Initialization ===');

    // Tauri APIs
    try {
        if (!window.__TAURI__) {
            const isLikelyTauriRuntime =
                (typeof window.__TAURI_IPC__ === 'function') ||
                (typeof navigator !== 'undefined' && /tauri/i.test(navigator.userAgent || ''));

            // On slower Tauri environments (e.g., Linux ARM64), bridge injection
            // can lag behind DOMContentLoaded. Retry only when Tauri is likely.
            if (isLikelyTauriRuntime && initRetryCount < INIT_RETRY_MAX) {
                initRetryCount += 1;
                if (initRetryCount === 1 || initRetryCount % 10 === 0) {
                    console.warn(`[INIT] Waiting for Tauri bridge... (${initRetryCount}/${INIT_RETRY_MAX})`);
                }
                setTimeout(init, INIT_RETRY_DELAY_MS);
                return;
            }

            console.warn('[WARN] Tauri API not available - running in browser mode with limited functionality');
            // Mock Tauri APIs for browser testing
            invoke = () => Promise.resolve();
            tauriOpen = () => Promise.resolve(null);
            tauriSave = () => Promise.resolve(null);
            readTextFile = () => Promise.resolve('');
            writeTextFile = () => Promise.resolve();
            readBinaryFile = () => Promise.resolve(new Uint8Array());
            writeBinaryFile = () => Promise.resolve();
            createDir = () => Promise.resolve();
            readDir = () => Promise.resolve([]);
            exists = () => Promise.resolve(false);
            convertFileSrc = (path) => path;
            shellOpen = () => Promise.resolve();
            // Don't return - continue initialization
        } else {
            initRetryCount = 0;
            invoke = window.__TAURI__.tauri.invoke;
            tauriOpen = window.__TAURI__.dialog.open;
            tauriSave = window.__TAURI__.dialog.save;
            readTextFile = window.__TAURI__.fs.readTextFile;
            writeTextFile = window.__TAURI__.fs.writeTextFile;
            readBinaryFile = window.__TAURI__.fs.readBinaryFile;
            writeBinaryFile = window.__TAURI__.fs.writeBinaryFile;
            createDir = window.__TAURI__.fs.createDir;
            readDir = window.__TAURI__.fs.readDir;
            exists = window.__TAURI__.fs.exists;
            convertFileSrc = window.__TAURI__.tauri.convertFileSrc;
            shellOpen = window.__TAURI__.shell.open;
            console.log('Tauri APIs OK');

            // アプリ名の横にバージョンを表示
            (async () => {
                try {
                    const appName = await window.__TAURI__.app.getName();
                    const appVersion = await window.__TAURI__.app.getVersion();
                    document.title = `${appName} v${appVersion}`;
                    if (window.__TAURI__.window && window.__TAURI__.window.appWindow) {
                        window.__TAURI__.window.appWindow.setTitle(`${appName} v${appVersion}`);
                    }
                } catch (vErr) {
                    console.warn('Could not set version in title:', vErr);
                }
            })();
        }
    } catch (err) {
        console.error('Tauri API init failed:', err);
        return;
    }

    // DOM elements
    editor = document.getElementById('editor');
    wordCountSpan = document.getElementById('wordCount');

    // Initialize tab manager (currentFileSpan, tabList を初期化)
    initTabManager();

    if (!editor) {
        console.error('Editor element not found');
        return;
    }

    // Configure Marked (Markdown → HTML)
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false,
        });
        console.log('Marked configured');
    }

    // Configure Turndown (HTML → Markdown)
    configureTurndown();

    // Set default paragraph separator to <p>
    document.execCommand('defaultParagraphSeparator', false, 'p');

    // Initialize editor with empty paragraph
    editor.innerHTML = '<p><br></p>';

    // Setup event listeners
    setupEventListeners();
    setupTableContextMenu();
    setupImageResize();
    setupImageViewer();
    setupCodeCopyButtons();
    setupImageErrorHandling();
    setupImageMutationObserver(); // Watch for new images added to editor
    // setupTabKeyboardShortcuts() は呼ばない（N/W は main.js handleKeyDown で処理済み）
    setupZoomKeyboardShortcuts();

    // Initialize Mermaid (may load asynchronously via defer)
    try {
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
            console.log('Mermaid initialized');
        } else {
            console.log('Mermaid not yet loaded, will initialize on first use');
        }
    } catch (err) {
        console.error('Mermaid init error:', err);
    }

    // Create initial tab
    createTab(null, '無題', '<p><br></p>');

    // Initial state
    updateWordCount();
    editor.focus();
}

// configureTurndown(), getMarkdown(), preprocessNotionMarkdown(), _normalizeNotionTable(), setMarkdown() → modules/markdown.js に移動済み

// getCaretCharacterOffsetWithin(), setCaretCharacterOffset(), highlightCodeBlock(), highlightAllCodeBlocks() は src/codeHighlight.js に移動済み

// Ensure editor starts with an editable element
function ensureEditableStart() {
    if (!editor || editor.children.length === 0) {
        return;
    }
    
    const firstChild = editor.firstElementChild;
    // Check if first element is a block element that's hard to edit before
    const blockElements = ['PRE', 'TABLE', 'UL', 'OL', 'BLOCKQUOTE', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    
    if (firstChild && blockElements.includes(firstChild.tagName)) {
        // Insert an empty paragraph at the beginning
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editor.insertBefore(p, firstChild);
    }
}

// updateLineNumbers(), updateAllLineNumbers(), debouncedHighlightCodeAtCursor() は src/codeHighlight.js に移動済み

// isOnEmptyTrailingLine(), removeTrailingEmptyLines() は src/nodeUtils.js に移動済み

// ========== Event Listeners ==========
function setupEventListeners() {
    // Prevent ALL toolbar buttons from stealing focus
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
    });

    // Editor events
    editor.addEventListener('input', onEditorInput);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('compositionstart', () => { 
        console.log('[DEBUG] IME composition started');
        isComposing = true; 
    });
    editor.addEventListener('compositionend', () => {
        console.log('[DEBUG] IME composition ended');
        isComposing = false;
        // Trigger conversion after IME commit
        onEditorInput();
    });

    // Checkbox delegation
    editor.addEventListener('change', e => {
        if (e.target.type === 'checkbox') {
            markModified();
        }
    });

    // Link click handling - Cmd/Ctrl+click opens in browser
    editor.addEventListener('click', e => {
        // Toggle delete button
        if (e.target.closest('.toggle-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const details = e.target.closest('details');
            if (details) {
                unwrapToggle(details);
            }
            return;
        }
        // TOC delete button
        if (e.target.closest('.toc-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const tocContainer = e.target.closest('.toc-container');
            if (tocContainer) {
                tocContainer.remove();
                markModified();
            }
            return;
        }

        // TOC link click - scroll to heading
        const tocLink = e.target.closest('.toc-link');
        if (tocLink) {
            e.preventDefault();
            const targetId = tocLink.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                const targetEl = editor.querySelector(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Brief highlight effect
                    targetEl.style.transition = 'background-color 0.3s';
                    targetEl.style.backgroundColor = '#fff3cd';
                    setTimeout(() => {
                        targetEl.style.backgroundColor = '';
                        setTimeout(() => { targetEl.style.transition = ''; }, 300);
                    }, 1500);
                }
            }
            return;
        }

        // Click on non-editable element (TOC, Mermaid preview): select it so Backspace/Delete can remove it
        const nonEditable = e.target.closest('[contenteditable="false"]');
        if (nonEditable && nonEditable !== editor && editor.contains(nonEditable)) {
            // Don't interfere with buttons inside non-editable elements
            if (e.target.closest('button')) return;
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNode(nonEditable);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        const link = e.target.closest('a');
        if (link) {
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                const url = link.getAttribute('href') || link.href;
                if (url && shellOpen) {
                    shellOpen(url).catch(err => console.error('Failed to open URL:', err));
                }
            }
        }
    });

    // Toolbar buttons
    const buttons = [
        { id: 'newBtn',       handler: newFile },
        { id: 'openBtn',      handler: openFile },
        { id: 'saveBtn',      handler: saveFile },
        { id: 'saveAsBtn',    handler: saveAsFile },
        { id: 'pdfBtn',       handler: exportPDF },
        { id: 'undoBtn',      handler: performUndo },
        { id: 'redoBtn',      handler: performRedo },
        { id: 'boldBtn',      handler: () => document.execCommand('bold') },
        { id: 'italicBtn',    handler: () => document.execCommand('italic') },
        { id: 'strikeBtn',    handler: () => document.execCommand('strikethrough') },
        { id: 'codeBtn',      handler: applyInlineCode },
        { id: 'linkBtn',      handler: insertLink },
        { id: 'imageBtn',     handler: insertImage },
        { id: 'h1Btn',        handler: () => applyHeading(1) },
        { id: 'h2Btn',        handler: () => applyHeading(2) },
        { id: 'h3Btn',        handler: () => applyHeading(3) },
        { id: 'ulBtn',        handler: insertUnorderedList },
        { id: 'olBtn',        handler: insertOrderedList },
        { id: 'taskBtn',      handler: insertTaskList },
        { id: 'tableBtn',     handler: insertTable },
        { id: 'codeBlockBtn', handler: insertCodeBlock },
        { id: 'quoteBtn',     handler: applyBlockquote },
        { id: 'toggleBtn',    handler: insertToggle },
        { id: 'hrBtn',        handler: insertHorizontalRule },
        { id: 'dateBtn',      handler: insertDate },
        { id: 'timeBtn',      handler: insertTime },
        { id: 'datetimeBtn',  handler: insertDateTime },
        { id: 'tocBtn',       handler: insertTOC },
        { id: 'emojiBtn',     handler: showEmojiPicker },
    ];

    buttons.forEach(({ id, handler }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                handler();
                editor.focus();
            });
        }
    });

    console.log('Event listeners attached');
    
    // File drop event (Tauri v1 drag-and-drop support)
    if (window.__TAURI__ && window.__TAURI__.event) {
        console.log('[DEBUG] Setting up Tauri file drop listeners...');
        
        // Use Tauri v1 event API
        window.__TAURI__.event.listen('tauri://file-drop', async (event) => {
            console.log('[DEBUG] File drop event received:', event);
            console.log('[DEBUG] Event payload:', event.payload);
            
            const files = event.payload;
            console.log('[DEBUG] Files:', files);
            
            if (files && Array.isArray(files)) {
                console.log('[DEBUG] Processing', files.length, 'dropped files');
                for (const filePath of files) {
                    console.log('[DEBUG] Processing file:', filePath);
                    // Check if file is a Markdown file
                    const ext = filePath.split('.').pop().toLowerCase();
                    if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
                        try {
                            await openFileFromPath(filePath);
                            console.log('[DEBUG] Successfully opened:', filePath);
                        } catch (err) {
                            console.error('Error opening dropped file:', err);
                            showError('ファイルを開けませんでした: ' + filePath);
                        }
                    } else {
                        console.log('[INFO] Skipping non-Markdown file:', filePath);
                    }
                }
            } else {
                console.warn('[WARN] No files in drop event or invalid format');
            }
        });
        
        // File drop hover event (optional visual feedback)
        window.__TAURI__.event.listen('tauri://file-drop-hover', (event) => {
            console.log('[DEBUG] File drop hover:', event);
            document.body.style.outline = '3px dashed #007bff';
        });
        
        // File drop cancelled event
        window.__TAURI__.event.listen('tauri://file-drop-cancelled', (event) => {
            console.log('[DEBUG] File drop cancelled:', event);
            document.body.style.outline = '';
        });
        
        console.log('[DEBUG] Tauri file drop listeners registered');
    } else {
        console.log('[DEBUG] Tauri event API not available - file drop disabled');
    }
    
    // ========== Unified File Drop Handling (non-Tauri fallback) ==========
    // When running outside Tauri (browser-only), HTML5 Drag & Drop API handles file drops.
    // In Tauri, fileDropEnabled=true means native tauri://file-drop handles it;
    // this handler only serves as a fallback for non-Tauri environments.
    const setupUnifiedDropHandler = () => {
        console.log('[DEBUG] Setting up unified drop handlers...');

        // Helper: check if drag contains files or file URIs
        const isFileDrag = (e) => {
            const types = Array.from(e.dataTransfer?.types || []);
            return types.includes('Files') || types.includes('text/uri-list');
        };

        // Helper: extract file paths from text/uri-list
        const parseUriList = (uriListStr) => {
            return uriListStr
                .split(/\r?\n/)
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => {
                    try {
                        const url = new URL(line.trim());
                        if (url.protocol === 'file:') {
                            return decodeURIComponent(url.pathname);
                        }
                    } catch (e) {}
                    return null;
                })
                .filter(Boolean);
        };

        // Window dragover: accept file drags, prevent browser navigation
        window.addEventListener('dragover', (e) => {
            if (isFileDrag(e)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                document.body.style.outline = '3px dashed #007bff';
            }
        });

        window.addEventListener('dragleave', (e) => {
            if (e.clientX === 0 && e.clientY === 0) {
                document.body.style.outline = '';
            }
        });

        // Window drop: handle file drops from any source
        window.addEventListener('drop', async (e) => {
            document.body.style.outline = '';

            // Only handle file drops; let text drops through for contenteditable
            if (!isFileDrag(e)) return;

            e.preventDefault();
            e.stopPropagation();

            // In Tauri with fileDropEnabled=true, native tauri://file-drop handles file drops.
            // If this HTML5 handler fires anyway, skip to avoid duplicate processing.
            if (window.__TAURI__ && window.__TAURI__.event) {
                console.log('[DEBUG] Tauri native file-drop is active, skipping HTML5 handler');
                return;
            }

            console.log('[DEBUG] ===== DROP EVENT (non-Tauri) =====');
            console.log('[DEBUG] dataTransfer.types:', Array.from(e.dataTransfer.types || []));
            console.log('[DEBUG] dataTransfer.files.length:', e.dataTransfer.files?.length);

            if (isProcessingDrop) {
                console.log('[DEBUG] Drop already in progress, skipping');
                return;
            }
            isProcessingDrop = true;

            try {
                let handled = false;

                // 1. Try text/uri-list first (VSCode Explorer, possibly Finder on macOS)
                const uriList = e.dataTransfer.getData('text/uri-list');
                if (uriList) {
                    console.log('[DEBUG] text/uri-list:', uriList);
                    const filePaths = parseUriList(uriList);
                    for (const filePath of filePaths) {
                        const ext = filePath.split('.').pop().toLowerCase();
                        if (['md', 'markdown', 'txt'].includes(ext)) {
                            console.log('[DEBUG] Opening from URI:', filePath);
                            await openFileFromPath(filePath);
                            handled = true;
                        } else {
                            console.log('[INFO] Skipping unsupported file:', filePath);
                        }
                    }
                }

                if (handled) return;

                // 2. Try text/plain for file:// URIs (fallback)
                const plainText = e.dataTransfer.getData('text/plain');
                if (plainText && plainText.startsWith('file://')) {
                    console.log('[DEBUG] text/plain has file URI:', plainText);
                    const filePaths = parseUriList(plainText);
                    for (const filePath of filePaths) {
                        const ext = filePath.split('.').pop().toLowerCase();
                        if (['md', 'markdown', 'txt'].includes(ext)) {
                            await openFileFromPath(filePath);
                            handled = true;
                        }
                    }
                }

                if (handled) return;

                // 3. Try dataTransfer.files (Finder drops)
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    console.log('[DEBUG] Processing', e.dataTransfer.files.length, 'files from dataTransfer.files');
                    for (const file of e.dataTransfer.files) {
                        console.log('[DEBUG] File:', file.name, 'type:', file.type, 'size:', file.size, 'path:', file.path || 'N/A');
                        await processDroppedFile(file);
                    }
                    return;
                }

                // 4. Try dataTransfer.items
                if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                    console.log('[DEBUG] Processing items, count:', e.dataTransfer.items.length);
                    for (let i = 0; i < e.dataTransfer.items.length; i++) {
                        const item = e.dataTransfer.items[i];
                        console.log('[DEBUG] Item', i, '- kind:', item.kind, 'type:', item.type);
                        if (item.kind === 'file') {
                            const file = item.getAsFile();
                            if (file) await processDroppedFile(file);
                        }
                    }
                }
            } catch (err) {
                console.error('[ERROR] Drop handler:', err);
            } finally {
                isProcessingDrop = false;
            }
        });

        console.log('[DEBUG] Unified drop handlers registered');
    };

    // Helper: process a dropped File object (non-Tauri fallback only)
    async function processDroppedFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        console.log('[DEBUG] processDroppedFile:', file.name, 'ext:', ext);

        if (!['md', 'markdown', 'txt'].includes(ext)) {
            console.log('[INFO] Skipping unsupported file type:', ext);
            return;
        }

        try {
            // Try file.path (available in some runtimes like Electron)
            if (file.path) {
                console.log('[DEBUG] Using file.path:', file.path);
                await openFileFromPath(file.path);
            } else {
                // Read content directly via File API (no path = no image resolution)
                console.log('[DEBUG] Reading file via text() (no path available)...');
                const text = await file.text();
                console.log('[DEBUG] Loaded', text.length, 'chars from', file.name);
                let processedText = text;
                // Prevent indented lone '-' from being interpreted as Setext H2
                processedText = processedText.replace(/^(\s+)-(\s*)$/gm, '$1- \u200B');
                const processed = preprocessNotionMarkdown(processedText);
                const html = (typeof marked !== 'undefined') ? marked.parse(processed) : processed;
                createTab(null, file.name, html);
                showWarn('ファイルパスを取得できないため、画像が表示されない場合があります。「開く」ボタンをご利用ください。');
            }
        } catch (err) {
            console.error('[ERROR] processDroppedFile:', err);
            showError('ファイルを開けませんでした: ' + file.name);
        }
    }

    setupUnifiedDropHandler();

    // ブラウザモード用フォールバック（beforeunload）
    window.addEventListener('beforeunload', e => {
        if (!hasUnsavedTabs()) return;
        e.preventDefault();
        e.returnValue = '';
    });

    // Tauri ウィンドウクローズ確認（アプリX / Cmd+Q 共通）
    // ダブル発火防止ガード（CloseRequested と ExitRequested が両方発火する場合に対応）
    let appCloseDialogShowing = false;
    const requestAppClose = async () => {
            if (appCloseDialogShowing) return;
            appCloseDialogShowing = true;
            try {
                const hasUnsaved = hasUnsavedTabs();
                const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;
                console.log('[CloseFlow] app-close-requested', {
                    hasUnsaved,
                    activeTabId: activeTab ? activeTab.id : null,
                    isModified: activeTab ? activeTab.isModified : null,
                    filePath: activeTab ? activeTab.filePath : null,
                    editorTextLength: editor ? (editor.innerText || '').trim().length : -1,
                });

                if (!hasUnsaved) {
                    // 未保存なし → Rust 側で明示的に終了
                    await invoke('allow_close');
                    await invoke('exit_app');
                    return;
                }

                const unsavedTabs = getUnsavedTabs();
                const names = unsavedTabs.slice(0, 5).map(t => '・' + t.title).join('\n');
                const extra = unsavedTabs.length > 5 ? '\n...他 ' + (unsavedTabs.length - 5) + ' 件' : '';
                const message = '保存されていないタブがあります。\nアプリを終了しますか？\n\n' + names + extra;

                // Tauri ネイティブダイアログ（WebViewの innerHTML を壊さない）
                const ok = await window.__TAURI__.dialog.confirm(message, { title: '確認', type: 'warning' });
                if (ok) {
                    await invoke('allow_close');
                    await invoke('exit_app');
                }
                // キャンセル → 何もしない（Rust側で prevent 済み）
            } catch (closeErr) {
                console.error('Failed to close app:', closeErr);
                showError('アプリを終了できませんでした。もう一度お試しください。');
            } finally {
                appCloseDialogShowing = false;
            }
    };

    // keyboard.js からも同じ終了フローを使えるように公開
    window.requestAppClose = requestAppClose;

    if (window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.listen('app-close-requested', requestAppClose);
    }
    
    // Initialize undo stack with initial state
    saveEditorState();
}

// ========== Advanced Undo/Redo Functions ==========

/**
 * Save current editor state to undo stack
 */
// saveEditorState, debouncedSaveEditorState, performUndo, performRedo
// → modules/undoRedo.js に移動済み

// saveSelection(), restoreSelection(), getNodePath(), getNodeByPath() は src/nodeUtils.js に移動済み

// onEditorInput(), handleBlockAutoConversion(), handleInlineAutoConversion(), applyInlineAutoConvert() → modules/autoConvert.js に移動済み

// handleKeyDown(), handleEnterKey(), handleTabKey() → modules/keyboard.js に移動済み

// ========== Progress Indicator for Large Operations ==========
function showProgressIndicator(message) {
    let indicator = document.getElementById('paste-progress-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'paste-progress-indicator';
        indicator.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:white;padding:20px 40px;border-radius:8px;font-size:16px;z-index:10000;box-shadow:0 4px 6px rgba(0,0,0,0.3);';
        document.body.appendChild(indicator);
    }
    indicator.textContent = message;
    indicator.style.display = 'block';
}

function hideProgressIndicator() {
    const indicator = document.getElementById('paste-progress-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// pasteTextInChunks() は src/pasteUtils.js に移動済み

// ========== Paste Handling ==========
async function handlePaste(e) {
    // 0. If inside a code block, always paste as plain text
    const sel = window.getSelection();
    if (sel.rangeCount) {
        let node = sel.anchorNode;
        while (node && node !== editor) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                const lines = text.split('\n');
                const lineCount = lines.length;
                
                // Show info for large pastes
                if (lineCount > 100) {
                    console.log(`[大量コード貼り付け] ${lineCount}行のコードを貼り付けています...`);
                }
                
                // Use chunked processing for large pastes
                if (lineCount > 100) {
                    await pasteTextInChunks(lines, node);
                } else {
                    // Small paste: use direct insertion
                    for (let i = 0; i < lines.length; i++) {
                        if (i > 0) {
                            document.execCommand('insertLineBreak');
                        }
                        if (lines[i]) {
                            document.execCommand('insertText', false, lines[i]);
                        }
                    }
                }
                
                markModified();
                debouncedHighlightCodeAtCursor();
                
                if (lineCount > 100) {
                    const skipMsg = lineCount > 500 ? '（500行超えのためハイライトはスキップされます）' : '';
                    console.log(`[大量コード貼り付け] 完了しました。${skipMsg}`);
                }
                return;
            }
            if (node.tagName === 'PRE') {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                const lines = text.split('\n');
                const lineCount = lines.length;
                
                if (lineCount > 100) {
                    console.log(`[大量コード貼り付け] ${lineCount}行のコードを貼り付けています...`);
                }
                
                // Use chunked processing for large pastes
                if (lineCount > 100) {
                    await pasteTextInChunks(lines, node);
                } else {
                    // Small paste: use direct insertion
                    for (let i = 0; i < lines.length; i++) {
                        if (i > 0) {
                            document.execCommand('insertLineBreak');
                        }
                        if (lines[i]) {
                            document.execCommand('insertText', false, lines[i]);
                        }
                    }
                }
                
                markModified();
                debouncedHighlightCodeAtCursor();
                
                if (lineCount > 100) {
                    const skipMsg = lineCount > 500 ? '（500行超えのためハイライトはスキップされます）' : '';
                    console.log(`[大量コード貼り付け] 完了しました。${skipMsg}`);
                }
                return;
            }
            node = node.parentElement;
        }
    }

    // 1. Check for image in clipboard
    const items = e.clipboardData && e.clipboardData.items;
    if (items) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) {
                    pasteImageFile(file);
                }
                return;
            }
        }
    }

    // 2. Check for HTML table (Excel copy)
    const htmlData = e.clipboardData.getData('text/html');
    if (htmlData && /<table[\s>]/i.test(htmlData)) {
        e.preventDefault();
        const table = parseHtmlTable(htmlData);
        if (table) {
            document.execCommand('insertHTML', false, table + '<p><br></p>');
            markModified();
            return;
        }
    }

    // 3. Text paste
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    // 4. Check for tab-delimited text (TSV) → table
    if (isTabDelimited(text)) {
        const table = tsvToHtmlTable(text);
        document.execCommand('insertHTML', false, table + '<p><br></p>');
        markModified();
        return;
    }

    // 5. Check if markdown
    if (looksLikeMarkdown(text)) {
        // Normalize task list items: GFM requires a space after [x]/[ ]
        let normalizedText = text.replace(/^(\s*[-*+]\s+\[[ xX]\])([^\s]|$)/gm, '$1 $2');
        normalizedText = normalizedText.replace(/^(\s*[-*+]\s+\[[ xX]\])\s*$/gm, '$1 \u200B');
        // Prevent indented lone '-' from being interpreted as Setext H2
        normalizedText = normalizedText.replace(/^(\s+)-(\s*)$/gm, '$1- \u200B');
        const html = marked.parse(preprocessNotionMarkdown(normalizedText));
        document.execCommand('insertHTML', false, html);
        editor.querySelectorAll('input[type="checkbox"][disabled]').forEach(cb => {
            cb.removeAttribute('disabled');
        });
    } else {
        // Auto-link plain http(s) URLs when pasting plain text
        const urlRegex = /(https?:\/\/[^\s<>\"]+)/g;
        if (urlRegex.test(text)) {
            // Build HTML by escaping non-link parts and wrapping URLs with <a>
            let lastIndex = 0;
            let html = '';
            text.replace(urlRegex, (match, p1, offset) => {
                html += escapeHtml(text.slice(lastIndex, offset));
                const href = escapeHtml(match);
                html += '<a href="' + href + '">' + escapeHtml(match) + '</a>';
                lastIndex = offset + match.length;
            });
            html += escapeHtml(text.slice(lastIndex));
            // Preserve line breaks
            html = html.replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, html);
        } else {
            document.execCommand('insertText', false, text);
        }
    }
}

// isTabDelimited(), tsvToHtmlTable(), parseHtmlTable() は src/pasteUtils.js に移動済み

// pasteImageFile() は src/modules/imageManager.js に移動済み

// looksLikeMarkdown() は src/pasteUtils.js に移動済み

// applyHeading, insertUnorderedList, insertOrderedList, applyBlockquote, applyInlineCode,
// showModal, insertLink, insertImage, CODE_LANGUAGES, insertCodeBlock, doInsertCodeBlock,
// restoreCodeWrapStates, insertTaskList, insertHorizontalRule
// は src/modules/toolbarActions.js に移動済み

// newFile, openFileFromPath, openFile, resolveRelativeImages, resolveRelativeCsvLinks,
// saveFile, saveAsFile, resolveImagesForSave
// は src/modules/fileManager.js に移動済み

// mimeToExt(), generateImageFileName(), saveImageFile() は src/modules/imageManager.js に移動済み

// exportPDF は src/modules/exportManager.js に移動済み

// ========== Tab Management → tabManager.js に移動済み ==========
// createTab, getActiveTab, switchTab, closeTab, renderTabs, markModified, updateStatusBar
// は tabManager.js で定義

// insertDate, insertTime, insertDateTime
// は src/modules/toolbarActions.js に移動済み
// ========== Utility Functions ==========

function getParentBlock(node) {
    const blockTags = new Set([
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'TD', 'TH'
    ]);
    let current = node;
    while (current && current !== editor) {
        if (current.nodeType === Node.ELEMENT_NODE && blockTags.has(current.tagName)) {
            return current;
        }
        current = current.parentNode;
    }
    return null;
}

// isInsideTableCell() は src/modules/tableManager.js に移動済み

function setCursorTo(element) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false); // collapse to end
    sel.removeAllRanges();
    sel.addRange(range);
}

function setCursorToEnd(element) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

// escapeHtml() は src/utils.js に移動済み（全モジュール共有ユーティリティ）

function updateWordCount() {
    const text = editor.textContent || '';
    const chars = text.replace(/\u200B/g, '').length; // Exclude zero-width spaces
    const lines = text.split('\n').length;
    if (wordCountSpan) {
        wordCountSpan.textContent = chars + ' 文字 | ' + lines + ' 行';
    }
}

// setupTableContextMenu(), showTableContextMenu(), hideTableContextMenu(),
// handleTableAction(), createTableRow() は src/modules/tableManager.js に移動済み

// renderMathBlocks() は src/mathRender.js に移動済み

// renderMermaidBlocks(), showMermaidInsertDialog(), insertMermaidBlock(),
// addMermaidModeButton(), showMermaidModeMenu(), changeMermaidMode(),
// editMermaidBlock(), editMermaidDiagramOnly(), editMermaidCodeAndDiagram()
// は src/mermaidManager.js に移動済み

// unwrapToggle(), ensureToggleContentEditable(), setupToggleBlocks()
// は src/toggleBlock.js に移動済み

// setupTocDeleteButtons(), insertTOC() は src/tocManager.js に移動済み

// ========== Code Block Copy Button ==========
function setupCodeCopyButtons() {
    // Add copy buttons to existing code blocks
    addCopyButtonsToCodeBlocks();
    
    // Add wrap buttons after copy buttons are created
    editor.querySelectorAll('pre').forEach(pre => {
        if (typeof setupCodeWrapButton === 'function') {
            setupCodeWrapButton(pre);
        }
    });

    // Watch for new code blocks being added and update line numbers
    const observer = new MutationObserver(() => {
        addCopyButtonsToCodeBlocks();
        // Add wrap buttons to newly added code blocks
        editor.querySelectorAll('pre').forEach(pre => {
            if (typeof setupCodeWrapButton === 'function') {
                setupCodeWrapButton(pre);
            }
        });
        updateAllLineNumbers();
    });
    observer.observe(editor, { childList: true, subtree: true });
}

function addCopyButtonsToCodeBlocks() {
    editor.querySelectorAll('pre').forEach(pre => {
        // Skip if already has copy buttons
        if (pre.querySelector('.code-copy-container')) return;
        // Also skip if toolbar already exists above pre
        if (pre.previousElementSibling && pre.previousElementSibling.classList.contains('code-block-toolbar')) return;
        // Skip Mermaid containers
        if (pre.closest('.mermaid-container')) return;

        const code = pre.querySelector('code');
        // 言語選択ドロップダウンを作成
        const langSelect = document.createElement('select');
        langSelect.className = 'code-lang-select';
        // CODE_LANGUAGESはグローバル定義
        CODE_LANGUAGES.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            langSelect.appendChild(option);
        });
        // 現在の言語を初期値に
        let currentLang = '';
        if (code && code.className) {
            const m = code.className.match(/language-([\w-]+)/);
            if (m) currentLang = m[1];
        }
        langSelect.value = currentLang;

        // 言語変更時の処理
        langSelect.addEventListener('change', e => {
            if (!code) return;
            // クラスを書き換え
            code.className = langSelect.value ? 'language-' + langSelect.value : '';
            // 再ハイライト
            if (typeof hljs !== 'undefined') {
                isConverting = true;
                try {
                    highlightCodeBlock(code);
                } finally {
                    isConverting = false;
                }
            }
        });

        // ツールバーをpreの上に配置
        const toolbar = document.createElement('div');
        toolbar.className = 'code-block-toolbar';
        toolbar.setAttribute('contenteditable', 'false');
        toolbar.appendChild(langSelect);
        pre.parentNode.insertBefore(toolbar, pre);

        // 既存のコピーボタンUI
        const container = document.createElement('div');
        container.className = 'code-copy-container';
        container.setAttribute('contenteditable', 'false');

        // Helper: get raw code text
        function getRawText() {
            return code ? code.textContent : pre.textContent;
        }

        // Helper: copy text to clipboard with visual feedback
        function copyToClipboard(text, btn, label) {
            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 2000);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 2000);
            });
        }

        // Button 1: Copy (without line numbers)
        const btnCopy = document.createElement('button');
        btnCopy.className = 'code-copy-btn';
        btnCopy.textContent = 'Copy';
        btnCopy.title = 'コードをコピー';
        btnCopy.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
        btnCopy.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            copyToClipboard(getRawText(), btnCopy, 'Copy');
        });

        // Button 2: Copy with line numbers
        const btnNum = document.createElement('button');
        btnNum.className = 'code-copy-btn';
        btnNum.textContent = 'Copy #';
        btnNum.title = '行番号付きでコピー';
        btnNum.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
        btnNum.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const rawText = getRawText();
            const lines = rawText.split('\n');
            if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
            const maxDigits = String(lines.length).length;
            const numberedText = lines.map((line, i) => {
                const num = String(i + 1).padStart(maxDigits, ' ');
                return num + ' | ' + line;
            }).join('\n');
            copyToClipboard(numberedText, btnNum, 'Copy #');
        });

        container.appendChild(btnCopy);
        container.appendChild(btnNum);
        pre.appendChild(container);
    });
}

// setupImageMutationObserver(), handleSingleImage(), setupImageErrorHandling()
// は src/modules/imageManager.js に移動済み

// setupImageResize() は src/modules/imageManager.js に移動済み

// emojiPickerEl, showEmojiPicker
// は src/modules/toolbarActions.js に移動済み

// setupImageViewer(), openImageViewer(), closeImageViewer()
// は src/modules/imageManager.js に移動済み

// ========== Bootstrap ==========
console.log('Script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
} else {
    setTimeout(init, 200);
}
