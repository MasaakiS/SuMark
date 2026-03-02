// ============================================================
// SuMark 共有ユーティリティ (utils.js)
// 全モジュールから参照される横断的な純粋関数を配置
// main.js より前に読み込むこと
// ============================================================

/**
 * HTML特殊文字をエスケープする
 * DOM のテキストノード化を利用した安全なエスケープ
 * @param {string} str - エスケープ対象の文字列
 * @returns {string} エスケープ済みHTML文字列
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
