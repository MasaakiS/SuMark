// =====================================================
// SuMark - 自動変換モジュール
// =====================================================
// エディタ入力時のMarkdown自動変換ロジック
// - ブロックレベル変換: # → 見出し, - → リスト, > → 引用 等
// - インライン変換: **bold**, *italic*, `code`, ~~strike~~, URL, 絵文字, 数式
//
// 依存: editor, isConverting, isComposing, inputCharCount, EMOJI_MAP (main.js)
//       getParentBlock, setCursorTo, setCursorToEnd, updateWordCount (main.js)
//       markModified, saveEditorState, debouncedSaveEditorState, currentState (modules)
//       isInsideTableCell, getCaretCharacterOffsetWithin, setCaretCharacterOffset (modules)
//       debouncedHighlightCodeAtCursor, updateLineNumbers (modules)

// ========== エディタ入力ハンドラ ==========
function onEditorInput() {
    if (isConverting) return;
    if (isComposing) return; // IME変換中はスキップ
    if (isProgrammaticEditorUpdate) return;

    isConverting = true;
    try {
        handleBlockAutoConversion();
        handleInlineAutoConversion();
    } catch (err) {
        console.error('Auto-conversion error:', err);
    }

    updateWordCount();
    markModified();
    
    // Undo履歴の粒度: 3文字ごと、または Enter 押下時
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

    // カーソル位置がコードブロック内なら再ハイライト
    debouncedHighlightCodeAtCursor();

    // カーソル位置のコードブロック行番号を更新
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

    isConverting = false;
}

/**
 * 行頭のMarkdown記号だけを正規化する。
 * これにより、語中の「マーク」→「マ-ク」のような誤変換を防ぐ。
 */
