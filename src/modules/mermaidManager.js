/**
 * mermaidManager.js - Mermaid図の挿入・レンダリング・編集・モード管理
 *
 * 9関数 + DOMContentLoaded リスナーを提供する。
 * グローバル依存: editor (DOM), mermaid (Mermaid library),
 *   escapeHtml() (utils.js), markModified(), saveEditorState() (main.js)
 *
 * Phase 2-1 で src/main.js から分離。
 */

// Mermaid挿入ボタンの処理
document.addEventListener('DOMContentLoaded', () => {
    const mermaidBtn = document.getElementById('mermaidBtn');
    if (mermaidBtn) {
        mermaidBtn.addEventListener('click', () => {
            showMermaidInsertDialog();
        });
    }
});

function showMermaidInsertDialog() {
    // シンプルなテンプレートを初期値に
    const template = [
        'graph TD',
        '  A[Start] --> B{Is it working?}',
        '  B -- Yes --> C[Great!]',
        '  B -- No --> D[Check again]'
    ].join('\n');
    
    // モーダルダイアログを直接作成（ラジオボタンが必要なため）
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    overlay.innerHTML = 
        '<div class="modal-dialog" style="min-width:500px">' +
        '<div class="modal-title">Mermaid図を挿入</div>' +
        '<div class="modal-field">' +
        '<label>Mermaid記法</label>' +
        '<textarea id="mermaidInput" style="width:100%;height:200px;font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:4px;resize:vertical;font-size:13px;line-height:1.5;box-sizing:border-box">' + template + '</textarea>' +
        '</div>' +
        '<div class="modal-buttons">' +
        '<button class="modal-btn modal-btn-cancel" id="mermaidCancel">キャンセル</button>' +
        '<button class="modal-btn modal-btn-ok" id="mermaidOk">OK</button>' +
        '</div></div>';

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#mermaidInput');
    setTimeout(() => textarea.focus(), 50);

    overlay.querySelector('#mermaidOk').addEventListener('click', () => {
        const source = textarea.value.trim();
        overlay.remove();
        if (!source) return;
        insertMermaidBlock(source, 'code-and-diagram');
    });

    overlay.querySelector('#mermaidCancel').addEventListener('click', () => {
        overlay.remove();
    });

    // Escキーでキャンセル
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function insertMermaidBlock(source, mode = 'code-and-diagram') {
    // コンテナを直接作成してエディタに挿入する
    // （setMarkdown経由だとrenderMermaidBlocksとのレースコンディションが発生するため）
    let container;

    if (mode === 'diagram-only') {
        container = document.createElement('div');
        container.className = 'mermaid-diagram-only';
        container.setAttribute('data-mermaid-source', source);
        container.setAttribute('contenteditable', 'false');
    } else {
        container = document.createElement('div');
        container.className = 'mermaid-code-and-diagram';
        container.setAttribute('data-mermaid-source', source);
        container.setAttribute('contenteditable', 'false');
        container.innerHTML = '<div class="mermaid-display"></div><pre><code class="language-mermaid"></code></pre>';
        container.querySelector('code').textContent = source;
    }

    // エディタの末尾に挿入
    editor.appendChild(container);

    // コンテナの前に空の段落を確保（前方にカーソルを置けるようにする）
    if (!container.previousElementSibling) {
        const pBefore = document.createElement('p');
        pBefore.innerHTML = '<br>';
        container.parentNode.insertBefore(pBefore, container);
    }

    // コンテナの後ろに空の段落を確保（後方にカーソルを置けるようにする）
    if (!container.nextElementSibling) {
        const pAfter = document.createElement('p');
        pAfter.innerHTML = '<br>';
        container.parentNode.insertBefore(pAfter, container.nextSibling);
    }

    // Mermaidをレンダリング
    renderMermaidBlocks();

    markModified();
    saveEditorState && saveEditorState();
}

// ========== Mermaid Rendering ==========
async function renderMermaidBlocks() {
    // Mermaidライブラリがまだロードされていない場合は、最大10回まで再試行
    if (typeof mermaid === 'undefined') {
        if (!renderMermaidBlocks.retryCount) renderMermaidBlocks.retryCount = 0;
        if (renderMermaidBlocks.retryCount < 10) {
            renderMermaidBlocks.retryCount++;
            setTimeout(renderMermaidBlocks, 200);
        } else {
            console.error('Mermaidライブラリのロードに失敗しました。');
        }
        return;
    }
    renderMermaidBlocks.retryCount = 0;

    // Ensure mermaid is initialized
    try {
        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    } catch (e) { /* already initialized */ }

    // 1. コード表示のみモード（通常の言語ブロック）
    // ※ .mermaid-code-and-diagram 内部のコードブロックは除外する
    const codeBlocks = editor.querySelectorAll('pre code.language-mermaid');
    for (let i = 0; i < codeBlocks.length; i++) {
        const code = codeBlocks[i];
        const pre = code.parentElement;
        // .mermaid-code-and-diagram 内のコードブロックはスキップ（セクション3で処理）
        if (pre.closest('.mermaid-code-and-diagram')) continue;
        const source = code.textContent.trim();

        try {
            const id = 'mermaid-' + Date.now() + '-' + i;
            const { svg } = await mermaid.render(id, source);

            const container = document.createElement('div');
            container.className = 'mermaid-container';
            container.setAttribute('data-mermaid-source', source);
            container.setAttribute('data-mermaid-mode', 'code-only');
            container.setAttribute('contenteditable', 'false');
            container.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
            
            // モード変更ボタンを追加
            addMermaidModeButton(container, source);

            // Double-click to edit
            container.addEventListener('dblclick', () => {
                editMermaidBlock(container);
            });

            pre.parentNode.replaceChild(container, pre);
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    }

    // 2. 図形のみ表示モード
    const diagramOnlyContainers = editor.querySelectorAll('.mermaid-diagram-only');
    for (let i = 0; i < diagramOnlyContainers.length; i++) {
        const container = diagramOnlyContainers[i];
        if (container.getAttribute('data-mermaid-rendered') === 'true') continue; // 既にレンダリング済み

        const source = container.getAttribute('data-mermaid-source') || '';
        if (!source) continue;

        try {
            const id = 'mermaid-diagram-' + Date.now() + '-' + i;
            const { svg } = await mermaid.render(id, source);

            container.setAttribute('data-mermaid-rendered', 'true');
            container.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
            container.classList.add('mermaid-container');
            
            // モード変更ボタンを追加
            addMermaidModeButton(container, source);

            // Double-click to edit
            container.addEventListener('dblclick', () => {
                editMermaidDiagramOnly(container);
            });
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    }

    // 3. コード＋図形表示モード
    const codeAndDiagramContainers = editor.querySelectorAll('.mermaid-code-and-diagram');
    for (let i = 0; i < codeAndDiagramContainers.length; i++) {
        const container = codeAndDiagramContainers[i];
        if (container.getAttribute('data-mermaid-rendered') === 'true') continue; // 既にレンダリング済み

        const source = container.getAttribute('data-mermaid-source') || '';
        if (!source) continue;

        try {
            const id = 'mermaid-both-' + Date.now() + '-' + i;
            const { svg } = await mermaid.render(id, source);

            container.setAttribute('data-mermaid-rendered', 'true');
            const displayDiv = container.querySelector('.mermaid-display');
            if (displayDiv) {
                displayDiv.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
                displayDiv.classList.add('mermaid-svg-wrapper');
            }
            
            // モード変更ボタンを追加
            addMermaidModeButton(container, source);

            // Double-click to edit
            container.addEventListener('dblclick', () => {
                editMermaidCodeAndDiagram(container);
            });
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    }

    // 全Mermaidコンテナの前後に空の段落を確保（カーソルを置けるようにする）
    const allMermaidContainers = editor.querySelectorAll('.mermaid-container, .mermaid-diagram-only, .mermaid-code-and-diagram');
    allMermaidContainers.forEach(container => {
        if (!container.previousElementSibling) {
            const pBefore = document.createElement('p');
            pBefore.innerHTML = '<br>';
            container.parentNode.insertBefore(pBefore, container);
        }
        if (!container.nextElementSibling) {
            const pAfter = document.createElement('p');
            pAfter.innerHTML = '<br>';
            container.parentNode.insertBefore(pAfter, container.nextSibling);
        }
    });
}

// Mermaidコンテナにモード変更ボタンを追加
function addMermaidModeButton(container, source) {
    // 既に追加済みの場合はスキップ
    if (container.querySelector('.mermaid-mode-button')) return;
    
    const btn = document.createElement('button');
    btn.className = 'mermaid-mode-button';
    btn.innerHTML = '📋';
    btn.title = '表示モードを変更';
    btn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 50px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 100;
    `;
    
    container.style.position = 'relative';
    container.appendChild(btn);
    
    // ホバー時に表示
    container.addEventListener('mouseenter', () => {
        btn.style.opacity = '1';
    });
    container.addEventListener('mouseleave', () => {
        btn.style.opacity = '0';
    });
    
    // クリックでメニュー表示
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showMermaidModeMenu(container, source);
    });
}

// Mermaidモード変更メニューを表示
function showMermaidModeMenu(container, source) {
    // 既存のメニューを削除
    const existingMenu = document.querySelector('.mermaid-mode-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'mermaid-mode-menu';
    menu.style.cssText = `
        position: absolute;
        top: 32px;
        right: 50px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 180px;
        overflow: hidden;
    `;
    
    const modes = [
        { value: 'diagram-only', label: '図形のみ表示' },
        { value: 'code-and-diagram', label: 'コード＋図形表示' }
    ];
    
    modes.forEach(mode => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid #f0f0f0;
            transition: background-color 0.2s;
        `;
        item.textContent = mode.label;
        
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = '#f0f0f0';
        });
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
        });
        
        item.addEventListener('click', () => {
            changeMermaidMode(container, source, mode.value);
            menu.remove();
        });
        
        menu.appendChild(item);
    });
    
    container.appendChild(menu);
    
    // メニュー外クリックで閉じる
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !container.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Mermaidのモードを変更
async function changeMermaidMode(container, source, newMode) {
    const oldClass = container.className;
    const isCodeOnly = oldClass.includes('mermaid-container') && !oldClass.includes('diagram-only') && !oldClass.includes('code-and-diagram');
    const isDiagramOnly = oldClass.includes('mermaid-diagram-only');
    const isCodeAndDiagram = oldClass.includes('mermaid-code-and-diagram');
    
    // 新しいコンテナを作成
    let newContainer;
    
    if (newMode === 'diagram-only') {
        // 図形のみ表示に変換
        newContainer = document.createElement('div');
        newContainer.className = 'mermaid-diagram-only';
        newContainer.setAttribute('data-mermaid-source', source);
        newContainer.setAttribute('contenteditable', 'false');
        
        try {
            const id = 'mermaid-mode-change-' + Date.now();
            const { svg } = await mermaid.render(id, source);
            newContainer.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
        } catch (err) {
            console.error('Mermaid render error:', err);
            return;
        }
    } else if (newMode === 'code-and-diagram') {
        // コード＋図形表示に変換
        newContainer = document.createElement('div');
        newContainer.className = 'mermaid-code-and-diagram';
        newContainer.setAttribute('data-mermaid-source', source);
        newContainer.setAttribute('contenteditable', 'false');
        newContainer.innerHTML = '<div class="mermaid-display"></div><pre><code class="language-mermaid"></code></pre>';
        newContainer.querySelector('code').textContent = source;
        
        try {
            const id = 'mermaid-mode-change-' + Date.now();
            const { svg } = await mermaid.render(id, source);
            const displayDiv = newContainer.querySelector('.mermaid-display');
            displayDiv.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
            displayDiv.classList.add('mermaid-svg-wrapper');
        } catch (err) {
            console.error('Mermaid render error:', err);
            return;
        }
    }
    
    // モード変更ボタンを追加
    addMermaidModeButton(newContainer, source);
    
    // ダブルクリック編集イベントを追加
    if (newMode === 'diagram-only') {
        newContainer.addEventListener('dblclick', () => editMermaidDiagramOnly(newContainer));
    } else if (newMode === 'code-and-diagram') {
        newContainer.addEventListener('dblclick', () => editMermaidCodeAndDiagram(newContainer));
    }
    
    // 古いコンテナを新しいコンテナに置き換える
    container.parentNode.replaceChild(newContainer, container);
    
    markModified();
}


