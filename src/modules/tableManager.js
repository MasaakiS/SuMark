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

    // それ以外のクリック/キー操作で非表示
    document.addEventListener('click', e => {
        if (tableContextMenu && !tableContextMenu.contains(e.target)) {
            hideTableContextMenu();
        }
    });
    document.addEventListener('keydown', () => hideTableContextMenu());
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
            const newRow = createTableRow(colCount, 'td');
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
            const newRow = createTableRow(colCount, 'td');
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

    markModified();
}

/**
 * テーブル行を作成するヘルパー
 * @param {number} colCount - 列数
 * @param {string} tag - セルタグ ('td' or 'th')
 * @returns {HTMLTableRowElement}
 */
function createTableRow(colCount, tag) {
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
        const cell = document.createElement(tag);
        cell.innerHTML = '&nbsp;';
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
