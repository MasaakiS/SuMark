/**
 * SuMark Undo/Redo 管理モジュール (undoRedo.js)
 *
 * エディタの状態を履歴管理し、Undo/Redo操作を提供
 * グローバルスコープで動作（ESM未対応）
 * main.js より前に読み込むこと
 * 依存: nodeUtils.js (saveSelection, restoreSelection), codeHighlight.js (highlightAllCodeBlocks)
 */

// ========== Undo/Redo 状態 ==========
let undoStack = [];        // Array of { html, selection }
let redoStack = [];        // Array of { html, selection }
let currentState = null;   // Current editor state
const MAX_UNDO_STACK = 100; // Maximum undo history size
let isUndoRedoOperation = false; // Guard to prevent recording during undo/redo
let saveStateTimer = null; // Debounce timer for saving editor state

/**
 * 現在のエディタ状態を保存
 */
function saveEditorState() {
    if (isUndoRedoOperation) return; // Don't record during undo/redo
    if (isConverting) return; // Don't record during auto-conversion
    
    const html = editor.innerHTML;
    const selection = saveSelection();
    
    // Check if state actually changed
    if (currentState && currentState.html === html) {
        return; // No change, don't save
    }
    
    // Save current state to undo stack
    if (currentState) {
        undoStack.push(currentState);
        // Limit stack size
        if (undoStack.length > MAX_UNDO_STACK) {
            undoStack.shift();
        }
    }
    
    // Update current state
    currentState = { html, selection };
    
    // Clear redo stack when new change is made
    redoStack = [];
    
    console.log('[Undo] State saved. Stack size:', undoStack.length);
}

/**
 * Debounced version of saveEditorState (waits 500ms after last input)
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
    
    // Push current state to redo stack
    if (currentState) {
        redoStack.push(currentState);
    }
    
    // Pop from undo stack
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
    
    // Ensure editor starts with an editable element
    ensureEditableStart();
    
    // Restore selection
    restoreSelection(previousState.selection);
    
    // Re-highlight code blocks
    highlightAllCodeBlocks();
    
    // Update word count
    updateWordCount();
    
    // Mark as modified
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
    
    // Push current state to undo stack
    if (currentState) {
        undoStack.push(currentState);
        if (undoStack.length > MAX_UNDO_STACK) {
            undoStack.shift();
        }
    }
    
    // Pop from redo stack
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
    
    // Ensure editor starts with an editable element
    ensureEditableStart();
    
    // Restore selection
    restoreSelection(nextState.selection);
    
    // Re-highlight code blocks
    highlightAllCodeBlocks();
    
    // Update word count
    updateWordCount();
    
    // Mark as modified
    markModified();
    
    isUndoRedoOperation = false;
    
    console.log('[Redo] Performed. Undo stack:', undoStack.length, 'Redo stack:', redoStack.length);
}
