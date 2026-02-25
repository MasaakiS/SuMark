// =====================================================
// SuMark - Main Application Logic
// =====================================================

// Global error banner management
let errorBanner = null;
let errorBannerTimeout = null;
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
let codeHighlightTimer = null; // Debounce timer for code block highlighting
let isComposing = false; // IME composition state

// Tab management
let tabs = [];       // Array of { id, filePath, title, content, isModified, scrollTop }
let activeTabId = null;
let tabIdCounter = 0;

// ========== Advanced Undo/Redo Stack ==========
let undoStack = [];        // Array of { html, selection }
let redoStack = [];        // Array of { html, selection }
let currentState = null;   // Current editor state
const MAX_UNDO_STACK = 100; // Maximum undo history size
let isUndoRedoOperation = false; // Guard to prevent recording during undo/redo
let saveStateTimer = null; // Debounce timer for saving editor state

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
let editor, currentFileSpan, wordCountSpan, tabList;

// Turndown instance
let turndownService;

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
    currentFileSpan = document.getElementById('currentFile');
    wordCountSpan = document.getElementById('wordCount');
    tabList = document.getElementById('tabList');

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
                   node.querySelector('input[type="checkbox"]');
        },
        replacement: function(content, node) {
            const cb = node.querySelector('input[type="checkbox"]');
            // Check both property and attribute - property for runtime state, attribute for serialized HTML
            const checked = cb && (cb.checked || cb.hasAttribute('checked'));
            // Remove the checkbox from content - GFM plugin adds it as text
            // Also remove any leading/trailing whitespace and [ ] or [x] patterns
            let text = content.replace(/^\s*\[([ x])\]\s*/, '').trim();
            return (checked ? '- [x] ' : '- [ ] ') + text + '\n';
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
    if (typeof marked === 'undefined') {
        editor.textContent = md;
        return;
    }

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
            'data-mermaid-source', 'data-math',  // custom data attributes
        ],
        ALLOW_DATA_ATTR: true,
    }) : dirtyHtml;
    
    editor.innerHTML = cleanHtml;

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

    // Add delete buttons to TOC containers
    setupTocDeleteButtons();

    // Add line numbers to code blocks
    updateAllLineNumbers();

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

// ========== Code Block Live Highlighting ==========
function getCaretCharacterOffsetWithin(element) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString().length;
}

function setCaretCharacterOffset(element, offset) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let currentOffset = 0;
    let node;
    while (node = walker.nextNode()) {
        const nodeLen = node.textContent.length;
        if (currentOffset + nodeLen >= offset) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(node, offset - currentOffset);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
        currentOffset += nodeLen;
    }
    // If offset is beyond the content, place at end
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

function highlightCodeBlock(codeEl) {
    if (typeof hljs === 'undefined') return;
    if (!codeEl || codeEl.tagName !== 'CODE') return;
    // Don't highlight mermaid blocks
    if (codeEl.classList.contains('language-mermaid')) return;

    // Check line count - skip highlighting for large code blocks (500+ lines)
    const plainText = codeEl.textContent;
    const lineCount = plainText.split('\n').length;
    
    if (lineCount > 500) {
        console.log(`[ハイライトスキップ] ${lineCount}行のコードブロックが大きすぎるため、シンタックスハイライトをスキップしました。`);
        
        // Update line numbers without highlighting
        const pre = codeEl.closest('pre');
        if (pre) {
            updateLineNumbers(pre);
            // Add a visual indicator that highlighting is skipped
            if (!pre.querySelector('.highlight-skipped-notice')) {
                const notice = document.createElement('div');
                notice.className = 'highlight-skipped-notice';
                notice.textContent = `⚠️ ${lineCount}行 - シンタックスハイライト無効`;
                notice.style.cssText = 'position:absolute;top:5px;right:10px;background:rgba(255,165,0,0.2);color:#ff8c00;padding:2px 8px;border-radius:3px;font-size:11px;pointer-events:none;z-index:10;';
                pre.style.position = 'relative';
                pre.appendChild(notice);
            }
        }
        return;
    }

    // Save cursor position
    const sel = window.getSelection();
    const isInsideCode = codeEl.contains(sel.anchorNode);
    let caretOffset = 0;
    if (isInsideCode) {
        caretOffset = getCaretCharacterOffsetWithin(codeEl);
    }

    // Remove previous hljs state
    delete codeEl.dataset.highlighted;
    codeEl.removeAttribute('data-highlighted');
    codeEl.textContent = plainText;
    hljs.highlightElement(codeEl);

    // Restore cursor
    if (isInsideCode) {
        setCaretCharacterOffset(codeEl, caretOffset);
    }

    // Update line numbers
    const pre = codeEl.closest('pre');
    if (pre) {
        updateLineNumbers(pre);
        // Remove skipped notice if it exists
        const notice = pre.querySelector('.highlight-skipped-notice');
        if (notice) notice.remove();
    }
}

// Highlight all code blocks in the editor (used after undo/redo)
function highlightAllCodeBlocks() {
    if (typeof hljs === 'undefined') return;
    const codeBlocks = editor.querySelectorAll('pre code:not(.language-mermaid)');
    codeBlocks.forEach(block => {
        const lineCount = block.textContent.split('\n').length;
        
        if (lineCount > 500) {
            console.log(`[ハイライトスキップ] ${lineCount}行のコードブロックをスキップしました。`);
            
            // Update line numbers and add notice
            const pre = block.closest('pre');
            if (pre) {
                updateLineNumbers(pre);
                if (!pre.querySelector('.highlight-skipped-notice')) {
                    const notice = document.createElement('div');
                    notice.className = 'highlight-skipped-notice';
                    notice.textContent = `⚠️ ${lineCount}行 - シンタックスハイライト無効`;
                    notice.style.cssText = 'position:absolute;top:5px;right:10px;background:rgba(255,165,0,0.2);color:#ff8c00;padding:2px 8px;border-radius:3px;font-size:11px;pointer-events:none;z-index:10;';
                    pre.style.position = 'relative';
                    pre.appendChild(notice);
                }
            }
            return;
        }
        
        delete block.dataset.highlighted;
        block.removeAttribute('data-highlighted');
        hljs.highlightElement(block);
        
        // Remove skipped notice if it exists
        const pre = block.closest('pre');
        if (pre) {
            const notice = pre.querySelector('.highlight-skipped-notice');
            if (notice) notice.remove();
        }
    });
}

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

// ========== Line Numbers ==========
function updateLineNumbers(pre) {
    if (!pre || pre.tagName !== 'PRE') return;
    // Skip Mermaid containers
    if (pre.closest('.mermaid-container')) return;

    const code = pre.querySelector('code');
    if (!code) return;

    const text = code.textContent;
    const lines = text.split('\n');
    // Remove trailing empty line (common with code blocks ending in \n)
    if (lines.length > 1 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    const lineCount = Math.max(lines.length, 1);

    let gutter = pre.querySelector('.line-numbers-gutter');
    if (!gutter) {
        gutter = document.createElement('div');
        gutter.className = 'line-numbers-gutter';
        gutter.setAttribute('contenteditable', 'false');
        gutter.setAttribute('aria-hidden', 'true');
        pre.insertBefore(gutter, pre.firstChild);
    }

    // Only update if line count changed
    const currentCount = gutter.children.length;
    if (currentCount !== lineCount) {
        let html = '';
        for (let i = 1; i <= lineCount; i++) {
            html += '<span>' + i + '</span>';
        }
        gutter.innerHTML = html;
    }
}

function updateAllLineNumbers() {
    editor.querySelectorAll('pre').forEach(pre => {
        if (!pre.closest('.mermaid-container')) {
            updateLineNumbers(pre);
        }
    });
}

function debouncedHighlightCodeAtCursor() {
    if (codeHighlightTimer) clearTimeout(codeHighlightTimer);
    codeHighlightTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        let node = sel.anchorNode;
        // Walk up to find code element inside pre
        while (node && node !== editor) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                const lineCount = node.textContent.split('\n').length;
                // Adjust delay based on code size
                const delay = lineCount > 100 ? 500 : 0;
                
                if (delay > 0) {
                    setTimeout(() => highlightCodeBlock(node), delay);
                } else {
                    highlightCodeBlock(node);
                }
                return;
            }
            node = node.parentElement;
        }
    }, 300);
}

// Check if cursor is on an empty line at the end of the code element
// Handles both <br> elements (from insertLineBreak) and \n text chars (from file loading)
function isOnEmptyTrailingLine(targetEl, range) {
    const node = range.startContainer;
    const offset = range.startOffset;

    // Case 1: Cursor is in a text node
    if (node.nodeType === 3) {
        const text = node.textContent;
        // Check if character before cursor is \n (meaning we're on a new empty line)
        if (offset > 0 && text[offset - 1] === '\n') {
            // Check nothing meaningful after cursor in this node
            const after = text.substring(offset);
            if (after !== '' && after.replace(/\n/g, '') !== '') return false;
            // Check no more meaningful siblings after this node
            let sibling = node.nextSibling;
            while (sibling) {
                if (sibling.nodeType === 3 && sibling.textContent.replace(/\n/g, '') !== '') return false;
                if (sibling.nodeType === 1 && sibling.nodeName !== 'BR') return false;
                sibling = sibling.nextSibling;
            }
            return true;
        }
        return false;
    }

    // Case 2: Cursor is in an element node (between child nodes)
    if (node.nodeType === 1) {
        if (offset === 0) {
            // At the very start - exit only if completely empty
            return targetEl.textContent.trim() === '' &&
                   targetEl.innerHTML.replace(/<br\s*\/?>/gi, '').trim() === '';
        }
        const prevChild = node.childNodes[offset - 1];
        if (!prevChild) return false;

        // Previous child should be a <br> or a text node ending with \n
        const isPrevBr = prevChild.nodeName === 'BR';
        const isPrevNewline = prevChild.nodeType === 3 && prevChild.textContent.endsWith('\n');

        if (isPrevBr || isPrevNewline) {
            // Check no meaningful content after cursor position
            for (let i = offset; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                if (child.nodeType === 3 && child.textContent.replace(/\n/g, '') !== '') return false;
                if (child.nodeType === 1 && child.nodeName !== 'BR') return false;
            }
            return true;
        }
    }

    return false;
}

// Remove trailing empty lines (<br> elements and trailing \n characters) from element
function removeTrailingEmptyLines(el) {
    // Remove trailing <br> elements and empty text nodes
    while (el.lastChild) {
        if (el.lastChild.nodeType === 3 && el.lastChild.textContent.match(/^\n*$/)) {
            el.removeChild(el.lastChild);
        } else if (el.lastChild.nodeType === 3) {
            // Trim trailing newlines from the last text node
            el.lastChild.textContent = el.lastChild.textContent.replace(/\n+$/, '');
            if (el.lastChild.textContent === '') {
                el.removeChild(el.lastChild);
            } else {
                break;
            }
        } else {
            break;
        }
    }
    // If completely empty, add a non-breaking space to prevent collapse
    if (!el.textContent.trim()) {
        el.textContent = ' ';
    }
}

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
    
    // Initialize undo stack with initial state
    saveEditorState();
}

// ========== Advanced Undo/Redo Functions ==========

/**
 * Save current editor state to undo stack
 */
function saveEditorState() {
    if (isUndoRedoOperation) return; // Don't record during undo/redo
    if (isConverting) return; // Don't record during auto-conversion
    
    const html = editor.innerHTML;
    const selection = saveSelection();
    
    // Check if state actually changed
    if (currentState && currentState.html === html) {
        return; // No change, don't save
    }
    
    // Save current state to undo stack
    if (currentState) {
        undoStack.push(currentState);
        // Limit stack size
        if (undoStack.length > MAX_UNDO_STACK) {
            undoStack.shift();
        }
    }
    
    // Update current state
    currentState = { html, selection };
    
    // Clear redo stack when new change is made
    redoStack = [];
    
    console.log('[Undo] State saved. Stack size:', undoStack.length);
}

/**
 * Debounced version of saveEditorState (waits 500ms after last input)
 */
function debouncedSaveEditorState() {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
        saveEditorState();
    }, 500);
}

/**
 * Save current selection (cursor position/range)
 */
function saveSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    
    const range = sel.getRangeAt(0);
    return {
        startContainer: getNodePath(range.startContainer),
        startOffset: range.startOffset,
        endContainer: getNodePath(range.endContainer),
        endOffset: range.endOffset,
        collapsed: range.collapsed
    };
}

/**
 * Restore saved selection
 */
function restoreSelection(selectionData) {
    if (!selectionData) return;
    
    try {
        const startNode = getNodeByPath(selectionData.startContainer);
        const endNode = getNodeByPath(selectionData.endContainer);
        
        if (!startNode || !endNode) return;
        
        const range = document.createRange();
        range.setStart(startNode, Math.min(selectionData.startOffset, startNode.length || startNode.childNodes.length || 0));
        range.setEnd(endNode, Math.min(selectionData.endOffset, endNode.length || endNode.childNodes.length || 0));
        
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } catch (err) {
        console.warn('[Undo] Failed to restore selection:', err);
    }
}

/**
 * Get path from editor root to target node
 */
function getNodePath(node) {
    const path = [];
    let current = node;
    
    while (current && current !== editor) {
        const parent = current.parentNode;
        if (!parent) break;
        
        const index = Array.from(parent.childNodes).indexOf(current);
        path.unshift(index);
        current = parent;
    }
    
    return path;
}

/**
 * Get node by path from editor root
 */
function getNodeByPath(path) {
    if (!path || path.length === 0) return editor;
    
    let current = editor;
    for (const index of path) {
        if (!current.childNodes[index]) return null;
        current = current.childNodes[index];
    }
    
    return current;
}

/**
 * Perform undo operation
 */
function performUndo() {
    if (undoStack.length === 0) {
        console.log('[Undo] Nothing to undo');
        return;
    }
    
    isUndoRedoOperation = true;
    
    // Push current state to redo stack
    if (currentState) {
        redoStack.push(currentState);
    }
    
    // Pop from undo stack
    const previousState = undoStack.pop();
    currentState = previousState;
    
    // Restore editor content
    editor.innerHTML = previousState.html;
    
    // Ensure editor starts with an editable element
    ensureEditableStart();
    
    // Restore selection
    restoreSelection(previousState.selection);
    
    // Re-highlight code blocks
    highlightAllCodeBlocks();
    
    // Update word count
    updateWordCount();
    
    // Mark as modified
    markModified();
    
    isUndoRedoOperation = false;
    
    console.log('[Undo] Performed. Undo stack:', undoStack.length, 'Redo stack:', redoStack.length);
}

/**
 * Perform redo operation
 */
