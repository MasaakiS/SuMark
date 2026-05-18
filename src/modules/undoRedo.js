/**
 * SuMark Undo/Redo 管理モジュール (undoRedo.js)
 *
 * エディタの状態を履歴管理し、Undo/Redo操作を提供
 * グローバルスコープで動作（ESM未対応）
 * main.js より前に読み込むこと
 * 依存: nodeUtils.js (saveSelection, restoreSelection), codeHighlight.js (highlightAllCodeBlocks)
 */

// ========== Undo/Redo 状態 ==========
let undoStack = [];        // { html, selection } の配列
let redoStack = [];        // { html, selection } の配列
let currentState = null;   // 現在のエディタ状態
const MAX_UNDO_STACK = 100; // Undo履歴の最大数
let isUndoRedoOperation = false; // Undo/Redo中の記録を防ぐガード
let saveStateTimer = null; // 状態保存用デバウンスタイマー

/**
 * 現在のエディタ状態を保存
 */
function saveEditorState() {
    if (isUndoRedoOperation) return; // Undo/Redo中は記録しない
    if (isConverting) return; // 自動変換中は記録しない
    
    const html = editor.innerHTML;
    const selection = saveSelection();
    
    // 状態が実際に変わったか確認
    if (currentState && currentState.html === html) {
        return; // 変化なしなら保存しない
    }
    
    // 現在状態をUndoスタックへ保存
    if (currentState) {
        undoStack.push(currentState);
        // スタック上限を維持
        if (undoStack.length > MAX_UNDO_STACK) {
            undoStack.shift();
        }
    }
    
    // 現在状態を更新
    currentState = { html, selection };
    
    // 新規変更時はRedoスタックをクリア
    redoStack = [];
    
    console.log('[Undo] State saved. Stack size:', undoStack.length);
}

/**
 * saveEditorState のデバウンス版（最終入力から500ms待機）
 */
function debouncedSaveEditorState() {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
        saveEditorState();
    }, 500);
}

/**
 * Undo操作を実行
 */
function performUndo() {
    if (undoStack.length === 0) {
        console.log('[Undo] Nothing to undo');
        return;
    }
    
    isUndoRedoOperation = true;
    
    // 現在状態をRedoスタックへ積む
    if (currentState) {
        redoStack.push(currentState);
    }
    
    // Undoスタックから取り出す
    const previousState = undoStack.pop();
    currentState = previousState;
    
    try {
        console.log('[Undo] Restoring state:', previousState);
        if (typeof DOMPurify !== 'undefined') {
            editor.innerHTML = DOMPurify.sanitize(previousState.html, { ALLOWED_URI_REGEXP: DOMPURIFY_URI_REGEXP });
        } else {
            editor.innerHTML = previousState.html;
        }
        console.log('[Undo] editor.innerHTML length:', editor.innerHTML.length);
    } catch (e) {
        console.error('[Undo] Exception:', e);
    }
    
    // エディタ先頭が編集可能要素になるよう補正
    ensureEditableStart();
    
    // 選択範囲を復元
    restoreSelection(previousState.selection);
    
    // コードブロックを再ハイライト
    highlightAllCodeBlocks();
    
    // 文字数表示を更新
    updateWordCount();
    
    // 変更済みフラグを更新
    markModified();
    
    isUndoRedoOperation = false;
    
    console.log('[Undo] Performed. Undo stack:', undoStack.length, 'Redo stack:', redoStack.length);
}

/**
 * Redo操作を実行
 */
function performRedo() {
    if (redoStack.length === 0) {
        console.log('[Redo] Nothing to redo');
        return;
    }
    
    isUndoRedoOperation = true;
    
    // 現在状態をUndoスタックへ積む
    if (currentState) {
        undoStack.push(currentState);
        if (undoStack.length > MAX_UNDO_STACK) {
            undoStack.shift();
        }
    }
    
    // Redoスタックから取り出す
    const nextState = redoStack.pop();
    currentState = nextState;
    
    try {
        console.log('[Redo] Restoring state:', nextState);
        if (typeof DOMPurify !== 'undefined') {
            editor.innerHTML = DOMPurify.sanitize(nextState.html, { ALLOWED_URI_REGEXP: DOMPURIFY_URI_REGEXP });
        } else {
            editor.innerHTML = nextState.html;
        }
        console.log('[Redo] editor.innerHTML length:', editor.innerHTML.length);
    } catch (e) {
        console.error('[Redo] Exception:', e);
    }
    
    // エディタ先頭が編集可能要素になるよう補正
    ensureEditableStart();
    
    // 選択範囲を復元
    restoreSelection(nextState.selection);
    
    // コードブロックを再ハイライト
    highlightAllCodeBlocks();
    
    // 文字数表示を更新
    updateWordCount();
    
    // 変更済みフラグを更新
    markModified();
    
    isUndoRedoOperation = false;
    
    console.log('[Redo] Performed. Undo stack:', undoStack.length, 'Redo stack:', redoStack.length);
}
