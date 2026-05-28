// =====================================================
// SuMark - ツールバー操作モジュール
// =====================================================
// applyHeading, insertUnorderedList, insertOrderedList, applyBlockquote,
// applyInlineCode, showModal, insertLink, insertImage, insertCodeBlock,
// doInsertCodeBlock, restoreCodeWrapStates, insertTaskList,
// insertHorizontalRule, insertDate, insertTime, insertDateTime,
// showEmojiPicker, CODE_LANGUAGES

// ========== 検索ハイライト状態 ==========
let currentSearchHighlights = [];
let currentSearchIndex = -1;
let findDialogOpen = false;
let lastFindQuery = null;
let lastFindCaseSensitive = null;

function clearSearchHighlights() {
    if (!currentSearchHighlights || currentSearchHighlights.length === 0) return;
    currentSearchHighlights.forEach(span => {
        const parent = span.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(span.textContent), span);
        parent.normalize();
    });
    currentSearchHighlights = [];
    currentSearchIndex = -1;
}

function escapeRegExpForSearch(s) {
    return s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function highlightSearchMatches(query, caseSensitive) {
    clearSearchHighlights();
    if (!query) return 0;

    const flags = caseSensitive ? 'g' : 'gi';
    const re = new RegExp(escapeRegExpForSearch(query), flags);

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (node.parentNode && node.parentNode.classList && node.parentNode.classList.contains('search-highlight')) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(textNode => {
        const text = textNode.nodeValue;
        const matches = [...text.matchAll(re)];
        if (!matches.length) return;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;

        matches.forEach(match => {
            const matchIndex = match.index;
            if (matchIndex > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
            }
            const span = document.createElement('span');
            span.className = 'search-highlight';
            span.textContent = match[0];
            frag.appendChild(span);
            currentSearchHighlights.push(span);
            lastIndex = matchIndex + match[0].length;
        });

        if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.parentNode.replaceChild(frag, textNode);
    });

    currentSearchIndex = currentSearchHighlights.length > 0 ? 0 : -1;
    if (currentSearchHighlights.length > 0) {
        currentSearchHighlights[0].classList.add('active-search-highlight');
    }
    return currentSearchHighlights.length;
}

function moveToSearchHighlight(index) {
    if (!currentSearchHighlights.length) return;
    const normalized = ((index % currentSearchHighlights.length) + currentSearchHighlights.length) % currentSearchHighlights.length;
    if (currentSearchIndex >= 0 && currentSearchHighlights[currentSearchIndex]) {
        currentSearchHighlights[currentSearchIndex].classList.remove('active-search-highlight');
    }
    currentSearchIndex = normalized;
    const el = currentSearchHighlights[currentSearchIndex];
    if (!el) return;
    el.classList.add('active-search-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function moveToNextSearchHighlight() {
    if (!currentSearchHighlights.length) return;
    moveToSearchHighlight(currentSearchIndex + 1);
}

// ========== フォーマット処理 ==========

function applyHeading(level) {
    const tag = 'h' + level;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    const block = getParentBlock(sel.anchorNode);
    if (!block) return;
    
    // 同じ見出しレベルを再適用した場合は解除トグル
    if (block.tagName.toLowerCase() === tag) {
        // トグル解除: 段落へ戻す
        document.execCommand('formatBlock', false, 'p');
        return;
    }
    
    // リスト項目の特別処理: 見出しへ変換
    if (block.tagName === 'LI') {
        // テキスト内容を取得（チェックボックスは除外）
        const checkbox = block.querySelector('input[type="checkbox"]');
        let textContent = '';
        for (let node of block.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                textContent += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'INPUT') {
                textContent += node.textContent;
            }
        }
        
        // 見出し要素を作成
        const heading = document.createElement(tag);
        heading.textContent = textContent.trim();
        
        // 親リストを取得
        const list = block.parentNode;
        
        // 位置に応じて見出しをリストの前後へ挿入
        list.parentNode.insertBefore(heading, list.nextSibling);
        
        // リスト項目を削除
        block.remove();
        
        // リストが空になったら削除
        if (list.children.length === 0) {
            list.remove();
        }
        
        // カーソルを見出し末尾へ移動
        setCursorTo(heading);
        return;
    }
    
    // それ以外のブロック種別は標準 formatBlock を使用
    document.execCommand('formatBlock', false, tag);
}

function insertUnorderedList() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    // テーブルセル内でのリスト挿入を禁止
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
    
    // 見出しの特別処理: リスト項目へ変換
    if (/^H[1-6]$/.test(block.tagName)) {
        const textContent = block.textContent.trim();
        
        // リストとリスト項目を作成
        const ul = document.createElement('ul');
        const li = document.createElement('li');
        li.textContent = textContent;
        ul.appendChild(li);
        
        // 見出しをリストへ置換
        block.parentNode.insertBefore(ul, block);
        block.remove();
        
        // カーソルをリスト項目へ移動
        setCursorTo(li);
        if (toggleContent) ensureToggleContentEditable(toggleContent);
        return;
    }
    
    // それ以外のブロック種別は標準コマンドを使用
    document.execCommand('insertUnorderedList');
    if (toggleContent) ensureToggleContentEditable(toggleContent);
}

