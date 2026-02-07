// =====================================================
// SuMark - Main Application Logic
// =====================================================

// Global error handler for debugging
window.onerror = function(msg, url, line, col, error) {
    console.error('Global error:', msg, 'at', url, ':', line, ':', col);
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:10px;z-index:99999;font-size:14px';
    errDiv.textContent = 'JS Error: ' + msg + ' (line ' + line + ')';
    document.body.appendChild(errDiv);
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});

// ========== State ==========
let isConverting = false; // Guard for auto-conversion recursion
let codeHighlightTimer = null; // Debounce timer for code block highlighting
let isComposing = false; // IME composition state

// Tab management
let tabs = [];       // Array of { id, filePath, title, content, isModified, scrollTop }
let activeTabId = null;
let tabIdCounter = 0;

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
let invoke, tauriOpen, tauriSave, readTextFile, writeTextFile, readBinaryFile, shellOpen;

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
            alert('Tauri APIが利用できません');
            return;
        }
        invoke = window.__TAURI__.tauri.invoke;
        tauriOpen = window.__TAURI__.dialog.open;
        tauriSave = window.__TAURI__.dialog.save;
        readTextFile = window.__TAURI__.fs.readTextFile;
        writeTextFile = window.__TAURI__.fs.writeTextFile;
        readBinaryFile = window.__TAURI__.fs.readBinaryFile;
        shellOpen = window.__TAURI__.shell.open;
        console.log('Tauri APIs OK');
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
    setupCodeCopyButtons();

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
    console.log('Initialization complete');
}

