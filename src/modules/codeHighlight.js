// ============================================================
// SuMark コードハイライト (codeHighlight.js)
// コードブロックのシンタックスハイライト・行番号管理
// main.js より前に読み込むこと
// 依存: global hljs (highlight.min.js), global editor (main.js)
// ============================================================

/** デバウンスタイマー（モジュール内で管理） */
let codeHighlightTimer = null;

/**
 * 要素内のキャレット位置（文字オフセット）を取得する
 * @param {HTMLElement} element - 対象要素
 * @returns {number} キャレットの文字オフセット
 */
function getCaretCharacterOffsetWithin(element) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString().length;
}

/**
 * 要素内のキャレット位置を文字オフセットで設定する
 * @param {HTMLElement} element - 対象要素
 * @param {number} offset - 設定する文字オフセット
 */
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

/**
 * 単一のコードブロックにシンタックスハイライトを適用する
 * 500行超のブロックはスキップしてパフォーマンスを確保
 * 依存: hljs, getCaretCharacterOffsetWithin, setCaretCharacterOffset, updateLineNumbers
 * @param {HTMLElement} codeEl - <code> 要素
 */
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

    // Completely reset hljs cache state
    delete codeEl.dataset.highlighted;
    codeEl.removeAttribute('data-highlighted');
    // Also clear any hljs-specific internal state
    if (codeEl.__hljs_result) {
        delete codeEl.__hljs_result;
    }
    
    codeEl.textContent = plainText;
    
    // Ensure codeEl is properly inserted in DOM before highlighting
    if (!codeEl.parentElement) {
        console.warn('[highlightCodeBlock] Code element not in DOM tree');
        return;
    }
    
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

/**
 * エディタ内の全コードブロックにハイライトを適用する（Undo/Redo後に使用）
 * 依存: hljs, global editor, updateLineNumbers
 */
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

/**
 * <pre> 要素に行番号ガターを追加・更新する
 * @param {HTMLElement} pre - <pre> 要素
 */
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
    
    // Ensure wrap toggle button exists
    setupCodeWrapButton(pre);
}

/**
 * Setup code wrap toggle button for a code block
 */
function setupCodeWrapButton(pre) {
    if (!pre || pre.tagName !== 'PRE') return;
    
    // Check if button already exists
    if (pre.querySelector('.code-wrap-btn')) return;
    
    // Wait for container to be created by addCopyButtonsToCodeBlocks
    // If container doesn't exist yet, skip (will be called again later)
    const container = pre.querySelector('.code-copy-container');
    if (!container) return;
    
    // Create wrap toggle button
    const button = document.createElement('button');
    button.className = 'code-wrap-btn';
    button.setAttribute('type', 'button');
    button.setAttribute('contenteditable', 'false');
    button.setAttribute('aria-label', 'Toggle text wrapping');
    button.textContent = '↵ Wrap';
    button.title = 'Toggle text wrapping (Hold Shift to wrap long lines within window)';
    
    // Check if wrap is already enabled (from data attribute)
    const code = pre.querySelector('code');
    if (code && code.classList.contains('wrap-enabled')) {
        button.classList.add('wrap-enabled');
    }
    
    // Insert wrap button before copy button(s)
    container.insertBefore(button, container.firstChild);
    
    // Add click handler
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCodeWrap(pre);
    });
}

/**
 * エディタ内の全 <pre> 要素の行番号を更新する
 * 依存: global editor
 */
function updateAllLineNumbers() {
    editor.querySelectorAll('pre').forEach(pre => {
        if (!pre.closest('.mermaid-container')) {
            updateLineNumbers(pre);
        }
    });
}

/**
 * カーソル位置のコードブロックをデバウンス付きでハイライトする
 * 依存: global editor, highlightCodeBlock, global isConverting
 */
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
                
                // Guard against input event loops: hljs.highlightElement modifies
                // code.innerHTML inside contenteditable, which may trigger input
                // events in WebKit. Setting isConverting prevents re-entrant calls.
                const doHighlight = (codeNode) => {
                    isConverting = true;
                    try {
                        highlightCodeBlock(codeNode);
                    } finally {
                        isConverting = false;
                    }
                };

                if (delay > 0) {
                    setTimeout(() => doHighlight(node), delay);
                } else {
                    doHighlight(node);
                }
                return;
            }
            node = node.parentElement;
        }
    }, 300);
}

/**
 * Toggle text wrapping for a code block
 */
function toggleCodeWrap(pre) {
    if (!pre || pre.tagName !== 'PRE') return;
    
    const code = pre.querySelector('code');
    if (!code) return;
    
    const button = pre.querySelector('.code-wrap-btn');
    if (!button) return;
    
    // Toggle wrap class
    const isWrapped = code.classList.toggle('wrap-enabled');
    button.classList.toggle('wrap-enabled', isWrapped);
    
    // Save wrap state in data attribute
    code.setAttribute('data-wrap', isWrapped ? 'true' : 'false');
    
    console.log(`[CodeWrap] Toggled for code block: ${isWrapped ? 'enabled' : 'disabled'}`);
}
