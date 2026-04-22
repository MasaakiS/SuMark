// =====================================================
// SuMark - Toolbar Actions Module
// =====================================================
// applyHeading, insertUnorderedList, insertOrderedList, applyBlockquote,
// applyInlineCode, showModal, insertLink, insertImage, insertCodeBlock,
// doInsertCodeBlock, restoreCodeWrapStates, insertTaskList,
// insertHorizontalRule, insertDate, insertTime, insertDateTime,
// showEmojiPicker, CODE_LANGUAGES

// ========== Search Highlight State ==========
let currentSearchHighlights = [];
let currentSearchIndex = -1;

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

    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function moveToNextSearchHighlight() {
    if (!currentSearchHighlights.length) return;
    moveToSearchHighlight(currentSearchIndex + 1);
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

// ========== Custom Modal Dialog ==========
function showModal(title, fields, callback, options = {}) {
    // options: { okText, cancelText, keepOpenOnOk }
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

    // Position dialog in the center by default
    const dialog = overlay.querySelector('.modal-dialog');
    if (dialog) {
        dialog.style.left = '50%';
        dialog.style.top = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
    }

    // Focus first input/select
    const firstInput = fieldsEl.querySelector('input, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);

    // Cleanup previous listeners
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
        clearSearchHighlights();
        // Remove drag listeners (if any)
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onTouchDrag);
        document.removeEventListener('touchend', endDrag);
    }

    // Drag & move support (for moving the modal)
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

        // Convert % centering to absolute px so movement doesn't jump
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

function showFindDialog() {
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';

    const fields = [
        { key: 'query', label: '検索', value: selectedText || '', placeholder: '検索する文字列' },
        { key: 'caseSensitive', label: '大/小文字を区別', type: 'checkbox', value: false },
    ];

    let lastQuery = null;
    let lastCaseSensitive = null;

    showModal('検索', fields, (values) => {
        const query = (values.query || '').trim();
        if (!query) {
            showWarn('検索語を入力してください');
            return;
        }

        const caseSensitive = Boolean(values.caseSensitive);
        const isSameSearch = query === lastQuery && caseSensitive === lastCaseSensitive;

        if (!isSameSearch) {
            lastQuery = query;
            lastCaseSensitive = caseSensitive;

            const count = highlightSearchMatches(query, caseSensitive);
            if (count === 0) {
                showWarn('一致する文字列は見つかりませんでした');
                return;
            }

            showWarn(`${count} 件見つかりました`);
            moveToSearchHighlight(0);
            return;
        }

        // Same query: move to next match
        moveToNextSearchHighlight();
    }, {
        okText: '次へ',
        cancelText: '閉じる',
        keepOpenOnOk: true,
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
            // Fallback: directly replace editor text content
            if (editor) editor.textContent = replaced;
        }

        // 保存状態を更新
        if (typeof markModified === 'function') markModified();
        if (typeof saveEditorState === 'function') saveEditorState();

        showWarn(`${matches.length} 件を置換しました`);
    });
}

// Backwards-compat shim (existing calls)
function showFindReplace() {
    showReplaceDialog();
}

// ========== Element Insertion ==========

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

        // Temporarily prevent input events during highlighting
        const wasConverting = isConverting;
        isConverting = true;
        
        try {
            // Apply highlighting first
            if (lang && typeof hljs !== 'undefined') {
                highlightCodeBlock(code);
            }

            // Then add line numbers
            updateLineNumbers(pre);
        } finally {
            isConverting = wasConverting;
        }
        
        saveEditorState(); // Save state after inserting code block
    }
}

/**
 * Restore code wrap states from data attributes
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
    
    // Prevent list insertion inside table cells
    if (isInsideTableCell(sel.anchorNode)) {
        showWarn('表のセル内ではリストを作成できません。');
        return;
    }
    
    const block = getParentBlock(sel.anchorNode);
    const toggleContent = block ? block.closest('.toggle-content') : null;
    const selectedText = sel.toString().trim();

    if (selectedText) {
        // Convert selected block elements to task list items (preserves <br> within blocks)
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
                // Move inline content from block to li, preserving <br>
                while (blk.firstChild) {
                    li.appendChild(blk.firstChild);
                }
                ul.appendChild(li);
            });

            // Insert ul where first block was
            const firstBlock = blocks[0];
            firstBlock.parentNode.insertBefore(ul, firstBlock);

            // Remove original blocks
            blocks.forEach(b => b.remove());

            // Add trailing paragraph for continuing editing after the list
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            ul.parentNode.insertBefore(p, ul.nextSibling);

            // Position cursor in the first list item
            const firstLi = ul.querySelector('li');
            if (firstLi) setCursorTo(firstLi);
        } else {
            // Fallback: no block elements found, use text splitting
            const lines = selectedText.split('\n').filter(l => l.trim());
            const items = lines.map(line =>
                '<li class="task-list-item"><input type="checkbox"> ' + escapeHtml(line.trim()) + '</li>'
            ).join('');
            const html = '<ul class="contains-task-list">' + items + '</ul><p><br></p>';
            document.execCommand('insertHTML', false, html);
        }
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
