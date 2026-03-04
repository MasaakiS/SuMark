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

// Turndown instance
let turndownService;

// DOMPurify config: allow Tauri's asset:// protocol for local file display
const DOMPURIFY_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

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

// ========== Turndown Configuration ==========
function configureTurndown() {
    if (typeof TurndownService === 'undefined') {
        console.error('[ERROR] Turndown not loaded - TurndownService is undefined');
        return;
    }

    turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '*',
        strongDelimiter: '**',
        // Use backslash line break instead of trailing spaces (  )
        // Trailing spaces are fragile and can be stripped during file save/reload
        br: '',
    });

    // Load GFM plugin (tables, strikethrough, task lists) FIRST
    const gfmPlugin = (typeof TurndownPluginGfm !== 'undefined') ? TurndownPluginGfm :
                       (typeof turndownPluginGfm !== 'undefined') ? turndownPluginGfm : null;
    if (gfmPlugin && gfmPlugin.gfm) {
        turndownService.use(gfmPlugin.gfm);
        console.log('Turndown GFM plugin loaded');
    }

    // Custom rule: task list items with checkboxes (must be AFTER GFM plugin to override)
    turndownService.addRule('taskListCheckbox', {
        filter: function(node) {
            return node.nodeName === 'LI' &&
                   node.querySelector(':scope > input[type="checkbox"]');
        },
        replacement: function(content, node) {
            const cb = node.querySelector(':scope > input[type="checkbox"]');
            // Check both property and attribute - property for runtime state, attribute for serialized HTML
            const checked = cb && (cb.checked || cb.hasAttribute('checked'));

            // Remove the checkbox marker from content (GFM plugin adds [ ]/[x] as text)
            let text = content.replace(/^\s*\[([ x])\]\s*/, '').trim();
            // GFM requires a space after [x]/[ ] for task list recognition
            // Use zero-width space for empty items (marked ignores trailing whitespace/NBSP)
            if (!text) text = '\u200B';

            // Calculate nesting depth (count ancestor <ul>/<ol> elements inside editor)
            let depth = 0;
            let parent = node.parentElement;
            while (parent && parent.id !== 'editor') {
                if (parent.nodeName === 'UL' || parent.nodeName === 'OL') {
                    depth++;
                }
                parent = parent.parentElement;
            }
            // depth 1 = top-level list, no indent; depth 2 = one level nested, 4-space indent; etc.
            const indent = '    '.repeat(Math.max(0, depth - 1));

            return indent + (checked ? '- [x] ' : '- [ ] ') + text + '\n';
        }
    });

    // Custom rule: always convert <pre><code>...</code></pre> to fenced code blocks
    turndownService.addRule('fencedCodeBlock', {
        filter: function(node) {
            return node.nodeName === 'PRE';
        },
        replacement: function(content, node) {
            const codeEl = node.querySelector('code');
            const codeText = codeEl ? codeEl.textContent : node.textContent || '';
            let lang = '';
            if (codeEl && codeEl.className) {
                const match = codeEl.className.match(/language-([\w-]+)/);
                if (match) lang = match[1];
            }
            const fence = turndownService.options.fence || '```';
            return '\n' + fence + (lang ? lang : '') + '\n' + codeText.replace(/\n$/, '') + '\n' + fence + '\n';
        }
    });

    // Keep <br> in code blocks
    turndownService.addRule('codeBlockBr', {
        filter: function(node) {
            return node.nodeName === 'BR' &&
                   node.parentNode &&
                   (node.parentNode.nodeName === 'CODE' || node.parentNode.nodeName === 'PRE');
        },
        replacement: function() {
            return '\n';
        }
    });

    // Keep <br> in table cells as HTML (Markdown tables don't support native line breaks)
    turndownService.addRule('tableCellBr', {
        filter: function(node) {
            if (node.nodeName !== 'BR') return false;
            // Check if inside a table cell
            let parent = node.parentNode;
            while (parent) {
                if (parent.nodeName === 'TD' || parent.nodeName === 'TH') {
                    return true;
                }
                if (parent.nodeName === 'TABLE') {
                    return false; // Reached table but not inside a cell
                }
                parent = parent.parentNode;
            }
            return false;
        },
        replacement: function() {
            return '<br>';
        }
    });

    // Remove copy buttons from Turndown output
    turndownService.addRule('codeCopyBtn', {
        filter: function(node) {
            return node.classList && (
                node.classList.contains('code-copy-btn') ||
                node.classList.contains('code-copy-container') ||
                node.classList.contains('image-copy-btn')
            );
        },
        replacement: function() {
            return '';
        }
    });

    // Remove line numbers gutter from Turndown output
    turndownService.addRule('lineNumbersGutter', {
        filter: function(node) {
            return node.classList && node.classList.contains('line-numbers-gutter');
        },
        replacement: function() {
            return '';
        }
    });

    // KaTeX inline math
    turndownService.addRule('mathInline', {
        filter: function(node) {
            return node.classList && node.classList.contains('math-inline');
        },
        replacement: function(content, node) {
            // Extract original math from data attribute or text content
            const mathText = node.getAttribute('data-math') || node.textContent.trim();
            return '$' + mathText + '$';
        }
    });

    // KaTeX display math
    turndownService.addRule('mathDisplay', {
        filter: function(node) {
            return node.classList && node.classList.contains('math-display');
        },
        replacement: function(content, node) {
            const mathText = node.getAttribute('data-math') || node.textContent.trim();
            return '\n$$' + mathText + '$$\n';
        }
    });

    // Mermaid blocks: convert rendered SVG back to fenced code block
    turndownService.addRule('mermaidBlock', {
        filter: function(node) {
            return node.classList && node.classList.contains('mermaid-container');
        },
        replacement: function(content, node) {
            const source = node.getAttribute('data-mermaid-source') || '';
            return '\n```mermaid\n' + source + '\n```\n';
        }
    });

    // Mermaid diagram only mode: 図形のみ表示モード
    turndownService.addRule('mermaidDiagramOnly', {
        filter: function(node) {
            return node.classList && node.classList.contains('mermaid-diagram-only');
        },
        replacement: function(content, node) {
            const source = node.getAttribute('data-mermaid-source') || '';
            // 標準的なMarkdown形式で保存
            return '\n```mermaid\n' + source + '\n```\n';
        }
    });

    // Mermaid code and diagram mode: コード＋図形表示モード
    turndownService.addRule('mermaidCodeAndDiagram', {
        filter: function(node) {
            return node.classList && node.classList.contains('mermaid-code-and-diagram');
        },
        replacement: function(content, node) {
            const source = node.getAttribute('data-mermaid-source') || '';
            // 標準的なMarkdown形式で保存
            return '\n```mermaid\n' + source + '\n```\n';
        }
    });

    // Images with custom size: preserve width in HTML output
    turndownService.addRule('imageWithSize', {
        filter: function(node) {
            return node.tagName === 'IMG' && node.style.width;
        },
        replacement: function(content, node) {
            const alt = node.alt || '';
            const src = node.src || '';
            const width = parseInt(node.style.width);
            return '<img src="' + src + '" alt="' + alt + '" width="' + width + '">';
        }
    });

    // Image error containers: convert back to markdown image syntax
    turndownService.addRule('imageErrorContainer', {
        filter: function(node) {
            return node.classList && node.classList.contains('img-error-container');
        },
        replacement: function(content, node) {
            const altTextEl = node.querySelector('.img-error-text');
            const srcTextEl = node.querySelector('.img-error-src');
            const alt = altTextEl ? altTextEl.textContent : '画像を読み込めません';
            let src = '';
            if (srcTextEl) {
                const srcMatch = srcTextEl.textContent.match(/\(画像パス: (.+)\)/);
                if (srcMatch) src = srcMatch[1];
            }
            return '![' + alt + '](' + src + ')';
        }
    });

    // Toggle (details/summary) blocks: preserve as HTML
    turndownService.addRule('detailsBlock', {
        filter: function(node) {
            return node.nodeName === 'DETAILS';
        },
        replacement: function(content, node) {
            const summary = node.querySelector(':scope > summary');
            // Get summary text excluding delete button
            let summaryText = 'トグル';
            if (summary) {
                const clone = summary.cloneNode(true);
                const deleteBtn = clone.querySelector('.toggle-delete-btn');
                if (deleteBtn) deleteBtn.remove();
                summaryText = clone.textContent.trim() || 'トグル';
            }
            // Get toggle-content div or all content after summary
            const contentDiv = node.querySelector(':scope > .toggle-content');
            let innerMd = '';
            if (contentDiv) {
                innerMd = turndownService.turndown(contentDiv.innerHTML).trim();
            } else {
                // Fallback: collect all child nodes except summary
                const tempDiv = document.createElement('div');
                Array.from(node.childNodes).forEach(child => {
                    if (child !== summary) tempDiv.appendChild(child.cloneNode(true));
                });
                innerMd = turndownService.turndown(tempDiv.innerHTML).trim();
            }
            if (!innerMd) innerMd = '内容を入力...';
            return '\n<details>\n<summary>' + summaryText + '</summary>\n\n' + innerMd + '\n\n</details>\n';
        }
    });

    // Remove toggle-content wrapper from turndown (handled by detailsBlock rule)
    turndownService.addRule('toggleContentDiv', {
        filter: function(node) {
            return node.classList && node.classList.contains('toggle-content');
        },
        replacement: function(content) {
            return content;
        }
    });

    // TOC container: convert to markdown TOC
    turndownService.addRule('tocContainer', {
        filter: function(node) {
            return node.classList && node.classList.contains('toc-container');
        },
        replacement: function(content, node) {
            const items = node.querySelectorAll('li');
            let md = '\n**📑 目次**\n\n';
            items.forEach(li => {
                const marginLeft = parseInt(li.style.marginLeft || '0');
                const indent = '  '.repeat(Math.floor(marginLeft / 20));
                const link = li.querySelector('a.toc-link');
                if (link) {
                    const href = link.getAttribute('href') || '';
                    const text = link.textContent.trim();
                    md += indent + '- [' + text + '](' + href + ')\n';
                } else {
                    md += indent + '- ' + li.textContent.trim() + '\n';
                }
            });
            return md + '\n';
        }
    });

    console.log('Turndown configured');
}

