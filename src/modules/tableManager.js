/**
 * SuMark テーブル管理モジュール (tableManager.js)
 *
 * テーブルの挿入、コンテキストメニュー、行列操作、CSV変換を担当
 * グローバルスコープで動作（ESM未対応）
 * main.js より前に読み込むこと
 * 依存: main.js (editor, getParentBlock, onEditorInput, saveEditorState, markModified, showModal, showWarn)
 *       toggleBlock.js (ensureToggleContentEditable)
 */

// ========== テーブルコンテキストメニュー状態 ==========
let tableContextMenu = null;
let activeTableCell = null;
let lastActiveTableCell = null;
let rowDragObserver = null;

// ========== 列選択状態 ==========
let colAnchorCell = null;    // 最初にクリックしたセル（アンカー）
let colSelectedCells = [];   // 選択中のセル配列（アンカー含む）

// ========== 矩形選択状態（コピー/ペースト専用） ==========
const rectSelection = {
    active: false,
    dragging: false,
    moved: false,
    suppressNextClickClear: false,
    mode: 'edit',
    startX: 0,
    startY: 0,
    table: null,
    anchorCell: null,
    focusCell: null,
    startRow: -1,
    startCol: -1,
    endRow: -1,
    endCol: -1,
    cells: [],
};

// ========== 行ドラッグ状態 ==========
const ROW_DRAG_HANDLE_WIDTH_MOUSE = 34;
const ROW_DRAG_HANDLE_WIDTH_TOUCH = 44;
const rowDragState = {
    dragging: false,
    table: null,
    sourceRow: null,
    sourceIndex: -1,
    dropTargetRow: null,
    dropPosition: null,
};

/**
 * テーブルセル内かどうかを判定する
 * @param {Node} node - 判定対象ノード
 * @returns {boolean}
 */
