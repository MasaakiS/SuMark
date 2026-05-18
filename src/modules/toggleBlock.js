// ========== Toggle Block Manager ==========
// main.js から分離したトグル（details/summary）関連の関数群
// 依存: editor (グローバル), setCursorTo() (main.js), markModified() (main.js),
//       isInsideTableCell() (main.js), showWarn() (main.js), getParentBlock() (main.js),
//       onEditorInput() (main.js), saveEditorState() (main.js)

/**
 * summary要素にトグル解除ボタン（✕）を付与する
 */
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

/**
 * トグルブロック（details/summary）を挿入する
 */
function insertToggle() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    // テーブルセル内のトグル挿入を禁止
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

    // 選択範囲がある（非折り畳み状態）か確認
    if (!range.collapsed) {
        // 選択範囲と重なるブロック要素を全て収集
        const blocksToMove = [];
        const startBlock = getParentBlock(range.startContainer) || range.startContainer;
        const endBlock = getParentBlock(range.endContainer) || range.endContainer;

        // 挿入ルートの直下を走査して、選択範囲内のブロックを探す
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
            // 最初のブロックテキストをサマリーに、またはデフォルトを使用
            const firstText = blocksToMove[0].textContent.trim();
            summary.textContent = firstText.substring(0, 50) || 'トグル';
            ensureToggleDeleteButton(summary);

            // 最初に集めたブロックの前に details を挿入
            const insertBefore = blocksToMove[0];
            insertBefore.parentNode.insertBefore(details, insertBefore);

            // 集めたブロック全てを toggle-content へ移動
            blocksToMove.forEach(b => {
                contentDiv.appendChild(b);
            });

            // toggle-content に内容があることを確認
            if (contentDiv.children.length === 0) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
            }
            ensureToggleContentEditable(contentDiv);

            if (insertionRoot.classList && insertionRoot.classList.contains('toggle-content')) {
                ensureToggleContentEditable(insertionRoot);
            }

            // details の後ろに段落を追加して編集継続できるようにする
            const afterP = document.createElement('p');
            afterP.innerHTML = '<br>';
            details.parentNode.insertBefore(afterP, details.nextSibling);

            // summary テキストを選択して編集可能にする
            const r = document.createRange();
            r.selectNodeContents(summary);
            sel.removeAllRanges();
            sel.addRange(r);
            onEditorInput();
            return;
        }
    }

    // 選択なし: 空のトグルを挿入（元の動作）
    summary.textContent = 'トグル';
    ensureToggleDeleteButton(summary);
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    contentDiv.appendChild(p);

    const block = getParentBlock(range.startContainer);

    // 現在のブロック後ろに挿入、または空ブロックを置換
    if (block && block !== editor) {
        if (block.textContent.trim() === '' && block.tagName === 'P') {
            block.parentNode.replaceChild(details, block);
        } else {
            block.parentNode.insertBefore(details, block.nextSibling);
        }
    } else {
        insertionRoot.appendChild(details);
    }

    // details の後ろに段落を追加して編集継続できるようにする
    const afterP = document.createElement('p');
    afterP.innerHTML = '<br>';
    details.parentNode.insertBefore(afterP, details.nextSibling);

    if (insertionRoot.classList && insertionRoot.classList.contains('toggle-content')) {
        ensureToggleContentEditable(insertionRoot);
    }

    // summary テキストを選択して編集可能にする
    const r = document.createRange();
    r.selectNodeContents(summary);
    sel.removeAllRanges();
    sel.addRange(r);
    onEditorInput();
    saveEditorState(); // Save state after inserting toggle
}

/**
 * トグルブロックを解除し、中身を親要素に展開する
 */
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

/**
 * エディタ内の全トグルブロックを初期化（open属性、summary編集可能化、toggle-contentラッパー付与、削除ボタン追加）
 */
function setupToggleBlocks() {
    editor.querySelectorAll('details').forEach(details => {
        // エディタで編集可能な状態に details をオープン
        details.setAttribute('open', '');
        // summary が編集可能であることを確認
        const summary = details.querySelector(':scope > summary');
        if (summary) {
            summary.setAttribute('contenteditable', 'true');
            ensureToggleDeleteButton(summary);
        }
        // toggle-content div が存在することを確認
        let contentDiv = details.querySelector(':scope > .toggle-content');
        if (!contentDiv) {
            contentDiv = document.createElement('div');
            contentDiv.className = 'toggle-content';
            // summary の後ろの子要素全てを contentDiv へ移動
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

        // toggle-content の開始/終了に編集可能な段落を保証
        ensureToggleContentEditable(contentDiv);
    });
}