function performRedo() {
    if (redoStack.length === 0) {
        console.log('[Redo] Nothing to redo');
        return;
    }
    
    isUndoRedoOperation = true;
    
    // Push current state to undo stack
    if (currentState) {
        undoStack.push(currentState);
        if (undoStack.length > MAX_UNDO_STACK) {
            undoStack.shift();
        }
    }
    
    // Pop from redo stack
    const nextState = redoStack.pop();
    currentState = nextState;
    
    // Restore editor content
    editor.innerHTML = nextState.html;
    
    // Ensure editor starts with an editable element
    ensureEditableStart();
    
    // Restore selection
    restoreSelection(nextState.selection);
    
    // Re-highlight code blocks
    highlightAllCodeBlocks();
    
    // Update word count
    updateWordCount();
    
    // Mark as modified
    markModified();
    
    isUndoRedoOperation = false;
    
    console.log('[Redo] Performed. Undo stack:', undoStack.length, 'Redo stack:', redoStack.length);
}

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
    
    // Save state for undo (debounced to avoid too many snapshots)
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
        li.appendChild(document.createTextNode(' ' + content));
        ul.appendChild(li);
        block.parentNode.replaceChild(ul, block);
        setCursorToEnd(li);
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
        li.appendChild(document.createTextNode(' '));
        ul.appendChild(li);
        block.parentNode.replaceChild(ul, block);
        setCursorToEnd(li);
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

    // Display math: $$...$$
    const displayMathMatch = before.match(/\$\$([\s\S]+?)\$\$$/);
    if (displayMathMatch && window.katex) {
        const math = displayMathMatch[1];
        const fullMatch = displayMathMatch[0];
        const startIdx = pos - fullMatch.length;
        const beforeText = textNode.textContent.substring(0, startIdx);
        const afterText = textNode.textContent.substring(pos);
        const parent = textNode.parentNode;

        const frag = document.createDocumentFragment();
        if (beforeText) frag.appendChild(document.createTextNode(beforeText));
        const div = document.createElement('div');
        div.className = 'math-display';
        div.setAttribute('data-math', math);
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

    // Inline math: $...$
    const inlineMathMatch = before.match(/\$([^\$]+?)\$$/);
    if (inlineMathMatch && window.katex) {
        const math = inlineMathMatch[1];
        const fullMatch = inlineMathMatch[0];
        const startIdx = pos - fullMatch.length;
        const beforeText = textNode.textContent.substring(0, startIdx);
        const afterText = textNode.textContent.substring(pos);
        const parent = textNode.parentNode;

        const frag = document.createDocumentFragment();
        if (beforeText) frag.appendChild(document.createTextNode(beforeText));
        const span = document.createElement('span');
        span.className = 'math-inline';
        span.setAttribute('data-math', math);
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

    // In list item: if empty, exit the list
    if (tag === 'LI') {
        const text = block.textContent.trim();
        // Ignore checkbox content for task lists
        const hasCheckbox = block.querySelector('input[type="checkbox"]');
        const effectiveText = hasCheckbox ? text.replace(/^\s*/, '') : text;

        if (effectiveText === '' || (hasCheckbox && block.textContent.replace(/\s/g, '') === '')) {
            e.preventDefault();
            const list = block.parentNode;
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            list.parentNode.insertBefore(p, list.nextSibling);
            block.remove();
            if (list.children.length === 0) list.remove();
            setCursorTo(p);
            return;
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
            const newRange = document.createRange();
            // Position cursor at the end of the text node (after the space)
            const cursorPos = afterText.trim() ? textNode.textContent.length : 1;
            newRange.setStart(textNode, cursorPos);
            newRange.collapse(true);
            sel2.removeAllRanges();
            sel2.addRange(newRange);
            
            // Focus the new list item to ensure cursor visibility
            newLi.focus();
            
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

    // In lists: indent/outdent
    if (block && block.tagName === 'LI') {
        if (e.shiftKey) {
            const list = block.parentNode;
            const parentLi = list ? list.closest('li') : null;
            const parentList = parentLi ? parentLi.parentNode : null;

            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
                const insertBefore = parentLi.nextSibling;
                parentList.insertBefore(block, insertBefore);
                if (list.children.length === 0) {
                    list.remove();
                }
                setCursorTo(block);
            } else {
                document.execCommand('outdent');
            }
        } else {
            document.execCommand('indent');
        }
        return;
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

// ========== Chunked Paste Processing ==========
async function pasteTextInChunks(lines, codeElement) {
    const CHUNK_SIZE = 100; // Process 100 lines at a time
    const totalLines = lines.length;
    let currentIndex = 0;
    
    return new Promise((resolve) => {
        function processChunk() {
            const endIndex = Math.min(currentIndex + CHUNK_SIZE, totalLines);
            const chunk = lines.slice(currentIndex, endIndex);
            
            // Insert chunk
            for (let i = 0; i < chunk.length; i++) {
                if (currentIndex + i > 0) {
                    document.execCommand('insertLineBreak');
                }
                if (chunk[i]) {
                    document.execCommand('insertText', false, chunk[i]);
                }
            }
            
            currentIndex = endIndex;
            
            // Update progress
            if (totalLines > 500) {
                const progress = Math.round((currentIndex / totalLines) * 100);
                showProgressIndicator(`貼り付け中... ${progress}% (${currentIndex}/${totalLines}行)`);
            }
            
            // Continue processing or finish
            if (currentIndex < totalLines) {
                requestAnimationFrame(processChunk);
            } else {
                if (totalLines > 500) {
                    hideProgressIndicator();
                }
                resolve();
            }
        }
        
        // Start processing
        if (totalLines > 500) {
            showProgressIndicator(`貼り付け中... 0% (0/${totalLines}行)`);
        }
        requestAnimationFrame(processChunk);
    });
}

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
        const html = marked.parse(preprocessNotionMarkdown(text));
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

// Check if text is tab-delimited (multiple columns, multiple rows)
function isTabDelimited(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 1) return false;
    // At least one line must have a tab
    return lines.some(line => line.includes('\t'));
}

// Convert tab-separated text to HTML table
function tsvToHtmlTable(text) {
    const lines = text.trim().split('\n');
    const rows = lines.map(line => line.split('\t'));

    // First row as header
    let html = '<table><thead><tr>';
    rows[0].forEach(cell => {
        html += '<th>' + escapeHtml(cell.trim()) + '</th>';
    });
    html += '</tr></thead><tbody>';

    for (let i = 1; i < rows.length; i++) {
        html += '<tr>';
        rows[i].forEach(cell => {
            html += '<td>' + escapeHtml((cell || '').trim()) + '</td>';
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

// Parse HTML with table (from Excel) and create a clean table
function parseHtmlTable(htmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    const srcTable = doc.querySelector('table');
    if (!srcTable) return null;

    const rows = srcTable.querySelectorAll('tr');
    if (rows.length === 0) return null;

    let html = '<table><thead><tr>';
    // First row as header
    const headerCells = rows[0].querySelectorAll('th, td');
    headerCells.forEach(cell => {
        html += '<th>' + escapeHtml(cell.textContent.trim()) + '</th>';
    });
    html += '</tr></thead><tbody>';

    for (let i = 1; i < rows.length; i++) {
        html += '<tr>';
        rows[i].querySelectorAll('th, td').forEach(cell => {
            html += '<td>' + escapeHtml(cell.textContent.trim()) + '</td>';
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

function pasteImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64 = event.target.result;
        const html = '<img src="' + base64 + '" alt="貼り付け画像" style="max-width:100%">';
        editor.focus();
        document.execCommand('insertHTML', false, html);
        markModified();
    };
    reader.readAsDataURL(file);
}

function looksLikeMarkdown(text) {
    // Simple heuristic: does it contain common markdown patterns?
    return /^#{1,6} |^[-*+] |\*\*.*\*\*|^```|^\|.*\|.*\||^>\s|^\d+\.\s|!\[.*\]\(.*\)|\[.*\]\(.*\)/m.test(text);
}

// ========== Formatting Commands ==========

function applyHeading(level) {
    const tag = 'h' + level;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    const block = getParentBlock(sel.anchorNode);
    if (!block) return;
    
    // Check if we're toggling off the same heading level
    if (block.tagName.toLowerCase() === tag) {
        // Toggle off: revert to paragraph
        document.execCommand('formatBlock', false, 'p');
        return;
    }
    
    // Special handling for list items: convert list item to heading
    if (block.tagName === 'LI') {
        // Get the text content (excluding checkbox if present)
        const checkbox = block.querySelector('input[type="checkbox"]');
        let textContent = '';
        for (let node of block.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                textContent += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'INPUT') {
                textContent += node.textContent;
            }
        }
        
        // Create heading element
        const heading = document.createElement(tag);
        heading.textContent = textContent.trim();
        
        // Get the parent list
        const list = block.parentNode;
        
        // Insert heading before the list or after it depending on position
        list.parentNode.insertBefore(heading, list.nextSibling);
        
        // Remove the list item
        block.remove();
        
        // If list is now empty, remove it
        if (list.children.length === 0) {
            list.remove();
        }
        
        // Set cursor at the end of the heading
        setCursorTo(heading);
        return;
    }
    
    // For other block types, use the standard formatBlock command
    document.execCommand('formatBlock', false, tag);
}

function insertUnorderedList() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    // Prevent list insertion inside table cells
    if (isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内ではリストを作成できません。');
        return;
    }
    
    const block = getParentBlock(sel.anchorNode);
    const toggleContent = block ? block.closest('.toggle-content') : null;
    if (!block) {
        document.execCommand('insertUnorderedList');
        if (toggleContent) ensureToggleContentEditable(toggleContent);
        return;
    }
    
    // Special handling for headings: convert heading to list item
    if (/^H[1-6]$/.test(block.tagName)) {
        const textContent = block.textContent.trim();
        
        // Create list and list item
        const ul = document.createElement('ul');
        const li = document.createElement('li');
        li.textContent = textContent;
        ul.appendChild(li);
        
        // Replace heading with list
        block.parentNode.insertBefore(ul, block);
        block.remove();
        
        // Set cursor in the list item
        setCursorTo(li);
        if (toggleContent) ensureToggleContentEditable(toggleContent);
        return;
    }
    
    // For other block types, use the standard command
    document.execCommand('insertUnorderedList');
    if (toggleContent) ensureToggleContentEditable(toggleContent);
}

function insertOrderedList() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    // Prevent list insertion inside table cells
    if (isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内ではリストを作成できません。');
        return;
    }
    
    const block = getParentBlock(sel.anchorNode);
    const toggleContent = block ? block.closest('.toggle-content') : null;
    if (!block) {
        document.execCommand('insertOrderedList');
        if (toggleContent) ensureToggleContentEditable(toggleContent);
        return;
    }
    
    // Special handling for headings: convert heading to list item
    if (/^H[1-6]$/.test(block.tagName)) {
        const textContent = block.textContent.trim();
        
        // Create list and list item
        const ol = document.createElement('ol');
        const li = document.createElement('li');
        li.textContent = textContent;
        ol.appendChild(li);
        
        // Replace heading with list
        block.parentNode.insertBefore(ol, block);
        block.remove();
        
        // Set cursor in the list item
        setCursorTo(li);
        if (toggleContent) ensureToggleContentEditable(toggleContent);
        return;
    }
    
    // For other block types, use the standard command
    document.execCommand('insertOrderedList');
    if (toggleContent) ensureToggleContentEditable(toggleContent);
}

function ensureToggleDeleteButton(summary) {
    if (!summary) return;
    if (!summary.querySelector('.toggle-delete-btn')) {
        const btn = document.createElement('button');
        btn.className = 'toggle-delete-btn';
        btn.type = 'button';
        btn.title = 'トグルを解除';
        btn.textContent = '✕';
        btn.setAttribute('contenteditable', 'false');
        summary.appendChild(btn);
    }
}

function insertToggle() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    // Prevent toggle insertion inside table cells
    if (isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内ではトグルを作成できません。');
        return;
    }

    const range = sel.getRangeAt(0);

    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const summaryAncestor = startElement ? startElement.closest('summary') : null;
    let insertionRoot = editor;

    if (summaryAncestor) {
        const parentDetails = summaryAncestor.closest('details');
        if (parentDetails) {
            let contentDiv = parentDetails.querySelector(':scope > .toggle-content');
            if (!contentDiv) {
                contentDiv = document.createElement('div');
                contentDiv.className = 'toggle-content';
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
                parentDetails.appendChild(contentDiv);
            }
            insertionRoot = contentDiv;
        }
    } else {
        const currentBlock = getParentBlock(range.startContainer);
        const currentToggleContent = currentBlock ? currentBlock.closest('.toggle-content') : null;
        insertionRoot = currentToggleContent || editor;
    }

    const details = document.createElement('details');
    details.setAttribute('open', '');
    const summary = document.createElement('summary');
    summary.setAttribute('contenteditable', 'true');
    const contentDiv = document.createElement('div');
    contentDiv.className = 'toggle-content';
    details.appendChild(summary);
    details.appendChild(contentDiv);

    // Check if there is a selection (non-collapsed range)
    if (!range.collapsed) {
        // Collect all block-level elements that overlap the selection
        const blocksToMove = [];
        const startBlock = getParentBlock(range.startContainer) || range.startContainer;
        const endBlock = getParentBlock(range.endContainer) || range.endContainer;

        // Walk through direct children of insertion root to find blocks in selection
        let collecting = false;
        const rootChildren = Array.from(insertionRoot.childNodes);
        for (const child of rootChildren) {
            if (child.contains(startBlock) || child === startBlock) {
                collecting = true;
            }
            if (collecting) {
                blocksToMove.push(child);
            }
            if (child.contains(endBlock) || child === endBlock) {
                break;
            }
        }

        if (blocksToMove.length > 0) {
            // Use first block's text as summary, or default
            const firstText = blocksToMove[0].textContent.trim();
            summary.textContent = firstText.substring(0, 50) || 'トグル';
            ensureToggleDeleteButton(summary);

            // Insert details before the first collected block
            const insertBefore = blocksToMove[0];
            insertBefore.parentNode.insertBefore(details, insertBefore);

            // Move all collected blocks into toggle-content
            blocksToMove.forEach(b => {
                contentDiv.appendChild(b);
            });

            // Ensure toggle-content has content
            if (contentDiv.children.length === 0) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
            }
            ensureToggleContentEditable(contentDiv);

            if (insertionRoot.classList && insertionRoot.classList.contains('toggle-content')) {
                ensureToggleContentEditable(insertionRoot);
            }

            // Add a paragraph after details for continuing editing
            const afterP = document.createElement('p');
            afterP.innerHTML = '<br>';
            details.parentNode.insertBefore(afterP, details.nextSibling);

            // Select summary text for editing
            const r = document.createRange();
            r.selectNodeContents(summary);
            sel.removeAllRanges();
            sel.addRange(r);
            onEditorInput();
            return;
        }
    }

    // No selection: insert empty toggle (original behavior)
    summary.textContent = 'トグル';
    ensureToggleDeleteButton(summary);
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    contentDiv.appendChild(p);

    const block = getParentBlock(range.startContainer);

    // Insert after current block or replace empty block
    if (block && block !== editor) {
        if (block.textContent.trim() === '' && block.tagName === 'P') {
            block.parentNode.replaceChild(details, block);
        } else {
            block.parentNode.insertBefore(details, block.nextSibling);
        }
    } else {
        insertionRoot.appendChild(details);
    }

    // Add a paragraph after details for continuing editing
    const afterP = document.createElement('p');
    afterP.innerHTML = '<br>';
    details.parentNode.insertBefore(afterP, details.nextSibling);

    if (insertionRoot.classList && insertionRoot.classList.contains('toggle-content')) {
        ensureToggleContentEditable(insertionRoot);
    }

    // Select the summary text for editing
    const r = document.createRange();
    r.selectNodeContents(summary);
    sel.removeAllRanges();
    sel.addRange(r);
    onEditorInput();
    saveEditorState(); // Save state after inserting toggle
}

function applyBlockquote() {
    const sel = window.getSelection();
    // Prevent blockquote insertion inside table cells
    if (sel.rangeCount && isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内では引用を作成できません。');
        return;
    }
    const block = getParentBlock(sel.anchorNode);
    const toggleContent = block ? block.closest('.toggle-content') : null;
    // Check if already in blockquote
    let node = block;
    while (node && node !== editor) {
        if (node.tagName === 'BLOCKQUOTE') {
            // Exit blockquote
            document.execCommand('formatBlock', false, 'p');
            if (toggleContent) ensureToggleContentEditable(toggleContent);
            return;
        }
        node = node.parentNode;
    }
    document.execCommand('formatBlock', false, 'blockquote');
    if (toggleContent) ensureToggleContentEditable(toggleContent);
}

function applyInlineCode() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    // Check if already in code
    let node = sel.anchorNode;
    let codeParent = null;
    while (node && node !== editor) {
        if (node.nodeType === 1 && node.tagName === 'CODE' &&
            !(node.parentNode && node.parentNode.tagName === 'PRE')) {
            codeParent = node;
            break;
        }
        node = node.parentNode;
    }

    if (codeParent) {
        // Remove code formatting
        const text = codeParent.textContent;
        const textNode = document.createTextNode(text);
        codeParent.parentNode.replaceChild(textNode, codeParent);
        const range = document.createRange();
        range.selectNodeContents(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        const text = sel.toString() || 'コード';
        document.execCommand('insertHTML', false, '<code>' + escapeHtml(text) + '</code>\u200B');
    }
}

// ========== Element Insertion ==========

// ========== Custom Modal Dialog ==========
function showModal(title, fields, callback) {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const fieldsEl = document.getElementById('modalFields');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');

    titleEl.textContent = title;
    fieldsEl.innerHTML = '';

    // Build input fields
    fields.forEach((field, i) => {
        const div = document.createElement('div');
        div.className = 'modal-field';
        const label = document.createElement('label');
        label.textContent = field.label;
        label.setAttribute('for', 'modalInput' + i);
        let inputEl;
        if (field.type === 'select' && field.options) {
            inputEl = document.createElement('select');
            inputEl.id = 'modalInput' + i;
            field.options.forEach(opt => {
                const option = document.createElement('option');
                if (typeof opt === 'object') {
                    option.value = opt.value;
                    option.textContent = opt.label;
                } else {
                    option.value = opt;
                    option.textContent = opt;
                }
                if ((field.value || '') === option.value) option.selected = true;
                inputEl.appendChild(option);
            });
        } else {
            inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.id = 'modalInput' + i;
            inputEl.value = field.value || '';
            inputEl.placeholder = field.placeholder || '';
        }
        div.appendChild(label);
        div.appendChild(inputEl);
        fieldsEl.appendChild(div);
    });

    overlay.style.display = 'flex';

    // Focus first input/select
    const firstInput = fieldsEl.querySelector('input, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);

    // Cleanup previous listeners
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    function close() {
        overlay.style.display = 'none';
    }

    function submit() {
        const values = {};
        fields.forEach((field, i) => {
            values[field.key] = document.getElementById('modalInput' + i).value;
        });
        close();
        callback(values);
    }

    newOk.addEventListener('click', submit);
    newCancel.addEventListener('click', () => {
        close();
        editor.focus();
    });

    // Enter key submits, Escape cancels
    fieldsEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
            editor.focus();
        }
    };
}

function insertLink() {
    // Save selection before opening dialog
    const sel = window.getSelection();
    let savedRange = null;
    let selectedText = '';
    if (sel.rangeCount) {
        savedRange = sel.getRangeAt(0).cloneRange();
        selectedText = sel.toString() || '';
    }

    // Determine default URL and text values: if selection is inside an <a>,
    // use its href and text; if selected text itself looks like a URL, use it.
    let defaultUrl = 'https://';
    let defaultText = selectedText;
    if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const container = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentElement;
        const anchor = container ? container.closest('a') : null;
        if (anchor) {
            try {
                defaultUrl = anchor.getAttribute('href') || anchor.href || defaultUrl;
            } catch (err) {
                defaultUrl = anchor.getAttribute('href') || defaultUrl;
            }
            defaultText = anchor.textContent || defaultText;
        } else {
            const m = selectedText.trim().match(/^(https?:\/\/\S+)$/i);
            if (m) defaultUrl = m[1];
        }
    }

    const fields = [
        { key: 'url', label: 'URL', value: defaultUrl, placeholder: 'https://example.com' },
        { key: 'text', label: 'リンクテキスト', value: defaultText, placeholder: '表示するテキスト' },
    ];

    showModal('リンクを挿入', fields, (values) => {
        const url = values.url;
        if (!url || url === 'https://') { editor.focus(); return; }
        const linkText = values.text || url;

        // Restore selection and insert
        editor.focus();
        const s = window.getSelection();
        if (savedRange) {
            s.removeAllRanges();
            s.addRange(savedRange);
        }
        const html = '<a href="' + escapeHtml(url) + '">' + escapeHtml(linkText) + '</a>';
        document.execCommand('insertHTML', false, html);
        markModified();
        saveEditorState(); // Save state after inserting link
    });
}

async function insertImage() {
    const sel = window.getSelection();
    let savedRange = null;
    if (sel.rangeCount) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }

    let selectedImg = null;
    if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        let node = range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentNode
            : range.startContainer;

        if (node && node.tagName === 'IMG') {
            selectedImg = node;
        } else if (node && node.closest) {
            selectedImg = node.closest('img');
        }

        if (!selectedImg && !range.collapsed) {
            const common = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                ? range.commonAncestorContainer.parentNode
                : range.commonAncestorContainer;
            if (common && common.querySelector) {
                selectedImg = common.querySelector('img');
            }
        }
    }

    if (selectedImg) {
        const currentAlt = selectedImg.getAttribute('alt') || '';
        showModal('代替テキストを編集', [
            { name: 'alt', label: '代替テキスト', type: 'text', value: currentAlt }
        ], (values) => {
            const altText = (values.alt || '').trim();
            selectedImg.setAttribute('alt', altText);
            markModified();
            saveEditorState();
        });
        return;
    }

    try {
        // Open file dialog for local images
        const selected = await tauriOpen({
            multiple: false,
            filters: [{ name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }]
        });

        if (selected) {
            const data = await readBinaryFile(selected);
            const ext = selected.split('.').pop().toLowerCase();
            const mimeTypes = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp',
                'svg': 'image/svg+xml',
            };
            const mime = mimeTypes[ext] || 'image/png';

            // Convert Uint8Array to base64
            let binary = '';
            const bytes = new Uint8Array(data);
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            const base64 = btoa(binary);

            // Restore selection and insert
            editor.focus();
            const s = window.getSelection();
            if (savedRange) {
                s.removeAllRanges();
                s.addRange(savedRange);
            }

            const filename = selected.split('/').pop().split('\\').pop();
            showModal('画像を挿入', [
                { name: 'alt', label: '代替テキスト', type: 'text', value: filename }
            ], (values) => {
                const altText = (values.alt || filename).trim();
                const html = '<img src="data:' + mime + ';base64,' + base64 + '" alt="' + escapeHtml(altText) + '">';
                document.execCommand('insertHTML', false, html);
                markModified();
                saveEditorState(); // Save state after inserting image
            });
        }
    } catch (err) {
        console.error('Error loading image:', err);
    }
}