function insertOrderedList() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    // テーブルセル内のリスト挿入を禁止
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
    
    // 見出しの特別処理: リスト項目へ変換
    if (/^H[1-6]$/.test(block.tagName)) {
        const textContent = block.textContent.trim();
        
        // リストとリスト項目を作成
        const ol = document.createElement('ol');
        const li = document.createElement('li');
        li.textContent = textContent;
        ol.appendChild(li);
        
        // 見出しをリストへ置換
        block.parentNode.insertBefore(ol, block);
        block.remove();
        
        // カーソルをリスト項目へ設定
        setCursorTo(li);
        if (toggleContent) ensureToggleContentEditable(toggleContent);
        return;
    }
    
    // それ以外のブロック種別は標準コマンドを使用
    document.execCommand('insertOrderedList');
    if (toggleContent) ensureToggleContentEditable(toggleContent);
}

function applyBlockquote() {
    const sel = window.getSelection();
    // テーブルセル内での引用挿入を禁止
    if (sel.rangeCount && isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内では引用を作成できません。');
        return;
    }
    const block = getParentBlock(sel.anchorNode);
    const toggleContent = block ? block.closest('.toggle-content') : null;
    // 既に引用内かどうか確認
    let node = block;
    while (node && node !== editor) {
        if (node.tagName === 'BLOCKQUOTE') {
            // 引用を解除
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

    // 既にインラインコード内か確認
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
        // コード装飾を解除
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

// ========== カスタムモーダルダイアログ ==========
function showModal(title, fields, callback, options = {}) {
    // オプション: { okText, cancelText, keepOpenOnOk }
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const fieldsEl = document.getElementById('modalFields');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');

    titleEl.textContent = title;
    fieldsEl.innerHTML = '';

    // 入力フィールドを構築
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
        } else if (field.type === 'textarea') {
            inputEl = document.createElement('textarea');
            inputEl.id = 'modalInput' + i;
            inputEl.value = field.value || '';
            inputEl.placeholder = field.placeholder || '';
        } else if (field.type === 'checkbox') {
            const wrapper = document.createElement('div');
            wrapper.className = 'modal-field modal-field-checkbox';

            const checkboxLabel = document.createElement('label');
            checkboxLabel.style.display = 'flex';
            checkboxLabel.style.alignItems = 'center';
            checkboxLabel.style.gap = '8px';
            checkboxLabel.style.cursor = 'pointer';

            inputEl = document.createElement('input');
            inputEl.type = 'checkbox';
            inputEl.id = 'modalInput' + i;
            inputEl.checked = Boolean(field.value);

            checkboxLabel.appendChild(inputEl);
            checkboxLabel.appendChild(document.createTextNode(field.label));
            wrapper.appendChild(checkboxLabel);
            fieldsEl.appendChild(wrapper);
            return;
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

    // 既定ではダイアログを中央配置
    const dialog = overlay.querySelector('.modal-dialog');
    if (dialog) {
        dialog.style.left = '50%';
        dialog.style.top = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
    }

    // 先頭の input/select にフォーカス
    const firstInput = fieldsEl.querySelector('input, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);

    // 以前のリスナーをクリーンアップ
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    if (options.okText) {
        newOk.textContent = options.okText;
    }
    if (options.cancelText) {
        newCancel.textContent = options.cancelText;
    }

    function close() {
        overlay.style.display = 'none';
        fieldsEl.onkeydown = null;
        // ドラッグ用リスナーを解除（存在する場合）
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onTouchDrag);
        document.removeEventListener('touchend', endDrag);
    }

    // モーダル移動のためのドラッグ対応
    let dragStartX = 0;
    let dragStartY = 0;
    let startLeft = 0;
    let startTop = 0;
    let dragging = false;

    function beginDrag(clientX, clientY) {
        if (!dialog) return;
        dragging = true;

        const rect = dialog.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        dragStartX = clientX;
        dragStartY = clientY;

        // 移動時のジャンプを防ぐため、%中央寄せを絶対pxへ変換
        dialog.style.left = `${rect.left}px`;
        dialog.style.top = `${rect.top}px`;
        dialog.style.transform = 'none';
    }

    function onDrag(e) {
        if (!dragging || !dialog) return;
        const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0]?.clientX);
        const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0]?.clientY);
        if (clientX == null || clientY == null) return;

        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;

        dialog.style.left = (startLeft + dx) + 'px';
        dialog.style.top = (startTop + dy) + 'px';
    }

    function onTouchDrag(e) {
        onDrag(e);
    }

    function endDrag() {
        dragging = false;
    }

    if (dialog) {
        const titleEl = dialog.querySelector('.modal-title');
        if (titleEl) {
            titleEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                beginDrag(e.clientX, e.clientY);
            });
            titleEl.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                if (!touch) return;
                beginDrag(touch.clientX, touch.clientY);
            }, { passive: true });
        }
    }

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onTouchDrag, { passive: false });
    document.addEventListener('touchend', endDrag);

    function submit() {
        const values = {};
        fields.forEach((field, i) => {
            const el = document.getElementById('modalInput' + i);
            if (!el) return;
            if (field.type === 'checkbox') {
                values[field.key] = el.checked;
            } else {
                values[field.key] = el.value;
            }
        });
        if (!options.keepOpenOnOk) {
            close();
        }
        callback(values, close);
    }

    newOk.addEventListener('click', submit);
    newCancel.addEventListener('click', () => {
        close();
        editor.focus();
    });

    // Enterで送信、Escapeでキャンセル
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