function editMermaidBlock(container) {
    const source = container.getAttribute('data-mermaid-source') || '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    overlay.innerHTML =
        '<div class="modal-dialog" style="min-width:500px">' +
        '<div class="modal-title">Mermaid図を編集</div>' +
        '<div class="modal-field">' +
        '<label>Mermaid記法</label>' +
        '<textarea id="mermaidEditArea" style="width:100%;height:200px;font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:4px;resize:vertical;font-size:13px;line-height:1.5;box-sizing:border-box">' +
        escapeHtml(source) + '</textarea>' +
        '</div>' +
        '<div class="modal-buttons">' +
        '<button class="modal-btn modal-btn-cancel" id="mermaidCancel">キャンセル</button>' +
        '<button class="modal-btn modal-btn-ok" id="mermaidOk">OK</button>' +
        '</div></div>';

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#mermaidEditArea');
    setTimeout(() => textarea.focus(), 50);

    overlay.querySelector('#mermaidOk').addEventListener('click', async () => {
        const newSource = textarea.value.trim();
        overlay.remove();
        if (!newSource) return;

        try {
            const id = 'mermaid-edit-' + Date.now();
            const { svg } = await mermaid.render(id, newSource);
            container.setAttribute('data-mermaid-source', newSource);
            container.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
            container.addEventListener('dblclick', () => editMermaidBlock(container));
            markModified();
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    });

    overlay.querySelector('#mermaidCancel').addEventListener('click', () => {
        overlay.remove();
        editor.focus();
    });

    // Enter in textarea should be allowed (new line), Escape closes
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            overlay.remove();
            editor.focus();
        }
    });
}