function isInsideTableCell(node) {
    let current = node;
    while (current && current !== editor) {
        if (current.tagName === 'TD' || current.tagName === 'TH') {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

/**
 * テーブルを挿入する（3列×2行 + ヘッダー）
 */
function insertTable() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const block = getParentBlock(range.startContainer);
    const containerEl = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const cell = containerEl ? containerEl.closest('td, th') : null;

    // テーブルの入れ子を防止（セル内には挿入しない）
    if (cell) {
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['列1', '列2', '列3'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 0; i < 2; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < 3; j++) {
            const td = document.createElement('td');
            td.textContent = 'データ';
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const afterP = document.createElement('p');
    afterP.innerHTML = '<br>';

    // 挿入位置を決定（toggle-content 内かどうか確認）
    const toggleContent = block ? block.closest('.toggle-content') : null;
    if (toggleContent) {
        // toggle-content 内へ挿入
        if (block && block.parentNode === toggleContent) {
            if (block.textContent.trim() === '' && block.tagName === 'P') {
                toggleContent.replaceChild(table, block);
            } else {
                toggleContent.insertBefore(table, block.nextSibling);
            }
        } else {
            toggleContent.appendChild(table);
        }
        toggleContent.insertBefore(afterP, table.nextSibling);
        ensureToggleContentEditable(toggleContent);
    } else if (block && block !== editor && block.parentNode) {
        block.parentNode.insertBefore(table, block.nextSibling);
        block.parentNode.insertBefore(afterP, table.nextSibling);
    } else {
        editor.appendChild(table);
        editor.appendChild(afterP);
    }
    // 先頭ヘッダーセルへカーソルを配置
    const firstTh = table.querySelector('th');
    if (firstTh) {
        const r = document.createRange();
        r.selectNodeContents(firstTh);
        sel.removeAllRanges();
        sel.addRange(r);
    }
    onEditorInput();
    saveEditorState();
    refreshTableRowDragSupport();
}

// ========== 列選択ヘルパー関数 ==========

/**
 * セルの列インデックスを取得
 * @param {HTMLTableCellElement} cell
 * @returns {number}
 */
function getCellColIndex(cell) {
    const row = cell.closest('tr');
    if (!row) return -1;
    return Array.from(row.children).indexOf(cell);
}

/**
 * テーブル内でのセルの行インデックスを取得
 * @param {HTMLTableCellElement} cell
 * @param {HTMLTableElement} table
 * @returns {number}
 */
function getCellRowIndex(cell, table) {
    const allRows = Array.from(table.querySelectorAll('tr'));
    return allRows.indexOf(cell.closest('tr'));
}

/**
 * 同一列の行範囲内のセルを取得（両端を含む）
 * @param {HTMLTableElement} table
 * @param {number} colIndex
 * @param {number} rowIndexA
 * @param {number} rowIndexB
 * @returns {HTMLTableCellElement[]}
 */
function getCellsBetween(table, colIndex, rowIndexA, rowIndexB) {
    const allRows = Array.from(table.querySelectorAll('tr'));
    const min = Math.min(rowIndexA, rowIndexB);
    const max = Math.max(rowIndexA, rowIndexB);
    const cells = [];
    for (let i = min; i <= max; i++) {
        if (allRows[i] && allRows[i].children[colIndex]) {
            cells.push(allRows[i].children[colIndex]);
        }
    }
    return cells;
}

/**
 * 列選択状態をクリア
 */
function clearColSelection() {
    colSelectedCells.forEach(c => {
        c.classList.remove('col-selected');
        c.classList.remove('col-anchor');
    });
    if (colAnchorCell) colAnchorCell.classList.remove('col-anchor');
    colSelectedCells = [];
    colAnchorCell = null;
}

function normalizeClipboardText(text) {
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function getTableRows(table) {
    return table ? Array.from(table.querySelectorAll('tr')) : [];
}

function getCellPositionInTable(table, cell) {
    if (!table || !cell) return null;
    const rowEl = cell.closest('tr');
    if (!rowEl) return null;
    const rows = getTableRows(table);
    const row = rows.indexOf(rowEl);
    const col = Array.from(rowEl.children).indexOf(cell);
    if (row < 0 || col < 0) return null;
    return { row, col };
}

function clearRectCellClasses() {
    rectSelection.cells.forEach(cell => {
        cell.classList.remove('rect-selected');
        cell.classList.remove('rect-anchor');
    });
    if (rectSelection.anchorCell) rectSelection.anchorCell.classList.remove('rect-anchor');
}

function clearRectSelection() {
    clearRectCellClasses();
    document.body.classList.remove('table-rect-selecting');
    rectSelection.active = false;
    rectSelection.dragging = false;
    rectSelection.moved = false;
    rectSelection.suppressNextClickClear = false;
    rectSelection.mode = 'edit';
    rectSelection.startX = 0;
    rectSelection.startY = 0;
    rectSelection.table = null;
    rectSelection.anchorCell = null;
    rectSelection.focusCell = null;
    rectSelection.startRow = -1;
    rectSelection.startCol = -1;
    rectSelection.endRow = -1;
    rectSelection.endCol = -1;
    rectSelection.cells = [];
}

function collectRectCells(table, startRow, endRow, startCol, endCol) {
    const rows = getTableRows(table);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const cells = [];

    for (let r = minRow; r <= maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = minCol; c <= maxCol; c++) {
            const cell = row.children[c];
            if (cell) cells.push(cell);
        }
    }
    return cells;
}

function updateRectSelection(table, anchorCell, focusCell) {
    if (!table || !anchorCell || !focusCell) return;
    const anchorPos = getCellPositionInTable(table, anchorCell);
    const focusPos = getCellPositionInTable(table, focusCell);
    if (!anchorPos || !focusPos) return;

    clearRectCellClasses();

    rectSelection.table = table;
    rectSelection.anchorCell = anchorCell;
    rectSelection.focusCell = focusCell;
    rectSelection.startRow = anchorPos.row;
    rectSelection.startCol = anchorPos.col;
    rectSelection.endRow = focusPos.row;
    rectSelection.endCol = focusPos.col;
    rectSelection.cells = collectRectCells(
        table,
        rectSelection.startRow,
        rectSelection.endRow,
        rectSelection.startCol,
        rectSelection.endCol
    );
    rectSelection.active = rectSelection.cells.length > 0;
    if (rectSelection.moved || anchorCell !== focusCell) {
        rectSelection.mode = 'select';
    }

    rectSelection.cells.forEach(cell => {
        if (cell === anchorCell) {
            cell.classList.add('rect-anchor');
        } else {
            cell.classList.add('rect-selected');
        }
    });
}

function startRectSelection(cell, e) {
    const table = cell.closest('table');
    if (!table) return;

    clearColSelection();
    clearRectSelection();
    // mousedown直後からブラウザの文字選択を止める（6px未満の間も含む）。
    window.getSelection().removeAllRanges();
    document.body.classList.add('table-rect-selecting');
    rectSelection.dragging = true;
    rectSelection.moved = false;
    rectSelection.suppressNextClickClear = false;
    rectSelection.startX = e.clientX;
    rectSelection.startY = e.clientY;
    updateRectSelection(table, cell, cell);
}

function getRectBounds() {
    if (!rectSelection.active || !rectSelection.table) return null;
    return {
        minRow: Math.min(rectSelection.startRow, rectSelection.endRow),
        maxRow: Math.max(rectSelection.startRow, rectSelection.endRow),
        minCol: Math.min(rectSelection.startCol, rectSelection.endCol),
        maxCol: Math.max(rectSelection.startCol, rectSelection.endCol),
    };
}

function isRectTableSelectionActive() {
    return !!(rectSelection.active && rectSelection.table && rectSelection.cells.length > 0);
}

function getLastActiveTableCell() {
    return lastActiveTableCell && editor && editor.contains(lastActiveTableCell)
        ? lastActiveTableCell
        : null;
}

function enterTableSelectionMode() {
    if (!isRectTableSelectionActive()) return false;
    rectSelection.mode = 'select';
    clearRectCellClasses();
    rectSelection.cells.forEach(cell => {
        cell.classList.add(cell === rectSelection.anchorCell ? 'rect-anchor' : 'rect-selected');
    });
    const selection = window.getSelection();
    selection.removeAllRanges();
    return true;
}

function getAdjacentTableCell(cell, key) {
    const table = cell ? cell.closest('table') : null;
    const position = getCellPositionInTable(table, cell);
    if (!table || !position) return null;
    const rows = getTableRows(table);
    let row = position.row;
    let col = position.col;

    if (key === 'ArrowUp') row -= 1;
    if (key === 'ArrowDown') row += 1;
    if (key === 'ArrowLeft') col -= 1;
    if (key === 'ArrowRight' || key === 'Tab') col += 1;
    if (key === 'Shift+Tab') col -= 1;
    if (key === 'Tab' && (!rows[row] || col >= rows[row].children.length)) {
        row += 1;
        col = 0;
    }
    if (key === 'Shift+Tab' && col < 0) {
        row -= 1;
        col = rows[row] ? rows[row].children.length - 1 : -1;
    }
    return rows[row] && rows[row].children[col] ? rows[row].children[col] : null;
}

function moveTableSelection(key, selectMode) {
    if (!isRectTableSelectionActive() || !rectSelection.focusCell) return false;
    if (selectMode && rectSelection.mode !== 'select') return false;
    const target = getAdjacentTableCell(rectSelection.focusCell, key);
    if (!target) return false;
    clearRectCellClasses();
    rectSelection.anchorCell = target;
    rectSelection.focusCell = target;
    rectSelection.startRow = getCellPositionInTable(rectSelection.table, target).row;
    rectSelection.startCol = getCellPositionInTable(rectSelection.table, target).col;
    rectSelection.endRow = rectSelection.startRow;
    rectSelection.endCol = rectSelection.startCol;
    rectSelection.cells = [target];
    rectSelection.mode = selectMode ? 'select' : 'edit';
    target.classList.add('rect-anchor');
    if (!selectMode) {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        window.getSelection().removeAllRanges();
    }
    return true;
}

function moveCurrentTableCell(key) {
    // 通常のセル移動では、互換用に残っている列選択表示を解除する。
    clearColSelection();
    let cell = rectSelection.active ? rectSelection.focusCell : null;
    if (!cell) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return false;
        const container = selection.getRangeAt(0).startContainer;
        const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
        cell = element && element.closest ? element.closest('td, th') : null;
    }
    if (!cell) return false;

    if (!rectSelection.active) {
        const table = cell.closest('table');
        updateRectSelection(table, cell, cell);
    }
    return moveTableSelection(key, false);
}

function getCellPlainText(cell) {
    if (!cell) return '';
    return normalizeClipboardText(cell.innerText || cell.textContent || '').replace(/\u00A0/g, ' ').trimEnd();
}

function getRectSelectionMatrix() {
    if (!isRectTableSelectionActive()) return null;
    const bounds = getRectBounds();
    if (!bounds) return null;
    const rows = getTableRows(rectSelection.table);
    const matrix = [];

    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const line = [];
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
            line.push(getCellPlainText(row.children[c]));
        }
        matrix.push(line);
    }
    return matrix;
}

function matrixToTsv(matrix) {
    if (!matrix || matrix.length === 0) return '';
    return matrix.map(line => line.join('\t')).join('\n');
}

function matrixToHtmlTable(matrix) {
    if (!matrix || matrix.length === 0) return '';
    const esc = (typeof escapeHtml === 'function')
        ? escapeHtml
        : (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    let html = '<table><tbody>';
    matrix.forEach(line => {
        html += '<tr>';
        line.forEach(value => {
            html += '<td>' + esc(value).replace(/\n/g, '<br>') + '</td>';
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}

function getRectSelectionClipboardData() {
    const matrix = getRectSelectionMatrix();
    if (!matrix || matrix.length === 0) return null;
    return {
        matrix,
        tsv: matrixToTsv(matrix),
        html: matrixToHtmlTable(matrix),
    };
}

function copyRectSelectionWithClipboardApi() {
    const data = getRectSelectionClipboardData();
    if (!data || !navigator.clipboard || !navigator.clipboard.writeText) return;

    // Windows WebView2では、ネイティブ選択Rangeを持たない矩形選択でcopyイベントが
    // editorへ届かないことがあるため、ユーザーのCtrl/Cmd+C操作中に直接書き込む。
    navigator.clipboard.writeText(data.tsv).catch(() => {
        // Clipboard APIが拒否された場合は、documentのcopyイベント経路へ委譲する。
    });
}

function handleRectSelectionCopyCut(e) {
    if (!isRectTableSelectionActive()) return;
    if (e.__sumarkRectClipboardHandled) return;
    e.__sumarkRectClipboardHandled = true;
    const data = getRectSelectionClipboardData();
    if (!data) return;

    e.preventDefault();
    if (e.clipboardData) {
        e.clipboardData.setData('text/plain', data.tsv);
        e.clipboardData.setData('text/html', data.html);
    }

    if (e.type === 'cut') {
        const bounds = getRectBounds();
        const rows = getTableRows(rectSelection.table);
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const row = rows[r];
            if (!row) continue;
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const cell = row.children[c];
                if (!cell) continue;
                cell.innerHTML = '&nbsp;';
            }
        }
        markModified();
        onEditorInput();
    }
}

function parseTsvToMatrix(text) {
    const normalized = normalizeClipboardText(text);
    if (!normalized) return [];
    const lines = normalized.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.map(line => line.split('\t'));
}

function parseHtmlTableToMatrix(html) {
    if (!html || !/<table[\s>]/i.test(html)) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return [];
    const rows = Array.from(table.querySelectorAll('tr'));
    return rows.map(row => Array.from(row.querySelectorAll('th,td')).map(cell => normalizeClipboardText(cell.innerText || cell.textContent || '')));
}

function setCellTextWithBreaks(cell, text) {
    const normalized = normalizeClipboardText(text);
    if (!normalized) {
        cell.innerHTML = '&nbsp;';
        return;
    }
    const parts = normalized.split('\n');
    cell.innerHTML = '';
    parts.forEach((part, idx) => {
        if (idx > 0) cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode(part));
    });
}

function applyMatrixToRectSelection(matrix) {
    if (!isRectTableSelectionActive() || !matrix || matrix.length === 0) return false;
    const bounds = getRectBounds();
    const table = rectSelection.table;
    const rows = getTableRows(table);
    const startRow = bounds.minRow;
    const startCol = bounds.minCol;

    const requiredColumnCount = startCol + Math.max(...matrix.map(row => row.length));
    const currentColumnCount = rows.reduce((count, row) => Math.max(count, row.children.length), 0);
    if (requiredColumnCount > currentColumnCount) {
        rows.forEach(row => {
            const tag = row.parentNode && row.parentNode.tagName === 'THEAD' ? 'th' : 'td';
            for (let col = row.children.length; col < requiredColumnCount; col++) {
                const cell = document.createElement(tag);
                cell.innerHTML = '&nbsp;';
                row.appendChild(cell);
            }
        });
    }

    const updatedRows = getTableRows(table);
    const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    while (updatedRows.length < startRow + matrix.length) {
        tbody.appendChild(createTableRow(table, Math.max(requiredColumnCount, currentColumnCount), 'td'));
        updatedRows.push(tbody.lastElementChild);
    }

    let changed = false;
    for (let r = 0; r < matrix.length; r++) {
        const row = updatedRows[startRow + r];
        if (!row) continue;
        for (let c = 0; c < matrix[r].length; c++) {
            const cell = row.children[startCol + c];
            if (!cell) continue;
            setCellTextWithBreaks(cell, matrix[r][c]);
            changed = true;
        }
    }

    if (changed) {
        markModified();
        onEditorInput();
    }
    return changed;
}

function handleRectSelectionPaste(e) {
    if (!isRectTableSelectionActive()) return false;
    if (!e || !e.clipboardData) return false;

    let matrix = parseHtmlTableToMatrix(e.clipboardData.getData('text/html'));
    if (!matrix || matrix.length === 0) {
        matrix = parseTsvToMatrix(e.clipboardData.getData('text/plain'));
    }
    if (!matrix || matrix.length === 0) return false;

    e.preventDefault();
    return applyMatrixToRectSelection(matrix);
}

/**
 * 列全体へ揃えを適用する
 * @param {HTMLTableElement} table
 * @param {number} colIndex
 * @param {'left'|'center'|'right'} align
 */
function applyColumnAlignment(table, colIndex, align) {
    if (!table || colIndex < 0) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach(r => {
        const cell = r.children[colIndex];
        if (!cell) return;
        cell.style.textAlign = align;
        cell.setAttribute('align', align);
    });
}

/**
 * 指定列の揃え設定を既存行から取得
 * @param {HTMLTableElement} table
 * @param {number} colIndex
 * @returns {'left'|'center'|'right'|null}
 */
function getColumnAlignment(table, colIndex) {
    if (!table || colIndex < 0) return null;
    const rows = table.querySelectorAll('tr');
    for (const r of rows) {
        const cell = r.children[colIndex];
        if (!cell) continue;
        const alignAttr = (cell.getAttribute('align') || '').toLowerCase();
        if (alignAttr === 'left' || alignAttr === 'center' || alignAttr === 'right') {
            return alignAttr;
        }
        const styleAlign = (cell.style.textAlign || '').toLowerCase();
        if (styleAlign === 'left' || styleAlign === 'center' || styleAlign === 'right') {
            return styleAlign;
        }
    }
    return null;
}

/**
 * 行ドラッグ用の装飾クラスをテーブルへ付与
 */
function refreshTableRowDragSupport() {
    if (!editor) return;
    editor.querySelectorAll('table').forEach(table => {
        if (table.querySelector('tbody tr')) {
            table.classList.add('row-drag-enabled');
        } else {
            table.classList.remove('row-drag-enabled');
        }
    });
}

/**
 * マウス/タッチイベントから座標を取得
 * @param {MouseEvent|TouchEvent} e
 * @returns {{x:number, y:number}|null}
 */
function getPointerClientXY(e) {
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        return { x: e.clientX, y: e.clientY };
    }
    const touch = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null);
    if (!touch) return null;
    return { x: touch.clientX, y: touch.clientY };
}

/**
 * 左端ハンドル領域かを判定
 * @param {HTMLTableCellElement} cell
 * @param {number} clientX
 * @param {boolean} isTouch
 * @returns {boolean}
 */
function isRowDragHandleArea(cell, clientX, isTouch) {
    if (!cell || cell.tagName !== 'TD') return false;
    const row = cell.closest('tr');
    if (!row || !row.parentNode || row.parentNode.tagName !== 'TBODY') return false;
    const firstCell = row.querySelector('td, th');
    if (firstCell !== cell) return false;

    const rect = firstCell.getBoundingClientRect();
    const widthBase = isTouch ? ROW_DRAG_HANDLE_WIDTH_TOUCH : ROW_DRAG_HANDLE_WIDTH_MOUSE;
    const style = window.getComputedStyle(firstCell);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    // 視覚上のハンドル位置（左パディング領域）に合わせて当たり判定を広めに取る
    const width = Math.max(widthBase, paddingLeft + 10);
    return clientX >= rect.left - 6 && clientX <= rect.left + width;
}

/**
 * 既存ドロップ候補の強調表示をクリア
 */
function clearRowDropIndicator() {
    if (rowDragState.dropTargetRow) {
        rowDragState.dropTargetRow.classList.remove('row-drop-before');
        rowDragState.dropTargetRow.classList.remove('row-drop-after');
    }
    rowDragState.dropTargetRow = null;
    rowDragState.dropPosition = null;
}

/**
 * ドロップ候補を現在座標から計算
 * @param {HTMLTableElement} table
 * @param {HTMLTableRowElement} sourceRow
 * @param {number} clientY
 * @returns {{targetRow: HTMLTableRowElement, position: 'before'|'after'}|null}
 */
function computeRowDropTarget(table, sourceRow, clientY) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (rows.length <= 1) return null;

    for (const row of rows) {
        if (row === sourceRow) continue;
        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (clientY < midpoint) {
            return { targetRow: row, position: 'before' };
        }
    }

    const last = rows[rows.length - 1];
    if (!last || last === sourceRow) return null;
    return { targetRow: last, position: 'after' };
}

