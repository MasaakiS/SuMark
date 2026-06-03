/**
 * SuMark タブ管理モジュール (tabManager.js)
 *
 * タブのライフサイクル管理、切り替え、クローズなどを担当
 * グローバルスコープで動作（ESM未対応）
 * main.js より前に読み込むこと
 */

// ========== タブ管理グローバル状態 ==========
let tabs = [];              // Array of { id, filePath, title, content, isModified, scrollTop }
let activeTabId = null;
let tabIdCounter = 0;

// ========== DOM参照（init()で初期化） ==========
let tabList = null;         // #tabList element
let currentFileSpan = null; // #currentFile element

/**
 * タブマネージャーを初期化
 */
function initTabManager() {
    tabList = document.getElementById('tabList');
    currentFileSpan = document.getElementById('currentFile');
}

/**
 * 新しいタブを作成
 * @param {string|null} filePath - ファイルパス（新規の場合は null）
 * @param {string} title - タブのタイトル
 * @param {string} htmlContent - HTML コンテンツ
 * @returns {Object} 作成されたタブオブジェクト
 */
function createTab(filePath, title, htmlContent) {
    const id = ++tabIdCounter;
    const tab = {
        id,
        filePath: filePath || null,
        title: title || '無題',
        content: htmlContent || '<p><br></p>',
        isModified: false,
        scrollTop: 0,
    };
    tabs.push(tab);
    switchTab(id);
    return tab;
}

/**
 * アクティブタブを取得
 * @returns {Object|null} アクティブなタブ、またはnull
 */
function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
}

/**
 * タブを切り替える
 * @param {number} id - 切り替え先のタブID
 */
function switchTab(id) {
    beginProgrammaticEditorUpdate();

    try {
        // 現在のタブの状態を保存
        const current = getActiveTab();
        if (current) {
            current.content = editor.innerHTML;
            current.scrollTop = editor.parentElement.scrollTop;
        }

        activeTabId = id;
        const tab = getActiveTab();
        if (!tab) return;

    try {
        console.log('[TabSwitch] Restoring tab content:', tab);
        if (typeof DOMPurify !== 'undefined') {
            editor.innerHTML = DOMPurify.sanitize(tab.content, {
                ALLOWED_TAGS: [
                    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
                    'blockquote', 'pre', 'code', 'hr',
                    'br', 'strong', 'em', 'del', 's', 'a', 'img',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    'details', 'summary',
                    'div', 'span', 'input', 'select', 'option', 'button',
                ],
                ALLOWED_ATTR: [
                    'href', 'title', 'src', 'alt', 'width', 'height',
                    'class', 'id', 'style',
                    'type', 'checked', 'disabled', 'value',
                    'open',
                    'contenteditable',
                    'data-mermaid-source', 'data-math', 'data-wrap', 'data-code-lang',
                ],
                ALLOW_DATA_ATTR: true,
                ALLOWED_URI_REGEXP: DOMPURIFY_URI_REGEXP
            });
        } else {
            editor.innerHTML = tab.content;
        }
        console.log('[TabSwitch] editor.innerHTML length:', editor.innerHTML.length);
    } catch (e) {
        console.error('[TabSwitch] Exception:', e);
    }
    // サニタイズ後にコードブロックツールバーを再構築（restoredHTMLでは要素削除される）
    editor.querySelectorAll('.code-block-toolbar').forEach(el => el.remove());
    // タブ復元ではSVGがsanitizeで落ちる場合があるため、描画済みフラグを一度クリアする
    editor.querySelectorAll('.mermaid-diagram-only[data-mermaid-rendered], .mermaid-code-and-diagram[data-mermaid-rendered]').forEach(el => {
        el.removeAttribute('data-mermaid-rendered');
    });
    editor.parentElement.scrollTop = tab.scrollTop;
    
    // エディタが編集可能要素で始まることを確認
    ensureEditableStart();
    
    // チェックボックスをインタラクティブにする
    editor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.removeAttribute('disabled');
    });

    // コードブロックをハイライト
    editor.querySelectorAll('pre code').forEach(block => {
        if (block.classList.contains('language-mermaid')) return;
        if (typeof hljs !== 'undefined' && !block.dataset.highlighted) {
            hljs.highlightElement(block);
        }
    });

    // Mermaid ダイアグラムをレンダリング
    renderMermaidBlocks();

    // KaTeX 数式をレンダリング
    renderMathBlocks();

    // トグルブロック（details/summary）をセットアップ
    setupToggleBlocks();

    // TOC コンテナを復元
    reconstructTocContainers();
    restoreTocHeadingIds();
    setupTocDeleteButtons();

    // コードブロックに行番号を追加
    updateAllLineNumbers();

    // タブ切替後、コピー/ラップボタンが利用可能であることを確認
    if (typeof addCopyButtonsToCodeBlocks === 'function') {
        addCopyButtonsToCodeBlocks();
        editor.querySelectorAll('pre').forEach(pre => {
            if (typeof setupCodeWrapButton === 'function') {
                setupCodeWrapButton(pre);
            }
        });
    }
    
    // コード折り返し状態を復元
    restoreCodeWrapStates();

    // 画像エラーハンドリングをセットアップ
    setupImageErrorHandling();

    // タブ復元後の後処理でDOMが変化するため、未変更タブは最終HTMLを基準にそろえる
    if (!tab.isModified) {
        tab.content = editor.innerHTML;
    }

    // タブ切り替え時にUndo/Redoスタックを最終DOM基準でリセット
    undoStack = [];
    redoStack = [];
    currentState = null;
    saveEditorState();

        renderTabs();
        updateWordCount();
        updateStatusBar();
    } finally {
        endProgrammaticEditorUpdate();
    }
}

