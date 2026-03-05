// =====================================================
// SuMark - Markdown Conversion Module
// =====================================================
// Markdown ↔ HTML 双方向変換ロジック
// - configureTurndown(): HTML→Markdown 変換設定 (Turndown + GFM + カスタムルール)
// - getMarkdown(): エディタHTML → Markdown
// - setMarkdown(): Markdown → エディタHTML
// - preprocessNotionMarkdown(): Notion形式テーブル前処理
//
// 依存: editor (main.js)
//       TurndownService, TurndownPluginGfm, marked, DOMPurify, hljs (vendor)
//       resetGlobalState (main.js)
//       renderMermaidBlocks (mermaidManager.js), renderMathBlocks (mathRender.js)
//       reconstructTocContainers, restoreTocHeadingIds, setupTocDeleteButtons (tocManager.js)
//       updateAllLineNumbers (codeHighlight.js), restoreCodeWrapStates (toolbarActions.js)
//       setupToggleBlocks (toggleBlock.js), setupImageErrorHandling (imageManager.js)

// Turndown instance
let turndownService;

// DOMPurify config: allow Tauri's asset:// protocol for local file display
const DOMPURIFY_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

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