/**
 * ドロップ候補表示を更新
 * @param {number} clientY
 */
function updateRowDropIndicator(clientY) {
    if (!rowDragState.dragging || !rowDragState.table || !rowDragState.sourceRow) return;
    const drop = computeRowDropTarget(rowDragState.table, rowDragState.sourceRow, clientY);
    clearRowDropIndicator();
    if (!drop) return;

    rowDragState.dropTargetRow = drop.targetRow;
    rowDragState.dropPosition = drop.position;
    drop.targetRow.classList.add(drop.position === 'before' ? 'row-drop-before' : 'row-drop-after');
}

/**
 * 行ドラッグを終了
 * @param {boolean} applyDrop
 */
function finishRowDrag(applyDrop) {
    if (!rowDragState.dragging) return;

    const sourceRow = rowDragState.sourceRow;
    const sourceIndexBefore = rowDragState.sourceIndex;
    const targetRow = rowDragState.dropTargetRow;
    const dropPosition = rowDragState.dropPosition;

    document.removeEventListener('mousemove', onRowDragMove);
    document.removeEventListener('mouseup', onRowDragEnd);
    document.removeEventListener('touchmove', onRowDragMove);
    document.removeEventListener('touchend', onRowDragEnd);
    document.removeEventListener('touchcancel', onRowDragEnd);
    document.body.classList.remove('row-dragging');

    if (sourceRow) {
        sourceRow.classList.remove('row-drag-active');
    }
    if (rowDragState.table) {
        rowDragState.table.classList.remove('row-dragging-table');
    }

    let moved = false;
    if (applyDrop && sourceRow && targetRow && sourceRow.parentNode && targetRow.parentNode === sourceRow.parentNode) {
        const parent = sourceRow.parentNode;
        if (dropPosition === 'before') {
            if (targetRow !== sourceRow && targetRow !== sourceRow.nextElementSibling) {
                parent.insertBefore(sourceRow, targetRow);
            }
        } else if (dropPosition === 'after') {
            if (targetRow.nextElementSibling !== sourceRow) {
                parent.insertBefore(sourceRow, targetRow.nextElementSibling);
            }
        }

        const sourceIndexAfter = Array.from(parent.children).indexOf(sourceRow);
        moved = sourceIndexAfter !== sourceIndexBefore;
        if (moved) {
            clearColSelection();
            const focusCell = sourceRow.querySelector('td, th');
            if (focusCell) {
                setCursorTo(focusCell);
            }
            onEditorInput();
            markModified();
            saveEditorState();
        }
    }

    clearRowDropIndicator();

    rowDragState.dragging = false;
    rowDragState.table = null;
    rowDragState.sourceRow = null;
    rowDragState.sourceIndex = -1;

    if (moved) {
        refreshTableRowDragSupport();
    }
}