// ========== Turndown Configuration ==========
function configureTurndown() {
    if (typeof TurndownService === 'undefined') {
        console.error('Turndown not loaded');
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

    // Load GFM plugin (tables, strikethrough, task lists)
    const gfmPlugin = (typeof TurndownPluginGfm !== 'undefined') ? TurndownPluginGfm :
                       (typeof turndownPluginGfm !== 'undefined') ? turndownPluginGfm : null;
    if (gfmPlugin && gfmPlugin.gfm) {
        turndownService.use(gfmPlugin.gfm);
        console.log('Turndown GFM plugin loaded');
    }

    // Custom rule: task list items with checkboxes
    turndownService.addRule('taskListCheckbox', {
        filter: function(node) {
            return node.nodeName === 'LI' &&
                   node.querySelector('input[type="checkbox"]');
        },
        replacement: function(content, node) {
            const cb = node.querySelector('input[type="checkbox"]');
            const checked = cb && cb.checked;
            // Clean up content: remove leading checkbox text
            let text = content.replace(/^\s*/, '').trim();
            return (checked ? '- [x] ' : '- [ ] ') + text + '\n';
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

    // Remove copy buttons from Turndown output
    turndownService.addRule('codeCopyBtn', {
        filter: function(node) {
            return node.classList && node.classList.contains('code-copy-btn');
        },
        replacement: function() {
            return '';
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
    return turndownService.turndown(editor.innerHTML);
}

function setMarkdown(md) {
    if (typeof marked === 'undefined') {
        editor.textContent = md;
        return;
    }
    editor.innerHTML = marked.parse(md);

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

    // Save cursor position
    const sel = window.getSelection();
    const isInsideCode = codeEl.contains(sel.anchorNode);
    let caretOffset = 0;
    if (isInsideCode) {
        caretOffset = getCaretCharacterOffsetWithin(codeEl);
    }

    // Get plain text and re-highlight
    const plainText = codeEl.textContent;
    // Remove previous hljs state
    delete codeEl.dataset.highlighted;
    codeEl.removeAttribute('data-highlighted');
    codeEl.textContent = plainText;
    hljs.highlightElement(codeEl);

    // Restore cursor
    if (isInsideCode) {
        setCaretCharacterOffset(codeEl, caretOffset);
    }
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
                highlightCodeBlock(node);
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
        if (el.lastChild.nodeName === 'BR') {
            el.removeChild(el.lastChild);
        } else if (el.lastChild.nodeType === 3 && el.lastChild.textContent.match(/^\n*$/)) {
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
    editor.addEventListener('compositionstart', () => { isComposing = true; });
    editor.addEventListener('compositionend', () => {
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
        { id: 'undoBtn',      handler: () => document.execCommand('undo') },
        { id: 'redoBtn',      handler: () => document.execCommand('redo') },
        { id: 'boldBtn',      handler: () => document.execCommand('bold') },
        { id: 'italicBtn',    handler: () => document.execCommand('italic') },
        { id: 'strikeBtn',    handler: () => document.execCommand('strikethrough') },
        { id: 'codeBtn',      handler: applyInlineCode },
        { id: 'linkBtn',      handler: insertLink },
        { id: 'imageBtn',     handler: insertImage },
        { id: 'h1Btn',        handler: () => applyHeading(1) },
        { id: 'h2Btn',        handler: () => applyHeading(2) },
        { id: 'h3Btn',        handler: () => applyHeading(3) },
        { id: 'ulBtn',        handler: () => document.execCommand('insertUnorderedList') },
        { id: 'olBtn',        handler: () => document.execCommand('insertOrderedList') },
        { id: 'taskBtn',      handler: insertTaskList },
        { id: 'tableBtn',     handler: insertTable },
        { id: 'codeBlockBtn', handler: insertCodeBlock },
        { id: 'quoteBtn',     handler: applyBlockquote },
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
}

// ========== Editor Input Handler ==========
function onEditorInput() {
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

    // Re-highlight code block if cursor is inside one
    debouncedHighlightCodeAtCursor();
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
    if (!sel.rangeCount || !sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const block = getParentBlock(range.startContainer);
    if (!block || block === editor) return;

    // Only convert in P or DIV blocks (not already formatted)
    const tag = block.tagName;
    if (tag !== 'P' && tag !== 'DIV') return;

    let text = block.textContent;

    // Normalize full-width characters to half-width for matching
    const originalText = text;
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
        // Save caret offset
        const caretOffset = getCaretCharacterOffsetWithin(block);
        block.textContent = text;
        // Restore caret
        setCaretCharacterOffset(block, caretOffset);
    }

    // Heading: "# text" or "## text" etc.
    const headingMatch = text.match(/^(#{1,6}) (.+)$/);
    if (headingMatch) {
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
        const level = headingPrefixMatch[1].length;
        const heading = document.createElement('h' + level);
        heading.innerHTML = '<br>';
        block.parentNode.replaceChild(heading, block);
        setCursorTo(heading);
        return;
    }

    // Task list: "- [ ] text" or "- [x] text"
    const taskMatch = text.match(/^- \[([ x])\] (.+)$/);
    if (taskMatch) {
        const checked = taskMatch[1] === 'x';
        const content = taskMatch[2];
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
    // Task list prefix only: "- [ ] "
    if (text === '- [ ] ' || text === '- [x] ') {
        const checked = text.startsWith('- [x]');
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
        block.textContent = '';
        block.innerHTML = '<br>';
        document.execCommand('formatBlock', false, 'p');
        document.execCommand('insertOrderedList');
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

    // URL auto-detection: http(s)://... followed by space
    const urlMatch = before.match(/(https?:\/\/[^\s<>"]+) $/);
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
                saveFile();
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
            // Cmd+Z / Cmd+Shift+Z (undo/redo) are handled natively
        }
    }
}

// ========== Enter Key Handling ==========
function handleEnterKey(e) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const block = getParentBlock(range.startContainer);
    if (!block) return;

    const tag = block.tagName;

    // In heading: create paragraph after, not another heading
    if (/^H[1-6]$/.test(tag)) {
        e.preventDefault();
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.parentNode.insertBefore(p, block.nextSibling);
        setCursorTo(p);
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
            newRange.setStart(textNode, textNode.textContent.length);
            newRange.collapse(true);
            sel2.removeAllRanges();
            sel2.addRange(newRange);
            return;
        }

        // Otherwise, let default list behavior handle it
        return;
    }

    // In blockquote: check for double Enter (exit blockquote)
    if (tag === 'BLOCKQUOTE' || (block.parentNode && block.parentNode.tagName === 'BLOCKQUOTE')) {
        const bqBlock = tag === 'BLOCKQUOTE' ? block : block.parentNode;
        // Check if current line is empty
        const currentBlock = tag === 'BLOCKQUOTE' ? range.startContainer : block;
        if (currentBlock.textContent.trim() === '') {
            e.preventDefault();
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            bqBlock.parentNode.insertBefore(p, bqBlock.nextSibling);
            // Remove empty element from blockquote
            if (currentBlock !== bqBlock && currentBlock.parentNode) {
                currentBlock.remove();
            }
            if (bqBlock.textContent.trim() === '') {
                bqBlock.remove();
            }
            setCursorTo(p);
            return;
        }
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
            document.execCommand('outdent');
        } else {
            document.execCommand('indent');
        }
        return;
    }

    // Default: insert 4 spaces
    document.execCommand('insertText', false, '    ');
}

// ========== Paste Handling ==========
function handlePaste(e) {
    // 0. If inside a code block, always paste as plain text
    const sel = window.getSelection();
    if (sel.rangeCount) {
        let node = sel.anchorNode;
        while (node && node !== editor) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                // Insert plain text preserving newlines within the code block
                // Use insertText for each line with insertLineBreak between them
                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (i > 0) {
                        document.execCommand('insertLineBreak');
                    }
                    if (lines[i]) {
                        document.execCommand('insertText', false, lines[i]);
                    }
                }
                markModified();
                debouncedHighlightCodeAtCursor();
                return;
            }
            if (node.tagName === 'PRE') {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (i > 0) {
                        document.execCommand('insertLineBreak');
                    }
                    if (lines[i]) {
                        document.execCommand('insertText', false, lines[i]);
                    }
                }
                markModified();
                debouncedHighlightCodeAtCursor();
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
        const html = marked.parse(text);
        document.execCommand('insertHTML', false, html);
        editor.querySelectorAll('input[type="checkbox"][disabled]').forEach(cb => {
            cb.removeAttribute('disabled');
        });
    } else {
        document.execCommand('insertText', false, text);
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
    const block = getParentBlock(window.getSelection().anchorNode);
    if (block && block.tagName.toLowerCase() === tag) {
        // Toggle off: revert to paragraph
        document.execCommand('formatBlock', false, 'p');
    } else {
        document.execCommand('formatBlock', false, tag);
    }
}

function applyBlockquote() {
    const block = getParentBlock(window.getSelection().anchorNode);
    // Check if already in blockquote
    let node = block;
    while (node && node !== editor) {
        if (node.tagName === 'BLOCKQUOTE') {
            // Exit blockquote
            document.execCommand('formatBlock', false, 'p');
            return;
        }
        node = node.parentNode;
    }
    document.execCommand('formatBlock', false, 'blockquote');
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
    fieldsEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
            editor.focus();
        }
    });
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

    const fields = [
        { key: 'url', label: 'URL', value: 'https://', placeholder: 'https://example.com' },
        { key: 'text', label: 'リンクテキスト', value: selectedText, placeholder: '表示するテキスト' },
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
    });
}

async function insertImage() {
    // Save selection before opening dialog
    const sel = window.getSelection();
    let savedRange = null;
    if (sel.rangeCount) {
        savedRange = sel.getRangeAt(0).cloneRange();
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
            const html = '<img src="data:' + mime + ';base64,' + base64 + '" alt="' + escapeHtml(filename) + '">';
            document.execCommand('insertHTML', false, html);
            markModified();
        }
    } catch (err) {
        console.error('Error loading image:', err);
    }
}

function insertTable() {
    const html = '<table><thead><tr><th>列1</th><th>列2</th><th>列3</th></tr></thead>' +
                 '<tbody><tr><td>データ</td><td>データ</td><td>データ</td></tr>' +
                 '<tr><td>データ</td><td>データ</td><td>データ</td></tr></tbody></table>' +
                 '<p><br></p>';
    document.execCommand('insertHTML', false, html);
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
    // Save selection
    const sel = window.getSelection();
    let savedRange = null;
    if (sel.rangeCount) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }

    const fields = [
        { key: 'lang', label: 'プログラミング言語', type: 'select', value: 'javascript', options: CODE_LANGUAGES },
    ];

    showModal('コードブロックを挿入', fields, (values) => {
        const lang = values.lang || '';
        doInsertCodeBlock(lang, savedRange);
    });
}

function doInsertCodeBlock(lang, savedRange) {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    if (lang) code.className = 'language-' + lang;
    code.textContent = 'コードをここに記述';
    pre.appendChild(code);

    // Restore selection first
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

        // Select the placeholder text
        const codeRange = document.createRange();
        codeRange.selectNodeContents(code);
        sel.removeAllRanges();
        sel.addRange(codeRange);

        // Apply highlighting
        if (lang && typeof hljs !== 'undefined') {
            highlightCodeBlock(code);
        }
    }
}

function insertTaskList() {
    const sel = window.getSelection();
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
        // Insert empty task item at cursor
        const html = '<ul class="contains-task-list">' +
                     '<li class="task-list-item"><input type="checkbox"> </li>' +
                     '</ul><p><br></p>';
        document.execCommand('insertHTML', false, html);
    }

    // Make checkboxes interactive
    editor.querySelectorAll('input[type="checkbox"][disabled]').forEach(cb => {
        cb.removeAttribute('disabled');
    });
}

function insertHorizontalRule() {
    document.execCommand('insertHTML', false, '<hr><p><br></p>');
}

// ========== File Operations ==========

async function newFile() {
    createTab(null, '無題', '<p><br></p>');
    editor.focus();
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
                // Check if file is already open
                const existingTab = tabs.find(t => t.filePath === filePath);
                if (existingTab) {
                    switchTab(existingTab.id);
                    continue;
                }

                const contents = await readTextFile(filePath);
                const filename = filePath.split('/').pop().split('\\').pop();
                const html = (typeof marked !== 'undefined') ? marked.parse(contents) : contents;
                createTab(filePath, filename, html);
            }
        }
    } catch (err) {
        console.error('Error opening file:', err);
        alert('ファイルを開けませんでした: ' + err);
    }
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
            const markdown = getMarkdown();
            await writeTextFile(filePath, markdown);
            tab.filePath = filePath;
            tab.title = filePath.split('/').pop().split('\\').pop();
            tab.isModified = false;
            renderTabs();
            updateStatusBar();
        }
    } catch (err) {
        console.error('Error saving file:', err);
        alert('ファイルを保存できませんでした: ' + err);
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

// ========== TOC Generation ==========
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

    let html = '<div class="toc-container" contenteditable="false"><p><strong>📑 目次</strong></p><ul>';
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
}