function normalizeMarkdownPrefix(text) {
    if (typeof text !== 'string' || text.length === 0) return text;

    // アルゴリズム意図:
    // 1) 行頭だけを正規化して変換トリガーを安定化
    // 2) 本文側の空白は維持して contenteditable の見た目崩れを防止
    // 3) 記号の全角/半角ゆれのみを吸収して誤変換を減らす
    // 非改行空白/全角空白は行頭のMarkdown接頭辞領域だけを正規化する。
    // （先頭約10文字）本文側の &nbsp; を壊すと見た目が崩れるため。
    // contenteditable ではブラウザが空白維持のため &nbsp; を挿入することがあり
    // 全体置換すると末尾空白が消える副作用がある。
    const prefixLen = Math.min(10, text.length);
    let normalized = text.substring(0, prefixLen).replace(/\u00A0/g, ' ').replace(/　/g, ' ')
        + text.substring(prefixLen);

    // 順序付きリストの数字は行頭のみ正規化する。
    normalized = normalized.replace(/^[０-９]+/, m =>
        m.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    );

    // Markdown記号は行頭のみ正規化
    normalized = normalized.replace(/^([0-9]+)．/, '$1.');
    normalized = normalized.replace(/^[ー－―−]{1,3}/, m => '-'.repeat(m.length));
    normalized = normalized.replace(/^＃{1,6}/, m => '#'.repeat(m.length));
    normalized = normalized.replace(/^＞{1,3}/, m => '>'.repeat(m.length));
    normalized = normalized.replace(/^＊/, '*');
    normalized = normalized.replace(/^［/, '[');
    normalized = normalized.replace(/^(\[[ xX]?)］/, '$1]');

    return normalized;
}

// ========== ブロックレベル自動変換 ==========
// ブロック先頭で入力されたMarkdown構文を変換する。
// 動作モード:
//   1. 接頭辞のみ（接頭辞の直後にスペース入力で発火）
//      "# " → 空のH1、"- " → 箇条書き、"1. " → 番号付きリスト、"> " → 引用
//   2. 接頭辞 + 本文
//      "# ああああ" → 本文付きH1
//      "- テキスト" → 本文付き箇条書き、"1. テキスト" → 本文付き番号付きリスト
//      "> テキスト" → 本文付き引用
//      "- [ ] テキスト" → 本文付きタスクリスト
//   3. 完全一致
//      "---" → 水平線
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

    // 変換対象は未整形の P / DIV ブロックのみ
    const tag = block.tagName;
    if (tag !== 'P' && tag !== 'DIV') {
        console.log('[DEBUG] handleBlockAutoConversion: not P or DIV, tag=', tag);
        return;
    }
    
    // セル内だけ変換を制限する理由:
    // リスト等のブロック要素を許可すると「表の中に表/リスト」が発生し、
    // 保存→再読み込み時にDOM構造が壊れやすいため。
    if (isInsideTableCell(range.startContainer)) {
        console.log('[DEBUG] handleBlockAutoConversion: inside table cell, skipping list conversions');
        // セル内ではリスト変換を除外し、見出し/引用/水平線のみ許可
        const text = normalizeMarkdownPrefix(block.textContent);

        // テーブルセル内では見出し変換のみ許可
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

    // マッチ判定前に行頭Markdown記号のみ正規化
    const originalText = text;
    text = normalizeMarkdownPrefix(text);

    // 壊れる条件:
    // 空白種別の差だけでDOMを書き戻すと、ブラウザが末尾空白を削除しやすい。
    // そのため「記号正規化が実際に発生したときだけ」DOMを書き換える。
    const normalizedForCompare = text.replace(/[\u00A0　]/g, ' ');
    const originalForCompare = originalText.replace(/[\u00A0　]/g, ' ');

    // 行頭記号が実際に正規化された場合のみエディタへ反映
    if (text !== originalText && normalizedForCompare !== originalForCompare) {
        console.log('[DEBUG] Text normalized from "' + originalText + '" to "' + text + '"');
        const caretOffset = getCaretCharacterOffsetWithin(block);
        block.textContent = text;
        setCaretCharacterOffset(block, caretOffset);
    }

    // 見出し: "# text" や "## text" など
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
    // 見出し接頭辞のみ: "# "
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

    // タスクリスト（短縮記法）: "[] text" / "[x] text"
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
    // タスクリスト接頭辞のみ（短縮記法）: "[] " / "[x] "
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

    // 箇条書き（本文あり）: "- text" / "* text"
    const ulContentMatch = text.match(/^[-*] (.+)$/);
    if (ulContentMatch && !text.startsWith('- [')) {
        const content = ulContentMatch[1];
        // toggle-content 内は execCommand を避けて DOM 操作で変換
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
        // ブロック全体を選択してからリスト化
        const newSel = window.getSelection();
        const newRange = document.createRange();
        newRange.selectNodeContents(block);
        newRange.collapse(false);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
        document.execCommand('insertUnorderedList');
        return;
    }
    // 箇条書き接頭辞のみ: "- " / "* "
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

    // 番号付きリスト（本文あり）: "1. text"
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
    // 番号付きリスト接頭辞のみ: "1. "
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

    // トグル（本文あり）: ">>> text"
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
    // トグル接頭辞のみ: ">>> "
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
        // summary テキストを編集しやすいよう選択
        const r = document.createRange();
        r.selectNodeContents(summary);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(r);
        return;
    }

    // 引用（本文あり）: "> text"
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
    // 引用接頭辞のみ: "> "
    if (text === '> ') {
        const bq = document.createElement('blockquote');
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        bq.appendChild(p);
        block.parentNode.replaceChild(bq, block);
        setCursorTo(p);
        return;
    }

    // 水平線: ---
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

// ========== インライン自動変換 ==========
// インラインMarkdownパターンを変換:
//   **text** → 太字、*text* → 斜体
//   `code`   → コード、~~text~~ → 打ち消し線
function handleInlineAutoConversion() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    // コードブロック内（<pre><code>）では変換しない
    let ancestor = textNode.parentNode;
    while (ancestor && ancestor !== editor) {
        if (ancestor.tagName === 'PRE' || (ancestor.tagName === 'CODE' && ancestor.parentNode && ancestor.parentNode.tagName === 'PRE')) {
            return;
        }
        ancestor = ancestor.parentNode;
    }

    const text = textNode.textContent;
    const pos = range.startOffset;
    const before = text.substring(0, pos);

    // 太字: **text**
    const boldMatch = before.match(/\*\*(.+?)\*\*$/);
    if (boldMatch) {
        applyInlineAutoConvert(textNode, boldMatch, 'strong', pos);
        return;
    }

    // 打ち消し線: ~~text~~
    const strikeMatch = before.match(/~~(.+?)~~$/);
    if (strikeMatch) {
        applyInlineAutoConvert(textNode, strikeMatch, 'del', pos);
        return;
    }

    // インラインコード: `text`
    // 行頭の ``` フェンス開始と見なせる場合はスキップ
    const codeMatch = before.match(/`([^`]+)`$/);
    if (codeMatch) {
        const matchStart = before.length - codeMatch[0].length;
        const textBeforeMatch = before.substring(0, matchStart);
        // 直前が `（例: ```bash）ならフェンス開始記号として扱う
        if (!textBeforeMatch.endsWith('`')) {
            applyInlineAutoConvert(textNode, codeMatch, 'code', pos);
            return;
        }
    }

    // 斜体: *text*（直前が * でない場合）
    const italicMatch = before.match(/(?<!\*)\*([^*]+?)\*$/);
    if (italicMatch && !before.endsWith('**')) {
        applyInlineAutoConvert(textNode, italicMatch, 'em', pos);
        return;
    }

    // URL自動リンク化: http(s)://... の後に空白が続く場合
    const urlMatch = before.match(/(https?:\/\/[^\s<>\"]+)\s$/);
    if (urlMatch) {
        const url = urlMatch[1];
        const urlStart = before.lastIndexOf(url);
        // 既に <a> 内にある場合は変換しない
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

    // 絵文字: :emoji_name:
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

    // ディスプレイ数式: $$...$$（競合回避のためインライン数式より先に判定）
    // インライン数式との誤マッチを避けるため厳しめに判定する
    const displayMathMatch = before.match(/\$\$([\s\S]+?)\$\$$/);
    if (displayMathMatch && window.katex) {
        const math = displayMathMatch[1];
        const fullMatch = displayMathMatch[0];
        const startIdx = pos - fullMatch.length;
        
        // 安全確認: $...$ ではなく $$...$$ を確実に検出できた場合のみ処理
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

    // インライン数式: $...$（$$ との競合を避けるため直前 $ を除外）
    const inlineMathMatch = before.match(/\$([^$\n]+?)\$$/);
    if (inlineMathMatch && window.katex) {
        const math = inlineMathMatch[1];
        const fullMatch = inlineMathMatch[0];
        const startIdx = pos - fullMatch.length;
        
        // 直前が $ の場合は $$...$$ の一部とみなしてスキップ
        if (startIdx > 0 && textNode.textContent[startIdx - 1] === '$') {
            return; // $$...$$ の一部の可能性が高いためスキップ
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

    // 置換後ノードを構築
    const frag = document.createDocumentFragment();
    if (beforeText) {
        frag.appendChild(document.createTextNode(beforeText));
    }

    const elem = document.createElement(tag);
    elem.textContent = innerText;
    frag.appendChild(elem);

    // カーソル位置維持のためゼロ幅スペースを先頭に付ける
    const cursorText = document.createTextNode('\u200B' + afterText);
    frag.appendChild(cursorText);

    parent.replaceChild(frag, textNode);

    // 変換要素の直後にカーソルを移動
    const newSel = window.getSelection();
    const newRange = document.createRange();
    newRange.setStart(cursorText, 1); // ゼロ幅スペースの直後
    newRange.collapse(true);
    newSel.removeAllRanges();
    newSel.addRange(newRange);
}