function insertTable() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const block = getParentBlock(range.startContainer);
    const containerEl = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const cell = containerEl ? containerEl.closest('td, th') : null;

    // Prevent nested tables - do not insert table inside table cells
    if (cell) {
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['列1', '列2', '列3'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 0; i < 2; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < 3; j++) {
            const td = document.createElement('td');
            td.textContent = 'データ';
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const afterP = document.createElement('p');
    afterP.innerHTML = '<br>';

    // Find insertion point - check if inside toggle-content
    const toggleContent = block ? block.closest('.toggle-content') : null;
    if (toggleContent) {
        // Insert inside toggle-content
        if (block && block.parentNode === toggleContent) {
            if (block.textContent.trim() === '' && block.tagName === 'P') {
                toggleContent.replaceChild(table, block);
            } else {
                toggleContent.insertBefore(table, block.nextSibling);
            }
        } else {
            toggleContent.appendChild(table);
        }
        toggleContent.insertBefore(afterP, table.nextSibling);
        ensureToggleContentEditable(toggleContent);
    } else if (block && block !== editor && block.parentNode) {
        block.parentNode.insertBefore(table, block.nextSibling);
        block.parentNode.insertBefore(afterP, table.nextSibling);
    } else {
        editor.appendChild(table);
        editor.appendChild(afterP);
    }
    // Place cursor in first header cell
    const firstTh = table.querySelector('th');
    if (firstTh) {
        const r = document.createRange();
        r.selectNodeContents(firstTh);
        sel.removeAllRanges();
        sel.addRange(r);
    }
    onEditorInput();
    saveEditorState(); // Save state after inserting table
}

// Supported languages for code block dropdown (Highlight.js common languages)
const CODE_LANGUAGES = [
    { value: '', label: '（自動検出）' },
    { value: 'bash', label: 'Bash / Shell' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'css', label: 'CSS' },
    { value: 'dart', label: 'Dart' },
    { value: 'diff', label: 'Diff' },
    { value: 'dockerfile', label: 'Dockerfile' },
    { value: 'elixir', label: 'Elixir' },
    { value: 'erlang', label: 'Erlang' },
    { value: 'go', label: 'Go' },
    { value: 'graphql', label: 'GraphQL' },
    { value: 'groovy', label: 'Groovy' },
    { value: 'haskell', label: 'Haskell' },
    { value: 'html', label: 'HTML' },
    { value: 'ini', label: 'INI / TOML' },
    { value: 'java', label: 'Java' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'json', label: 'JSON' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'lua', label: 'Lua' },
    { value: 'makefile', label: 'Makefile' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'mermaid', label: 'Mermaid (図表)' },
    { value: 'nginx', label: 'Nginx' },
    { value: 'objectivec', label: 'Objective-C' },
    { value: 'perl', label: 'Perl' },
    { value: 'php', label: 'PHP' },
    { value: 'plaintext', label: 'Plain Text' },
    { value: 'powershell', label: 'PowerShell' },
    { value: 'python', label: 'Python' },
    { value: 'r', label: 'R' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'rust', label: 'Rust' },
    { value: 'scala', label: 'Scala' },
    { value: 'scss', label: 'SCSS' },
    { value: 'sql', label: 'SQL' },
    { value: 'swift', label: 'Swift' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'vbnet', label: 'VB.NET' },
    { value: 'xml', label: 'XML' },
    { value: 'yaml', label: 'YAML' },
];

function insertCodeBlock() {
    // Save selection and selected text
    const sel = window.getSelection();
    // Prevent code block insertion inside table cells
    if (sel.rangeCount && isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内ではコードブロックを作成できません。');
        return;
    }
    let savedRange = null;
    let selectedText = '';
    if (sel.rangeCount) {
        savedRange = sel.getRangeAt(0).cloneRange();
        selectedText = sel.toString();
    }

    const fields = [
        { key: 'lang', label: 'プログラミング言語', type: 'select', value: 'javascript', options: CODE_LANGUAGES },
    ];

    showModal('コードブロックを挿入', fields, (values) => {
        const lang = values.lang || '';
        doInsertCodeBlock(lang, savedRange, selectedText);
    });
}

function doInsertCodeBlock(lang, savedRange, selectedText) {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    if (lang) code.className = 'language-' + lang;
    // Use selected text if available, otherwise use placeholder
    code.textContent = selectedText || 'コードをここに記述';
    pre.appendChild(code);

    // Restore selection first
    if (!editor) {
        console.error('Editor element not found');
        return;
    }
    editor.focus();
    const sel = window.getSelection();
    if (savedRange) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }

    // Insert at cursor position
    if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();

        // Make sure we're inserting at block level
        const block = getParentBlock(range.startContainer);
        const toggleContent = block ? block.closest('.toggle-content') : null;
        if (block && block !== editor) {
            block.parentNode.insertBefore(pre, block.nextSibling);
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            pre.parentNode.insertBefore(p, pre.nextSibling);
            if (block.textContent.trim() === '') block.remove();
        } else {
            editor.appendChild(pre);
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            editor.appendChild(p);
        }
        // Ensure editable lines at start/end of toggle-content
        if (toggleContent) {
            ensureToggleContentEditable(toggleContent);
        }

        // Select the code content (whether placeholder or selected text)
        const codeRange = document.createRange();
        codeRange.selectNodeContents(code);
        sel.removeAllRanges();
        sel.addRange(codeRange);

        // Apply highlighting first
        if (lang && typeof hljs !== 'undefined') {
            highlightCodeBlock(code);
        }

        // Then add line numbers (wraps the highlighted HTML)
        updateLineNumbers(pre);
        
        saveEditorState(); // Save state after inserting code block
    }
}

function insertTaskList() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    // Prevent list insertion inside table cells
    if (isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内ではリストを作成できません。');
        return;
    }
    
    const block = getParentBlock(sel.anchorNode);
    const toggleContent = block ? block.closest('.toggle-content') : null;
    const selectedText = sel.toString().trim();

    if (selectedText) {
        // Convert selected lines to task list items
        const lines = selectedText.split('\n').filter(l => l.trim());
        const items = lines.map(line =>
            '<li class="task-list-item"><input type="checkbox"> ' + escapeHtml(line.trim()) + '</li>'
        ).join('');
        const html = '<ul class="contains-task-list">' + items + '</ul><p><br></p>';
        document.execCommand('insertHTML', false, html);
    } else {
        // Build task list via DOM manipulation for precise structure control
        const ul = document.createElement('ul');
        ul.className = 'contains-task-list';

        const li = document.createElement('li');
        li.className = 'task-list-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';

        // Use non-breaking space so cursor is visible and has width
        const textNode = document.createTextNode('\u00A0');

        li.appendChild(cb);
        li.appendChild(textNode);
        ul.appendChild(li);

        // Trailing paragraph for continuing editing after the list
        const p = document.createElement('p');
        p.innerHTML = '<br>';

        // Find the current block-level element to insert after
        const range = sel.getRangeAt(0);
        range.deleteContents();

        const findDirectChild = (container, node) => {
            let current = node;
            while (current && current !== container && current.parentNode !== container) {
                current = current.parentNode;
            }
            return current && current.parentNode === container ? current : null;
        };

        let insertParent = editor;
        let insertAfter = null;

        if (toggleContent) {
            insertParent = toggleContent;
            insertAfter = findDirectChild(toggleContent, range.startContainer);
        } else {
            let rootBlock = range.startContainer;
            while (rootBlock && rootBlock !== editor && rootBlock.parentNode !== editor) {
                rootBlock = rootBlock.parentNode;
            }
            if (rootBlock && rootBlock !== editor) {
                insertAfter = rootBlock;
            }
        }

        if (insertAfter && insertAfter.parentNode === insertParent) {
            insertParent.insertBefore(ul, insertAfter.nextSibling);
            insertParent.insertBefore(p, ul.nextSibling);
            // Remove empty placeholder block in the same container
            if (insertAfter.tagName === 'P' && insertAfter.textContent.trim() === '') {
                insertAfter.remove();
            }
        } else {
            insertParent.appendChild(ul);
            insertParent.appendChild(p);
        }

        // Position cursor right after the non-breaking space (beside checkbox)
        const newRange = document.createRange();
        newRange.setStart(textNode, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        editor.focus();
    }

    // Make checkboxes interactive
    editor.querySelectorAll('input[type="checkbox"][disabled]').forEach(cb => {
        cb.removeAttribute('disabled');
    });
    
    if (toggleContent) ensureToggleContentEditable(toggleContent);
    saveEditorState(); // Save state after inserting task list
}

function insertHorizontalRule() {
    const sel = window.getSelection();
    // Prevent horizontal rule insertion inside table cells
    if (sel.rangeCount && isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内では水平線を挿入できません。');
        return;
    }
    document.execCommand('insertHTML', false, '<hr><p><br></p>');
    saveEditorState(); // Save state after inserting HR
}

// ========== File Operations ==========

async function newFile() {
    createTab(null, '無題', '<p><br></p>');
    editor.focus();
}

// Open a file from a given path (used by both dialog and drag-and-drop)
async function openFileFromPath(filePath) {
    try {
        // Check if file is already open
        const existingTab = tabs.find(t => t.filePath === filePath);
        if (existingTab) {
            switchTab(existingTab.id);
            return;
        }

        let contents = await readTextFile(filePath);

        // Resolve relative image paths to asset protocol URLs for display
        const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        const fileDir = filePath.substring(0, lastSlash);
        contents = resolveRelativeImages(contents, fileDir);
        contents = await resolveRelativeCsvLinks(contents, fileDir);

        // Notion エクスポート形式の複数行テーブルセルを正規化
        contents = preprocessNotionMarkdown(contents);

        const filename = filePath.split('/').pop().split('\\').pop();
        const html = (typeof marked !== 'undefined') ? marked.parse(contents) : contents;
        createTab(filePath, filename, html);
    } catch (err) {
        console.error('Error opening file:', err);
        throw err;
    }
}

async function openFile() {
    try {
        const selected = await tauriOpen({
            multiple: true,
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
        });

        if (selected) {
            // Handle both single and multiple file selections
            const files = Array.isArray(selected) ? selected : [selected];
            for (const filePath of files) {
                await openFileFromPath(filePath);
            }
        }
    } catch (err) {
        console.error('Error opening file:', err);
        showError('ファイルを開けませんでした: ' + err);
    }
}