/**
 * Show an unsaved tab confirmation dialog with Save / Don't Save / Cancel options.
 * @param {Object} tab - The tab object being closed.
 * @returns {Promise<'save'|'discard'|'cancel'>}
 */
function showUnsavedCloseDialog(tab) {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const fieldsEl = document.getElementById('modalFields');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');
    const extraBtn = document.getElementById('modalExtra');
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!overlay || !titleEl || !fieldsEl || !okBtn || !cancelBtn || !extraBtn) {
        return Promise.resolve('cancel');
    }

    titleEl.textContent = '確認';
    fieldsEl.innerHTML = '<div class="modal-field" style="margin-bottom:0;">"' + escapeHtml(tab.title) + '" は保存されていません。変更を保存しますか？</div>';
    okBtn.textContent = '保存';
    cancelBtn.textContent = 'キャンセル';
    extraBtn.textContent = '保存しない';
    extraBtn.style.display = 'inline-flex';
    fieldsEl.onkeydown = null;

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        if (overlay.style.display !== 'none') {
            okBtn.focus({ preventScroll: true });
        }
    });

    let resolveChoice;
    const handleOverlayClick = e => {
        if (e.target === overlay) {
            cleanup();
            resolveChoice('cancel');
        }
    };

    const handleKeyDown = e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cleanup();
            resolveChoice('cancel');
        }
    };

    const handleSave = async () => {
        cleanup();
        await saveFile();
        resolveChoice(tab.isModified ? 'cancel' : 'save');
    };

    const handleDiscard = () => {
        cleanup();
        resolveChoice('discard');
    };

    const handleCancel = () => {
        cleanup();
        resolveChoice('cancel');
    };

    const cleanup = () => {
        overlay.style.display = 'none';
        titleEl.textContent = '';
        fieldsEl.innerHTML = '';
        fieldsEl.onkeydown = null;
        okBtn.textContent = 'OK';
        cancelBtn.textContent = 'キャンセル';
        extraBtn.style.display = 'none';
        document.removeEventListener('keydown', handleKeyDown);
        okBtn.removeEventListener('click', handleSave);
        extraBtn.removeEventListener('click', handleDiscard);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
        if (previousActiveElement && document.contains(previousActiveElement)) {
            previousActiveElement.focus({ preventScroll: true });
        }
    };

    const promise = new Promise(resolve => {
        resolveChoice = resolve;
        okBtn.addEventListener('click', handleSave);
        extraBtn.addEventListener('click', handleDiscard);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleKeyDown);
    });

    return promise;
}

/**
 * タブをクローズ
 * @param {number} id - クローズするタブのID
 */
async function closeTab(id) {
    const tabIndex = tabs.findIndex(t => t.id === id);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];
    ensureTabUnsavedState(tab);

    // 保存されていない場合は確認
    if (tab.isModified) {
        const choice = await showUnsavedCloseDialog(tab);
        if (choice === 'cancel') return;
        if (choice === 'save' && tab.isModified) return;
    }

    tabs.splice(tabIndex, 1);

    if (tabs.length === 0) {
        // タブがない場合は新しい空のタブを作成
        createTab(null, '無題', '<p><br></p>');
    } else if (id === activeTabId) {
        // 最も近いタブに切り替え
        const newIndex = Math.min(tabIndex, tabs.length - 1);
        switchTab(tabs[newIndex].id);
    } else {
        renderTabs();
    }
}

/**
 * タブUIをレンダリング
 */
function getTabPreviewText(tab) {
    if (tab.filePath) {
        return tab.title;
    }

    let text = '';
    if (tab.id === activeTabId && typeof editor !== 'undefined' && editor) {
        text = editor.innerText || editor.textContent || '';
    } else {
        const temp = document.createElement('div');
        temp.innerHTML = tab.content || '';
        text = temp.innerText || temp.textContent || '';
    }

    text = text.replace(/\u200B/g, '').replace(/\r\n|\r/g, '\n');
    const firstLine = text.split('\n').map(line => line.trim()).find(line => line.length > 0) || '';
    if (!firstLine) {
        return '無題';
    }
    return firstLine.length > 32 ? firstLine.slice(0, 32) + '…' : firstLine;
}

