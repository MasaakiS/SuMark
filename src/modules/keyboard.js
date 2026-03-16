// =====================================================
// SuMark - Keyboard Event Handler Module
// =====================================================
// キーボードイベント処理（ショートカット、Enter、Tab）
// - handleKeyDown(): メインキーボードショートカットディスパッチャー
// - handleEnterKey(): Enterキー処理（見出し→段落変換、コードブロック脱出、リスト継続/脱出等）
// - handleTabKey(): Tabキー処理（コードブロック内タブ挿入、リストインデント/アウトデント）
//
// 依存: editor, isComposing, inputCharCount (main.js)
//       getParentBlock, setCursorTo, setCursorToEnd (main.js)
//       markModified, closeTab, activeTabId, tabs, switchTab (tabManager.js)
//       saveEditorState, performUndo, performRedo (undoRedo.js)
//       exportPDF (exportManager.js), hljs (vendor)
//       isOnEmptyTrailingLine, removeTrailingEmptyLines (nodeUtils.js)
//       highlightCodeBlock, updateLineNumbers (codeHighlight.js)
//       renderMermaidBlocks (mermaidManager.js)
//       insertDate, insertTime, applyInlineCode, insertLink (toolbarActions.js)
//       newFile, openFile, saveFile, saveAsFile (fileManager.js)