// ========== Markdown Conversion ==========
function getMarkdown() {
    if (!turndownService) {
        console.error('Turndown not available');
        return editor.textContent || '';
    }

    // Clone the editor content for conversion
    const clone = editor.cloneNode(true);

    // Sync checkbox checked property to checked attribute
    // When innerHTML is serialized, only attributes are preserved, not properties
    const originalCheckboxes = editor.querySelectorAll('input[type="checkbox"]');
    const clonedCheckboxes = clone.querySelectorAll('input[type="checkbox"]');
    originalCheckboxes.forEach((original, i) => {
        const cloned = clonedCheckboxes[i];
        if (cloned) {
            if (original.checked) {
                cloned.setAttribute('checked', '');
            } else {
                cloned.removeAttribute('checked');
            }
        }
    });

    // Clean up contenteditable empty paragraph placeholders.
    // Browsers insert <br> as caret placeholder in empty blocks;
    // these should not serialize as backslash line breaks (\).
    clone.querySelectorAll('p').forEach(p => {
        if (p.childNodes.length === 1 && p.firstChild.nodeName === 'BR') {
            p.removeChild(p.firstChild);
        }
    });

    let md = turndownService.turndown(clone.innerHTML);

    return md;
}

// ========== Notion Markdown Preprocessor ==========
/**
 * Notion エクスポート形式の Markdown を正規化する。
 *
 * Notion はテーブルセルの複数行コンテンツをリテラル改行で出力するため、
 * 標準の GFM パーサー（marked.js）では正しく解析できない。
 * このプリプロセッサは:
 *   1. テーブル内の複数行セルを <br> で結合して単一行の GFM テーブルに変換
 *   2. セル途中の | を次のセルの開始として解釈
 *   3. Notion 固有の記号を変換:
 *        •        → そのまま保持（Unicode 箇条書き）
 *        —- / ——  → — (区切り線の代替）
 *        []       → ☐ (未チェックチェックボックス)
 *        [x]      → ☑ (チェック済みチェックボックス)
 */
function preprocessNotionMarkdown(md) {
    const lines = md.split('\n');
    const output = [];
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();

        if (trimmed.startsWith('|')) {
            // テーブルブロックを収集（空行まで）
            const block = [];
            while (i < lines.length && lines[i].trim() !== '') {
                block.push(lines[i]);
                i++;
            }
            // セパレータ行があれば Notion 形式のテーブルとして処理
            const hasSep = block.some(l => /^\|[\s\-:|]+\|/.test(l.trim()));
            if (hasSep) {
                output.push(..._normalizeNotionTable(block));
            } else {
                output.push(...block);
            }
        } else {
            output.push(lines[i]);
            i++;
        }
    }

    return output.join('\n');
}

/**
 * Notion 形式の複数行テーブルブロックを、
 * 単一行の GFM テーブル行の配列に変換する。
 *
 * 判定: 先頭に | があり末尾に | がない行を複数行セルの開始とし、
 *       末尾が | の行まで収集して改行を <br> に変換する。
 */
function _normalizeNotionTable(lines) {
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const t = lines[i].trim();

        if (t.startsWith('|') && !t.endsWith('|')) {
            // 先頭に | があるが末尾に | がない → 複数行セルの開始
            // | で終わる行まで収集し、間の改行を全て <br> に変換
            const parts = [t];
            i++;
            while (i < lines.length) {
                const next = lines[i].trim();
                if (next === '') break; // 安全策: 空行で打ち切り
                parts.push(next);
                i++;
                if (next.endsWith('|')) break;
            }
            const joined = parts.join('<br>');
            result.push(joined);
        } else {
            result.push(t);
            i++;
        }
    }

    return result;
}