/**
 * ドラッグ移動中
 * @param {MouseEvent|TouchEvent} e
 */
function onRowDragMove(e) {
    if (!rowDragState.dragging) return;
    const point = getPointerClientXY(e);
    if (!point) return;

    if (e.cancelable) {
        e.preventDefault();
    }
    updateRowDropIndicator(point.y);
}

/**
 * ドラッグ終了
 * @param {MouseEvent|TouchEvent} _e
 */
function onRowDragEnd(_e) {
    finishRowDrag(true);
}

/**
 * 行ドラッグ開始
 * @param {HTMLTableRowElement} row
 * @param {HTMLTableElement} table
 * @param {number} clientY
 */
function startRowDrag(row, table, clientY) {
    if (rowDragState.dragging) {
        finishRowDrag(false);
    }

    const tbody = row.parentNode;
    if (!tbody || tbody.tagName !== 'TBODY') return;

    clearColSelection();
    hideTableContextMenu();
    saveEditorState();

    rowDragState.dragging = true;
    rowDragState.table = table;
    rowDragState.sourceRow = row;
    rowDragState.sourceIndex = Array.from(tbody.children).indexOf(row);
    row.classList.add('row-drag-active');
    table.classList.add('row-dragging-table');
    document.body.classList.add('row-dragging');

    updateRowDropIndicator(clientY);

    document.addEventListener('mousemove', onRowDragMove);
    document.addEventListener('mouseup', onRowDragEnd);
    document.addEventListener('touchmove', onRowDragMove, { passive: false });
    document.addEventListener('touchend', onRowDragEnd);
    document.addEventListener('touchcancel', onRowDragEnd);
}

