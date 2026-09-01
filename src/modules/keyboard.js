// =====================================================
// SuMark - キーボードイベント処理モジュール
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

// ========== メインキーボードハンドラ ==========
function handleKeyDown(e) {
    if (e.key === 'Enter') {
        const selection = window.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        const tableCell = getTableCellFromEvent(e, range);
        if (tableCell) {
            // IME確定時を含め、WebViewの既定Enter動作を表セルへ適用しない。
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!isComposing) {
                insertLineBreakInTableCell(tableCell, range);
            }
            return;
        }
    }

        // エンター押下時は即座に履歴を積む
        if (e.key === 'Enter' && !isComposing) {
            saveEditorState();
            inputCharCount = 0;
        }
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'a') {
        const selection = window.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        const cell = getTableCellFromEvent(e, range);
        if (cell) {
            e.preventDefault();
            const cellRange = document.createRange();
            cellRange.selectNodeContents(cell);
            selection.removeAllRanges();
            selection.addRange(cellRange);
            return;
        }
    }

    const selection = window.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    const tableCell = getTableCellFromEvent(e, range);
    const isHorizontalBoundaryNavigation = !e.shiftKey && tableCell &&
        ((e.key === 'ArrowLeft' && typeof isCaretAtCellStart === 'function' && isCaretAtCellStart(tableCell)) ||
        (e.key === 'ArrowRight' && typeof isCaretAtCellEnd === 'function' && isCaretAtCellEnd(tableCell)));
    const isTableNavigationKey = e.key === 'Tab' ||
        ['ArrowUp', 'ArrowDown'].includes(e.key) || isHorizontalBoundaryNavigation;

    if (!e.ctrlKey && !e.metaKey && !e.altKey && isTableNavigationKey &&
        typeof moveCurrentTableCell === 'function' && moveCurrentTableCell(e.key === 'Tab' && e.shiftKey ? 'Shift+Tab' : e.key)) {
        e.preventDefault();
        return;
    }

    const hasRectTableSelection =
        typeof isRectTableSelectionActive === 'function' &&
        isRectTableSelectionActive();

    if (hasRectTableSelection && e.key === 'Escape' && typeof enterTableSelectionMode === 'function') {
        e.preventDefault();
        enterTableSelectionMode();
        return;
    }

    if (hasRectTableSelection && typeof moveTableSelection === 'function') {
        const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
        if (e.key === 'Tab' || isArrowKey) {
            const navigationKey = e.key === 'Tab' && e.shiftKey ? 'Shift+Tab' : e.key;
            if (moveTableSelection(navigationKey, false)) return;
        }
    }

    // 矩形選択中のCopyは、Windows WebView2でcopyイベントがeditorへ届かない場合にも
    // TSVを出力できるようClipboard APIへ補助的に直接書き込む。
    if (hasRectTableSelection && mod && e.key.toLowerCase() === 'c') {
        if (typeof copyRectSelectionWithClipboardApi === 'function') {
            copyRectSelectionWithClipboardApi();
        }
        return;
    }

    // 矩形選択中のCut/PasteはtableManager側の専用フローへ委譲する。
    if (hasRectTableSelection && mod && (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'v')) {
        return;
    }
    
    // Cmd/Ctrl+Z: 元に戻す
    if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
    }
    
    // Cmd/Ctrl+Shift+Z: やり直し
    if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
        return;
    }
    
    // Cmd/Ctrl+Y: やり直し（代替ショートカット）
    if (mod && e.key === 'y') {
        e.preventDefault();
        performRedo();
        return;
    }

    // Cmd/Ctrl+P: PDFエクスポート
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

    // Cmd/Ctrl+Enter: テーブル列選択の一括入力
    if (mod && e.key === 'Enter') {
        if (hasRectTableSelection) {
            return;
        }
        if (typeof colSelectedCells !== 'undefined' && colSelectedCells.length >= 2 &&
            typeof colAnchorCell !== 'undefined' && colAnchorCell) {
            e.preventDefault();
            const content = colAnchorCell.innerHTML;
            colSelectedCells.forEach(cell => {
                if (cell !== colAnchorCell) {
                    cell.innerHTML = content;
                }
            });
            onEditorInput();
            markModified();
            if (typeof clearColSelection === 'function') clearColSelection();
            return;
        }
    }

    // Backspace/Delete: 非編集要素（TOC, Mermaid など）を処理
    if (e.key === 'Backspace' || e.key === 'Delete') {
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);

            // ケース1: 選択範囲が非編集要素をまたぐ
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

            // ケース2: カーソルが非編集要素の境界にある
            if (range.collapsed) {
                const node = range.startContainer;
                const offset = range.startOffset;
                let target = null;

                if (e.key === 'Backspace') {
                    // 前兄弟または直前ノードを確認
                    if (node.nodeType === 1 && offset > 0) {
                        const prev = node.childNodes[offset - 1];
                        if (prev && prev.nodeType === 1 && prev.getAttribute('contenteditable') === 'false') {
                            target = prev;
                        }
                    } else if (node.nodeType === 3 && offset === 0) {
                        // テキストノード先頭では親ブロックの前兄弟を確認
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

        // リスト末尾の空項目でBackspaceした場合はリストを抜けて空段落へ移る
        if (e.key === 'Backspace' && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            if (range.collapsed) {
                const block = getParentBlock(range.startContainer);
                if (block && block.tagName === 'LI') {
                    // 可視テキストがない場合のみ「空」と判定（<br>は無視）
                    const text = block.textContent.replace(/\u200B/g, '').trim();
                    const isEmpty = text === '';

                    // カーソルがLI先頭にあることを確認
                    const testRange = document.createRange();
                    testRange.selectNodeContents(block);
                    testRange.setEnd(range.startContainer, range.startOffset);
                    const isAtStart = testRange.toString().length === 0;

                    if (isEmpty && isAtStart) {
                        const list = block.parentNode;
                        if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
                            // 最後のリスト項目のときのみ発火
                            if (!block.nextElementSibling) {
                                e.preventDefault();

                                const listParent = list.parentNode;
                                const nextSibling = list.nextSibling;

                                // 空のリスト項目を削除
                                block.remove();

                                // リストが空になったらリスト自体を削除
                                if (list.children.length === 0) {
                                    list.remove();
                                }

                                // リスト直後（または元の位置）に空段落を挿入
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

    // Enterキー: 特殊処理
    if (e.key === 'Enter') {
        handleEnterKey(e);
        return;
    }

    // Tabキー処理
    if (e.key === 'Tab') {
        handleTabKey(e);
        return;
    }

    // テーブルセル内の矢印キー: 境界条件でセル移動
    // （Up/Downは可能なら常に移動、Left/Rightは端にいる場合のみ移動）
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
                            // 上のセルへ移動（同一列）
                            const rows = Array.from(table.querySelectorAll('tr'));
                            const rowIndex = rows.indexOf(row);
                            if (rowIndex > 0) {
                                const prevRow = rows[rowIndex - 1];
                                const prevCells = Array.from(prevRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                const target = prevCells[Math.min(idx, prevCells.length - 1)];
                                moved = moveToCell(target);
                            }
                        } else if (e.key === 'ArrowDown') {
                            // 下のセルへ移動（同一列）
                            const rows = Array.from(table.querySelectorAll('tr'));
                            const rowIndex = rows.indexOf(row);
                            if (rowIndex < rows.length - 1) {
                                const nextRow = rows[rowIndex + 1];
                                const nextCells = Array.from(nextRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
                                const target = nextCells[Math.min(idx, nextCells.length - 1)];
                                moved = moveToCell(target);
                            }
                        } else if (e.key === 'ArrowLeft' && atStart) {
                            // 前セルへ移動（なければ前行末尾）
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
                            // 次セルへ移動（なければ次行先頭）
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

    // Ctrl/Cmd+; → 日付、Ctrl/Cmd+Shift+; (Ctrl/Cmd+:) → 時刻
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

    // Cmd/Ctrl+W → タブを閉じる
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

    // Cmd/Ctrl+Tab: 次のタブへ / Cmd/Ctrl+Shift+Tab: 前のタブへ
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

    // 修飾キーショートカット（MacはCmd、WindowsはCtrl）
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
            // Cmd+Z / Cmd+Shift+Z（undo/redo）は上で処理済み
        }
    }
}

function getNodeTableCell(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    if (node.tagName === 'TD' || node.tagName === 'TH') return node;
    return node.closest ? node.closest('td, th') : null;
}

function getTableCellFromRange(range) {
    if (!range) return null;
    const start = range.startContainer;

    if (start.nodeType === Node.TEXT_NODE) {
        return start.parentElement ? getNodeTableCell(start.parentElement) : null;
    }

    let cell = getNodeTableCell(start);
    if (cell) return cell;

    // startContainer が tr/tbody/table 等の場合は offset 先の要素から推定
    const children = start.childNodes || [];
    if (children.length > 0) {
        let idx = range.startOffset;
        if (idx >= children.length) idx = children.length - 1;
        if (idx < 0) idx = 0;
        const candidate = children[idx] || children[idx - 1] || null;
        if (candidate) {
            cell = getNodeTableCell(candidate);
            if (cell) return cell;
            if (candidate.querySelector) {
                const nested = candidate.querySelector('td, th');
                if (nested) return nested;
            }
        }
    }

    return null;
}

function getTableCellFromEvent(e, range) {
    const target = e && e.target;
    if (target) {
        const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
        const targetCell = element && element.closest ? element.closest('td, th') : null;
        if (targetCell) return targetCell;
    }
    const rangeCell = getTableCellFromRange(range);
    if (rangeCell) return rangeCell;
    // 表外の有効なRangeがある場合は、直近セルへフォールバックしない。
    if (range) return null;
    return typeof getLastActiveTableCell === 'function' ? getLastActiveTableCell() : null;
}

/**
 * テーブルセル内へ改行（<br>）を安全に挿入する。
 * execCommand('insertLineBreak') はブラウザエンジンによって、
 * セル境界付近で新規セル/行を生成してしまう（表構造が壊れる）ことがあるため、
 * Range API による直接DOM操作のみで完結させる。
 * @param {HTMLTableCellElement} cell
 * @param {Range} currentRange - 呼び出し時点の選択範囲（セル外の場合はセル末尾へ寄せる）
 */
function insertLineBreakInTableCell(cell, currentRange) {
    const sel = window.getSelection();
    let range = currentRange;

    // 渡されたレンジがセル外（セル選択状態など）なら、セル末尾に寄せる
    if (!range || !cell.contains(range.startContainer) || !cell.contains(range.endContainer)) {
        range = document.createRange();
        range.selectNodeContents(cell);
        range.collapse(false);
    } else {
        range = range.cloneRange();
    }

    // 選択範囲があれば先に削除（execCommand同様の挙動に合わせる）
    if (!range.collapsed) {
        range.deleteContents();
    }

    const br = document.createElement('br');
    range.insertNode(br);

    // キャレットを br の直後へ移動
    const newRange = document.createRange();
    newRange.setStartAfter(br);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    markModified();
}

function handleBeforeInput(e) {
    if (!e || !e.inputType) return;
    if (e.inputType !== 'insertParagraph' && e.inputType !== 'insertLineBreak') return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const activeTableCell = getTableCellFromEvent(e, range);
    if (!activeTableCell) return;

    // keydown 側で取りこぼした場合の最終フォールバック。
    e.preventDefault();
    e.stopImmediatePropagation();
    insertLineBreakInTableCell(activeTableCell, range);
}

// ========== Enter Key Handling ==========
function handleEnterKey(e) {
    // IME変換中（日本語入力など）はEnter処理をスキップ
        // IME変換中（日本語入力など）はEnter処理をスキップ
    if (isComposing) {
        return; // IME既定動作に任せる
    }
    
    // Shift+Enter: ソフト改行を挿入（Markdown向けに半角スペース2つ + 改行）
    if (e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        const range = sel.getRangeAt(0);
        
        // 半角スペース2つを挿入
        // Markdownレンダリング時に <br> へ変換
        const textNode = document.createTextNode('  ');
        range.insertNode(textNode);
        
        // カーソルをスペースの後ろへ移動
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // 改行を挿入
        document.execCommand('insertLineBreak');
        
        markModified();
        saveEditorState();
        return;
    }
    
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    // テーブルセル内 Enter は最優先で処理する。
    // セル選択状態（startContainer が tr/tbody など）でも対象セルを推定し、
    // ブラウザ既定動作による div/p 混入を防止する。
    const activeTableCell = getTableCellFromEvent(e, range);
    if (activeTableCell) {
        e.preventDefault();
        insertLineBreakInTableCell(activeTableCell, range);
        return;
    }

    // ---- Details/Summary: handle BEFORE getParentBlock (summary is not a block tag) ----
    let detailsAncestor = range.startContainer;
    while (detailsAncestor && detailsAncestor !== editor) {
        if (detailsAncestor.nodeType === 1 && detailsAncestor.tagName === 'DETAILS') break;
        detailsAncestor = detailsAncestor.parentNode;
    }
    if (detailsAncestor && detailsAncestor.tagName === 'DETAILS' && detailsAncestor !== editor) {
        const detailsEl = detailsAncestor;
        const summaryEl = detailsEl.querySelector(':scope > summary');

        // ケース1: カーソルがsummary内 → toggle-contentへ移動
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

        // ケース2: カーソルがtoggle-content内
        const toggleContent = detailsEl.querySelector(':scope > .toggle-content');
        if (toggleContent && toggleContent.contains(range.startContainer)) {
            const currentBlock = getParentBlock(range.startContainer);

            // toggle内リストでは、先頭項目の先頭位置かを確認
            // リスト前への要素挿入を可能にする
            if (currentBlock && (currentBlock.tagName === 'LI')) {
                const parentList = currentBlock.closest('ul, ol');
                if (parentList && toggleContent.firstElementChild === parentList) {
                    // 先頭LIかつカーソルが最先頭かを確認
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
                // 通常のリストEnter処理へフォールスルー
            } else if (currentBlock && (currentBlock.tagName === 'TD' || currentBlock.tagName === 'TH')) {
                // 通常のテーブルEnter処理へフォールスルー
            } else {
                // 先頭要素の先頭位置にカーソルがあるか確認
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

                // 末尾の空行ならトグルを抜ける
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

                // toggle-content内の通常Enter: 位置で分割して新段落を作成
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

                    // 現在ブロックが空なら整形
                    if (!currentBlock.textContent.trim() && !currentBlock.querySelector('br')) {
                        currentBlock.innerHTML = '<br>';
                    }

                    // toggle-content内で現在ブロック直後に新段落を挿入
                    if (currentBlock.nextSibling) {
                        toggleContent.insertBefore(newP, currentBlock.nextSibling);
                    } else {
                        toggleContent.appendChild(newP);
                    }
                    setCursorTo(newP);
                    return;
                } else {
                    // ブロックが見つからない（toggle-content直下テキスト）
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

    // テーブルセル内の Enter は環境差が大きく、既定動作だとセル内に div/p が混入して
    // 保存・再読込時に表構造が崩れることがあるため、常に <br> 挿入へ統一する。
    // （通常はこの手前の early-return で処理済みだが、フォールバックとして維持）
    if (tag === 'TD' || tag === 'TH' || (block.closest && block.closest('td, th'))) {
        e.preventDefault();
        const cellForBreak = (tag === 'TD' || tag === 'TH') ? block : block.closest('td, th');
        insertLineBreakInTableCell(cellForBreak, range);
        return;
    }

    // 見出し内では次の見出しを作らず段落を作る
    if (/^H[1-6]$/.test(tag)) {
        e.preventDefault();

        // 見出しが空なら段落へ変換
        const headingText = block.textContent.trim();
        if (headingText === '') {
            // 空見出しを段落へ変換
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            block.parentNode.insertBefore(p, block);
            block.remove();
            setCursorTo(p);
            return;
        }

        // カーソルが見出し先頭にあるか確認
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
            // 見出しの前に空段落を挿入（見出しを下へ押し下げる）
            block.parentNode.insertBefore(p, block);
            // カーソルは見出し内に維持
            setCursorTo(block);
        } else {
            // 見出しの後ろに段落を挿入
            block.parentNode.insertBefore(p, block.nextSibling);
            setCursorTo(p);
        }
        return;
    }

    // コードブロック（<pre> または <pre> 内 <code>）では改行を挿入
    // 末尾の空行にいる場合はコードブロックを抜ける
    if (tag === 'PRE' || (tag === 'CODE' && block.parentNode && block.parentNode.tagName === 'PRE')) {
        const preEl = tag === 'PRE' ? block : block.parentNode;
        const codeEl = tag === 'CODE' ? block : block.querySelector('code');
        const targetEl = codeEl || preEl;

        e.preventDefault();
        if (codeEl) {
            const caretOffset = getCaretCharacterOffsetWithin(codeEl);
            const currentText = codeEl.textContent;
            codeEl.textContent = currentText.slice(0, caretOffset) + '\n' + currentText.slice(caretOffset);
            setCaretCharacterOffset(codeEl, caretOffset + 1);
        } else if (targetEl) {
            document.execCommand('insertText', false, '\n');
        }

        if (preEl) updateLineNumbers(preEl);
        markModified();
        return;
    }

    // リスト項目内: 空項目ならEnterごとに1段アウトデントし、最後はリスト外へ
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

        // タスクリスト: Enterでチェックボックス付き新規項目を作成
        if (hasCheckbox) {
            e.preventDefault();

            // カーソル位置でテキストを分割
            const sel2 = window.getSelection();
            const r = sel2.getRangeAt(0);

            // カーソル以降の内容を取得
            const afterRange = document.createRange();
            afterRange.setStart(r.startContainer, r.startOffset);
            afterRange.setEndAfter(block.lastChild);
            const afterFrag = afterRange.extractContents();

            // 抽出したDOM構造（例: コードツールバー + pre）はそのまま保持する。
            // textContent平坦化するとUIラベルが本文へ混入する
            const hasAfterContent = Array.from(afterFrag.childNodes).some(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent.trim() !== '';
                }
                return true;
            });

            // チェックボックス付き新規LIを作成
            const newLi = document.createElement('li');
            newLi.className = 'task-list-item';
            const newCb = document.createElement('input');
            newCb.type = 'checkbox';
            newCb.checked = false;
            newLi.appendChild(newCb);

            // キャレット配置を安定させるため、チェックボックス後の空白を保持
            const spacer = document.createTextNode(' ');
            newLi.appendChild(spacer);

            if (hasAfterContent) {
                const firstNode = afterFrag.firstChild;
                if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
                    firstNode.textContent = firstNode.textContent.replace(/^\s+/, '');
                }
                newLi.appendChild(afterFrag);
            }

            // 現在LIの直後へ挿入
            const parentList = block.parentNode;
            if (block.nextSibling) {
                parentList.insertBefore(newLi, block.nextSibling);
            } else {
                parentList.appendChild(newLi);
            }

            // 新規項目のチェックボックス後ろへカーソル移動
            const textNode = spacer;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                const newRange = document.createRange();
                newRange.setStart(textNode, 1);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                // エディタフォーカスを保証
                editor.focus();
            } else {
                // フォールバック: テキストノードが無ければ setCursorTo を使う
                setCursorTo(newLi);
            }
            
            return;
        }

        // それ以外は既定のリスト挙動に任せる
        // ただし toggle-content 内ではブラウザ既定動作が不安定なため独自処理
        const listInToggle = block.closest('.toggle-content');
        if (listInToggle) {
            e.preventDefault();
            const sel3 = window.getSelection();
            const r3 = sel3.getRangeAt(0);

            // カーソル以降の内容を抽出
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

            // 現在LIが空なら整形
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

    // 引用内: Enterで引用を抜ける（Shift+Enterは上で処理）
    if (tag === 'BLOCKQUOTE' || (block.parentNode && block.parentNode.tagName === 'BLOCKQUOTE')) {
        e.preventDefault();
        const bqBlock = tag === 'BLOCKQUOTE' ? block : block.parentNode;

        // 引用を抜けるため、blockquote直後に新しい <p> を挿入
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        bqBlock.parentNode.insertBefore(p, bqBlock.nextSibling);
        setCursorTo(p);
        return;
    }

    // コードブロック開始トリガー: ``` の直後にEnter
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
            // 言語指定があれば初期ハイライトを適用
            if (lang && typeof hljs !== 'undefined') {
                highlightCodeBlock(code);
            }
            // 行番号を追加
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

    // コードブロック内では実タブ相当（半角4スペース）を挿入
    if (block && (block.tagName === 'PRE' || block.tagName === 'CODE' ||
        (block.parentNode && block.parentNode.tagName === 'PRE'))) {
        document.execCommand('insertText', false, '    ');
        return;
    }

    // リスト内はDOM操作でインデント/アウトデント
    // (execCommand('indent') creates malformed HTML: <ul> directly inside <ul> without <li> wrapper)
    if (block && block.tagName === 'LI') {
        if (e.shiftKey) {
            // アウトデント: 現在LIをサブリストから親リストへ移動
            const list = block.parentNode;
            const parentLi = list ? list.closest('li') : null;
            const parentList = parentLi ? parentLi.parentNode : null;

            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
                // サブリストに残る兄弟要素を、このLI配下の新サブリストへ移す
                const remainingSiblings = [];
                let sib = block.nextElementSibling;
                while (sib) {
                    remainingSiblings.push(sib);
                    sib = sib.nextElementSibling;
                }
                if (remainingSiblings.length > 0) {
                    const newSubList = document.createElement(list.tagName);
                    // 必要に応じてタスクリスト用クラスを引き継ぐ
                    if (list.classList.contains('contains-task-list')) {
                        newSubList.classList.add('contains-task-list');
                    }
                    remainingSiblings.forEach(s => newSubList.appendChild(s));
                    block.appendChild(newSubList);
                }

                // 親リストで parentLi の直後にこのLIを挿入
                parentList.insertBefore(block, parentLi.nextSibling);

                // 空になったサブリストを削除
                if (list.children.length === 0) {
                    list.remove();
                }
                setCursorTo(block);
            }
        } else {
            // インデント: このLIを直前兄弟のサブリストへ移動
            const prevLi = block.previousElementSibling;
            if (!prevLi || prevLi.tagName !== 'LI') {
                // 先頭項目はインデント不可
                return;
            }

            const parentList = block.parentNode; // UL or OL
            const listTag = parentList.tagName;   // 'UL' or 'OL'

            // prevLi が同種の子サブリストを持つか確認
            let subList = null;
            for (let i = prevLi.children.length - 1; i >= 0; i--) {
                if (prevLi.children[i].tagName === listTag) {
                    subList = prevLi.children[i];
                    break;
                }
            }

            if (!subList) {
                subList = document.createElement(listTag);
                // 必要に応じてタスクリスト用クラスを引き継ぐ
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

    // テーブルセル内: Tabで次セル、Shift+Tabで前セルへ移動
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
                        // 前セルへ移動。先頭セルなら前行末尾へ移動
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
                        // 次セルへ移動。末尾セルなら次行先頭へ移動
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
                                const newRow = createTableRow(table, colCount, 'td');
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

    // 既定動作: 半角4スペースを挿入
    document.execCommand('insertText', false, '    ');
}