// ========== フローティング検索ダイアログ ==========
function updateFindCount() {
    const countEl = document.getElementById('findDialogCount');
    if (!countEl) return;
    if (!currentSearchHighlights.length) {
        countEl.textContent = '';
    } else {
        countEl.textContent = `${currentSearchIndex + 1} / ${currentSearchHighlights.length}`;
    }
}

function getFindDialog() {
    let dialog = document.getElementById('findDialog');
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.id = 'findDialog';
    dialog.className = 'find-dialog';
    dialog.style.display = 'none';
    dialog.innerHTML =
        '<div class="find-dialog-title" id="findDialogTitle">検索</div>' +
        '<div class="find-dialog-body">' +
          '<div class="find-dialog-row">' +
            '<input type="text" id="findInput" class="find-dialog-input" placeholder="検索する文字列" autocomplete="off" spellcheck="false">' +
            '<span id="findDialogCount" class="find-dialog-count"></span>' +
          '</div>' +
          '<div class="find-dialog-row find-dialog-options">' +
            '<label class="find-dialog-checkbox-label">' +
              '<input type="checkbox" id="findCaseSensitive"> 大/小文字を区別' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="find-dialog-footer">' +
          '<button id="findNextBtn" class="modal-btn modal-btn-ok">次へ</button>' +
          '<button id="findCloseBtn" class="modal-btn modal-btn-cancel">閉じる</button>' +
        '</div>';

    document.body.appendChild(dialog);

    // ドラッグ
    let dragging = false, dragStartX = 0, dragStartY = 0, startLeft = 0, startTop = 0;
    document.getElementById('findDialogTitle').addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        const rect = dialog.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dialog.style.right = 'auto';
        dialog.style.left = rect.left + 'px';
        dialog.style.top = rect.top + 'px';
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        dialog.style.left = (startLeft + e.clientX - dragStartX) + 'px';
        dialog.style.top = (startTop + e.clientY - dragStartY) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    document.getElementById('findCloseBtn').addEventListener('click', closeFindDialog);
    document.getElementById('findNextBtn').addEventListener('click', doFindNext);

    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeFindDialog();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            doFindNext();
        }
    });

    document.getElementById('findInput').addEventListener('input', () => {
        clearSearchHighlights();
        lastFindQuery = null;
        lastFindCaseSensitive = null;
        updateFindCount();
    });

    return dialog;
}

function closeFindDialog() {
    const dialog = document.getElementById('findDialog');
    if (dialog) dialog.style.display = 'none';
    findDialogOpen = false;
    clearSearchHighlights();
    lastFindQuery = null;
    lastFindCaseSensitive = null;
    if (editor) editor.focus();
}

