// ============================================================
// SuMark ペーストユーティリティ (pasteUtils.js)
// テキスト貼り付け時の判定・変換処理
// utils.js, main.js より後に読み込むこと
// 依存: escapeHtml() (utils.js), showProgressIndicator/hideProgressIndicator (main.js)
// ============================================================

/**
 * テキストがタブ区切り（複数列・複数行）かどうか判定する
 * @param {string} text - 判定対象テキスト
 * @returns {boolean}
 */
function isTabDelimited(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 1) return false;
    // 少なくとも1行はタブ文字を含む
    return lines.some(line => line.includes('\t'));
}

/**
 * タブ区切りテキストをHTMLテーブルに変換する
 * 依存: escapeHtml() (utils.js)
 * @param {string} text - タブ区切りテキスト
 * @returns {string} HTMLテーブル文字列
 */
function tsvToHtmlTable(text) {
    const lines = text.trim().split('\n');
    const rows = lines.map(line => line.split('\t'));

    // 最初の行をヘッダーに
    let html = '<table><thead><tr>';
    rows[0].forEach(cell => {
        html += '<th>' + escapeHtml(cell.trim()) + '</th>';
    });
    html += '</tr></thead><tbody>';

    for (let i = 1; i < rows.length; i++) {
        html += '<tr>';
        rows[i].forEach(cell => {
            html += '<td>' + escapeHtml((cell || '').trim()) + '</td>';
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

/**
 * HTML文字列からテーブルをパースしてクリーンなテーブルHTMLを生成する
 * 依存: escapeHtml() (utils.js)
 * @param {string} htmlStr - テーブルを含むHTML文字列
 * @returns {string|null} クリーンなHTMLテーブル文字列、テーブルがなければnull
 */
function parseHtmlTable(htmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    const srcTable = doc.querySelector('table');
    if (!srcTable) return null;

    const rows = srcTable.querySelectorAll('tr');
    if (rows.length === 0) return null;

    let html = '<table><thead><tr>';
    // 最初の行をヘッダーに
    const headerCells = rows[0].querySelectorAll('th, td');
    headerCells.forEach(cell => {
        html += '<th>' + escapeHtml(cell.textContent.trim()) + '</th>';
    });
    html += '</tr></thead><tbody>';

    for (let i = 1; i < rows.length; i++) {
        html += '<tr>';
        rows[i].querySelectorAll('th, td').forEach(cell => {
            html += '<td>' + escapeHtml(cell.textContent.trim()) + '</td>';
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

/**
 * テキストがMarkdown形式かどうかをヒューリスティックに判定する
 * @param {string} text - 判定対象テキスト
 * @returns {boolean}
 */
function looksLikeMarkdown(text) {
    // 簡単なヒューリスティック：Markdown パターンを含むか判定
    return /^#{1,6} |^[-*+] |\*\*.*\*\*|^```|^\|.*\|.*\||^>\s|^\d+\.\s|!\[.*\]\(.*\)|\[.*\]\(.*\)/m.test(text);
}

/**
 * 大量テキストをチャンクに分けて段階的に貼り付ける
 * 依存: showProgressIndicator(), hideProgressIndicator() (main.js)
 * @param {string[]} lines - 貼り付ける行の配列
 * @param {HTMLElement} codeElement - 貼り付け先のコード要素
 * @returns {Promise<void>}
 */
async function pasteTextInChunks(lines, codeElement) {
    const CHUNK_SIZE = 100; // Process 100 lines at a time
    const totalLines = lines.length;
    let currentIndex = 0;
    
    return new Promise((resolve) => {
        function processChunk() {
            const endIndex = Math.min(currentIndex + CHUNK_SIZE, totalLines);
            const chunk = lines.slice(currentIndex, endIndex);
            
            // チャンクを挿入
            for (let i = 0; i < chunk.length; i++) {
                if (currentIndex + i > 0) {
                    document.execCommand('insertLineBreak');
                }
                if (chunk[i]) {
                    document.execCommand('insertText', false, chunk[i]);
                }
            }
            
            currentIndex = endIndex;
            
            // 進捗を更新
            if (totalLines > 500) {
                const progress = Math.round((currentIndex / totalLines) * 100);
                showProgressIndicator(`貼り付け中... ${progress}% (${currentIndex}/${totalLines}行)`);
            }
            
            // 処理を続けるまたは終了
            if (currentIndex < totalLines) {
                requestAnimationFrame(processChunk);
            } else {
                if (totalLines > 500) {
                    hideProgressIndicator();
                }
                resolve();
            }
        }
        
        // 処理を開始
        if (totalLines > 500) {
            showProgressIndicator(`貼り付け中... 0% (0/${totalLines}行)`);
        }
        requestAnimationFrame(processChunk);
    });
}
