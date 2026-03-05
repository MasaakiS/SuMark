// =====================================================
// SuMark - Auto-Conversion Module
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