function doFindNext() {
    const input = document.getElementById('findInput');
    const csCheckbox = document.getElementById('findCaseSensitive');
    if (!input) return;

    const query = input.value.trim();
    if (!query) {
        showWarn('検索語を入力してください');
        input.focus();
        return;
    }

    const cs = csCheckbox ? csCheckbox.checked : false;
    const isSameSearch = query === lastFindQuery && cs === lastFindCaseSensitive;

    if (!isSameSearch) {
        lastFindQuery = query;
        lastFindCaseSensitive = cs;
        const count = highlightSearchMatches(query, cs);
        if (count === 0) {
            showWarn('一致する文字列は見つかりませんでした');
            input.focus();
            return;
        }
        showWarn(`${count} 件見つかりました`);
        moveToSearchHighlight(0);
    } else {
        moveToNextSearchHighlight();
    }

    updateFindCount();
    input.focus();
}

function showFindDialog() {
    const dialog = getFindDialog();

    if (findDialogOpen) {
        const input = document.getElementById('findInput');
        if (input) input.focus();
        return;
    }

    // 選択テキストを初期値に設定
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';
    const input = document.getElementById('findInput');
    if (input && selectedText) {
        input.value = selectedText;
    }

    clearSearchHighlights();
    lastFindQuery = null;
    lastFindCaseSensitive = null;
    updateFindCount();

    dialog.style.display = 'block';
    findDialogOpen = true;

    requestAnimationFrame(() => {
        if (input) {
            input.focus();
            input.select();
        }
    });
}

function showReplaceDialog() {
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';

    const fields = [
        { key: 'query', label: '検索', value: selectedText || '', placeholder: '検索する文字列' },
        { key: 'replace', label: '置換', value: '', placeholder: '置換後の文字列（空の場合は削除）' },
        { key: 'caseSensitive', label: '大/小文字を区別', type: 'checkbox', value: false },
        { key: 'replaceAll', label: 'すべて置換', type: 'checkbox', value: true },
    ];

    showModal('置換', fields, (values) => {
        const query = (values.query || '').trim();
        if (!query) {
            showWarn('検索語を入力してください');
            return;
        }

        const replacement = values.replace || '';
        const caseSensitive = Boolean(values.caseSensitive);
        const global = Boolean(values.replaceAll);

        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const flags = caseSensitive ? (global ? 'g' : '') : (global ? 'gi' : 'i');
        const re = new RegExp(escapeRegExp(query), flags);

        const md = (typeof getMarkdown === 'function') ? getMarkdown() : '';
        if (md === null || md === undefined) {
            showError('Markdown を取得できませんでした');
            return;
        }

        const matches = md.match(re);
        if (!matches || matches.length === 0) {
            showWarn('一致する文字列は見つかりませんでした');
            return;
        }

        const replaced = md.replace(re, replacement);

        if (typeof setMarkdown === 'function') {
            setMarkdown(replaced);
        } else {
            // フォールバック: エディタのテキスト内容を直接置換
            if (editor) editor.textContent = replaced;
        }

        // 保存状態を更新
        if (typeof markModified === 'function') markModified();
        if (typeof saveEditorState === 'function') saveEditorState();

        showWarn(`${matches.length} 件を置換しました`);
    });
}

// 後方互換のためのシム（既存呼び出し用）
function showFindReplace() {
    showReplaceDialog();
}

// ========== Element Insertion ==========