function renderTabs() {
    if (!tabList) return;
    tabList.innerHTML = '';

    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
        el.title = tab.filePath || getTabPreviewText(tab);

        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.textContent = getTabPreviewText(tab);
        el.appendChild(titleSpan);

        if (tab.isModified) {
            const dot = document.createElement('span');
            dot.className = 'tab-modified';
            dot.textContent = '●';
            el.appendChild(dot);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
        });
        closeBtn.addEventListener('click', e => {
            e.stopPropagation();
            closeTab(tab.id);
        });
        el.appendChild(closeBtn);

        el.addEventListener('mousedown', e => e.preventDefault());
        el.addEventListener('click', () => {
            if (tab.id !== activeTabId) switchTab(tab.id);
        });

        tabList.appendChild(el);
    });
}

/**
 * 現在のタブを "保存されていない" とマーク
 */
function markModified() {
    const tab = getActiveTab();
    if (tab && !tab.isModified) {
        tab.isModified = true;
        renderTabs();
    }
}

/**
 * 未変更タブの保存基準HTMLを現在の描画後DOMへ同期する。
 * 描画系の後処理でDOMだけが変わるケースの誤dirty補正を防ぐ。
 */
function syncActiveTabContentIfPristine() {
    const tab = getActiveTab();
    if (
        tab &&
        !tab.isModified &&
        typeof editor !== 'undefined' &&
        editor
    ) {
        tab.content = editor.innerHTML;
    }
}

/**
 * アクティブタブに対して未保存判定の補正を適用する。
 * タブクローズ確認とアプリ終了確認で同じ判定を使うための共通入口。
 * @param {Object|null} tab
 * @param {{ renderOnChange?: boolean }} options
 * @returns {boolean}
 */
function ensureTabUnsavedState(tab, options = {}) {
    if (!tab) return false;
    if (tab.isModified) return true;
    if (tab.id !== activeTabId) return false;
    if (typeof editor === 'undefined' || !editor) return false;

    const { renderOnChange = true } = options;
    let shouldMarkModified = tab.content !== editor.innerHTML;

    if (!shouldMarkModified && !tab.filePath) {
        const text = (editor.innerText || '').replace(/\u200B/g, '').trim();
        const hasStructuredContent = !!editor.querySelector(
            'img, table, pre, blockquote, ul, ol, details, hr, h1, h2, h3, h4, h5, h6, input[type="checkbox"]'
        );
        shouldMarkModified = text.length > 0 || hasStructuredContent;
    }

    if (shouldMarkModified) {
        tab.isModified = true;
        if (renderOnChange) {
            renderTabs();
        }
    }

    return tab.isModified;
}

/**
 * 未保存タブ一覧を取得
 * @returns {Array<Object>} isModified=true のタブ配列
 */
function getUnsavedTabs() {
    ensureTabUnsavedState(getActiveTab());
    return tabs.filter(tab => tab.isModified);
}

/**
 * 未保存タブが1つ以上あるか判定
 * @returns {boolean}
 */
function hasUnsavedTabs() {
    return getUnsavedTabs().length > 0;
}

/**
 * ステータスバーを更新（タブ情報を表示）
 */
function updateStatusBar() {
    const tab = getActiveTab();
    if (!tab) return;

    // ステータスバーにファイルパスを表示
    if (currentFileSpan) {
        if (tab.filePath) {
            currentFileSpan.textContent = tab.filePath;
            currentFileSpan.title = tab.filePath;
        } else {
            currentFileSpan.textContent = '無題';
            currentFileSpan.title = '';
        }
    }
}

/**
 * キーボードショートカット: Cmd/Ctrl+N で新規タブ作成
 */
function setupTabKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Tab 関連キーのみを処理
        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        
        // Cmd/Ctrl+N: 新規タブ
        if (isCmdOrCtrl && e.key === 'n') {
            e.preventDefault();
            createTab(null, '無題', '<p><br></p>');
        }
        // Cmd/Ctrl+W: タブクローズ
        else if (isCmdOrCtrl && e.key === 'w') {
            e.preventDefault();
            if (activeTabId !== null) {
                closeTab(activeTabId);
            }
        }
        // Cmd/Ctrl+Tab: 次のタブへ移動
        else if (isCmdOrCtrl && e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            if (tabs.length > 0) {
                const currentIndex = tabs.findIndex(t => t.id === activeTabId);
                const nextIndex = (currentIndex + 1) % tabs.length;
                switchTab(tabs[nextIndex].id);
            }
        }
        // Cmd/Ctrl+Shift+Tab: 前のタブへ移動
        else if (isCmdOrCtrl && e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            if (tabs.length > 0) {
                const currentIndex = tabs.findIndex(t => t.id === activeTabId);
                const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                switchTab(tabs[prevIndex].id);
            }
        }
    });
}