// ========== Main Keyboard Handler ==========
function handleKeyDown(e) {
        // エンター押下時は即座に履歴を積む
        if (e.key === 'Enter' && !isComposing) {
            saveEditorState();
            inputCharCount = 0;
        }
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    
    // Cmd/Ctrl+Z: Undo
    if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
    }
    
    // Cmd/Ctrl+Shift+Z: Redo
    if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
        return;
    }
    
    // Cmd/Ctrl+Y: Redo (alternative shortcut)
    if (mod && e.key === 'y') {
        e.preventDefault();
        performRedo();
        return;
    }

    // Cmd/Ctrl+P: PDF export
    if (mod && e.key === 'p') {
        e.preventDefault();
        exportPDF();
        return;
    }

    // Cmd/Ctrl+F: 検索
    if (mod && e.key === 'f') {
        e.preventDefault();
        if (typeof showFindDialog === 'function') {
            showFindDialog();
        }
        return;
    }

    // Cmd/Ctrl+R: 置換
    if (mod && e.key === 'r') {
        e.preventDefault();
        if (typeof showReplaceDialog === 'function') {
            showReplaceDialog();
        }
        return;
    }

    // Backspace/Delete: handle non-editable elements (TOC, Mermaid, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete') {
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);

            // Case 1: Selection spans across a non-editable element
            if (!range.collapsed) {
                const selected = range.commonAncestorContainer;
                const nonEditable = selected.nodeType === 1
                    ? selected.closest('[contenteditable="false"]')
                    : selected.parentElement && selected.parentElement.closest('[contenteditable="false"]');
                if (nonEditable && nonEditable !== editor) {
                    e.preventDefault();
                    nonEditable.remove();
                    markModified();
                    return;
                }
            }

            // Case 2: Cursor is at the boundary of a non-editable element
            if (range.collapsed) {
                const node = range.startContainer;
                const offset = range.startOffset;
                let target = null;

                if (e.key === 'Backspace') {
                    // Check previous sibling or previous node
                    if (node.nodeType === 1 && offset > 0) {
                        const prev = node.childNodes[offset - 1];
                        if (prev && prev.nodeType === 1 && prev.getAttribute('contenteditable') === 'false') {
                            target = prev;
                        }
                    } else if (node.nodeType === 3 && offset === 0) {
                        // At start of text node, check previous sibling of parent block
                        const block = getParentBlock(node);
                        if (block && block.previousElementSibling &&
                            block.previousElementSibling.getAttribute('contenteditable') === 'false') {
                            target = block.previousElementSibling;
                        }
                    }
                } else { // Delete
                    if (node.nodeType === 1 && offset < node.childNodes.length) {
                        const next = node.childNodes[offset];
                        if (next && next.nodeType === 1 && next.getAttribute('contenteditable') === 'false') {
                            target = next;
                        }
                    } else if (node.nodeType === 3 && offset === node.textContent.length) {
                        const block = getParentBlock(node);
                        if (block && block.nextElementSibling &&
                            block.nextElementSibling.getAttribute('contenteditable') === 'false') {
                            target = block.nextElementSibling;
                        }
                    }
                }

                if (target) {
                    e.preventDefault();
                    target.remove();
                    markModified();
                    return;
                }
            }
        }

        // Backspace within an empty list item at end should exit list into an empty paragraph
        if (e.key === 'Backspace' && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            if (range.collapsed) {
                const block = getParentBlock(range.startContainer);
                if (block && block.tagName === 'LI') {
                    // Only treat as "empty" if no visible text (ignore <br>)
                    const text = block.textContent.replace(/\u200B/g, '').trim();
                    const isEmpty = text === '';

                    // Ensure cursor is at start of the LI
                    const testRange = document.createRange();
                    testRange.selectNodeContents(block);
                    testRange.setEnd(range.startContainer, range.startOffset);
                    const isAtStart = testRange.toString().length === 0;

                    if (isEmpty && isAtStart) {
                        const list = block.parentNode;
                        if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
                            // Only trigger when this is the last list item
                            if (!block.nextElementSibling) {
                                e.preventDefault();

                                const listParent = list.parentNode;
                                const nextSibling = list.nextSibling;

                                // Remove the empty list item
                                block.remove();

                                // If list is now empty, remove it
                                if (list.children.length === 0) {
                                    list.remove();
                                }

                                // Insert an empty paragraph after the list (or where the list was)
                                const p = document.createElement('p');
                                p.innerHTML = '<br>';
                                if (listParent) {
                                    if (nextSibling) {
                                        listParent.insertBefore(p, nextSibling);
                                    } else {
                                        listParent.appendChild(p);
                                    }
                                } else {
                                    editor.appendChild(p);
                                }

                                setCursorTo(p);
                                markModified();
                                return;
                            }
                        }
                    }
                }
            }
        }
    }

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

    // Arrow keys in table cells: move between cells when at boundaries
    // (Up/Down always move if possible; Left/Right only if cursor is at edge)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const arrowKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (arrowKeys.includes(e.key)) {
            const sel = window.getSelection();
            if (sel.rangeCount && sel.isCollapsed) {
                const range = sel.getRangeAt(0);
                const cell = (range.startContainer.nodeType === 1
                    ? range.startContainer.closest('td, th')
                    : range.startContainer.parentElement && range.startContainer.parentElement.closest('td, th'));
                if (cell) {
                    const table = cell.closest('table');
                    const row = cell.closest('tr');
                    if (table && row) {
                        const cells = Array.from(row.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                        const idx = cells.indexOf(cell);

                        const isCursorAtStart = (r, container) => {
                            const testRange = r.cloneRange();
                            testRange.selectNodeContents(container);
                            testRange.setEnd(r.startContainer, r.startOffset);
                            return testRange.toString().length === 0;
                        };
                        const isCursorAtEnd = (r, container) => {
                            const testRange = r.cloneRange();
                            testRange.selectNodeContents(container);
                            testRange.setStart(r.startContainer, r.startOffset);
                            return testRange.toString().length === 0;
                        };
                        const atStart = isCursorAtStart(range, cell);
                        const atEnd = isCursorAtEnd(range, cell);

                        const moveToCell = (targetCell) => {
                            if (!targetCell) return false;
                            const r = document.createRange();
                            r.selectNodeContents(targetCell);
                            r.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(r);
                            return true;
                        };

                        let moved = false;

                        if (e.key === 'ArrowUp') {
                            // Move to cell above (same column index)
                            const rows = Array.from(table.querySelectorAll('tr'));
                            const rowIndex = rows.indexOf(row);
                            if (rowIndex > 0) {
                                const prevRow = rows[rowIndex - 1];
                                const prevCells = Array.from(prevRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                const target = prevCells[Math.min(idx, prevCells.length - 1)];
                                moved = moveToCell(target);
                            }
                        } else if (e.key === 'ArrowDown') {
                            // Move to cell below (same column index)
                            const rows = Array.from(table.querySelectorAll('tr'));
                            const rowIndex = rows.indexOf(row);
                            if (rowIndex < rows.length - 1) {
                                const nextRow = rows[rowIndex + 1];
                                const nextCells = Array.from(nextRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                const target = nextCells[Math.min(idx, nextCells.length - 1)];
                                moved = moveToCell(target);
                            }
                        } else if (e.key === 'ArrowLeft' && atStart) {
                            // Move to previous cell (or previous row end)
                            if (idx > 0) {
                                moved = moveToCell(cells[idx - 1]);
                            } else {
                                const rows = Array.from(table.querySelectorAll('tr'));
                                const rowIndex = rows.indexOf(row);
                                if (rowIndex > 0) {
                                    const prevRow = rows[rowIndex - 1];
                                    const prevCells = Array.from(prevRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                    moved = moveToCell(prevCells[prevCells.length - 1]);
                                }
                            }
                        } else if (e.key === 'ArrowRight' && atEnd) {
                            // Move to next cell (or next row start)
                            if (idx < cells.length - 1) {
                                moved = moveToCell(cells[idx + 1]);
                            } else {
                                const rows = Array.from(table.querySelectorAll('tr'));
                                const rowIndex = rows.indexOf(row);
                                if (rowIndex < rows.length - 1) {
                                    const nextRow = rows[rowIndex + 1];
                                    const nextCells = Array.from(nextRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                    moved = moveToCell(nextCells[0]);
                                }
                            }
                        }

                        if (moved) {
                            e.preventDefault();
                            return;
                        }
                    }
                }
            }
        }
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

    // Cmd/Ctrl+Q → アプリ終了確認フロー
    if (mod && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        if (typeof window.requestAppClose === 'function') {
            window.requestAppClose();
        }
        return;
    }

    // Cmd/Ctrl+Tab: 次のタブへ移動 / Cmd/Ctrl+Shift+Tab: 前のタブへ移動
    if (mod && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1) {
            const currentIndex = tabs.findIndex(t => t.id === activeTabId);
            if (e.shiftKey) {
                const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                switchTab(tabs[prevIndex].id);
            } else {
                const nextIndex = (currentIndex + 1) % tabs.length;
                switchTab(tabs[nextIndex].id);
            }
        }
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
                if (e.shiftKey) {
                    saveAsFile();
                } else {
                    saveFile();
                }
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
            case 'x':
                if (e.shiftKey) {
                    e.preventDefault();
                    document.execCommand('strikethrough');
                }
                break;
            // Cmd+Z / Cmd+Shift+Z (undo/redo) are handled natively
        }
    }
}

// ========== Enter Key Handling ==========
function handleEnterKey(e) {
    // Skip Enter handling during IME composition (Japanese input, etc.)
    // The Enter key during composition is for confirming the conversion, not for creating new lines
    if (isComposing) {
        return; // Let the default IME behavior handle it
    }
    
    // Shift+Enter: Insert soft line break (space space + newline for Markdown)
    if (e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        const range = sel.getRangeAt(0);
        
        // Insert two spaces followed by a line break
        // This creates a <br> in Markdown when rendered
        const textNode = document.createTextNode('  ');
        range.insertNode(textNode);
        
        // Move cursor after the spaces
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Insert line break
        document.execCommand('insertLineBreak');
        
        markModified();
        saveEditorState();
        return;
    }
    
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    // ---- Details/Summary: handle BEFORE getParentBlock (summary is not a block tag) ----
    let detailsAncestor = range.startContainer;
    while (detailsAncestor && detailsAncestor !== editor) {
        if (detailsAncestor.nodeType === 1 && detailsAncestor.tagName === 'DETAILS') break;
        detailsAncestor = detailsAncestor.parentNode;
    }
    if (detailsAncestor && detailsAncestor.tagName === 'DETAILS' && detailsAncestor !== editor) {
        const detailsEl = detailsAncestor;
        const summaryEl = detailsEl.querySelector(':scope > summary');

        // Case 1: Cursor is in summary → move to toggle content
        if (summaryEl && summaryEl.contains(range.startContainer)) {
            e.preventDefault();
            let contentDiv = detailsEl.querySelector(':scope > .toggle-content');
            if (!contentDiv) {
                contentDiv = document.createElement('div');
                contentDiv.className = 'toggle-content';
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
                detailsEl.appendChild(contentDiv);
            }
            const firstP = contentDiv.querySelector('p') || contentDiv.firstElementChild;
            if (firstP) {
                setCursorTo(firstP);
            } else {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                contentDiv.appendChild(p);
                setCursorTo(p);
            }
            return;
        }

        // Case 2: Cursor is in toggle content
        const toggleContent = detailsEl.querySelector(':scope > .toggle-content');
        if (toggleContent && toggleContent.contains(range.startContainer)) {
            const currentBlock = getParentBlock(range.startContainer);

            // If inside a list within toggle, check if at very start of first item
            // to allow inserting elements before the list
            if (currentBlock && (currentBlock.tagName === 'LI')) {
                const parentList = currentBlock.closest('ul, ol');
                if (parentList && toggleContent.firstElementChild === parentList) {
                    // Check if this is the first LI and cursor is at the very start
                    const firstLi = parentList.querySelector('li');
                    if (firstLi === currentBlock) {
                        const testRange = document.createRange();
                        testRange.selectNodeContents(currentBlock);
                        testRange.setEnd(range.startContainer, range.startOffset);
                        const isAtStart = testRange.toString().length === 0;
                        if (isAtStart && currentBlock.textContent.trim() !== '') {
                            e.preventDefault();
                            const newP = document.createElement('p');
                            newP.innerHTML = '<br>';
                            toggleContent.insertBefore(newP, parentList);
                            setCursorTo(newP);
                            return;
                        }
                    }
                }
                // fall through to normal list Enter handling
            } else if (currentBlock && (currentBlock.tagName === 'TD' || currentBlock.tagName === 'TH')) {
                // fall through to normal table Enter handling
            } else {
                // Check if cursor is at the very start of the first element
                if (currentBlock && toggleContent.firstElementChild === currentBlock) {
                    const testRange = document.createRange();
                    testRange.selectNodeContents(currentBlock);
                    testRange.setEnd(range.startContainer, range.startOffset);
                    const isAtStart = testRange.toString().length === 0;
                    if (isAtStart && currentBlock.textContent.trim() !== '') {
                        e.preventDefault();
                        const newP = document.createElement('p');
                        newP.innerHTML = '<br>';
                        toggleContent.insertBefore(newP, currentBlock);
                        setCursorTo(newP);
                        return;
                    }
                }

                // Empty line at end: exit toggle
                if (currentBlock && currentBlock.textContent.trim() === '') {
                    const children = Array.from(toggleContent.children);
                    const idx = children.indexOf(currentBlock);
                    const isLast = idx === children.length - 1;
                    if (isLast && children.length > 1) {
                        e.preventDefault();
                        currentBlock.remove();
                        let afterEl = detailsEl.nextElementSibling;
                        if (!afterEl || afterEl.tagName !== 'P') {
                            afterEl = document.createElement('p');
                            afterEl.innerHTML = '<br>';
                            detailsEl.parentNode.insertBefore(afterEl, detailsEl.nextSibling);
                        }
                        setCursorTo(afterEl);
                        return;
                    }
                }

                // Normal Enter in toggle content: split text and create new paragraph
                if (currentBlock) {
                    e.preventDefault();
                    const afterRange = document.createRange();
                    afterRange.setStart(range.startContainer, range.startOffset);
                    afterRange.setEndAfter(currentBlock.lastChild || currentBlock);
                    const afterFrag = afterRange.extractContents();

                    const newP = document.createElement('p');
                    if (afterFrag.textContent.trim() || afterFrag.querySelector('*')) {
                        newP.appendChild(afterFrag);
                    } else {
                        newP.innerHTML = '<br>';
                    }

                    // Clean up current block if empty
                    if (!currentBlock.textContent.trim() && !currentBlock.querySelector('br')) {
                        currentBlock.innerHTML = '<br>';
                    }

                    // Insert new paragraph after current block within toggle-content
                    if (currentBlock.nextSibling) {
                        toggleContent.insertBefore(newP, currentBlock.nextSibling);
                    } else {
                        toggleContent.appendChild(newP);
                    }
                    setCursorTo(newP);
                    return;
                } else {
                    // No block found (text directly in toggle-content)
                    e.preventDefault();
                    const newP = document.createElement('p');
                    newP.innerHTML = '<br>';
                    toggleContent.appendChild(newP);
                    setCursorTo(newP);
                    return;
                }
            }
        }
    }

    const block = getParentBlock(range.startContainer);
    if (!block) return;

    const tag = block.tagName;

    // In heading: create paragraph, not another heading
    if (/^H[1-6]$/.test(tag)) {
        e.preventDefault();

        // Check if the heading is empty (convert to paragraph)
        const headingText = block.textContent.trim();
        if (headingText === '') {
            // Convert empty heading to paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            block.parentNode.insertBefore(p, block);
            block.remove();
            setCursorTo(p);
            return;
        }

        // Check if cursor is at the very beginning of the heading
        const isAtStart = (function() {
            if (!range.collapsed) return false;
            const testRange = document.createRange();
            testRange.selectNodeContents(block);
            testRange.setEnd(range.startContainer, range.startOffset);
            return testRange.toString().length === 0;
        })();

        const p = document.createElement('p');
        p.innerHTML = '<br>';

        if (isAtStart) {
            // Insert empty paragraph BEFORE heading (to push heading down)
            block.parentNode.insertBefore(p, block);
            // Keep cursor in the heading
            setCursorTo(block);
        } else {
            // Insert paragraph after heading
            block.parentNode.insertBefore(p, block.nextSibling);
            setCursorTo(p);
        }
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
        // Update line numbers after new line
        if (preEl) updateLineNumbers(preEl);
        return;
    }

    // In list item: if empty, outdent one level per Enter, finally exit list
    if (tag === 'LI') {
        const text = block.textContent.trim();
        const hasCheckbox = block.querySelector('input[type="checkbox"]');
        const effectiveText = hasCheckbox ? text.replace(/^\s*/, '') : text;

        if (effectiveText === '' || (hasCheckbox && block.textContent.replace(/\s/g, '') === '')) {
            e.preventDefault();
            const list = block.parentNode;
            const parentLi = list.closest('li');
            if (parentLi) {
                // 親liの直後に空liを移動（アウトデント）
                parentLi.parentNode.insertBefore(block, parentLi.nextSibling);
                setCursorTo(block);
                return;
            } else {
                // 最上位リストならli→p変換
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                list.parentNode.insertBefore(p, list.nextSibling);
                block.remove();
                if (list.children.length === 0) list.remove();
                setCursorTo(p);
                return;
            }
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
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                const newRange = document.createRange();
                // Position cursor at the end of the text node
                // If afterText is empty (typical case), textNode contains only ' ' (space), so length is 1
                // If afterText has content, position at the end
                const cursorPos = afterText.trim() ? textNode.textContent.length : 1;
                newRange.setStart(textNode, cursorPos);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                // Ensure editor focus
                editor.focus();
            } else {
                // Fallback: use setCursorTo if text node not found
                setCursorTo(newLi);
            }
            
            return;
        }

        // Otherwise, let default list behavior handle it
        // But inside toggle-content, browser default doesn't work properly
        const listInToggle = block.closest('.toggle-content');
        if (listInToggle) {
            e.preventDefault();
            const sel3 = window.getSelection();
            const r3 = sel3.getRangeAt(0);

            // Extract content after cursor
            const afterRange = document.createRange();
            afterRange.setStart(r3.startContainer, r3.startOffset);
            afterRange.setEndAfter(block.lastChild || block);
            const afterFrag = afterRange.extractContents();
            const afterText = afterFrag.textContent;

            const newLi = document.createElement('li');
            if (afterText.trim()) {
                newLi.appendChild(afterFrag);
            } else {
                newLi.innerHTML = '<br>';
            }

            // Clean up current LI if empty
            if (!block.textContent.trim() && !block.querySelector('br')) {
                block.innerHTML = '<br>';
            }

            const parentList = block.parentNode;
            if (block.nextSibling) {
                parentList.insertBefore(newLi, block.nextSibling);
            } else {
                parentList.appendChild(newLi);
            }
            setCursorTo(newLi);
            return;
        }
        return;
    }

    // In blockquote: Enter exits blockquote, Shift+Enter inserts newline inside
    if (tag === 'BLOCKQUOTE' || (block.parentNode && block.parentNode.tagName === 'BLOCKQUOTE')) {
        e.preventDefault();
        const bqBlock = tag === 'BLOCKQUOTE' ? block : block.parentNode;

        // Exit blockquote: insert a new <p> after the blockquote
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        bqBlock.parentNode.insertBefore(p, bqBlock.nextSibling);
        setCursorTo(p);
        return;
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
            // Add line numbers
            updateLineNumbers(pre);
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

    // In lists: indent/outdent via proper DOM manipulation
    // (execCommand('indent') creates malformed HTML: <ul> directly inside <ul> without <li> wrapper)
    if (block && block.tagName === 'LI') {
        if (e.shiftKey) {
            // Outdent: move this LI from sub-list to parent list
            const list = block.parentNode;
            const parentLi = list ? list.closest('li') : null;
            const parentList = parentLi ? parentLi.parentNode : null;

            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
                // Move any remaining siblings in the sub-list into a new sub-list under this LI
                const remainingSiblings = [];
                let sib = block.nextElementSibling;
                while (sib) {
                    remainingSiblings.push(sib);
                    sib = sib.nextElementSibling;
                }
                if (remainingSiblings.length > 0) {
                    const newSubList = document.createElement(list.tagName);
                    // Copy task-list classes if applicable
                    if (list.classList.contains('contains-task-list')) {
                        newSubList.classList.add('contains-task-list');
                    }
                    remainingSiblings.forEach(s => newSubList.appendChild(s));
                    block.appendChild(newSubList);
                }

                // Insert this LI after parentLi in the parent list
                parentList.insertBefore(block, parentLi.nextSibling);

                // Remove empty sub-list
                if (list.children.length === 0) {
                    list.remove();
                }
                setCursorTo(block);
            }
        } else {
            // Indent: move this LI into the previous sibling's sub-list
            const prevLi = block.previousElementSibling;
            if (!prevLi || prevLi.tagName !== 'LI') {
                // Can't indent the first item in a list
                return;
            }

            const parentList = block.parentNode; // UL or OL
            const listTag = parentList.tagName;   // 'UL' or 'OL'

            // Check if prevLi already has a child sub-list of the same type
            let subList = null;
            for (let i = prevLi.children.length - 1; i >= 0; i--) {
                if (prevLi.children[i].tagName === listTag) {
                    subList = prevLi.children[i];
                    break;
                }
            }

            if (!subList) {
                subList = document.createElement(listTag);
                // Copy task-list classes if applicable
                if (parentList.classList.contains('contains-task-list')) {
                    subList.classList.add('contains-task-list');
                }
                prevLi.appendChild(subList);
            }

            subList.appendChild(block);
            setCursorTo(block);
        }
        return;
    }

    // In table cells: move to the next cell on Tab, or previous cell on Shift+Tab
    if (block && (block.tagName === 'TD' || block.tagName === 'TH' || (block.closest && block.closest('td, th')))) {
        const cell = (block.tagName === 'TD' || block.tagName === 'TH') ? block : block.closest('td, th');
        if (cell) {
            const table = cell.closest('table');
            if (table) {
                const row = cell.closest('tr');
                if (row) {
                    const cells = Array.from(row.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                    const idx = cells.indexOf(cell);
                    let targetCell = null;
                    let createdRow = false;

                    if (e.shiftKey) {
                        // Move to previous cell; if at start, go to previous row end
                        if (idx > 0) {
                            targetCell = cells[idx - 1];
                        } else {
                            let prevRow = row.previousElementSibling;
                            if (!prevRow && row.parentElement && row.parentElement.tagName === 'TBODY') {
                                const thead = table.querySelector('thead');
                                if (thead) prevRow = thead.querySelector('tr:last-child');
                            }
                            if (prevRow) {
                                const prevCells = Array.from(prevRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                targetCell = prevCells[prevCells.length - 1];
                            }
                        }
                    } else {
                        // Move to next cell; if at end, go to next row first cell
                        if (idx < cells.length - 1) {
                            targetCell = cells[idx + 1];
                        } else {
                            let nextRow = row.nextElementSibling;
                            if (!nextRow && row.parentElement && row.parentElement.tagName === 'THEAD') {
                                let tbody = table.querySelector('tbody');
                                if (!tbody) {
                                    tbody = document.createElement('tbody');
                                    table.appendChild(tbody);
                                }
                                nextRow = tbody.firstElementChild;
                            }

                            if (!nextRow) {
                                const colCount = cells.length;
                                const newRow = createTableRow(colCount, 'td');
                                const parent = row.parentElement;
                                if (parent && parent.tagName === 'THEAD') {
                                    let tbody = table.querySelector('tbody');
                                    if (!tbody) {
                                        tbody = document.createElement('tbody');
                                        table.appendChild(tbody);
                                    }
                                    tbody.appendChild(newRow);
                                } else if (parent) {
                                    parent.appendChild(newRow);
                                } else {
                                    table.appendChild(newRow);
                                }
                                nextRow = newRow;
                                createdRow = true;
                            }

                            if (nextRow) {
                                const nextCells = Array.from(nextRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                if (nextCells.length > 0) targetCell = nextCells[0];
                            }
                        }
                    }

                    if (targetCell) {
                        const range = document.createRange();
                        range.selectNodeContents(targetCell);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);

                        if (createdRow) {
                            markModified();
                            saveEditorState();
                        }
                        return;
                    }
                }
            }
        }
    }


    // --- 空行でShift+Tabを押した場合は、リストの最上位まで一気に抜けてリスト全体の直後に移動 ---
    if (e.shiftKey && block && block.tagName === 'P' && block.childNodes.length === 1 && block.firstChild.nodeName === 'BR') {
        let parent = block.parentElement;
        // editor直下なら何もしない
        if (parent === editor) {
            block.style.marginLeft = '';
            block.style.paddingLeft = '';
            block.style.textIndent = '';
            return;
        }
        // 親がリストなら、最上位リストまで遡る
        let topList = null;
        let cur = parent;
        while (cur && (cur.tagName === 'UL' || cur.tagName === 'OL')) {
            topList = cur;
            cur = cur.parentElement;
        }
        if (topList && topList.parentElement) {
            // 最上位リストの直後に空行を移動
              topList.parentElement.insertBefore(block, topList.nextSibling);
              block.classList.add('no-indent');
              block.style.marginLeft = '';
              block.style.paddingLeft = '';
              block.style.textIndent = '';
              return;
        }
        // それ以外は従来通り1段階外へ
        const grandParent = parent.parentElement;
        if (grandParent) {
              grandParent.insertBefore(block, parent.nextSibling);
              block.classList.add('no-indent');
              block.style.marginLeft = '';
              block.style.paddingLeft = '';
              block.style.textIndent = '';
              return;
        }
    }

    // Default: insert 4 spaces
    document.execCommand('insertText', false, '    ');
}