async function insertLink() {
    // ダイアログ表示前に選択状態を保存
    const sel = window.getSelection();
    let savedRange = null;
    let selectedText = '';
    if (sel.rangeCount) {
        savedRange = sel.getRangeAt(0).cloneRange();
        selectedText = sel.toString() || '';
    }

    // URLとテキストの初期値を決定：選択範囲が <a> 内なら href と表示文字列を採用
    // 選択文字列自体がURLに見える場合はそれをURL初期値に使う。
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

        // 選択状態を復元して挿入
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

    // モーダル表示後にファイル選択ボタンを追加
    const fieldsEl = document.getElementById('modalFields');
    if (fieldsEl) {
        // 既存のファイルボタンがあれば削除
        const existingBtn = fieldsEl.querySelector('.modal-file-select-btn');
        if (existingBtn) existingBtn.remove();

        // ファイル選択ボタンを作成
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '12px';
        const fileBtn = document.createElement('button');
        fileBtn.className = 'modal-file-select-btn';
        fileBtn.textContent = 'ファイルを選択';
        fileBtn.style.cssText = 'padding:8px 12px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px;width:100%;';
        
        fileBtn.addEventListener('click', async () => {
            try {
                const selected = await tauriOpen({
                    multiple: false
                });
                
                if (selected) {
                    // 選択したパスをURL入力欄へ設定
                    const urlInput = document.getElementById('modalInput0');
                    if (urlInput) {
                        urlInput.value = selected;
                        urlInput.focus();
                    }
                }
            } catch (err) {
                console.error('Failed to open file dialog:', err);
            }
        });

        buttonContainer.appendChild(fileBtn);
        fieldsEl.appendChild(buttonContainer);
    }
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
        // ローカル画像選択用のファイルダイアログを開く
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

            // Uint8Array を base64 へ変換
            let binary = '';
            const bytes = new Uint8Array(data);
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            const base64 = btoa(binary);

            const filename = selected.split('/').pop().split('\\').pop();
            showModal('画像を挿入', [
                { name: 'alt', label: '代替テキスト', type: 'text', value: filename }
            ], (values) => {
                const altText = (values.alt || filename).trim();
                const html = '<img src="data:' + mime + ';base64,' + base64 + '" alt="' + escapeHtml(altText) + '">';
                // モーダルを閉じた後にエディタにフォーカスを戻してからカーソル位置を復元
                editor.focus();
                const s = window.getSelection();
                if (savedRange) {
                    s.removeAllRanges();
                    s.addRange(savedRange);
                }
                document.execCommand('insertHTML', false, html);
                markModified();
                saveEditorState(); // Save state after inserting image
            });
        }
    } catch (err) {
        console.error('Error loading image:', err);
    }
}

// コードブロック言語ドロップダウン用の対応言語（Highlight.jsの主要言語）
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
    // 選択範囲と選択テキストを保存
    const sel = window.getSelection();
    // テーブルセル内でのコードブロック挿入を禁止
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
        { key: 'lang', label: 'プログラミング言語', type: 'select', value: '', options: CODE_LANGUAGES },
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
    // 選択テキストがあれば使用し、無ければプレースホルダを使用
    code.textContent = selectedText || 'コードをここに記述';
    pre.appendChild(code);

    // 先に選択状態を復元
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

    // カーソル位置に挿入
    if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();

        // ブロックレベルで挿入されるよう調整
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
        // toggle-content の先頭/末尾に編集可能行を保証
        if (toggleContent) {
            ensureToggleContentEditable(toggleContent);
        }

        // コード内容を選択（プレースホルダ/選択テキストのいずれでも）
        const codeRange = document.createRange();
        codeRange.selectNodeContents(code);
        sel.removeAllRanges();
        sel.addRange(codeRange);

        // ハイライト中は一時的に入力イベントを抑止
        const wasConverting = isConverting;
        isConverting = true;
        
        try {
            // 先にハイライトを適用
            if (lang && typeof hljs !== 'undefined') {
                highlightCodeBlock(code);
            }

            // その後に行番号を追加
            updateLineNumbers(pre);
        } finally {
            isConverting = wasConverting;
        }
        
        saveEditorState(); // Save state after inserting code block
    }
}

/**
 * data属性からコード折り返し状態を復元する
 */
function restoreCodeWrapStates() {
    editor.querySelectorAll('pre code[data-wrap="true"]').forEach(code => {
        code.classList.add('wrap-enabled');
        const pre = code.closest('pre');
        const toolbar = pre && pre.previousElementSibling;
        const button = toolbar && toolbar.classList.contains('code-block-toolbar')
            ? toolbar.querySelector('.code-wrap-btn')
            : null;
        if (button) {
            button.classList.add('wrap-enabled');
        }
    });
}