// Resolve relative image paths in Markdown to asset protocol URLs for display
// This is a synchronous, lightweight string replacement (no file I/O)
function resolveRelativeImages(markdown, fileDir) {
    // Handle nested parentheses in URLs (e.g., Notion exports with unencoded parens)
    const imgRegex = /!\[([^\]]*)\]\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
    let match;
    const replacements = [];

    while ((match = imgRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const alt = match[1];
        const rawPath = match[2];

        // Skip data URIs, http(s) URLs, absolute paths, and already-converted asset URLs
        if (rawPath.startsWith('data:') || rawPath.startsWith('http://') ||
            rawPath.startsWith('https://') || rawPath.startsWith('/') ||
            rawPath.startsWith('asset://')) {
            continue;
        }

        // URL-decode the path (Notion exports use URL-encoded paths)
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch (e) {
            decodedPath = rawPath;
        }

        // Resolve to absolute path and convert to asset protocol URL
        const absolutePath = fileDir + '/' + decodedPath;
        try {
            const assetUrl = convertFileSrc(absolutePath);
            replacements.push({
                original: fullMatch,
                replacement: '![' + alt + '](' + assetUrl + ')'
            });
        } catch (err) {
            console.warn('Could not convert to asset URL:', absolutePath, err);
        }
    }

    // Apply replacements
    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }
    return result;
}

// Resolve relative CSV links in Markdown to inline Markdown tables
async function resolveRelativeCsvLinks(markdown, fileDir) {
    // Match links ending in .csv, handling nested parentheses in URLs
    const linkRegex = /\[([^\]]*)\]\(([^)]*(?:\([^)]*\)[^)]*)*\.csv)\)/g;
    let match;
    const replacements = [];

    while ((match = linkRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const linkText = match[1];
        const rawPath = match[2];

        // Skip http(s) URLs and absolute paths
        if (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('/')) {
            continue;
        }

        // URL-decode the path (Notion exports use URL-encoded paths)
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch (e) {
            decodedPath = rawPath;
        }

        const absolutePath = fileDir + '/' + decodedPath;

        try {
            const csvText = await readTextFile(absolutePath);
            const table = csvToMarkdownTable(csvText, linkText);
            if (table) {
                replacements.push({ original: fullMatch, replacement: table });
            }
        } catch (err) {
            console.warn('Could not resolve CSV link:', absolutePath, err);
        }
    }

    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }
    return result;
}

// Parse CSV text and convert to Markdown table
function csvToMarkdownTable(csvText, title) {
    const rows = parseCsv(csvText);
    if (rows.length === 0) return null;

    // Find max columns
    const maxCols = Math.max(...rows.map(r => r.length));
    if (maxCols === 0) return null;

    // Normalize rows to have equal columns
    const normalized = rows.map(row => {
        while (row.length < maxCols) row.push('');
        return row;
    });

    // Build Markdown table
    let md = '';
    if (title) {
        md += '**' + title + '**\n\n';
    }

    // Header row
    md += '| ' + normalized[0].map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    // Separator
    md += '| ' + normalized[0].map(() => '---').join(' | ') + ' |\n';
    // Data rows
    for (let i = 1; i < normalized.length; i++) {
        md += '| ' + normalized[i].map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    }

    return md;
}

// Simple CSV parser that handles quoted fields
function parseCsv(text) {
    const rows = [];
    let current = [];
    let field = '';
    let inQuotes = false;
    const len = text.length;

    for (let i = 0; i < len; i++) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < len && text[i + 1] === '"') {
                    field += '"';
                    i++; // skip escaped quote
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                current.push(field.trim());
                field = '';
            } else if (ch === '\n') {
                current.push(field.trim());
                if (current.some(c => c !== '')) {
                    rows.push(current);
                }
                current = [];
                field = '';
            } else if (ch === '\r') {
                // skip carriage return
            } else {
                field += ch;
            }
        }
    }

    // Last field/row
    current.push(field.trim());
    if (current.some(c => c !== '')) {
        rows.push(current);
    }

    return rows;
}

async function saveFile() {
    const tab = getActiveTab();
    if (!tab) return;

    try {
        let filePath = tab.filePath;

        if (!filePath) {
            filePath = await tauriSave({
                filters: [{ name: 'Markdown', extensions: ['md'] }]
            });
        }

        if (filePath) {
            let markdown = getMarkdown();
            markdown = await resolveImagesForSave(markdown, filePath);
            await writeTextFile(filePath, markdown);
            tab.filePath = filePath;
            tab.title = filePath.split('/').pop().split('\\').pop();
            tab.isModified = false;
            renderTabs();
            updateStatusBar();
        }
    } catch (err) {
        console.error('Error saving file:', err);
        showError('ファイルを保存できませんでした: ' + err);
    }
}

// ========== Save As ==========
async function saveAsFile() {
    const tab = getActiveTab();
    if (!tab) return;

    try {
        const defaultPath = tab.filePath || (tab.title.endsWith('.md') ? tab.title : tab.title + '.md');
        const filePath = await tauriSave({
            defaultPath: defaultPath,
            filters: [{ name: 'Markdown', extensions: ['md'] }]
        });

        if (filePath) {
            let markdown = getMarkdown();
            markdown = await resolveImagesForSave(markdown, filePath);
            await writeTextFile(filePath, markdown);
            tab.filePath = filePath;
            tab.title = filePath.split('/').pop().split('\\').pop();
            tab.isModified = false;
            renderTabs();
            updateStatusBar();
        }
    } catch (err) {
        console.error('Error saving file as:', err);
        showError('ファイルを保存できませんでした: ' + err);
    }
}

// ========== Resolve Images for Save ==========
// Convert asset:// URLs back to relative paths, and save Base64 images to files
async function resolveImagesForSave(markdown, mdFilePath) {
    const lastSlash = Math.max(mdFilePath.lastIndexOf('/'), mdFilePath.lastIndexOf('\\'));
    const fileDir = mdFilePath.substring(0, lastSlash);
    const mdFileName = mdFilePath.substring(lastSlash + 1).replace(/\.md$/i, '');

    // --- Step 1: Convert asset URLs back to relative paths ---
    // macOS: asset://localhost/ENCODED_PATH
    // Windows: https://asset.localhost/PATH
    // Both forms need to be handled
    const replacements = [];

    function assetUrlToAbsPath(url) {
        // macOS format: asset://localhost/%2Fpath%2Fto%2Ffile
        if (url.startsWith('asset://localhost/')) {
            return decodeURIComponent(url.substring('asset://localhost/'.length));
        }
        // Windows format: https://asset.localhost/PATH
        if (url.startsWith('https://asset.localhost/')) {
            return decodeURIComponent(url.substring('https://asset.localhost/'.length));
        }
        return null;
    }

    // Pattern: ![alt](asset://localhost/...) or ![alt](https://asset.localhost/...)
    const mdAssetRegex = /!\[([^\]]*)\]\(((?:asset:\/\/localhost\/|https:\/\/asset\.localhost\/)[^)]+)\)/g;
    let match;
    while ((match = mdAssetRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const alt = match[1];
        const assetUrl = match[2];
        const absPath = assetUrlToAbsPath(assetUrl);
        if (absPath && absPath.startsWith(fileDir + '/')) {
            const relPath = absPath.substring(fileDir.length + 1);
            replacements.push({ original: fullMatch, replacement: '![' + alt + '](' + relPath + ')' });
        }
    }

    // Pattern: <img src="asset://localhost/..." or <img src="https://asset.localhost/...">
    const htmlAssetRegex = /<img\s+src="((?:asset:\/\/localhost\/|https:\/\/asset\.localhost\/)[^"]*)"\s*alt="([^"]*)"(?:\s*width="(\d+)")?\s*\/?>/g;
    while ((match = htmlAssetRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const assetUrl = match[1];
        const alt = match[2];
        const width = match[3];
        const absPath = assetUrlToAbsPath(assetUrl);
        if (absPath && absPath.startsWith(fileDir + '/')) {
            const relPath = absPath.substring(fileDir.length + 1);
            const widthAttr = width ? ' width="' + width + '"' : '';
            replacements.push({ original: fullMatch, replacement: '<img src="' + relPath + '" alt="' + alt + '"' + widthAttr + '>' });
        }
    }

    // Apply asset URL replacements first
    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }

    // --- Step 2: Save Base64 images (from paste) to files ---
    // Detect image directory for new images
    let imageDir = null;

    // Check companion directory (Notion-style)
    try {
        const exactDir = fileDir + '/' + mdFileName;
        if (await exists(exactDir)) { imageDir = mdFileName; }
    } catch (e) { /* ignore */ }
    if (!imageDir) {
        const notionHashMatch = mdFileName.match(/^(.+)\s+[0-9a-f]{20,32}$/);
        if (notionHashMatch) {
            try {
                const baseDir = fileDir + '/' + notionHashMatch[1];
                if (await exists(baseDir)) { imageDir = notionHashMatch[1]; }
            } catch (e) { /* ignore */ }
        }
    }
    // Check from existing relative image paths in the markdown
    if (!imageDir) {
        const existingImgMatch = result.match(/!\[[^\]]*\]\(([^)]+\/)[^/]+\.[a-zA-Z]+\)/);
        if (existingImgMatch) {
            const relDir = existingImgMatch[1].replace(/\/$/, '');
            try {
                if (await exists(fileDir + '/' + relDir)) { imageDir = relDir; }
            } catch (e) { /* ignore */ }
        }
    }
    if (!imageDir) { imageDir = 'images'; }

    // Match Base64 images (from paste operations)
    const mdImgRegex = /!\[([^\]]*)\]\(data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=\s]+)\)/g;
    const htmlImgRegex = /<img\s+src="data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=\s]+)"\s*alt="([^"]*)"(?:\s*width="(\d+)")?\s*\/?>/g;

    // Scan existing files in image directory to avoid overwriting
    let imgCounter = 0;
    try {
        const dirPath = fileDir + '/' + imageDir;
        if (await exists(dirPath)) {
            const entries = await readDir(dirPath);
            for (const entry of entries) {
                const name = entry.name || '';
                const counterMatch = name.match(/_(\d{3})\.[a-zA-Z]+$/);
                if (counterMatch) {
                    const num = parseInt(counterMatch[1], 10);
                    if (num > imgCounter) imgCounter = num;
                }
            }
        }
    } catch (e) { /* ignore - start from 0 */ }
    const base64Replacements = [];

    while ((match = mdImgRegex.exec(result)) !== null) {
        imgCounter++;
        const fullMatch = match[0];
        const alt = match[1];
        const mime = match[2];
        const base64Data = match[3].replace(/\s/g, '');
        const ext = mimeToExt(mime);
        const fileName = generateImageFileName(alt, imgCounter, ext);
        try {
            await saveImageFile(fileDir, imageDir, fileName, base64Data);
            base64Replacements.push({ original: fullMatch, replacement: '![' + alt + '](' + imageDir + '/' + fileName + ')' });
        } catch (err) { console.warn('Failed to save image:', fileName, err); }
    }

    while ((match = htmlImgRegex.exec(result)) !== null) {
        imgCounter++;
        const fullMatch = match[0];
        const mime = match[1];
        const base64Data = match[2].replace(/\s/g, '');
        const alt = match[3];
        const width = match[4];
        const ext = mimeToExt(mime);
        const fileName = generateImageFileName(alt, imgCounter, ext);
        try {
            await saveImageFile(fileDir, imageDir, fileName, base64Data);
            const widthAttr = width ? ' width="' + width + '"' : '';
            base64Replacements.push({ original: fullMatch, replacement: '<img src="' + imageDir + '/' + fileName + '" alt="' + alt + '"' + widthAttr + '>' });
        } catch (err) { console.warn('Failed to save image:', fileName, err); }
    }

    for (const r of base64Replacements) {
        result = result.replace(r.original, r.replacement);
    }
    return result;
}

function mimeToExt(mime) {
    const map = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/bmp': 'bmp',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
    };
    return map[mime] || 'png';
}

