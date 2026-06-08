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
    // オフセットが内容末尾を超える場合は末尾に配置
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
    // Mermaidブロックはハイライト対象外
    if (codeEl.classList.contains('language-mermaid')) return;

    // 行数を確認し、500行超の大きなコードブロックはハイライトをスキップ
    // contenteditable では insertLineBreak により <br> が入るため、innerText で改行を保持
    // innerText が利用できない場合（例: 未接続ノード）は textContent にフォールバック
    const plainText = codeEl.isConnected ? codeEl.innerText : codeEl.textContent;
    const lineCount = plainText.split('\n').length;
    
    if (lineCount > 500) {
        console.log(`[ハイライトスキップ] ${lineCount}行のコードブロックが大きすぎるため、シンタックスハイライトをスキップしました。`);
        
        // ハイライトせず行番号のみ更新
        const pre = codeEl.closest('pre');
        if (pre) {
            updateLineNumbers(pre);
            // ハイライトを省略したことを視覚表示
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

    // カーソル位置を保存
    const sel = window.getSelection();
    const isInsideCode = codeEl.contains(sel.anchorNode);
    let caretOffset = 0;
    if (isInsideCode) {
        caretOffset = getCaretCharacterOffsetWithin(codeEl);
    }

    // hljs のキャッシュ状態を完全にリセット
    delete codeEl.dataset.highlighted;
    codeEl.removeAttribute('data-highlighted');
    // hljs固有の内部状態もクリア
    if (codeEl.__hljs_result) {
        delete codeEl.__hljs_result;
    }
    
    codeEl.textContent = plainText;
    
    // ハイライト前に codeEl がDOMツリー内にあることを保証
    if (!codeEl.parentElement) {
        console.warn('[highlightCodeBlock] Code element not in DOM tree');
        return;
    }
    
    hljs.highlightElement(codeEl);

    // カーソル位置を復元
    if (isInsideCode) {
        setCaretCharacterOffset(codeEl, caretOffset);
    }

    // 行番号を更新
    const pre = codeEl.closest('pre');
    if (pre) {
        updateLineNumbers(pre);
        // スキップ通知が残っていれば削除
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
            
            // 行番号を更新し、スキップ通知を追加
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
        
        // スキップ通知が残っていれば削除
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
    // Mermaidコンテナは対象外
    if (pre.closest('.mermaid-container')) return;

    const code = pre.querySelector('code');
    if (!code) return;

    const text = code.textContent;
    const lines = text.split('\n');
    // 末尾の空行を除去（コードブロックが \n で終わる場合に発生しやすい）
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

    // 行数が変わった場合のみ更新
    const currentCount = gutter.children.length;
    if (currentCount !== lineCount) {
        let html = '';
        for (let i = 1; i <= lineCount; i++) {
            html += '<span>' + i + '</span>';
        }
        gutter.innerHTML = html;
    }
    
    // 折り返しトグルボタンが存在することを保証
    setupCodeWrapButton(pre);
}

/**
 * コードブロック用の折り返しトグルボタンを設定する
 */
function setupCodeWrapButton(pre) {
    if (!pre || pre.tagName !== 'PRE') return;
    
    // pre の直前のツールバーからコンテナを取得（code-block-toolbar が前兄弟）
    const toolbar = pre.previousElementSibling;
    if (!toolbar || !toolbar.classList.contains('code-block-toolbar')) return;
    
    // ツールバー内に既存ボタンがある場合は何もしない
    if (toolbar.querySelector('.code-wrap-btn')) return;
    
    const container = toolbar.querySelector('.code-copy-container');
    if (!container) return;
    
    // 折り返しトグルボタンを作成
    const button = document.createElement('button');
    button.className = 'code-wrap-btn';
    button.setAttribute('type', 'button');
    button.setAttribute('contenteditable', 'false');
    button.setAttribute('aria-label', 'Toggle text wrapping');
    button.textContent = '↵ Wrap';
    button.title = 'Toggle text wrapping (Hold Shift to wrap long lines within window)';
    
    // data属性 / 既存クラスから折り返し有効状態を復元（pre/code互換）
    const code = pre.querySelector('code');
    const shouldWrap = !!(code && (
        code.classList.contains('wrap-enabled') ||
        code.getAttribute('data-wrap') === 'true' ||
        pre.classList.contains('wrap-enabled') ||
        pre.getAttribute('data-wrap') === 'true'
    ));
    if (code && shouldWrap) {
        code.classList.add('wrap-enabled');
        code.setAttribute('data-wrap', 'true');
        pre.classList.add('wrap-enabled');
        pre.setAttribute('data-wrap', 'true');
        button.classList.add('wrap-enabled');
    }
    
    // コピーボタンより前に折り返しボタンを挿入
    container.insertBefore(button, container.firstChild);
    
    // クリックハンドラを登録
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
        // 親方向にたどり、pre 内の code 要素を探索
        while (node && node !== editor) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                const lineCount = node.textContent.split('\n').length;
                // コードサイズに応じて遅延時間を調整
                const delay = lineCount > 100 ? 500 : 0;
                
                // 入力イベントループ対策: hljs.highlightElement が contenteditable 内の
                // code.innerHTML 変更時、WebKit で input が再発火することがある
                // isConverting を立てて再入呼び出しを防ぐ
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
 * コードブロックの折り返し表示を切り替える
 */
function toggleCodeWrap(pre) {
    if (!pre || pre.tagName !== 'PRE') return;
    
    const code = pre.querySelector('code');
    if (!code) return;
    
    // ボタンは pre の直前にあるツールバー内
    const toolbar = pre.previousElementSibling;
    const button = toolbar && toolbar.classList.contains('code-block-toolbar')
        ? toolbar.querySelector('.code-wrap-btn')
        : null;
    if (!button) return;
    
    // 折り返し用クラスを切り替え（pre/code双方で同期）
    const isWrapped = code.classList.toggle('wrap-enabled');
    pre.classList.toggle('wrap-enabled', isWrapped);
    button.classList.toggle('wrap-enabled', isWrapped);
    
    // 折り返し状態を data 属性へ保存（pre/code双方で互換維持）
    code.setAttribute('data-wrap', isWrapped ? 'true' : 'false');
    pre.setAttribute('data-wrap', isWrapped ? 'true' : 'false');
    
    console.log(`[CodeWrap] Toggled for code block: ${isWrapped ? 'enabled' : 'disabled'}`);
}