function insertTaskList() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    // テーブルセル内のリスト挿入を禁止
    if (isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内ではリストを作成できません。');
        return;
    }
    
    const block = getParentBlock(sel.anchorNode);
    const toggleContent = block ? block.closest('.toggle-content') : null;
    const selectedText = sel.toString().trim();

    if (selectedText) {
        // 選択ブロック要素をタスク項目へ変換（ブロック内の <br> を保持）
        const range = sel.getRangeAt(0);
        const container = toggleContent || editor;
        const blocks = Array.from(container.children).filter(child =>
            range.intersectsNode(child) && child.textContent.trim()
        );

        if (blocks.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'contains-task-list';

            blocks.forEach(blk => {
                const li = document.createElement('li');
                li.className = 'task-list-item';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                li.appendChild(cb);
                li.appendChild(document.createTextNode(' '));
                // ブロックのインラインコンテンツを li へ移動（<br> 保持）
                while (blk.firstChild) {
                    li.appendChild(blk.firstChild);
                }
                ul.appendChild(li);
            });

            // 最初のブロック位置に ul を挿入
            const firstBlock = blocks[0];
            firstBlock.parentNode.insertBefore(ul, firstBlock);

            // 元のブロックを削除
            blocks.forEach(b => b.remove());

            // リスト後の編集継続用に段落を追加
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            ul.parentNode.insertBefore(p, ul.nextSibling);

            // カーソルを最初のリスト項目に配置
            const firstLi = ul.querySelector('li');
            if (firstLi) setCursorTo(firstLi);
        } else {
            // フォールバック：ブロック要素が見つからない場合、テキスト分割を使用
            const lines = selectedText.split('\n').filter(l => l.trim());
            const items = lines.map(line =>
                '<li class="task-list-item"><input type="checkbox"> ' + escapeHtml(line.trim()) + '</li>'
            ).join('');
            const html = '<ul class="contains-task-list">' + items + '</ul><p><br></p>';
            document.execCommand('insertHTML', false, html);
        }
    } else {
        // DOM操作でタスクリストを構築（構造を厳密制御）
        const ul = document.createElement('ul');
        ul.className = 'contains-task-list';

        const li = document.createElement('li');
        li.className = 'task-list-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';

        // ノーブレークスペースでカーソルが見える幅を確保
        const textNode = document.createTextNode('\u00A0');

        li.appendChild(cb);
        li.appendChild(textNode);
        ul.appendChild(li);

        // リスト後の編集継続用に段落を追加
        const p = document.createElement('p');
        p.innerHTML = '<br>';

        // 挿入後の現在のブロック要素を検出
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
            // 同一コンテナの空プレースホルダ要素を削除
            if (insertAfter.tagName === 'P' && insertAfter.textContent.trim() === '') {
                insertAfter.remove();
            }
        } else {
            insertParent.appendChild(ul);
            insertParent.appendChild(p);
        }

        // ノーブレークスペースの直後（チェックボックス横）に カーソル配置
        const newRange = document.createRange();
        newRange.setStart(textNode, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        editor.focus();
    }

    // チェックボックスをインタラクティブに
    editor.querySelectorAll('input[type="checkbox"][disabled]').forEach(cb => {
        cb.removeAttribute('disabled');
    });
    
    if (toggleContent) ensureToggleContentEditable(toggleContent);
    saveEditorState(); // Save state after inserting task list
}

function insertHorizontalRule() {
    const sel = window.getSelection();
    // テーブルセル内の水平線挿入を禁止
    if (sel.rangeCount && isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内では水平線を挿入できません。');
        return;
    }
    document.execCommand('insertHTML', false, '<hr><p><br></p>');
    saveEditorState(); // Save state after inserting HR
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

// ========== Emoji Picker ==========
var emojiPickerEl = null;

function showEmojiPicker() {
    if (emojiPickerEl && emojiPickerEl.style.display === 'block') {
        emojiPickerEl.style.display = 'none';
        return;
    }

    // 選択範囲を保存
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

    // 絵文字ボタン付近に配置
    const btn = document.getElementById('emojiBtn');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        emojiPickerEl.style.left = Math.min(rect.left, window.innerWidth - 330) + 'px';
        emojiPickerEl.style.top = (rect.bottom + 4) + 'px';
    }

    // クリック処理
    function onEmojiClick(e) {
        const item = e.target.closest('.emoji-item');
        if (!item) return;
        const emoji = item.dataset.emoji;
        emojiPickerEl.style.display = 'none';
        emojiPickerEl.removeEventListener('click', onEmojiClick);

        // 選択範囲を復元して挿入
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

    // 外側クリックで閉じる
    function onOutsideClick(e) {
        if (emojiPickerEl && !emojiPickerEl.contains(e.target) && e.target.id !== 'emojiBtn') {
            emojiPickerEl.style.display = 'none';
            emojiPickerEl.removeEventListener('click', onEmojiClick);
            document.removeEventListener('click', onOutsideClick);
        }
    }
    setTimeout(() => document.addEventListener('click', onOutsideClick), 0);
}