/**
 * セルイベントから行ドラッグを開始できるか判定し、開始する
 * @param {HTMLTableCellElement} cell
 * @param {MouseEvent|TouchEvent} e
 * @param {boolean} isTouch
 * @returns {boolean}
 */
function maybeStartRowDrag(cell, e, isTouch) {
    const point = getPointerClientXY(e);
    if (!point) return false;

    if (!isRowDragHandleArea(cell, point.x, isTouch)) {
        return false;
    }

    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table || !row.parentNode || row.parentNode.tagName !== 'TBODY') {
        return false;
    }

    if (e.cancelable) {
        e.preventDefault();
    }
    e.stopPropagation();
    startRowDrag(row, table, point.y);
    return true;
}

/**
 * テーブルコンテキストメニューをセットアップ
 */
function setupTableContextMenu() {
    // コンテキストメニュー要素を作成
    tableContextMenu = document.createElement('div');
    tableContextMenu.id = 'tableContextMenu';
    tableContextMenu.className = 'table-context-menu';
    tableContextMenu.innerHTML = `
        <button data-action="addRowAbove">↑ 上に行を追加</button>
        <button data-action="addRowBelow">↓ 下に行を追加</button>
        <div class="ctx-divider"></div>
        <button data-action="addColLeft">← 左に列を追加</button>
        <button data-action="addColRight">→ 右に列を追加</button>
        <div class="ctx-divider"></div>
        <button data-action="alignLeft">⇤ 左揃え</button>
        <button data-action="alignCenter">⇆ 中央揃え</button>
        <button data-action="alignRight">⇥ 右揃え</button>
        <div class="ctx-divider"></div>
        <button data-action="deleteRow" class="ctx-danger">行を削除</button>
        <button data-action="deleteCol" class="ctx-danger">列を削除</button>
    `;
    tableContextMenu.style.display = 'none';
    document.body.appendChild(tableContextMenu);

    // メニューがエディタフォーカスを奪わないようにする
    tableContextMenu.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
    });
    tableContextMenu.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        handleTableAction(btn.dataset.action);
        hideTableContextMenu();
    });

    // テーブルセル内の右クリックで表示
    editor.addEventListener('contextmenu', e => {
        const cell = e.target.closest('td, th');
        if (cell && editor.contains(cell)) {
            e.preventDefault();
            activeTableCell = cell;
            showTableContextMenu(e.clientX, e.clientY);
        } else {
            hideTableContextMenu();
        }
    });

    // 列選択: セルのmousedownイベント
    editor.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        const cell = e.target.closest('td, th');
        if (!cell || !editor.contains(cell)) return;
        lastActiveTableCell = cell;

        if (isRectTableSelectionActive()) {
            clearRectSelection();
        }

        if (maybeStartRowDrag(cell, e, false)) {
            return;
        }

        if (e.shiftKey && colAnchorCell) {
            const anchorTable = colAnchorCell.closest('table');
            const currentTable = cell.closest('table');
            if (anchorTable === currentTable) {
                const anchorColIdx = getCellColIndex(colAnchorCell);
                const currentColIdx = getCellColIndex(cell);
                if (anchorColIdx === currentColIdx) {
                    e.preventDefault(); // ブラウザのテキスト選択を防止
                    // 既存のハイライトをリセット（アンカーは保持）
                    colSelectedCells.forEach(c => {
                        c.classList.remove('col-selected');
                        c.classList.remove('col-anchor');
                    });
                    colSelectedCells = [];
                    const anchorRowIdx = getCellRowIndex(colAnchorCell, currentTable);
                    const currentRowIdx = getCellRowIndex(cell, currentTable);
                    const cells = getCellsBetween(currentTable, anchorColIdx, anchorRowIdx, currentRowIdx);
                    colSelectedCells = cells;
                    cells.forEach(c => {
                        if (c === colAnchorCell) {
                            c.classList.add('col-anchor');
                        } else {
                            c.classList.add('col-selected');
                        }
                    });
                }
            }
        } else if (!e.shiftKey) {
            // 通常クリック: 編集カーソルを優先し、ドラッグ時だけ矩形選択へ切り替える
            clearColSelection();
            startRectSelection(cell, e);
            colAnchorCell = cell;
            cell.classList.add('col-anchor');
        }
    });

    editor.addEventListener('focusin', e => {
        const cell = e.target.closest ? e.target.closest('td, th') : null;
        if (cell && editor.contains(cell)) lastActiveTableCell = cell;
    });

    editor.addEventListener('mousemove', e => {
        if (!rectSelection.dragging || !rectSelection.table || !rectSelection.anchorCell) return;
        const cell = e.target.closest('td, th');
        if (!cell || !editor.contains(cell)) return;
        if (cell.closest('table') !== rectSelection.table) return;
        const movedDistance = Math.max(
            Math.abs(e.clientX - rectSelection.startX),
            Math.abs(e.clientY - rectSelection.startY)
        );
        const movedToAnotherCell = rectSelection.focusCell && rectSelection.focusCell !== cell;
        if (!rectSelection.moved && movedDistance < 6 && !movedToAnotherCell) return;
        if (!rectSelection.moved) {
            if (e.cancelable) e.preventDefault();
            window.getSelection().removeAllRanges();
            document.body.classList.add('table-rect-selecting');
        }
        rectSelection.moved = true;
        if (rectSelection.focusCell && rectSelection.focusCell !== cell) {
            rectSelection.moved = true;
        }
        updateRectSelection(rectSelection.table, rectSelection.anchorCell, cell);
    });

    document.addEventListener('mouseup', () => {
        if (rectSelection.dragging && rectSelection.active && rectSelection.moved) {
            rectSelection.suppressNextClickClear = true;
            window.getSelection().removeAllRanges();
        } else if (rectSelection.dragging) {
            clearRectCellClasses();
            document.body.classList.remove('table-rect-selecting');
            rectSelection.mode = 'edit';
        }
        rectSelection.dragging = false;
        document.body.classList.remove('table-rect-selecting');
    });

    // 矩形選択ではネイティブSelection Rangeを解除しているため、Windows WebView2では
    // copyイベントのtargetがeditor外になる場合がある。documentのcapture段階で捕捉する。
    document.addEventListener('copy', handleRectSelectionCopyCut, true);
    document.addEventListener('cut', handleRectSelectionCopyCut, true);

    // タッチ環境向けの行ドラッグ開始
    editor.addEventListener('touchstart', e => {
        const target = e.target;
        if (!target || !target.closest) return;
        const cell = target.closest('td, th');
        if (!cell || !editor.contains(cell)) return;
        maybeStartRowDrag(cell, e, true);
    }, { passive: false });

    // それ以外のクリック/キー操作で非表示
    document.addEventListener('click', e => {
        if (rectSelection.suppressNextClickClear) {
            rectSelection.suppressNextClickClear = false;
            return;
        }
        if (tableContextMenu && !tableContextMenu.contains(e.target)) {
            hideTableContextMenu();
        }
        // テーブルセル以外のクリックで列選択を解除
        if (!e.target.closest('td, th')) {
            clearColSelection();
            clearRectSelection();
        }
    });
    document.addEventListener('keydown', e => {
        hideTableContextMenu();
        if (e.key === 'Escape') {
            clearColSelection();
            if (!isRectTableSelectionActive()) {
                clearRectSelection();
            }
        }
    });

    refreshTableRowDragSupport();
    if (rowDragObserver) {
        rowDragObserver.disconnect();
    }
    rowDragObserver = new MutationObserver(() => {
        refreshTableRowDragSupport();
    });
    rowDragObserver.observe(editor, { childList: true, subtree: true });
}