// ========== Image Resize ==========
// ========== Code Block Copy Button ==========
function setupCodeCopyButtons() {
    // Add copy buttons to existing code blocks
    addCopyButtonsToCodeBlocks();

    // Watch for new code blocks being added
    const observer = new MutationObserver(() => {
        addCopyButtonsToCodeBlocks();
    });
    observer.observe(editor, { childList: true, subtree: true });
}

function addCopyButtonsToCodeBlocks() {
    editor.querySelectorAll('pre').forEach(pre => {
        // Skip if already has a copy button
        if (pre.querySelector('.code-copy-btn')) return;
        // Skip Mermaid containers
        if (pre.closest('.mermaid-container')) return;

        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.textContent = 'Copy';
        btn.setAttribute('contenteditable', 'false');
        btn.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
        });
        btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const code = pre.querySelector('code');
            const text = code ? code.textContent : pre.textContent;
            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = 'Copy';
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(() => {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = 'Copy';
                    btn.classList.remove('copied');
                }, 2000);
            });
        });
        pre.appendChild(btn);
    });
}

function setupImageResize() {
    let activeImage = null;
    let resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    resizeHandle.style.display = 'none';
    resizeHandle.innerHTML = '<div class="resize-grip"></div>';
    document.body.appendChild(resizeHandle);

    editor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            selectImage(e.target);
        } else if (!e.target.closest('.image-resize-handle')) {
            deselectImage();
        }
    });

    function selectImage(img) {
        deselectImage();
        activeImage = img;
        img.classList.add('image-selected');
        positionHandle();
        resizeHandle.style.display = 'block';
    }

    function deselectImage() {
        if (activeImage) {
            activeImage.classList.remove('image-selected');
        }
        activeImage = null;
        resizeHandle.style.display = 'none';
    }

    function positionHandle() {
        if (!activeImage) return;
        const rect = activeImage.getBoundingClientRect();
        resizeHandle.style.left = (rect.right - 12) + 'px';
        resizeHandle.style.top = (rect.bottom - 12) + 'px';
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

// ========== Bootstrap ==========
console.log('Script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
} else {
    setTimeout(init, 200);
}