// 図形のみ表示モード用の編集関数
async function editMermaidDiagramOnly(container) {
    const source = container.getAttribute('data-mermaid-source') || '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    overlay.innerHTML =
        '<div class="modal-dialog" style="min-width:500px">' +
        '<div class="modal-title">Mermaid図を編集（図形のみ表示）</div>' +
        '<div class="modal-field">' +
        '<label>Mermaid記法</label>' +
        '<textarea id="mermaidEditArea" style="width:100%;height:200px;font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:4px;resize:vertical;font-size:13px;line-height:1.5;box-sizing:border-box">' +
        escapeHtml(source) + '</textarea>' +
        '</div>' +
        '<div class="modal-buttons">' +
        '<button class="modal-btn modal-btn-cancel" id="mermaidCancel">キャンセル</button>' +
        '<button class="modal-btn modal-btn-ok" id="mermaidOk">OK</button>' +
        '</div></div>';

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#mermaidEditArea');
    setTimeout(() => textarea.focus(), 50);

    overlay.querySelector('#mermaidOk').addEventListener('click', async () => {
        const newSource = textarea.value.trim();
        overlay.remove();
        if (!newSource) return;

        try {
            const id = 'mermaid-diagram-edit-' + Date.now();
            const { svg } = await mermaid.render(id, newSource);
            container.setAttribute('data-mermaid-source', newSource);
            container.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
            container.addEventListener('dblclick', () => editMermaidDiagramOnly(container));
            markModified();
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    });

    overlay.querySelector('#mermaidCancel').addEventListener('click', () => {
        overlay.remove();
        editor.focus();
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            overlay.remove();
            editor.focus();
        }
    });
}