/**
 * テーブルコンテキストメニューを表示
 * @param {number} x - X座標
 * @param {number} y - Y座標
 */
function showTableContextMenu(x, y) {
    tableContextMenu.style.display = 'block';
    tableContextMenu.style.left = x + 'px';
    tableContextMenu.style.top = y + 'px';
    // ビューポート内に収める
    requestAnimationFrame(() => {
        const rect = tableContextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tableContextMenu.style.left = (window.innerWidth - rect.width - 8) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            tableContextMenu.style.top = (window.innerHeight - rect.height - 8) + 'px';
        }
    });
}

/**
 * テーブルコンテキストメニューを非表示
 */
function hideTableContextMenu() {
    if (tableContextMenu) tableContextMenu.style.display = 'none';
    activeTableCell = null;
}

/**
 * テーブル操作アクションを実行
 * @param {string} action - アクション名
 */
function handleTableAction(action) {
    if (!activeTableCell) return;

    const row = activeTableCell.closest('tr');
    const table = activeTableCell.closest('table');
    if (!row || !table) return;

    const cellIndex = Array.from(row.children).indexOf(activeTableCell);
    const allRows = table.querySelectorAll('tr');
    const colCount = allRows[0] ? allRows[0].children.length : 0;
    const isHeader = activeTableCell.tagName === 'TH' || (row.parentNode && row.parentNode.tagName === 'THEAD');

    switch (action) {
        case 'addRowAbove': {
            const newRow = createTableRow(table, colCount, 'td');
            if (isHeader) {
                let tbody = table.querySelector('tbody');
                if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
                tbody.insertBefore(newRow, tbody.firstChild);
            } else {
                row.parentNode.insertBefore(newRow, row);
            }
            break;
        }
        case 'addRowBelow': {
            const newRow = createTableRow(table, colCount, 'td');
            if (isHeader) {
                let tbody = table.querySelector('tbody');
                if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
                tbody.insertBefore(newRow, tbody.firstChild);
            } else {
                row.parentNode.insertBefore(newRow, row.nextSibling);
            }
            break;
        }
        case 'addColLeft': {
            allRows.forEach(r => {
                const tag = r.parentNode && r.parentNode.tagName === 'THEAD' ? 'th' : 'td';
                const newCell = document.createElement(tag);
                newCell.innerHTML = '&nbsp;';
                r.insertBefore(newCell, r.children[cellIndex]);
            });
            break;
        }
        case 'addColRight': {
            allRows.forEach(r => {
                const tag = r.parentNode && r.parentNode.tagName === 'THEAD' ? 'th' : 'td';
                const newCell = document.createElement(tag);
                newCell.innerHTML = '&nbsp;';
                const ref = r.children[cellIndex];
                r.insertBefore(newCell, ref ? ref.nextSibling : null);
            });
            break;
        }
        case 'alignLeft': {
            applyColumnAlignment(table, cellIndex, 'left');
            break;
        }
        case 'alignCenter': {
            applyColumnAlignment(table, cellIndex, 'center');
            break;
        }
        case 'alignRight': {
            applyColumnAlignment(table, cellIndex, 'right');
            break;
        }
        case 'deleteRow': {
            if (isHeader) break; // ヘッダー行は削除しない
            const tbody = row.parentNode;
            row.remove();
            if (tbody.tagName === 'TBODY' && tbody.children.length === 0) {
                const thead = table.querySelector('thead');
                if (!thead || thead.children.length === 0) {
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    table.parentNode.replaceChild(p, table);
                }
            }
            break;
        }
        case 'deleteCol': {
            if (colCount <= 1) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                table.parentNode.replaceChild(p, table);
            } else {
                allRows.forEach(r => {
                    if (r.children[cellIndex]) r.children[cellIndex].remove();
                });
            }
            break;
        }
    }

    clearColSelection();
    refreshTableRowDragSupport();
    markModified();
}

