// ============================================================
// SuMark ノードユーティリティ (nodeUtils.js)
// DOM ノードのパス取得・選択範囲の保存/復元・末尾空行処理
// main.js より前に読み込むこと
// 注意: getNodePath / getNodeByPath はグローバル変数 editor を参照
// ============================================================

/**
 * カーソルがコード要素の末尾空行にあるか判定する
 * <br> 要素（insertLineBreak由来）と \n テキスト（ファイル読み込み由来）の両方に対応
 * @param {HTMLElement} targetEl - 対象のコード要素
 * @param {Range} range - 現在の選択範囲
 * @returns {boolean}
 */
function isOnEmptyTrailingLine(targetEl, range) {
    const node = range.startContainer;
    const offset = range.startOffset;

    // ケース1: カーソルがテキストノード内にある
    if (node.nodeType === 3) {
        const text = node.textContent;
        // カーソル直前が \n か確認（新しい空行上にいることを意味する）
        if (offset > 0 && text[offset - 1] === '\n') {
            // このノード内でカーソル後方に実質的な文字がないことを確認
            const after = text.substring(offset);
            if (after !== '' && after.replace(/\n/g, '') !== '') return false;
            // このノード以降の兄弟に実質的な内容がないことを確認
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

    // ケース2: カーソルが要素ノード内（子ノード間）にある
    if (node.nodeType === 1) {
        if (offset === 0) {
            // 先頭位置では完全に空の場合のみtrue
            return targetEl.textContent.trim() === '' &&
                   targetEl.innerHTML.replace(/<br\s*\/?>/gi, '').trim() === '';
        }
        const prevChild = node.childNodes[offset - 1];
        if (!prevChild) return false;

        // 直前の子ノードは <br> か、\n で終わるテキストノードである必要がある
        const isPrevBr = prevChild.nodeName === 'BR';
        const isPrevNewline = prevChild.nodeType === 3 && prevChild.textContent.endsWith('\n');

        if (isPrevBr || isPrevNewline) {
            // カーソル位置以降に実質的な内容がないことを確認
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

/**
 * 要素から末尾の空行（<br>やトレイリング\n）を除去する
 * @param {HTMLElement} el - 対象要素
 */
function removeTrailingEmptyLines(el) {
    // 末尾の <br> 要素と空テキストノードを除去
    while (el.lastChild) {
        if (el.lastChild.nodeType === 3 && el.lastChild.textContent.match(/^\n*$/)) {
            el.removeChild(el.lastChild);
        } else if (el.lastChild.nodeType === 3) {
            // 最後のテキストノード末尾にある改行を削る
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
    // 完全に空なら表示崩れを防ぐために空白を入れる
    if (!el.textContent.trim()) {
        el.textContent = ' ';
    }
}

/**
 * 現在の選択範囲（カーソル位置）を保存する
 * @returns {Object|null} 選択データ（startContainer, startOffset, endContainer, endOffset, collapsed）
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
 * 保存した選択範囲を復元する
 * @param {Object} selectionData - saveSelection() の戻り値
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
 * editorルートからターゲットノードまでのパスを取得する
 * 注意: グローバル変数 editor を参照
 * @param {Node} node - パスを取得するノード
 * @returns {number[]} ノードパス（各階層のchildNodesインデックス配列）
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
 * editorルートからパスをたどってノードを取得する
 * 注意: グローバル変数 editor を参照
 * @param {number[]} path - getNodePath() の戻り値
 * @returns {Node|null} 対応するノード
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
