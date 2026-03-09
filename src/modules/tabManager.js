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
                    'div', 'span', 'input',
                ],
                ALLOWED_ATTR: [
                    'href', 'title', 'src', 'alt', 'width', 'height',
                    'class', 'id', 'style',
                    'type', 'checked', 'disabled',
                    'open',
                    'contenteditable',
                    'data-mermaid-source', 'data-math', 'data-wrap',
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
    editor.parentElement.scrollTop = tab.scrollTop;
    
    // エディタが編集可能要素で始まることを確認
    ensureEditableStart();
    
    // タブ切り替え時にUndo/Redoスタックをリセット
    undoStack = [];
    redoStack = [];
    currentState = null;
    saveEditorState(); // 保存状態の初期化

    // チェックボックスをインタラクティブにする
    editor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.removeAttribute('disabled');
    });

    // コードブロックをハイライト
    editor.querySelectorAll('pre code').forEach(block => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
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
    
    // コード折り返し状態を復元
    restoreCodeWrapStates();

    // 画像エラーハンドリングをセットアップ
    setupImageErrorHandling();

    renderTabs();
    updateWordCount();
    updateStatusBar();
}

/**
 * タブをクローズ
 * @param {number} id - クローズするタブのID
 */
function closeTab(id) {
    const tabIndex = tabs.findIndex(t => t.id === id);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];

    // confirm() がエディタ内容をクリアする場合に備え、アクティブタブの内容を保存
    let savedContent = null;
    let savedScrollTop = 0;
    const activeTab = getActiveTab();
    if (activeTab && editor) {
        savedContent = editor.innerHTML;
        savedScrollTop = editor.parentElement.scrollTop;
        activeTab.content = savedContent;
        activeTab.scrollTop = savedScrollTop;
    }

    // 保存されていない場合は確認
    if (tab.isModified) {
        const ok = confirm('"' + tab.title + '" は保存されていません。閉じますか？');

        // confirm() 後にエディタ内容を復元（WebViewがクリアする場合がある）
        if (savedContent !== null && editor) {
            editor.innerHTML = savedContent;
            editor.parentElement.scrollTop = savedScrollTop;
        }

        if (!ok) return;
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
function renderTabs() {
    if (!tabList) return;
    tabList.innerHTML = '';

    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
        el.title = tab.filePath || tab.title;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.textContent = tab.title;
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
 * 未保存タブ一覧を取得
 * @returns {Array<Object>} isModified=true のタブ配列
 */
function getUnsavedTabs() {
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
