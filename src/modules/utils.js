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

/**
 * 関数実行を遅延させる（デバウンス）
 * @param {Function} fn - 実行する関数
 * @param {number} delay - 遅延時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
function debounce(fn, delay) {
    let timeoutId;
    return function debounced(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 関数の実行頻度を制限する（スロットル）
 * @param {Function} fn - 実行する関数
 * @param {number} delay - 最小実行間隔（ミリ秒）
 * @returns {Function} スロットルされた関数
 */
function throttle(fn, delay) {
    let lastCall = 0;
    return function throttled(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
        }
    };
}

/**
 * ファイルパスをノーマライズする（クロスプラットフォーム対応）
 * バックスラッシュをスラッシュに置き換える
 * @param {string} path - ファイルパス
 * @returns {string} ノーマライズされたパス
 */
function normalizeFilePath(path) {
    if (!path) return '';
    return path.replace(/\\/g, '/').replace(/\/$/, '');
}

/**
 * 相対パスを解決する（ディレクトリを基準）
 * @param {string} fileDir - ファイルディレクトリ（ベースパス）
 * @param {string} relativePath - 相対パス
 * @returns {string} 解決済みパス
 */
function resolveRelativePath(fileDir, relativePath) {
    if (!fileDir || !relativePath) return relativePath;
    
    fileDir = normalizeFilePath(fileDir);
    relativePath = normalizeFilePath(relativePath);
    
    const parts = fileDir.split('/');
    const relParts = relativePath.split('/');
    
    for (const part of relParts) {
        if (part === '..') {
            parts.pop();
        } else if (part !== '.') {
            parts.push(part);
        }
    }
    
    return parts.join('/');
}

/**
 * キープレスをシミュレートする（キーボードイベント）
 * @param {string} key - キー名
 * @returns {boolean} イベント発火成功フラグ
 */
function simulateKeyPress(element, key) {
    if (!element) return false;
    
    const event = new KeyboardEvent('keydown', {
        key: key,
        code: key,
        bubbles: true,
        cancelable: true,
    });
    
    return element.dispatchEvent(event);
}

/**
 * ローカルストレージに安全にアクセスする
 * @param {string} key - キー名
 * @param {*} defaultValue - デフォルト値
 * @returns {*} 保存された値またはデフォルト値
 */
function getLocalStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
        console.warn(`[getLocalStorage] Failed to read key "${key}":`, e);
        return defaultValue;
    }
}

/**
 * ローカルストレージに安全に保存する
 * @param {string} key - キー名
 * @param {*} value - 保存する値
 * @returns {boolean} 保存成功フラグ
 */
function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn(`[setLocalStorage] Failed to write key "${key}":`, e);
        return false;
    }
}

/**
 * 配列から重複を削除する
 * @param {Array} arr - 対象配列
 * @returns {Array} 重複なしの配列
 */
function uniqueArray(arr) {
    return [...new Set(arr)];
}

/**
 * オブジェクトを深いコピーする
 * @param {Object} obj - コピー対象オブジェクト
 * @returns {Object} ディープコピー
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