function setMarkdown(md) {
        console.log('[setMarkdown] called, md.length:', md.length);
    // リセット: グローバル状態をクリア（複数ページロード時のメモリリーク防止）
    resetGlobalState();
    
    if (typeof marked === 'undefined') {
        editor.textContent = md;
        return;
    }

    // Normalize task list items: GFM requires a space after [x]/[ ]
    // e.g. "- [x]" (no space) → "- [x] " (with space)
    md = md.replace(/^(\s*[-*+]\s+\[[ xX]\])([^\s]|$)/gm, '$1 $2');
    // Empty task items (only whitespace/NBSP after [x]) need ZWSP for marked to recognize
    md = md.replace(/^(\s*[-*+]\s+\[[ xX]\])\s*$/gm, '$1 \u200B');

    // Prevent indented lone '-' from being interpreted as Setext H2 heading
    // (e.g. nested list with empty trailing item: "- 3\n    -" → marked sees "3\n-" as H2)
    // Only targets indented lines (top-level Setext headings like "Title\n-" are unaffected)
    md = md.replace(/^(\s+)-(\s*)$/gm, '$1- \u200B');

    // Notion エクスポート形式の複数行テーブルセルを正規化
    const preprocessed = preprocessNotionMarkdown(md);

    const dirtyHtml = marked.parse(preprocessed);

    // Sanitize HTML to prevent XSS attacks while preserving custom UI elements
    const cleanHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(dirtyHtml, {
        ALLOWED_TAGS: [
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'blockquote', 'pre', 'code', 'hr',
            'br', 'strong', 'em', 'del', 's', 'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'details', 'summary',  // toggle support
            'div', 'span', 'input',  // custom elements containers
        ],
        ALLOWED_ATTR: [
            'href', 'title', 'src', 'alt', 'width', 'height',
            'class', 'id', 'style',
            'type', 'checked', 'disabled',
            'open',
            'contenteditable',
            'data-mermaid-source', 'data-math', 'data-wrap',  // custom data attributes
        ],
        ALLOW_DATA_ATTR: true,
        ALLOWED_URI_REGEXP: DOMPURIFY_URI_REGEXP,
    }) : dirtyHtml;
    
    try {
        editor.innerHTML = cleanHtml;
        console.log('[setMarkdown] editor.innerHTML length:', editor.innerHTML.length);
    } catch (e) {
        console.error('[setMarkdown] Exception:', e);
    }

    // Make checkboxes interactive
    editor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.removeAttribute('disabled');
    });

    // Highlight code blocks
    editor.querySelectorAll('pre code').forEach(block => {
        if (typeof hljs !== 'undefined') {
            hljs.highlightElement(block);
        }
    });

    // Render Mermaid diagrams
    renderMermaidBlocks();

    // Render KaTeX math expressions
    renderMathBlocks();

    // Reconstruct TOC containers from parsed markdown, then restore heading IDs and add delete buttons
    reconstructTocContainers();
    restoreTocHeadingIds();
    setupTocDeleteButtons();

    // Add line numbers to code blocks
    updateAllLineNumbers();
    
    // Restore code wrap states
    restoreCodeWrapStates();

    // Setup toggle blocks
    setupToggleBlocks();
    
    // Setup image error handling to display alt text
    // Use setTimeout to ensure DOM is fully updated after innerHTML assignment
    setTimeout(() => {
        setupImageErrorHandling();
    }, 100);
    
    // Log notice if DOMPurify is not available
    if (typeof DOMPurify === 'undefined') {
        console.warn('[WARN] DOMPurify not loaded - XSS protection unavailable');
    }
}

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
    
    // ========== Unified File Drop Handling ==========
    // fileDropEnabled=false in tauri.conf.json → HTML5 Drag & Drop API handles all drops
    // This supports: Finder drops (dataTransfer.files), VSCode Explorer drops (text/uri-list)
    const setupUnifiedDropHandler = () => {
        console.log('[DEBUG] Setting up unified drop handlers (fileDropEnabled=false)...');

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

            console.log('[DEBUG] ===== DROP EVENT =====');
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

    // Helper: process a dropped File object
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
                // Read content directly via File API
                console.log('[DEBUG] Reading file via text()...');
                const text = await file.text();
                console.log('[DEBUG] Loaded', text.length, 'chars from', file.name);
                // Preprocess and create a new tab (same logic as openFileFromPath)
                let processedText = text;
                // Prevent indented lone '-' from being interpreted as Setext H2
                processedText = processedText.replace(/^(\s+)-(\s*)$/gm, '$1- \u200B');
                const processed = preprocessNotionMarkdown(processedText);
                const html = (typeof marked !== 'undefined') ? marked.parse(processed) : processed;
                createTab(null, file.name, html);
            }
        } catch (err) {
            console.error('[ERROR] processDroppedFile:', err);
            showError('ファイルを開けませんでした: ' + file.name);
        }
    }

    setupUnifiedDropHandler();
    
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

// ========== Editor Input Handler ==========
function onEditorInput() {
    console.log('[DEBUG] onEditorInput called');
    if (isConverting) return;
    if (isComposing) return; // Skip during IME composition

    isConverting = true;
    try {
        handleBlockAutoConversion();
        handleInlineAutoConversion();
    } catch (err) {
        console.error('Auto-conversion error:', err);
    }
    isConverting = false;

    updateWordCount();
    markModified();
    
    // Undo履歴粒度: 3文字ごと or Enter押下時
    // IME変換中はカウントしない
    if (!isComposing) {
        // 入力文字数をカウント
        const text = editor.innerText || '';
        // 前回状態との差分を計算（追加文字数のみカウント）
        if (currentState && text.length > currentState.html.replace(/<[^>]+>/g, '').length) {
            inputCharCount += text.length - currentState.html.replace(/<[^>]+>/g, '').length;
        } else {
            inputCharCount = 1;
        }
        if (inputCharCount >= 3) {
            saveEditorState();
            inputCharCount = 0;
        }
    }
    // 3文字未満のときは従来通りデバウンスで積む（保険）
    debouncedSaveEditorState();

    // Re-highlight code block if cursor is inside one
    debouncedHighlightCodeAtCursor();

    // Update line numbers for code block at cursor
    const sel2 = window.getSelection();
    if (sel2.rangeCount) {
        let n = sel2.anchorNode;
        while (n && n !== editor) {
            if (n.tagName === 'PRE') { updateLineNumbers(n); break; }
            if (n.tagName === 'CODE' && n.parentElement && n.parentElement.tagName === 'PRE') {
                updateLineNumbers(n.parentElement); break;
            }
            n = n.parentElement;
        }
    }
}