function generateImageFileName(alt, counter, ext) {
    // Use alt text as filename if it looks like a filename with extension
    if (alt && /^[\w.-]+$/.test(alt) && alt.includes('.')) {
        const name = alt.replace(/\.[^.]+$/, '');
        const origExt = alt.split('.').pop();
        return name + '_' + String(counter).padStart(3, '0') + '.' + origExt;
    }
    // Use alt text (sanitized) + counter for uniqueness
    if (alt && alt.trim()) {
        const sanitized = alt.trim()
            .replace(/[^\w\u3000-\u9FFF\u4E00-\u9FFF\uF900-\uFAFF-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50);
        if (sanitized) {
            return sanitized + '_' + String(counter).padStart(3, '0') + '.' + ext;
        }
    }
    return 'image_' + String(counter).padStart(3, '0') + '.' + ext;
}

async function saveImageFile(fileDir, imageDir, fileName, base64Data) {
    const dirPath = fileDir + '/' + imageDir;

    // Create directory if it doesn't exist
    try {
        const dirExists = await exists(dirPath);
        if (!dirExists) {
            await createDir(dirPath, { recursive: true });
        }
    } catch (e) {
        // Try to create anyway
        try {
            await createDir(dirPath, { recursive: true });
        } catch (e2) {
            // Directory might already exist, continue
        }
    }

    // Decode Base64 to binary
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    // Write file
    const filePath = dirPath + '/' + fileName;
    await writeBinaryFile(filePath, bytes);
}

// ========== PDF Export ==========
async function exportPDF() {
    try {
        const tab = getActiveTab();
        const fileName = tab ? tab.title.replace(/\.md$/i, '') : '無題';

        // Ask user where to save the HTML file (they'll print to PDF from browser)
        const savePath = await tauriSave({
            defaultPath: fileName + '.html',
            filters: [{ name: 'HTML', extensions: ['html'] }]
        });
        if (!savePath) return;

        // Collect editor content (clean clone)
        const clone = editor.cloneNode(true);

        // Remove UI elements from clone
        clone.querySelectorAll('.code-copy-container, .code-copy-btn, .toc-delete-btn, .image-resize-handle, .image-copy-btn, .line-numbers-gutter').forEach(el => el.remove());

        // Convert asset:// / https://asset.localhost/ URLs to Base64 for PDF export
        // On macOS, Tauri uses asset://localhost/ENCODED_PATH
        // On Windows, Tauri uses https://asset.localhost/PATH
        // Both forms need to be handled
        const allImages = clone.querySelectorAll('img');
        for (const img of allImages) {
            try {
                const srcAttr = img.getAttribute('src') || '';
                let imgFilePath = null;

                if (srcAttr.startsWith('asset://localhost/')) {
                    // macOS format: asset://localhost/%2Fpath%2Fto%2Ffile
                    imgFilePath = decodeURIComponent(srcAttr.substring('asset://localhost/'.length));
                } else if (srcAttr.startsWith('https://asset.localhost/')) {
                    // Windows format: https://asset.localhost/path/to/file
                    imgFilePath = decodeURIComponent(srcAttr.substring('https://asset.localhost/'.length));
                }

                if (!imgFilePath) continue; // Skip non-asset images (data:, http:, etc.)

                // Read the image file
                const binaryData = await readBinaryFile(imgFilePath);

                // Detect MIME type from file extension
                const lowerPath = imgFilePath.toLowerCase();
                let mimeType = 'image/png';
                if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
                    mimeType = 'image/jpeg';
                } else if (lowerPath.endsWith('.gif')) {
                    mimeType = 'image/gif';
                } else if (lowerPath.endsWith('.webp')) {
                    mimeType = 'image/webp';
                } else if (lowerPath.endsWith('.svg')) {
                    mimeType = 'image/svg+xml';
                } else if (lowerPath.endsWith('.bmp')) {
                    mimeType = 'image/bmp';
                }

                // Convert to Base64 (handle large files by chunking)
                const bytes = new Uint8Array(binaryData);
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                }
                const base64 = btoa(binary);
                img.setAttribute('src', `data:${mimeType};base64,${base64}`);
            } catch (err) {
                console.error('Failed to convert image to Base64:', img.getAttribute('src'), err);
                // Keep original URL (will be broken but better than removing)
            }
        }

        const editorHTML = clone.innerHTML;

        // Read current stylesheet
        let cssText = '';
        try {
            const stylesheets = document.styleSheets;
            for (let i = 0; i < stylesheets.length; i++) {
                try {
                    const rules = stylesheets[i].cssRules || stylesheets[i].rules;
                    for (let j = 0; j < rules.length; j++) {
                        cssText += rules[j].cssText + '\n';
                    }
                } catch (e) {
                    // Cross-origin stylesheet, skip
                }
            }
        } catch (e) {
            console.error('Failed to read stylesheets:', e);
        }

        // Also collect hljs inline styles by grabbing the hljs theme link
        let hljsCSS = '';
        try {
            const resp = await fetch('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-light.min.css');
            if (resp.ok) hljsCSS = await resp.text();
        } catch (e) { /* ignore */ }

        // Build complete HTML document
        const fullHTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
/* Base styles */
body {
    font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 400;
    margin: 40px auto;
    max-width: 900px;
    padding: 0 20px;
    color: #333;
    line-height: 1.8;
    background: white;
}

/* Headings */
h1, h2, h3, h4, h5, h6 { font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; color: #1a1a1a; }
h1 { font-size: 2em; border-bottom: 2px solid #eaecef; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }

/* Paragraphs */
p { margin-bottom: 16px; }

/* Links */
a { color: #0366d6; text-decoration: none; }

/* Inline code */
code {
    padding: 0.2em 0.4em;
    font-size: 85%;
    color: #c7254e;
    background-color: #f9f2f4;
    border-radius: 6px;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

/* Code blocks */
pre {
    position: relative;
    margin-bottom: 16px;
    padding: 0;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #fafafa;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    display: flex;
    flex-direction: row;
}
pre code {
    padding: 16px;
    margin: 0;
    color: inherit;
    background-color: transparent;
    border-radius: 0;
    font-size: 100%;
    display: block;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    flex: 1;
    min-width: 0;
}

/* Tables */
table { border-collapse: collapse; margin-bottom: 16px; width: 100%; }
th, td { padding: 6px 13px; border: 1px solid #ddd; }
th { background-color: #f6f8fa; font-weight: 700; }

/* Blockquote */
blockquote {
    margin: 0 0 16px;
    padding: 0 1em;
    color: #6a737d;
    border-left: 4px solid #dfe2e5;
}

/* Lists */
ul, ol { margin-bottom: 16px; padding-left: 2em; }
li { margin-bottom: 4px; }

/* Task list */
.task-list-item { list-style: none; margin-left: -1.5em; }
input[type="checkbox"] { margin-right: 0.5em; }

/* HR */
hr { border: none; border-top: 2px solid #eaecef; margin: 24px 0; }

/* Images */
img { max-width: 100%; }

/* TOC */
.toc-container {
    margin: 16px 0;
    padding: 16px 20px;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    border-left: 4px solid #4a9eff;
}
.toc-container ul { list-style: none; padding-left: 0; }
.toc-container li { padding: 2px 0; font-size: 14px; }
.toc-container a { color: #0366d6; text-decoration: none; }

/* Mermaid */
.mermaid-container { margin: 16px 0; text-align: center; }

/* Highlight.js theme */
${hljsCSS}

/* Print optimization */
@media print {
    body { margin: 0; padding: 0; max-width: 100%; }
    pre { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
    img { page-break-inside: avoid; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
    pre code { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    blockquote { border-left-color: #dfe2e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toc-container { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    code { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
${editorHTML}
<script>
// Auto-trigger print dialog, then close the tab
window.onload = function() {
    window.print();
};
<\/script>
</body>
</html>`;

        await writeTextFile(savePath, fullHTML);

        // Open in default browser for printing
        await invoke('open_in_browser', { path: savePath });
    } catch (err) {
        console.error('PDF export error:', err);
        showError('PDF出力に失敗しました: ' + err);
    }
}

// ========== Tab Management ==========

function createTab(filePath, title, htmlContent) {
    const id = ++tabIdCounter;
    const tab = {
        id,
        filePath: filePath || null,
        title: title || '無題',
        content: htmlContent || '<p><br></p>',
        isModified: false,
        scrollTop: 0,
    };
    tabs.push(tab);
    switchTab(id);
    return tab;
}

function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
}

function switchTab(id) {
    // Save current tab state
    const current = getActiveTab();
    if (current) {
        current.content = editor.innerHTML;
        current.scrollTop = editor.parentElement.scrollTop;
    }

    activeTabId = id;
    const tab = getActiveTab();
    if (!tab) return;

    // Restore tab content
    editor.innerHTML = tab.content;
    editor.parentElement.scrollTop = tab.scrollTop;
    
    // Ensure editor starts with an editable element
    ensureEditableStart();
    
    // Reset undo/redo stack when switching tabs
    undoStack = [];
    redoStack = [];
    currentState = null;
    saveEditorState(); // Save initial state for new tab

    // Make checkboxes interactive
    editor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.removeAttribute('disabled');
    });

    // Highlight code blocks
    editor.querySelectorAll('pre code').forEach(block => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });

    // Render Mermaid diagrams
    renderMermaidBlocks();

    // Setup toggle blocks (open, contenteditable, toggle-content wrapper, delete buttons)
    setupToggleBlocks();

    // Add delete buttons to TOC containers
    setupTocDeleteButtons();

    // Add line numbers to code blocks
    updateAllLineNumbers();

    // Setup image error handling
    setupImageErrorHandling();

    renderTabs();
    updateWordCount();
    updateStatusBar();
}

function closeTab(id) {
    const tabIndex = tabs.findIndex(t => t.id === id);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];

    // Ask to save if modified
    if (tab.isModified) {
        const ok = confirm('"' + tab.title + '" は保存されていません。閉じますか？');
        if (!ok) return;
    }

    tabs.splice(tabIndex, 1);

    if (tabs.length === 0) {
        // No tabs left: create a new empty one
        createTab(null, '無題', '<p><br></p>');
    } else if (id === activeTabId) {
        // Switch to nearest tab
        const newIndex = Math.min(tabIndex, tabs.length - 1);
        switchTab(tabs[newIndex].id);
    } else {
        renderTabs();
    }
}

function renderTabs() {
    if (!tabList) return;
    tabList.innerHTML = '';

    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
        el.title = tab.filePath || tab.title;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.textContent = tab.title;
        el.appendChild(titleSpan);

        if (tab.isModified) {
            const dot = document.createElement('span');
            dot.className = 'tab-modified';
            dot.textContent = '●';
            el.appendChild(dot);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
        });
        closeBtn.addEventListener('click', e => {
            e.stopPropagation();
            closeTab(tab.id);
        });
        el.appendChild(closeBtn);

        el.addEventListener('mousedown', e => e.preventDefault());
        el.addEventListener('click', () => {
            if (tab.id !== activeTabId) switchTab(tab.id);
        });

        tabList.appendChild(el);
    });
}

function markModified() {
    const tab = getActiveTab();
    if (tab && !tab.isModified) {
        tab.isModified = true;
        renderTabs();
    }
}

function updateStatusBar() {
    const tab = getActiveTab();
    if (!tab) return;

    // Show full path in status bar
    if (tab.filePath) {
        currentFileSpan.textContent = tab.filePath;
        currentFileSpan.title = tab.filePath;
    } else {
        currentFileSpan.textContent = '無題';
        currentFileSpan.title = '';
    }
}

// ========== Date/Time Insertion ==========

async function insertDate() {
    try {
        const date = await invoke('get_current_date');
        document.execCommand('insertText', false, date);
    } catch (err) {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        document.execCommand('insertText', false, date);
    }
    saveEditorState(); // Save state after inserting date
}

async function insertTime() {
    try {
        const time = await invoke('get_current_time');
        document.execCommand('insertText', false, time);
    } catch (err) {
        const now = new Date();
        const time = now.toTimeString().split(' ')[0];
        document.execCommand('insertText', false, time);
    }
    saveEditorState(); // Save state after inserting time
}

async function insertDateTime() {
    try {
        const datetime = await invoke('get_current_datetime');
        document.execCommand('insertText', false, datetime);
    } catch (err) {
        const now = new Date();
        const datetime = now.toISOString().replace('T', ' ').split('.')[0];
        document.execCommand('insertText', false, datetime);
    }
    saveEditorState(); // Save state after inserting datetime
}

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

// Check if the current selection or node is inside a table cell
function isInsideTableCell(node) {
    let current = node;
    while (current && current !== editor) {
        if (current.tagName === 'TD' || current.tagName === 'TH') {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

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

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function updateWordCount() {
    const text = editor.textContent || '';
    const chars = text.replace(/\u200B/g, '').length; // Exclude zero-width spaces
    const lines = text.split('\n').length;
    if (wordCountSpan) {
        wordCountSpan.textContent = chars + ' 文字 | ' + lines + ' 行';
    }
}

// ========== Table Context Menu ==========
let tableContextMenu = null;
let activeTableCell = null;

function setupTableContextMenu() {
    // Create context menu element
    tableContextMenu = document.createElement('div');
    tableContextMenu.id = 'tableContextMenu';
    tableContextMenu.className = 'table-context-menu';
    tableContextMenu.innerHTML = `
        <button data-action="addRowAbove">↑ 上に行を追加</button>
        <button data-action="addRowBelow">↓ 下に行を追加</button>
        <div class="ctx-divider"></div>
        <button data-action="addColLeft">← 左に列を追加</button>
        <button data-action="addColRight">→ 右に列を追加</button>
        <div class="ctx-divider"></div>
        <button data-action="deleteRow" class="ctx-danger">行を削除</button>
        <button data-action="deleteCol" class="ctx-danger">列を削除</button>
    `;
    tableContextMenu.style.display = 'none';
    document.body.appendChild(tableContextMenu);

    // Prevent menu from stealing editor focus
    tableContextMenu.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
    });
    tableContextMenu.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        handleTableAction(btn.dataset.action);
        hideTableContextMenu();
    });

    // Show on right-click inside table cell
    editor.addEventListener('contextmenu', e => {
        const cell = e.target.closest('td, th');
        if (cell && editor.contains(cell)) {
            e.preventDefault();
            activeTableCell = cell;
            showTableContextMenu(e.clientX, e.clientY);
        } else {
            hideTableContextMenu();
        }
    });

    // Hide on click/key elsewhere
    document.addEventListener('click', e => {
        if (tableContextMenu && !tableContextMenu.contains(e.target)) {
            hideTableContextMenu();
        }
    });
    document.addEventListener('keydown', () => hideTableContextMenu());
}

function showTableContextMenu(x, y) {
    tableContextMenu.style.display = 'block';
    tableContextMenu.style.left = x + 'px';
    tableContextMenu.style.top = y + 'px';
    // Keep within viewport
    requestAnimationFrame(() => {
        const rect = tableContextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tableContextMenu.style.left = (window.innerWidth - rect.width - 8) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            tableContextMenu.style.top = (window.innerHeight - rect.height - 8) + 'px';
        }
    });
}

function hideTableContextMenu() {
    if (tableContextMenu) tableContextMenu.style.display = 'none';
    activeTableCell = null;
}

function handleTableAction(action) {
    if (!activeTableCell) return;

    const row = activeTableCell.closest('tr');
    const table = activeTableCell.closest('table');
    if (!row || !table) return;

    const cellIndex = Array.from(row.children).indexOf(activeTableCell);
    const allRows = table.querySelectorAll('tr');
    const colCount = allRows[0] ? allRows[0].children.length : 0;
    const isHeader = activeTableCell.tagName === 'TH' || (row.parentNode && row.parentNode.tagName === 'THEAD');

    switch (action) {
        case 'addRowAbove': {
            const newRow = createTableRow(colCount, 'td');
            if (isHeader) {
                let tbody = table.querySelector('tbody');
                if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
                tbody.insertBefore(newRow, tbody.firstChild);
            } else {
                row.parentNode.insertBefore(newRow, row);
            }
            break;
        }
        case 'addRowBelow': {
            const newRow = createTableRow(colCount, 'td');
            if (isHeader) {
                let tbody = table.querySelector('tbody');
                if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
                tbody.insertBefore(newRow, tbody.firstChild);
            } else {
                row.parentNode.insertBefore(newRow, row.nextSibling);
            }
            break;
        }
        case 'addColLeft': {
            allRows.forEach(r => {
                const tag = r.parentNode && r.parentNode.tagName === 'THEAD' ? 'th' : 'td';
                const newCell = document.createElement(tag);
                newCell.innerHTML = '&nbsp;';
                r.insertBefore(newCell, r.children[cellIndex]);
            });
            break;
        }
        case 'addColRight': {
            allRows.forEach(r => {
                const tag = r.parentNode && r.parentNode.tagName === 'THEAD' ? 'th' : 'td';
                const newCell = document.createElement(tag);
                newCell.innerHTML = '&nbsp;';
                const ref = r.children[cellIndex];
                r.insertBefore(newCell, ref ? ref.nextSibling : null);
            });
            break;
        }
        case 'deleteRow': {
            if (isHeader) break; // Don't delete header row
            const tbody = row.parentNode;
            row.remove();
            if (tbody.tagName === 'TBODY' && tbody.children.length === 0) {
                const thead = table.querySelector('thead');
                if (!thead || thead.children.length === 0) {
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    table.parentNode.replaceChild(p, table);
                }
            }
            break;
        }
        case 'deleteCol': {
            if (colCount <= 1) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                table.parentNode.replaceChild(p, table);
            } else {
                allRows.forEach(r => {
                    if (r.children[cellIndex]) r.children[cellIndex].remove();
                });
            }
            break;
        }
    }

    markModified();
}

function createTableRow(colCount, tag) {
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
        const cell = document.createElement(tag);
        cell.innerHTML = '&nbsp;';
        tr.appendChild(cell);
    }
    return tr;
}

// ========== Mermaid Rendering ==========
async function renderMermaidBlocks() {
    if (typeof mermaid === 'undefined') return;

    // Ensure mermaid is initialized
    try {
        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    } catch (e) { /* already initialized */ }

    const codeBlocks = editor.querySelectorAll('pre code.language-mermaid');
    for (let i = 0; i < codeBlocks.length; i++) {
        const code = codeBlocks[i];
        const pre = code.parentElement;
        const source = code.textContent;

        try {
            const id = 'mermaid-' + Date.now() + '-' + i;
            const { svg } = await mermaid.render(id, source);

            const container = document.createElement('div');
            container.className = 'mermaid-container';
            container.setAttribute('data-mermaid-source', source);
            container.setAttribute('contenteditable', 'false');
            container.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;

            // Double-click to edit
            container.addEventListener('dblclick', () => {
                editMermaidBlock(container);
            });

            pre.parentNode.replaceChild(container, pre);
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    }
}

function editMermaidBlock(container) {
    const source = container.getAttribute('data-mermaid-source') || '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    overlay.innerHTML =
        '<div class="modal-dialog" style="min-width:500px">' +
        '<div class="modal-title">Mermaid図を編集</div>' +
        '<div class="modal-field">' +
        '<label>Mermaid記法</label>' +
        '<textarea id="mermaidEditArea" style="width:100%;height:200px;font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:4px;resize:vertical;font-size:13px;line-height:1.5;box-sizing:border-box">' +
        escapeHtml(source) + '</textarea>' +
        '</div>' +
        '<div class="modal-buttons">' +
        '<button class="modal-btn modal-btn-cancel" id="mermaidCancel">キャンセル</button>' +
        '<button class="modal-btn modal-btn-ok" id="mermaidOk">OK</button>' +
        '</div></div>';

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#mermaidEditArea');
    setTimeout(() => textarea.focus(), 50);

    overlay.querySelector('#mermaidOk').addEventListener('click', async () => {
        const newSource = textarea.value.trim();
        overlay.remove();
        if (!newSource) return;

        try {
            const id = 'mermaid-edit-' + Date.now();
            const { svg } = await mermaid.render(id, newSource);
            container.setAttribute('data-mermaid-source', newSource);
            container.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
            container.addEventListener('dblclick', () => editMermaidBlock(container));
            markModified();
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    });

    overlay.querySelector('#mermaidCancel').addEventListener('click', () => {
        overlay.remove();
        editor.focus();
    });

    // Enter in textarea should be allowed (new line), Escape closes
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            overlay.remove();
            editor.focus();
        }
    });
}

// ========== Toggle Blocks Setup ==========
function unwrapToggle(details) {
    if (!details || !details.parentNode) return;
    const parent = details.parentNode;
    const summary = details.querySelector(':scope > summary');
    const contentDiv = details.querySelector(':scope > .toggle-content');
    let nodes = [];
    if (contentDiv) {
        nodes = Array.from(contentDiv.childNodes);
    } else {
        nodes = Array.from(details.childNodes).filter(n => n !== summary);
    }
    if (nodes.length === 0) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        nodes = [p];
    }
    const fragment = document.createDocumentFragment();
    nodes.forEach(node => fragment.appendChild(node));
    const firstInserted = fragment.firstChild;
    parent.insertBefore(fragment, details);
    details.remove();
    if (firstInserted) {
        if (firstInserted.nodeType === Node.ELEMENT_NODE) {
            setCursorTo(firstInserted);
        } else if (firstInserted.nodeType === Node.TEXT_NODE) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(firstInserted, firstInserted.textContent.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    markModified();
}

/**
 * Ensure toggle-content has editable paragraphs at start and end
 * so users can always add content before/after block elements (tables, code blocks, etc.)
 * Call this after inserting block elements into toggle-content.
 */
function ensureToggleContentEditable(contentDiv) {
    if (!contentDiv) return;
    const blockElements = ['PRE', 'TABLE', 'UL', 'OL', 'BLOCKQUOTE', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DETAILS'];
    const firstChild = contentDiv.firstElementChild;
    if (firstChild && blockElements.includes(firstChild.tagName)) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        contentDiv.insertBefore(p, firstChild);
    }
    const lastChild = contentDiv.lastElementChild;
    if (lastChild && blockElements.includes(lastChild.tagName)) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        contentDiv.appendChild(p);
    }
}

function setupToggleBlocks() {
    editor.querySelectorAll('details').forEach(details => {
        // Ensure details is open in editor for editing
        details.setAttribute('open', '');
        // Ensure summary is editable
        const summary = details.querySelector(':scope > summary');
        if (summary) {
            summary.setAttribute('contenteditable', 'true');
            ensureToggleDeleteButton(summary);
        }
        // Ensure toggle-content div exists
        let contentDiv = details.querySelector(':scope > .toggle-content');
        if (!contentDiv) {
            contentDiv = document.createElement('div');
            contentDiv.className = 'toggle-content';
            // Move all children after summary into contentDiv
            const children = Array.from(details.childNodes);
            let afterSummary = false;
            children.forEach(child => {
                if (child === summary) {
                    afterSummary = true;
                    return;
                }
                if (afterSummary) {
                    contentDiv.appendChild(child);
                }
            });
            if (contentDiv.children.length === 0) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
            }
            details.appendChild(contentDiv);
        }

        // Ensure editable paragraphs at start and end of toggle-content
        ensureToggleContentEditable(contentDiv);
    });
}

// ========== TOC Generation ==========
function setupTocDeleteButtons() {
    editor.querySelectorAll('.toc-container').forEach(toc => {
        // Make sure it's contenteditable=false
        if (toc.getAttribute('contenteditable') !== 'false') {
            toc.setAttribute('contenteditable', 'false');
        }
        // Add delete button if not already present
        if (!toc.querySelector('.toc-delete-btn')) {
            const btn = document.createElement('button');
            btn.className = 'toc-delete-btn';
            btn.title = '目次を削除';
            btn.textContent = '✕';
            toc.insertBefore(btn, toc.firstChild);
        }
    });
}

function insertTOC() {
    const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
        return;
    }

    // Assign unique IDs to all headings
    const idCounts = {};
    headings.forEach(h => {
        const text = h.textContent.trim();
        if (!text) return;
        // Generate a slug from the heading text
        let slug = 'heading-' + text
            .toLowerCase()
            .replace(/[^\w\u3000-\u9fff\uf900-\ufaff\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]+/g, '-')
            .replace(/^-+|-+$/g, '');
        // Handle duplicates
        if (idCounts[slug] !== undefined) {
            idCounts[slug]++;
            slug = slug + '-' + idCounts[slug];
        } else {
            idCounts[slug] = 0;
        }
        h.id = slug;
    });

    let html = '<div class="toc-container" contenteditable="false">' +
               '<button class="toc-delete-btn" title="目次を削除">✕</button>' +
               '<p><strong>📑 目次</strong></p><ul>';
    headings.forEach(h => {
        const level = parseInt(h.tagName[1]);
        const text = h.textContent.trim();
        if (text && h.id) {
            html += '<li style="margin-left:' + ((level - 1) * 20) + 'px">' +
                    '<a href="#' + h.id + '" class="toc-link">' + escapeHtml(text) + '</a></li>';
        }
    });
    html += '</ul></div><p><br></p>';

    document.execCommand('insertHTML', false, html);
    markModified();
    saveEditorState(); // Save state after inserting TOC
}

// ========== Image Resize ==========
// ========== Code Block Copy Button ==========
function setupCodeCopyButtons() {
    // Add copy buttons to existing code blocks
    addCopyButtonsToCodeBlocks();

    // Watch for new code blocks being added and update line numbers
    const observer = new MutationObserver(() => {
        addCopyButtonsToCodeBlocks();
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

        const container = document.createElement('div');
        container.className = 'code-copy-container';
        container.setAttribute('contenteditable', 'false');

        // Helper: get raw code text
        function getRawText() {
            const code = pre.querySelector('code');
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

// ========== Image Error Handling ==========
let imageMutationObserver = null;

function setupImageMutationObserver() {
    // Create a MutationObserver to watch for new images added to the editor
    if (imageMutationObserver) {
        imageMutationObserver.disconnect();
    }
    
    imageMutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Check for added nodes
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the node itself is an image
                    if (node.tagName === 'IMG') {
                        handleSingleImage(node);
                    }
                    // Check for images within the added node
                    else if (node.querySelectorAll) {
                        const images = node.querySelectorAll('img');
                        if (images.length > 0) {
                            images.forEach(img => handleSingleImage(img));
                        }
                    }
                }
            });
        });
    });
    
    // Start observing the editor
    imageMutationObserver.observe(editor, {
        childList: true,
        subtree: true
    });
}

function handleSingleImage(img) {
    // Skip if already processed
    if (img.dataset.errorHandled) {
        return;
    }
    img.dataset.errorHandled = 'true';
    
    // Function to handle error and display alt text
    const handleImageError = function() {
        // Skip if already showing alt text or if image loaded successfully
        if (this.classList.contains('img-error-processed')) {
            return;
        }
        if (this.complete && this.naturalWidth > 0) {
            return; // Image loaded successfully
        }
        
        this.classList.add('img-error-processed');
        
        const alt = this.getAttribute('alt') || '画像を読み込めません';
        const src = this.getAttribute('src') || '';
        
        // Create a container to display alt text
        const container = document.createElement('div');
        container.className = 'img-error-container';
        container.setAttribute('contenteditable', 'false');
        
        const altText = document.createElement('div');
        altText.className = 'img-error-text';
        altText.textContent = alt;
        
        const srcText = document.createElement('div');
        srcText.className = 'img-error-src';
        srcText.textContent = '(画像パス: ' + src + ')';
        
        container.appendChild(altText);
        container.appendChild(srcText);
        
        // Replace image with error container
        if (this.parentNode) {
            this.parentNode.replaceChild(container, this);
            markModified();
        }
    };
    
    // Add error event listener
    img.addEventListener('error', handleImageError);
    
    // Also add load event to mark successful loads
    img.addEventListener('load', function() {
        this.classList.add('img-loaded-successfully');
    });
    
    // Check current state
    if (img.complete) {
        // Image has finished loading (or failed)
        if (img.naturalWidth === 0 && img.naturalHeight === 0) {
            // Failed to load
            handleImageError.call(img);
        }
    }
}

function setupImageErrorHandling() {
    // Handle image load errors and display alt text
    const images = editor.querySelectorAll('img');
    
    images.forEach((img) => {
        handleSingleImage(img);
    });
}

// ========== Image Resize ==========
function setupImageResize() {
    let activeImage = null;
    let resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    resizeHandle.style.display = 'none';
    resizeHandle.innerHTML = '<div class="resize-grip"></div>';
    document.body.appendChild(resizeHandle);

    // Image copy button
    let copyBtn = document.createElement('button');
    copyBtn.className = 'image-copy-btn';
    copyBtn.textContent = '📋 Copy';
    copyBtn.title = '画像をコピー';
    document.body.appendChild(copyBtn);

    copyBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeImage) return;
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            // Use natural dimensions for best quality
            canvas.width = activeImage.naturalWidth || activeImage.width;
            canvas.height = activeImage.naturalHeight || activeImage.height;
            ctx.drawImage(activeImage, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (blob) {
                // --- Hybrid clipboard logic start ---
                // 1. Try Tauri native clipboard API if available
                if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
                    try {
                        // Convert blob to base64
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        await window.__TAURI__.tauri.invoke('copy_image_to_clipboard', { imageData: base64 });
                        showCopySuccess('(Tauri)');
                        return;
                    } catch (tauriErr) {
                        console.warn('Tauri clipboard failed, fallback to Web API:', tauriErr);
                    }
                }
                // 2. Try Web Clipboard API
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showCopySuccess();
                    return;
                } catch (clipboardErr) {
                    console.warn('Clipboard API image write failed, trying text fallback:', clipboardErr);
                }
                // 3. Fallback: copy image file name to clipboard as text
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    const imgName = activeImage.alt || activeImage.src.split('/').pop() || '画像';
                    await navigator.clipboard.writeText(imgName);
                    showCopySuccess('(ファイル名をコピー)');
                } else {
                    showCopyError('クリップボード API がサポートされていません');
                }
                // --- Hybrid clipboard logic end ---
            }
        } catch (err) {
            console.error('Image copy failed:', err);
            showCopyError();
        }

        function showCopySuccess(suffix = '') {
            copyBtn.textContent = '✅ Copied!' + (suffix ? ' ' + suffix : '');
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy';
                copyBtn.classList.remove('copied');
            }, 2500);
        }

        function showCopyError(msg = 'Failed') {
            copyBtn.textContent = '❌ ' + msg;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy';
                copyBtn.classList.remove('copied');
            }, 3000);
        }
    });

    editor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            selectImage(e.target);
        } else if (!e.target.closest('.image-resize-handle') && !e.target.closest('.image-copy-btn')) {
            deselectImage();
        }
    });

    // Add double-click handler to expand image
    editor.addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            openImageViewer(e.target);
        }
    });

    function selectImage(img) {
        deselectImage();
        activeImage = img;
        img.classList.add('image-selected');
        positionHandle();
        resizeHandle.style.display = 'block';
        copyBtn.style.display = 'block';
    }

    function deselectImage() {
        if (activeImage) {
            activeImage.classList.remove('image-selected');
        }
        activeImage = null;
        resizeHandle.style.display = 'none';
        copyBtn.style.display = 'none';
    }

    function positionHandle() {
        if (!activeImage) return;
        const rect = activeImage.getBoundingClientRect();
        resizeHandle.style.left = (rect.right - 12) + 'px';
        resizeHandle.style.top = (rect.bottom - 12) + 'px';
        // Position copy button at top-right of image
        copyBtn.style.left = (rect.right - copyBtn.offsetWidth - 4) + 'px';
        copyBtn.style.top = (rect.top + 4) + 'px';
    }

    resizeHandle.addEventListener('mousedown', (e) => {
        if (!activeImage) return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = activeImage.offsetWidth;

        function onMouseMove(ev) {
            const dx = ev.clientX - startX;
            const newWidth = Math.max(50, startWidth + dx);
            activeImage.style.width = newWidth + 'px';
            activeImage.style.height = 'auto';
            positionHandle();
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            markModified();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    const editorContainer = editor.parentElement;
    if (editorContainer) {
        editorContainer.addEventListener('scroll', () => {
            if (activeImage) positionHandle();
        });
    }
    window.addEventListener('resize', () => {
        if (activeImage) positionHandle();
    });
}

// ========== Emoji Picker ==========
let emojiPickerEl = null;

function showEmojiPicker() {
    if (emojiPickerEl && emojiPickerEl.style.display === 'block') {
        emojiPickerEl.style.display = 'none';
        return;
    }

    // Save selection
    const sel = window.getSelection();
    let savedRange = null;
    if (sel.rangeCount) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }

    if (!emojiPickerEl) {
        emojiPickerEl = document.createElement('div');
        emojiPickerEl.className = 'emoji-picker';
        emojiPickerEl.addEventListener('mousedown', e => e.preventDefault());
        document.body.appendChild(emojiPickerEl);
    }

    const commonEmojis = [
        '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
        '😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑',
        '🤗','🤔','🤫','🤭','😐','😑','😶','😏','😒','🙄',
        '😬','😮','😲','😳','🥺','😢','😭','😤','😠','😡',
        '🤯','😱','😰','😥','😓','😴','😷','🤒','🤕','🥴',
        '👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👋','🤚',
        '✋','👏','🙌','🤝','🙏','💪','❤️','🧡','💛','💚',
        '💙','💜','🖤','💔','❣️','💕','💞','💓','💗','💖',
        '⭐','🌟','✨','⚡','🔥','💥','🎉','🎊','🏆','🥇',
        '🚀','✈️','🌍','🌈','☀️','🌙','⛅','❄️','💧','🌊',
        '✅','❌','⭕','❗','❓','⚠️','💡','🔔','📌','📝',
        '📎','🔗','💻','📱','📧','📅','📊','🔒','🔑','🔧',
    ];

    emojiPickerEl.innerHTML = commonEmojis.map(e =>
        '<button class="emoji-item" data-emoji="' + e + '">' + e + '</button>'
    ).join('');

    emojiPickerEl.style.display = 'grid';

    // Position near emoji button
    const btn = document.getElementById('emojiBtn');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        emojiPickerEl.style.left = Math.min(rect.left, window.innerWidth - 330) + 'px';
        emojiPickerEl.style.top = (rect.bottom + 4) + 'px';
    }

    // Handle click
    function onEmojiClick(e) {
        const item = e.target.closest('.emoji-item');
        if (!item) return;
        const emoji = item.dataset.emoji;
        emojiPickerEl.style.display = 'none';
        emojiPickerEl.removeEventListener('click', onEmojiClick);

        // Restore selection and insert
        editor.focus();
        if (savedRange) {
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(savedRange);
        }
        document.execCommand('insertText', false, emoji);
        markModified();
        saveEditorState(); // Save state after inserting emoji
    }

    emojiPickerEl.addEventListener('click', onEmojiClick);

    // Close on click outside
    function onOutsideClick(e) {
        if (emojiPickerEl && !emojiPickerEl.contains(e.target) && e.target.id !== 'emojiBtn') {
            emojiPickerEl.style.display = 'none';
            emojiPickerEl.removeEventListener('click', onEmojiClick);
            document.removeEventListener('click', onOutsideClick);
        }
    }
    setTimeout(() => document.addEventListener('click', onOutsideClick), 0);
}

// ========== Image Viewer ==========
let imageViewerModal = null;

function setupImageViewer() {
    // Create modal element
    imageViewerModal = document.createElement('div');
    imageViewerModal.className = 'image-viewer-modal';
    imageViewerModal.innerHTML = `
        <div class="image-viewer-container">
            <button class="image-viewer-close" title="閉じる (Esc)">✕</button>
            <img class="image-viewer-img" src="" alt="">
            <div class="image-viewer-info"></div>
        </div>
    `;
    document.body.appendChild(imageViewerModal);

    // Close button
    const closeBtn = imageViewerModal.querySelector('.image-viewer-close');
    closeBtn.addEventListener('click', closeImageViewer);

    // Modal background click to close
    imageViewerModal.addEventListener('click', (e) => {
        if (e.target === imageViewerModal) {
            closeImageViewer();
        }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && imageViewerModal && imageViewerModal.classList.contains('active')) {
            closeImageViewer();
        }
    });
}

function openImageViewer(img) {
    if (!imageViewerModal) return;

    const viewerImg = imageViewerModal.querySelector('.image-viewer-img');
    const infoDiv = imageViewerModal.querySelector('.image-viewer-info');

    viewerImg.src = img.src;
    viewerImg.alt = img.alt || '画像';
    
    // Display image info (alt text or path)
    if (img.alt) {
        infoDiv.textContent = 'Alt: ' + img.alt;
    } else if (img.src) {
        const fileName = img.src.split('/').pop();
        infoDiv.textContent = fileName || img.src;
    } else {
        infoDiv.textContent = '';
    }

    imageViewerModal.classList.add('active');
    document.body.style.overflow = 'hidden';  // Prevent scrolling
}

function closeImageViewer() {
    if (!imageViewerModal) return;
    imageViewerModal.classList.remove('active');
    document.body.style.overflow = '';  // Restore scrolling
}

// ========== Bootstrap ==========
console.log('Script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
} else {
    setTimeout(init, 200);
}