/**
 * テーブル行を作成するヘルパー
 * 列揃え設定は既存列の設定を継承する
 * @param {HTMLTableElement} table - 対象テーブル
 * @param {number} colCount - 列数
 * @param {string} tag - セルタグ ('td' or 'th')
 * @returns {HTMLTableRowElement}
 */
function createTableRow(table, colCount, tag) {
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
        const cell = document.createElement(tag);
        cell.innerHTML = '&nbsp;';
        const align = getColumnAlignment(table, i);
        if (align) {
            cell.style.textAlign = align;
            cell.setAttribute('align', align);
        }
        tr.appendChild(cell);
    }
    return tr;
}

/**
 * CSV テキストを Markdown テーブルに変換
 * @param {string} csvText - CSV テキスト
 * @param {string|null} title - オプションのタイトル
 * @returns {string|null} Markdown テーブル文字列
 */
function csvToMarkdownTable(csvText, title) {
    const rows = parseCsv(csvText);
    if (rows.length === 0) return null;

    // 最大列数を算出
    const maxCols = Math.max(...rows.map(r => r.length));
    if (maxCols === 0) return null;

    // すべての行を同じ列数に正規化
    const normalized = rows.map(row => {
        while (row.length < maxCols) row.push('');
        return row;
    });

    // Markdownテーブルを構築
    let md = '';
    if (title) {
        md += '**' + title + '**\n\n';
    }

    // ヘッダー行
    md += '| ' + normalized[0].map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    // 区切り行
    md += '| ' + normalized[0].map(() => '---').join(' | ') + ' |\n';
    // データ行
    for (let i = 1; i < normalized.length; i++) {
        md += '| ' + normalized[i].map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    }

    return md;
}

/**
 * CSV テキストをパースする（クォートフィールド対応）
 * @param {string} text - CSV テキスト
 * @returns {Array<Array<string>>} パースされた行の配列
 */
function parseCsv(text) {
    const rows = [];
    let current = [];
    let field = '';
    let inQuotes = false;
    const len = text.length;

    for (let i = 0; i < len; i++) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < len && text[i + 1] === '"') {
                    field += '"';
                    i++; // エスケープされた引用符をスキップ
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                current.push(field.trim());
                field = '';
            } else if (ch === '\n') {
                current.push(field.trim());
                if (current.some(c => c !== '')) {
                    rows.push(current);
                }
                current = [];
                field = '';
            } else if (ch === '\r') {
                // キャリッジリターンは無視
            } else {
                field += ch;
            }
        }
    }

    // 最終フィールド/行
    current.push(field.trim());
    if (current.some(c => c !== '')) {
        rows.push(current);
    }

    return rows;
}

// ========== グローバル公開（矩形選択フロー連携） ==========
window.isRectTableSelectionActive = isRectTableSelectionActive;
window.handleRectSelectionPaste = handleRectSelectionPaste;