// ========== Block-Level Auto-Conversion ==========
// Converts markdown syntax typed at the start of a block.
// Two modes:
//   1. Prefix-only (trigger on Space after prefix):
//      "# " → H1 (empty), "- " → UL, "1. " → OL, "> " → blockquote
//   2. Prefix + content:
//      "# ああああ" → H1 with text "ああああ"
//      "- テキスト" → UL with item, "1. テキスト" → OL with item
//      "> テキスト" → blockquote with text
//      "- [ ] テキスト" → task list with text
//   3. Exact match: "---" → HR
function handleBlockAutoConversion() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) {
        console.log('[DEBUG] handleBlockAutoConversion: no selection or not collapsed');
        return;
    }

    const range = sel.getRangeAt(0);
    const block = getParentBlock(range.startContainer);
    if (!block || block === editor) {
        console.log('[DEBUG] handleBlockAutoConversion: no valid block found');
        return;
    }

    // Only convert in P or DIV blocks (not already formatted)
    const tag = block.tagName;
    if (tag !== 'P' && tag !== 'DIV') {
        console.log('[DEBUG] handleBlockAutoConversion: not P or DIV, tag=', tag);
        return;
    }
    
    // Prevent list auto-conversion inside table cells
    if (isInsideTableCell(range.startContainer)) {
        console.log('[DEBUG] handleBlockAutoConversion: inside table cell, skipping list conversions');
        // Allow only non-list conversions (headings, blockquotes, HR) - skip list patterns
        let text = block.textContent;
        // Normalize text
        text = text.replace(/\u00A0/g, ' ');
        text = text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        text = text.replace(/　/g, ' ');
        text = text.replace(/．/g, '.');
        text = text.replace(/[ー－―−]/g, '-');
        text = text.replace(/＃/g, '#');
        text = text.replace(/＞/g, '>');
        text = text.replace(/＊/g, '*');
        text = text.replace(/［/g, '[').replace(/］/g, ']');
        
        // Only allow heading conversion in table cells
        const headingMatch = text.match(/^(#{1,6}) (.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            const heading = document.createElement('h' + level);
            heading.textContent = content;
            block.parentNode.replaceChild(heading, block);
            setCursorToEnd(heading);
        }
        return;
    }

    let text = block.textContent;
    console.log('[DEBUG] handleBlockAutoConversion: text="' + text + '"');

    // Normalize full-width characters to half-width for matching
    const originalText = text;
    // Non-breaking space (U+00A0) → normal space
    text = text.replace(/\u00A0/g, ' ');
    // Full-width numbers → half-width
    text = text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    // Full-width space → half-width
    text = text.replace(/　/g, ' ');
    // Full-width period → half-width
    text = text.replace(/．/g, '.');
    // Full-width hyphen/minus variants → half-width
    text = text.replace(/[ー－―−]/g, '-');
    // Full-width # → half-width
    text = text.replace(/＃/g, '#');
    // Full-width > → half-width
    text = text.replace(/＞/g, '>');
    // Full-width * → half-width
    text = text.replace(/＊/g, '*');
    // Full-width [ ] → half-width
    text = text.replace(/［/g, '[').replace(/］/g, ']');

    // If text was normalized, update the block content
    if (text !== originalText) {
        console.log('[DEBUG] Text normalized from "' + originalText + '" to "' + text + '"');
        // Save caret offset
        const caretOffset = getCaretCharacterOffsetWithin(block);
        block.textContent = text;
        // Restore caret
        setCaretCharacterOffset(block, caretOffset);
    }

    // Heading: "# text" or "## text" etc.
    const headingMatch = text.match(/^(#{1,6}) (.+)$/);
    if (headingMatch) {
        console.log('[DEBUG] Heading match found:', headingMatch);
        const level = headingMatch[1].length;
        const content = headingMatch[2];
        const heading = document.createElement('h' + level);
        heading.textContent = content;
        block.parentNode.replaceChild(heading, block);
        setCursorToEnd(heading);
        return;
    }
    // Heading prefix only: "# "
    const headingPrefixMatch = text.match(/^(#{1,6}) $/);
    if (headingPrefixMatch) {
        console.log('[DEBUG] Heading prefix match found:', headingPrefixMatch);
        const level = headingPrefixMatch[1].length;
        const heading = document.createElement('h' + level);
        heading.innerHTML = '<br>';
        block.parentNode.replaceChild(heading, block);
        setCursorTo(heading);
        return;
    }

    // Task list (short form): "[] text" or "[x] text"
    const taskShortMatch = text.match(/^\[([ x]?)\] (.+)$/);
    if (taskShortMatch) {
        const checked = taskShortMatch[1] === 'x';
        const content = taskShortMatch[2];
        const ul = document.createElement('ul');
        ul.className = 'contains-task-list';
        const li = document.createElement('li');
        li.className = 'task-list-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        li.appendChild(cb);
        const textNode = document.createTextNode(' ' + content);
        li.appendChild(textNode);
        ul.appendChild(li);
        block.parentNode.replaceChild(ul, block);
        { const r = document.createRange(); r.setStart(textNode, textNode.length); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        return;
    }
    // Task list prefix only (short form): "[] " or "[x] "
    if (text === '[] ' || text === '[ ] ' || text === '[x] ') {
        const checked = text.startsWith('[x]');
        const ul = document.createElement('ul');
        ul.className = 'contains-task-list';
        const li = document.createElement('li');
        li.className = 'task-list-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        li.appendChild(cb);
        const textNode = document.createTextNode(' ');
        li.appendChild(textNode);
        ul.appendChild(li);
        block.parentNode.replaceChild(ul, block);
        { const r = document.createRange(); r.setStart(textNode, textNode.length); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        return;
    }

    // Unordered list with content: "- text" or "* text"
    const ulContentMatch = text.match(/^[-*] (.+)$/);
    if (ulContentMatch && !text.startsWith('- [')) {
        const content = ulContentMatch[1];
        // Check if inside toggle-content — use DOM manipulation instead of execCommand
        const toggleContent = block.closest('.toggle-content');
        if (toggleContent) {
            const ul = document.createElement('ul');
            const li = document.createElement('li');
            li.textContent = content;
            ul.appendChild(li);
            block.parentNode.replaceChild(ul, block);
            setCursorToEnd(li);
            return;
        }
        block.textContent = content;
        document.execCommand('formatBlock', false, 'p');
        // Select all text in the block, then apply list
        const newSel = window.getSelection();
        const newRange = document.createRange();
        newRange.selectNodeContents(block);
        newRange.collapse(false);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
        document.execCommand('insertUnorderedList');
        return;
    }
    // Unordered list prefix only: "- " or "* "
    if (text === '- ' || text === '* ') {
        const toggleContent = block.closest('.toggle-content');
        if (toggleContent) {
            const ul = document.createElement('ul');
            const li = document.createElement('li');
            li.innerHTML = '<br>';
            ul.appendChild(li);
            block.parentNode.replaceChild(ul, block);
            setCursorTo(li);
            return;
        }
        block.textContent = '';
        block.innerHTML = '<br>';
        document.execCommand('formatBlock', false, 'p');
        document.execCommand('insertUnorderedList');
        return;
    }

    // Ordered list with content: "1. text"
    const olContentMatch = text.match(/^\d+\. (.+)$/);
    if (olContentMatch) {
        const content = olContentMatch[1];
        const toggleContent = block.closest('.toggle-content');
        if (toggleContent) {
            const ol = document.createElement('ol');
            const li = document.createElement('li');
            li.textContent = content;
            ol.appendChild(li);
            block.parentNode.replaceChild(ol, block);
            setCursorToEnd(li);
            return;
        }
        block.textContent = content;
        document.execCommand('formatBlock', false, 'p');
        const newSel = window.getSelection();
        const newRange = document.createRange();
        newRange.selectNodeContents(block);
        newRange.collapse(false);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
        document.execCommand('insertOrderedList');
        return;
    }
    // Ordered list prefix only: "1. "
    if (/^\d+\. $/.test(text)) {
        const toggleContent = block.closest('.toggle-content');
        if (toggleContent) {
            const ol = document.createElement('ol');
            const li = document.createElement('li');
            li.innerHTML = '<br>';
            ol.appendChild(li);
            block.parentNode.replaceChild(ol, block);
            setCursorTo(li);
            return;
        }
        block.textContent = '';
        block.innerHTML = '<br>';
        document.execCommand('formatBlock', false, 'p');
        document.execCommand('insertOrderedList');
        return;
    }

    // Toggle with content: ">>> text"
    const toggleContentMatch = text.match(/^>>> (.+)$/);
    if (toggleContentMatch) {
        const content = toggleContentMatch[1];
        const details = document.createElement('details');
        details.setAttribute('open', '');
        const summary = document.createElement('summary');
        summary.textContent = content;
        summary.setAttribute('contenteditable', 'true');
        const contentDiv = document.createElement('div');
        contentDiv.className = 'toggle-content';
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        contentDiv.appendChild(p);
        details.appendChild(summary);
        details.appendChild(contentDiv);
        block.parentNode.replaceChild(details, block);
        const afterP = document.createElement('p');
        afterP.innerHTML = '<br>';
        details.parentNode.insertBefore(afterP, details.nextSibling);
        setCursorTo(p);
        return;
    }
    // Toggle prefix only: ">>> "
    if (text === '>>> ') {
        const details = document.createElement('details');
        details.setAttribute('open', '');
        const summary = document.createElement('summary');
        summary.textContent = 'トグル';
        summary.setAttribute('contenteditable', 'true');
        const contentDiv = document.createElement('div');
        contentDiv.className = 'toggle-content';
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        contentDiv.appendChild(p);
        details.appendChild(summary);
        details.appendChild(contentDiv);
        block.parentNode.replaceChild(details, block);
        const afterP = document.createElement('p');
        afterP.innerHTML = '<br>';
        details.parentNode.insertBefore(afterP, details.nextSibling);
        // Select summary text for editing
        const r = document.createRange();
        r.selectNodeContents(summary);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(r);
        return;
    }

    // Blockquote with content: "> text"
    const bqContentMatch = text.match(/^> (.+)$/);
    if (bqContentMatch) {
        const content = bqContentMatch[1];
        const bq = document.createElement('blockquote');
        const p = document.createElement('p');
        p.textContent = content;
        bq.appendChild(p);
        block.parentNode.replaceChild(bq, block);
        setCursorToEnd(p);
        return;
    }
    // Blockquote prefix only: "> "
    if (text === '> ') {
        const bq = document.createElement('blockquote');
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        bq.appendChild(p);
        block.parentNode.replaceChild(bq, block);
        setCursorTo(p);
        return;
    }

    // Horizontal rule: ---
    if (text === '---' || text === '***' || text === '___') {
        const hr = document.createElement('hr');
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.parentNode.replaceChild(hr, block);
        hr.parentNode.insertBefore(p, hr.nextSibling);
        setCursorTo(p);
        return;
    }
}

// ========== Inline Auto-Conversion ==========
// Converts inline markdown patterns:
//   **text** → bold,  *text* → italic
//   `code`   → code,  ~~text~~ → strikethrough
function handleInlineAutoConversion() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent;
    const pos = range.startOffset;
    const before = text.substring(0, pos);

    // Bold: **text**
    const boldMatch = before.match(/\*\*(.+?)\*\*$/);
    if (boldMatch) {
        applyInlineAutoConvert(textNode, boldMatch, 'strong', pos);
        return;
    }

    // Strikethrough: ~~text~~
    const strikeMatch = before.match(/~~(.+?)~~$/);
    if (strikeMatch) {
        applyInlineAutoConvert(textNode, strikeMatch, 'del', pos);
        return;
    }

    // Inline code: `text`
    const codeMatch = before.match(/`([^`]+)`$/);
    if (codeMatch) {
        applyInlineAutoConvert(textNode, codeMatch, 'code', pos);
        return;
    }

    // Italic: *text* (not preceded by *)
    const italicMatch = before.match(/(?<!\*)\*([^*]+?)\*$/);
    if (italicMatch && !before.endsWith('**')) {
        applyInlineAutoConvert(textNode, italicMatch, 'em', pos);
        return;
    }

    // URL auto-detection: http(s)://... followed by whitespace
    const urlMatch = before.match(/(https?:\/\/[^\s<>\"]+)\s$/);
    if (urlMatch) {
        const url = urlMatch[1];
        const urlStart = before.lastIndexOf(url);
        // Don't convert if already inside an <a> tag
        let isInLink = false;
        let n = textNode.parentNode;
        while (n && n !== editor) {
            if (n.tagName === 'A') { isInLink = true; break; }
            n = n.parentNode;
        }
        if (!isInLink) {
            const beforeUrl = textNode.textContent.substring(0, urlStart);
            const afterUrl = textNode.textContent.substring(pos);
            const parent = textNode.parentNode;

            const frag = document.createDocumentFragment();
            if (beforeUrl) frag.appendChild(document.createTextNode(beforeUrl));
            const a = document.createElement('a');
            a.href = url;
            a.textContent = url;
            frag.appendChild(a);
            const cursorText = document.createTextNode(' ' + afterUrl);
            frag.appendChild(cursorText);
            parent.replaceChild(frag, textNode);

            const newSel = window.getSelection();
            const newRange = document.createRange();
            newRange.setStart(cursorText, 1);
            newRange.collapse(true);
            newSel.removeAllRanges();
            newSel.addRange(newRange);
            return;
        }
    }

    // Emoji: :emoji_name:
    const emojiMatch = before.match(/:([a-z0-9_+-]+):$/);
    if (emojiMatch) {
        const name = emojiMatch[1];
        const emoji = EMOJI_MAP[name];
        if (emoji) {
            const fullMatch = emojiMatch[0];
            const startIdx = pos - fullMatch.length;
            const beforeText = textNode.textContent.substring(0, startIdx);
            const afterText = textNode.textContent.substring(pos);
            const parent = textNode.parentNode;

            const frag = document.createDocumentFragment();
            if (beforeText) frag.appendChild(document.createTextNode(beforeText));
            frag.appendChild(document.createTextNode(emoji));
            const cursorText = document.createTextNode('\u200B' + afterText);
            frag.appendChild(cursorText);
            parent.replaceChild(frag, textNode);

            const newSel = window.getSelection();
            const newRange = document.createRange();
            newRange.setStart(cursorText, 1);
            newRange.collapse(true);
            newSel.removeAllRanges();
            newSel.addRange(newRange);
            return;
        }
    }

    // Display math: $$...$$ (must match before inline math to avoid conflict)
    // Use negative lookahead/lookbehind to avoid matching inline math
    const displayMathMatch = before.match(/\$\$([^$]+?)\$\$$/);
    if (displayMathMatch && window.katex) {
        const math = displayMathMatch[1];
        const fullMatch = displayMathMatch[0];
        const startIdx = pos - fullMatch.length;
        
        // Safety check: make sure we actually matched $$...$$, not $...$
        if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
            const beforeText = textNode.textContent.substring(0, startIdx);
            const afterText = textNode.textContent.substring(pos);
            const parent = textNode.parentNode;

            const frag = document.createDocumentFragment();
            if (beforeText) frag.appendChild(document.createTextNode(beforeText));
            const div = document.createElement('div');
            div.className = 'math-display';
            div.setAttribute('data-math', math);
            div.setAttribute('contenteditable', 'false');
            try {
                div.innerHTML = katex.renderToString(math, {displayMode: true, throwOnError: false});
            } catch (err) {
                div.textContent = '$$' + math + '$$';
            }
            frag.appendChild(div);
            const cursorText = document.createTextNode('\u200B' + afterText);
            frag.appendChild(cursorText);
            parent.replaceChild(frag, textNode);

            const newSel = window.getSelection();
            const newRange = document.createRange();
            newRange.setStart(cursorText, 1);
            newRange.collapse(true);
            newSel.removeAllRanges();
            newSel.addRange(newRange);
            return;
        }
    }

    // Inline math: $...$ (but not preceded by $ to avoid conflict with $$)
    const inlineMathMatch = before.match(/\$([^$]+?)\$$/);
    if (inlineMathMatch && window.katex) {
        const math = inlineMathMatch[1];
        const fullMatch = inlineMathMatch[0];
        const startIdx = pos - fullMatch.length;
        
        // Check if there's a $ just before this match (would be part of $$)
        if (startIdx > 0 && textNode.textContent[startIdx - 1] === '$') {
            return; // Skip - likely part of $$...$$
        }
        
        const beforeText = textNode.textContent.substring(0, startIdx);
        const afterText = textNode.textContent.substring(pos);
        const parent = textNode.parentNode;

        const frag = document.createDocumentFragment();
        if (beforeText) frag.appendChild(document.createTextNode(beforeText));
        const span = document.createElement('span');
        span.className = 'math-inline';
        span.setAttribute('data-math', math);
        span.setAttribute('contenteditable', 'false');
        try {
            span.innerHTML = katex.renderToString(math, {displayMode: false, throwOnError: false});
        } catch (err) {
            span.textContent = '$' + math + '$';
        }
        frag.appendChild(span);
        const cursorText = document.createTextNode('\u200B' + afterText);
        frag.appendChild(cursorText);
        parent.replaceChild(frag, textNode);

        const newSel = window.getSelection();
        const newRange = document.createRange();
        newRange.setStart(cursorText, 1);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
        return;
    }
}

function applyInlineAutoConvert(textNode, match, tag, cursorPos) {
    const fullMatch = match[0];
    const innerText = match[1];
    const startIdx = cursorPos - fullMatch.length;

    const beforeText = textNode.textContent.substring(0, startIdx);
    const afterText = textNode.textContent.substring(cursorPos);
    const parent = textNode.parentNode;

    // Build new nodes
    const frag = document.createDocumentFragment();
    if (beforeText) {
        frag.appendChild(document.createTextNode(beforeText));
    }

    const elem = document.createElement(tag);
    elem.textContent = innerText;
    frag.appendChild(elem);

    // Zero-width space + remaining text for cursor positioning
    const cursorText = document.createTextNode('\u200B' + afterText);
    frag.appendChild(cursorText);

    parent.replaceChild(frag, textNode);

    // Position cursor after the formatted element
    const newSel = window.getSelection();
    const newRange = document.createRange();
    newRange.setStart(cursorText, 1); // After zero-width space
    newRange.collapse(true);
    newSel.removeAllRanges();
    newSel.addRange(newRange);
}

// ========== Keyboard Shortcuts ==========
function handleKeyDown(e) {
        // エンター押下時は即座に履歴を積む
        if (e.key === 'Enter' && !isComposing) {
            saveEditorState();
            inputCharCount = 0;
        }
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    
    // Cmd/Ctrl+Z: Undo
    if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
    }
    
    // Cmd/Ctrl+Shift+Z: Redo
    if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
        return;
    }
    
    // Cmd/Ctrl+Y: Redo (alternative shortcut)
    if (mod && e.key === 'y') {
        e.preventDefault();
        performRedo();
        return;
    }

    // Cmd/Ctrl+P: PDF export
    if (mod && e.key === 'p') {
        e.preventDefault();
        exportPDF();
        return;
    }

    // Backspace/Delete: handle non-editable elements (TOC, Mermaid, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete') {
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);

            // Case 1: Selection spans across a non-editable element
            if (!range.collapsed) {
                const selected = range.commonAncestorContainer;
                const nonEditable = selected.nodeType === 1
                    ? selected.closest('[contenteditable="false"]')
                    : selected.parentElement && selected.parentElement.closest('[contenteditable="false"]');
                if (nonEditable && nonEditable !== editor) {
                    e.preventDefault();
                    nonEditable.remove();
                    markModified();
                    return;
                }
            }

            // Case 2: Cursor is at the boundary of a non-editable element
            if (range.collapsed) {
                const node = range.startContainer;
                const offset = range.startOffset;
                let target = null;

                if (e.key === 'Backspace') {
                    // Check previous sibling or previous node
                    if (node.nodeType === 1 && offset > 0) {
                        const prev = node.childNodes[offset - 1];
                        if (prev && prev.nodeType === 1 && prev.getAttribute('contenteditable') === 'false') {
                            target = prev;
                        }
                    } else if (node.nodeType === 3 && offset === 0) {
                        // At start of text node, check previous sibling of parent block
                        const block = getParentBlock(node);
                        if (block && block.previousElementSibling &&
                            block.previousElementSibling.getAttribute('contenteditable') === 'false') {
                            target = block.previousElementSibling;
                        }
                    }
                } else { // Delete
                    if (node.nodeType === 1 && offset < node.childNodes.length) {
                        const next = node.childNodes[offset];
                        if (next && next.nodeType === 1 && next.getAttribute('contenteditable') === 'false') {
                            target = next;
                        }
                    } else if (node.nodeType === 3 && offset === node.textContent.length) {
                        const block = getParentBlock(node);
                        if (block && block.nextElementSibling &&
                            block.nextElementSibling.getAttribute('contenteditable') === 'false') {
                            target = block.nextElementSibling;
                        }
                    }
                }

                if (target) {
                    e.preventDefault();
                    target.remove();
                    markModified();
                    return;
                }
            }
        }
    }

    // Enter key: special handling
    if (e.key === 'Enter') {
        handleEnterKey(e);
        return;
    }

    // Tab key
    if (e.key === 'Tab') {
        handleTabKey(e);
        return;
    }

    // Ctrl/Cmd+; → 日付, Ctrl/Cmd+Shift+; (Ctrl/Cmd+:) → 時刻
    if ((e.ctrlKey || e.metaKey) && e.key === ';') {
        e.preventDefault();
        insertDate();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ':') {
        e.preventDefault();
        insertTime();
        return;
    }

    // Cmd/Ctrl+W → close tab
    if (mod && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeTab(activeTabId);
        return;
    }

    // Cmd/Ctrl+Tab: 次のタブへ移動 / Cmd/Ctrl+Shift+Tab: 前のタブへ移動
    if (mod && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1) {
            const currentIndex = tabs.findIndex(t => t.id === activeTabId);
            if (e.shiftKey) {
                const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                switchTab(tabs[prevIndex].id);
            } else {
                const nextIndex = (currentIndex + 1) % tabs.length;
                switchTab(tabs[nextIndex].id);
            }
        }
        return;
    }

    // Modifier shortcuts (Cmd on Mac, Ctrl on Windows)
    if (mod) {
        switch (e.key.toLowerCase()) {
            case 'n':
                e.preventDefault();
                newFile();
                break;
            case 'o':
                e.preventDefault();
                openFile();
                break;
            case 's':
                e.preventDefault();
                if (e.shiftKey) {
                    saveAsFile();
                } else {
                    saveFile();
                }
                break;
            case 'b':
                e.preventDefault();
                document.execCommand('bold');
                break;
            case 'i':
                e.preventDefault();
                document.execCommand('italic');
                break;
            case 'k':
                e.preventDefault();
                insertLink();
                break;
            case 'e':
                e.preventDefault();
                applyInlineCode();
                break;
            case 'x':
                if (e.shiftKey) {
                    e.preventDefault();
                    document.execCommand('strikethrough');
                }
                break;
            // Cmd+Z / Cmd+Shift+Z (undo/redo) are handled natively
        }
    }
}

// ========== Enter Key Handling ==========
function handleEnterKey(e) {
    // Skip Enter handling during IME composition (Japanese input, etc.)
    // The Enter key during composition is for confirming the conversion, not for creating new lines
    if (isComposing) {
        return; // Let the default IME behavior handle it
    }
    
    // Shift+Enter: Insert soft line break (space space + newline for Markdown)
    if (e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        const range = sel.getRangeAt(0);
        
        // Insert two spaces followed by a line break
        // This creates a <br> in Markdown when rendered
        const textNode = document.createTextNode('  ');
        range.insertNode(textNode);
        
        // Move cursor after the spaces
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Insert line break
        document.execCommand('insertLineBreak');
        
        markModified();
        saveEditorState();
        return;
    }
    
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    // ---- Details/Summary: handle BEFORE getParentBlock (summary is not a block tag) ----
    let detailsAncestor = range.startContainer;
    while (detailsAncestor && detailsAncestor !== editor) {
        if (detailsAncestor.nodeType === 1 && detailsAncestor.tagName === 'DETAILS') break;
        detailsAncestor = detailsAncestor.parentNode;
    }
    if (detailsAncestor && detailsAncestor.tagName === 'DETAILS' && detailsAncestor !== editor) {
        const detailsEl = detailsAncestor;
        const summaryEl = detailsEl.querySelector(':scope > summary');

        // Case 1: Cursor is in summary → move to toggle content
        if (summaryEl && summaryEl.contains(range.startContainer)) {
            e.preventDefault();
            let contentDiv = detailsEl.querySelector(':scope > .toggle-content');
            if (!contentDiv) {
                contentDiv = document.createElement('div');
                contentDiv.className = 'toggle-content';
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
                detailsEl.appendChild(contentDiv);
            }
            const firstP = contentDiv.querySelector('p') || contentDiv.firstElementChild;
            if (firstP) {
                setCursorTo(firstP);
            } else {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
                setCursorTo(p);
            }
            return;
        }

        // Case 2: Cursor is in toggle content
        const toggleContent = detailsEl.querySelector(':scope > .toggle-content');
        if (toggleContent && toggleContent.contains(range.startContainer)) {
            const currentBlock = getParentBlock(range.startContainer);

            // If inside a list within toggle, check if at very start of first item
            // to allow inserting elements before the list
            if (currentBlock && (currentBlock.tagName === 'LI')) {
                const parentList = currentBlock.closest('ul, ol');
                if (parentList && toggleContent.firstElementChild === parentList) {
                    // Check if this is the first LI and cursor is at the very start
                    const firstLi = parentList.querySelector('li');
                    if (firstLi === currentBlock) {
                        const testRange = document.createRange();
                        testRange.selectNodeContents(currentBlock);
                        testRange.setEnd(range.startContainer, range.startOffset);
                        const isAtStart = testRange.toString().length === 0;
                        if (isAtStart && currentBlock.textContent.trim() !== '') {
                            e.preventDefault();
                            const newP = document.createElement('p');
                            newP.innerHTML = '<br>';
                            toggleContent.insertBefore(newP, parentList);
                            setCursorTo(newP);
                            return;
                        }
                    }
                }
                // fall through to normal list Enter handling
            } else if (currentBlock && (currentBlock.tagName === 'TD' || currentBlock.tagName === 'TH')) {
                // fall through to normal table Enter handling
            } else {
                // Check if cursor is at the very start of the first element
                if (currentBlock && toggleContent.firstElementChild === currentBlock) {
                    const testRange = document.createRange();
                    testRange.selectNodeContents(currentBlock);
                    testRange.setEnd(range.startContainer, range.startOffset);
                    const isAtStart = testRange.toString().length === 0;
                    if (isAtStart && currentBlock.textContent.trim() !== '') {
                        e.preventDefault();
                        const newP = document.createElement('p');
                        newP.innerHTML = '<br>';
                        toggleContent.insertBefore(newP, currentBlock);
                        setCursorTo(newP);
                        return;
                    }
                }

                // Empty line at end: exit toggle
                if (currentBlock && currentBlock.textContent.trim() === '') {
                    const children = Array.from(toggleContent.children);
                    const idx = children.indexOf(currentBlock);
                    const isLast = idx === children.length - 1;
                    if (isLast && children.length > 1) {
                        e.preventDefault();
                        currentBlock.remove();
                        let afterEl = detailsEl.nextElementSibling;
                        if (!afterEl || afterEl.tagName !== 'P') {
                            afterEl = document.createElement('p');
                            afterEl.innerHTML = '<br>';
                            detailsEl.parentNode.insertBefore(afterEl, detailsEl.nextSibling);
                        }
                        setCursorTo(afterEl);
                        return;
                    }
                }

                // Normal Enter in toggle content: split text and create new paragraph
                if (currentBlock) {
                    e.preventDefault();
                    const afterRange = document.createRange();
                    afterRange.setStart(range.startContainer, range.startOffset);
                    afterRange.setEndAfter(currentBlock.lastChild || currentBlock);
                    const afterFrag = afterRange.extractContents();

                    const newP = document.createElement('p');
                    if (afterFrag.textContent.trim() || afterFrag.querySelector('*')) {
                        newP.appendChild(afterFrag);
                    } else {
                        newP.innerHTML = '<br>';
                    }

                    // Clean up current block if empty
                    if (!currentBlock.textContent.trim() && !currentBlock.querySelector('br')) {
                        currentBlock.innerHTML = '<br>';
                    }

                    // Insert new paragraph after current block within toggle-content
                    if (currentBlock.nextSibling) {
                        toggleContent.insertBefore(newP, currentBlock.nextSibling);
                    } else {
                        toggleContent.appendChild(newP);
                    }
                    setCursorTo(newP);
                    return;
                } else {
                    // No block found (text directly in toggle-content)
                    e.preventDefault();
                    const newP = document.createElement('p');
                    newP.innerHTML = '<br>';
                    toggleContent.appendChild(newP);
                    setCursorTo(newP);
                    return;
                }
            }
        }
    }

    const block = getParentBlock(range.startContainer);
    if (!block) return;

    const tag = block.tagName;

    // In heading: create paragraph, not another heading
    if (/^H[1-6]$/.test(tag)) {
        e.preventDefault();

        // Check if the heading is empty (convert to paragraph)
        const headingText = block.textContent.trim();
        if (headingText === '') {
            // Convert empty heading to paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            block.parentNode.insertBefore(p, block);
            block.remove();
            setCursorTo(p);
            return;
        }

        // Check if cursor is at the very beginning of the heading
        const isAtStart = (function() {
            if (!range.collapsed) return false;
            const testRange = document.createRange();
            testRange.selectNodeContents(block);
            testRange.setEnd(range.startContainer, range.startOffset);
            return testRange.toString().length === 0;
        })();

        const p = document.createElement('p');
        p.innerHTML = '<br>';

        if (isAtStart) {
            // Insert empty paragraph BEFORE heading (to push heading down)
            block.parentNode.insertBefore(p, block);
            // Keep cursor in the heading
            setCursorTo(block);
        } else {
            // Insert paragraph after heading
            block.parentNode.insertBefore(p, block.nextSibling);
            setCursorTo(p);
        }
        return;
    }

    // In code block (<pre> or <code> inside <pre>): insert line break
    // If cursor is on an empty line at the end, exit the code block
    if (tag === 'PRE' || (tag === 'CODE' && block.parentNode && block.parentNode.tagName === 'PRE')) {
        const codeEl = tag === 'CODE' ? block : block.querySelector('code');
        const preEl = tag === 'PRE' ? block : block.parentNode;
        const targetEl = codeEl || preEl;

        // Check if cursor is on an empty trailing line
        if (isOnEmptyTrailingLine(targetEl, range)) {
            e.preventDefault();
            // Remove trailing empty content (<br> elements and trailing \n)
            removeTrailingEmptyLines(targetEl);
            // Preserve language class if it was cleared
            if (codeEl && codeEl !== targetEl) {
                // codeEl is the <code> element, class should be preserved
            }
            // Create paragraph after code block
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            preEl.parentNode.insertBefore(p, preEl.nextSibling);
            setCursorTo(p);
            // Re-highlight the code block
            if (codeEl && typeof hljs !== 'undefined' && !codeEl.classList.contains('language-mermaid')) {
                highlightCodeBlock(codeEl);
            }
            // Render Mermaid blocks if this was a mermaid code block
            if (codeEl && codeEl.classList.contains('language-mermaid')) {
                renderMermaidBlocks();
            }
            return;
        }
        e.preventDefault();
        document.execCommand('insertLineBreak');
        // Update line numbers after new line
        if (preEl) updateLineNumbers(preEl);
        return;
    }

    // In list item: if empty, outdent one level per Enter, finally exit list
    if (tag === 'LI') {
        const text = block.textContent.trim();
        const hasCheckbox = block.querySelector('input[type="checkbox"]');
        const effectiveText = hasCheckbox ? text.replace(/^\s*/, '') : text;

        if (effectiveText === '' || (hasCheckbox && block.textContent.replace(/\s/g, '') === '')) {
            e.preventDefault();
            const list = block.parentNode;
            const parentLi = list.closest('li');
            if (parentLi) {
                // 親liの直後に空liを移動（アウトデント）
                parentLi.parentNode.insertBefore(block, parentLi.nextSibling);
                setCursorTo(block);
                return;
            } else {
                // 最上位リストならli→p変換
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                list.parentNode.insertBefore(p, list.nextSibling);
                block.remove();
                if (list.children.length === 0) list.remove();
                setCursorTo(p);
                return;
            }
        }

        // Task list: create a new task list item with checkbox on Enter
        if (hasCheckbox) {
            e.preventDefault();

            // Split text at cursor position
            const sel2 = window.getSelection();
            const r = sel2.getRangeAt(0);

            // Get the text content after the cursor
            const afterRange = document.createRange();
            afterRange.setStart(r.startContainer, r.startOffset);
            afterRange.setEndAfter(block.lastChild);
            const afterFrag = afterRange.extractContents();

            // Clean up: remove trailing whitespace from current item
            // Remove extracted content's leading whitespace
            const afterText = afterFrag.textContent;

            // Create new LI with checkbox
            const newLi = document.createElement('li');
            newLi.className = 'task-list-item';
            const newCb = document.createElement('input');
            newCb.type = 'checkbox';
            newCb.checked = false;
            newLi.appendChild(newCb);

            if (afterText.trim()) {
                newLi.appendChild(document.createTextNode(' ' + afterText.trim()));
            } else {
                newLi.appendChild(document.createTextNode(' '));
            }

            // Insert after current LI
            const parentList = block.parentNode;
            if (block.nextSibling) {
                parentList.insertBefore(newLi, block.nextSibling);
            } else {
                parentList.appendChild(newLi);
            }

            // Set cursor after the checkbox space in new item
            const textNode = newLi.lastChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                const newRange = document.createRange();
                // Position cursor at the end of the text node
                // If afterText is empty (typical case), textNode contains only ' ' (space), so length is 1
                // If afterText has content, position at the end
                const cursorPos = afterText.trim() ? textNode.textContent.length : 1;
                newRange.setStart(textNode, cursorPos);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                // Ensure editor focus
                editor.focus();
            } else {
                // Fallback: use setCursorTo if text node not found
                setCursorTo(newLi);
            }
            
            return;
        }

        // Otherwise, let default list behavior handle it
        // But inside toggle-content, browser default doesn't work properly
        const listInToggle = block.closest('.toggle-content');
        if (listInToggle) {
            e.preventDefault();
            const sel3 = window.getSelection();
            const r3 = sel3.getRangeAt(0);

            // Extract content after cursor
            const afterRange = document.createRange();
            afterRange.setStart(r3.startContainer, r3.startOffset);
            afterRange.setEndAfter(block.lastChild || block);
            const afterFrag = afterRange.extractContents();
            const afterText = afterFrag.textContent;

            const newLi = document.createElement('li');
            if (afterText.trim()) {
                newLi.appendChild(afterFrag);
            } else {
                newLi.innerHTML = '<br>';
            }

            // Clean up current LI if empty
            if (!block.textContent.trim() && !block.querySelector('br')) {
                block.innerHTML = '<br>';
            }

            const parentList = block.parentNode;
            if (block.nextSibling) {
                parentList.insertBefore(newLi, block.nextSibling);
            } else {
                parentList.appendChild(newLi);
            }
            setCursorTo(newLi);
            return;
        }
        return;
    }

    // In blockquote: Enter exits blockquote, Shift+Enter inserts newline inside
    if (tag === 'BLOCKQUOTE' || (block.parentNode && block.parentNode.tagName === 'BLOCKQUOTE')) {
        e.preventDefault();
        const bqBlock = tag === 'BLOCKQUOTE' ? block : block.parentNode;

        // Exit blockquote: insert a new <p> after the blockquote
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        bqBlock.parentNode.insertBefore(p, bqBlock.nextSibling);
        setCursorTo(p);
        return;
    }

    // Check for code block trigger: ``` followed by Enter
    if (block.textContent.startsWith('```')) {
        const blockTag = block.tagName;
        if (blockTag === 'P' || blockTag === 'DIV') {
            e.preventDefault();
            const lang = block.textContent.substring(3).trim();
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            if (lang) code.className = 'language-' + lang;
            code.innerHTML = '<br>';
            pre.appendChild(code);
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            block.parentNode.replaceChild(pre, block);
            pre.parentNode.insertBefore(p, pre.nextSibling);
            setCursorTo(code);
            // Apply initial highlighting if language specified
            if (lang && typeof hljs !== 'undefined') {
                highlightCodeBlock(code);
            }
            // Add line numbers
            updateLineNumbers(pre);
            return;
        }
    }
}

// ========== Tab Key Handling ==========
function handleTabKey(e) {
    e.preventDefault();

    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const block = getParentBlock(sel.getRangeAt(0).startContainer);

    // In code blocks: insert actual tab (4 spaces)
    if (block && (block.tagName === 'PRE' || block.tagName === 'CODE' ||
        (block.parentNode && block.parentNode.tagName === 'PRE'))) {
        document.execCommand('insertText', false, '    ');
        return;
    }

    // In lists: indent/outdent via proper DOM manipulation
    // (execCommand('indent') creates malformed HTML: <ul> directly inside <ul> without <li> wrapper)
    if (block && block.tagName === 'LI') {
        if (e.shiftKey) {
            // Outdent: move this LI from sub-list to parent list
            const list = block.parentNode;
            const parentLi = list ? list.closest('li') : null;
            const parentList = parentLi ? parentLi.parentNode : null;

            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
                // Move any remaining siblings in the sub-list into a new sub-list under this LI
                const remainingSiblings = [];
                let sib = block.nextElementSibling;
                while (sib) {
                    remainingSiblings.push(sib);
                    sib = sib.nextElementSibling;
                }
                if (remainingSiblings.length > 0) {
                    const newSubList = document.createElement(list.tagName);
                    // Copy task-list classes if applicable
                    if (list.classList.contains('contains-task-list')) {
                        newSubList.classList.add('contains-task-list');
                    }
                    remainingSiblings.forEach(s => newSubList.appendChild(s));
                    block.appendChild(newSubList);
                }

                // Insert this LI after parentLi in the parent list
                parentList.insertBefore(block, parentLi.nextSibling);

                // Remove empty sub-list
                if (list.children.length === 0) {
                    list.remove();
                }
                setCursorTo(block);
            }
        } else {
            // Indent: move this LI into the previous sibling's sub-list
            const prevLi = block.previousElementSibling;
            if (!prevLi || prevLi.tagName !== 'LI') {
                // Can't indent the first item in a list
                return;
            }

            const parentList = block.parentNode; // UL or OL
            const listTag = parentList.tagName;   // 'UL' or 'OL'

            // Check if prevLi already has a child sub-list of the same type
            let subList = null;
            for (let i = prevLi.children.length - 1; i >= 0; i--) {
                if (prevLi.children[i].tagName === listTag) {
                    subList = prevLi.children[i];
                    break;
                }
            }

            if (!subList) {
                subList = document.createElement(listTag);
                // Copy task-list classes if applicable
                if (parentList.classList.contains('contains-task-list')) {
                    subList.classList.add('contains-task-list');
                }
                prevLi.appendChild(subList);
            }

            subList.appendChild(block);
            setCursorTo(block);
        }
        return;
    }


    // --- 空行でShift+Tabを押した場合は、リストの最上位まで一気に抜けてリスト全体の直後に移動 ---
    if (e.shiftKey && block && block.tagName === 'P' && block.childNodes.length === 1 && block.firstChild.nodeName === 'BR') {
        let parent = block.parentElement;
        // editor直下なら何もしない
        if (parent === editor) {
            block.style.marginLeft = '';
            block.style.paddingLeft = '';
            block.style.textIndent = '';
            return;
        }
        // 親がリストなら、最上位リストまで遡る
        let topList = null;
        let cur = parent;
        while (cur && (cur.tagName === 'UL' || cur.tagName === 'OL')) {
            topList = cur;
            cur = cur.parentElement;
        }
        if (topList && topList.parentElement) {
            // 最上位リストの直後に空行を移動
              topList.parentElement.insertBefore(block, topList.nextSibling);
              block.classList.add('no-indent');
              block.style.marginLeft = '';
              block.style.paddingLeft = '';
              block.style.textIndent = '';
              return;
        }
        // それ以外は従来通り1段階外へ
        const grandParent = parent.parentElement;
        if (grandParent) {
              grandParent.insertBefore(block, parent.nextSibling);
              block.classList.add('no-indent');
              block.style.marginLeft = '';
              block.style.paddingLeft = '';
              block.style.textIndent = '';
              return;
        }
    }

    // Default: insert 4 spaces
    document.execCommand('insertText', false, '    ');
}

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
            if (typeof hljs !== 'undefined') hljs.highlightElement(code);
        });

        // ドロップダウンをpreの先頭に追加
        pre.insertBefore(langSelect, pre.firstChild);

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
