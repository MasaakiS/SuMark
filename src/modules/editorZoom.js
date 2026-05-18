/**
 * SuMark エディタズーム管理モジュール (editorZoom.js)
 *
 * Ctrl+/- / Ctrl+0 / Ctrl+マウスホイール によるエディタ倍率変更
 * グローバルスコープで動作（ESM未対応）
 * main.js より前に読み込むこと
 */

// ========== ズーム状態 ==========
let editorZoom = 1.0;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

/**
 * 現在のズーム倍率をエディタに適用する
 */
function applyEditorZoom() {
    if (!editor) return;
    editor.style.transform = `scale(${editorZoom})`;
    editor.style.transformOrigin = 'top left';
    // スクロール位置補正（ズーム時に左上基準で）
    editor.parentElement && (editor.parentElement.scrollLeft = 0);
}

/**
 * ズーム倍率を変更する
 * @param {number} delta - 変更量 (+ZOOM_STEP or -ZOOM_STEP)
 */
function changeEditorZoom(delta) {
    editorZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((editorZoom + delta) * 100) / 100));
    applyEditorZoom();
}

/**
 * ズームをリセット（等倍に戻す）
 */
function resetEditorZoom() {
    editorZoom = 1.0;
    applyEditorZoom();
}

/**
 * ズーム用キーボードショートカットを登録
 */
function setupZoomKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            // Mac配列対応: Ctrl+Shift+; も+になる。Ctrl+= も+として扱う
            if (
                e.code === 'Equal' ||
                e.key === '+' ||
                (e.shiftKey && (e.key === ';' || e.key === '=')) ||
                e.key === '='
            ) {
                changeEditorZoom(ZOOM_STEP);
                e.preventDefault();
            } else if (e.code === 'Minus' || e.key === '-') {
                changeEditorZoom(-ZOOM_STEP);
                e.preventDefault();
            } else if (e.code === 'Digit0' || e.key === '0') {
                resetEditorZoom();
                e.preventDefault();
            }
        }
    });

    // Ctrl+マウスホイール拡大縮小
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.deltaY < 0) {
                changeEditorZoom(ZOOM_STEP);
            } else if (e.deltaY > 0) {
                changeEditorZoom(-ZOOM_STEP);
            }
            e.preventDefault();
        }
    }, { passive: false });
}