// コード＋図形表示モード用の編集関数
async function editMermaidCodeAndDiagram(container) {
    const source = container.getAttribute('data-mermaid-source') || '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    overlay.innerHTML =
        '<div class="modal-dialog" style="min-width:500px">' +
        '<div class="modal-title">Mermaid図を編集（コード＋図形表示）</div>' +
        '<div class="modal-field">' +
        '<label>Mermaid記法</label>' +
        '<textarea id="mermaidEditArea" style="width:100%;height:200px;font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:4px;resize:vertical;font-size:13px;line-height:1.5;box-sizing:border-box">' +
        escapeHtml(source) + '</textarea>' +
        '</div>' +
        '<div class="modal-buttons">' +
        '<button class="modal-btn modal-btn-cancel" id="mermaidCancel">キャンセル</button>' +
        '<button class="modal-btn modal-btn-ok" id="mermaidOk">OK</button>' +
        '</div></div>';

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#mermaidEditArea');
    setTimeout(() => textarea.focus(), 50);

    overlay.querySelector('#mermaidOk').addEventListener('click', async () => {
        const newSource = textarea.value.trim();
        overlay.remove();
        if (!newSource) return;

        try {
            const id = 'mermaid-both-edit-' + Date.now();
            const { svg } = await mermaid.render(id, newSource);
            container.setAttribute('data-mermaid-source', newSource);
            
            const displayDiv = container.querySelector('.mermaid-display');
            if (displayDiv) {
                displayDiv.innerHTML = '<div class="mermaid-label">Mermaid</div>' + svg;
            }
            
            const codeBlock = container.querySelector('code.language-mermaid');
            if (codeBlock) {
                codeBlock.textContent = newSource;
            }
            
            container.addEventListener('dblclick', () => editMermaidCodeAndDiagram(container));
            markModified();
        } catch (err) {
            console.error('Mermaid render error:', err);
        }
    });

    overlay.querySelector('#mermaidCancel').addEventListener('click', () => {
        overlay.remove();
        editor.focus();
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            overlay.remove();
            editor.focus();
        }
    });
}
