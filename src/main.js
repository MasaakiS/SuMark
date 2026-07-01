// insertTextAtCursor: カーソル位置にテキストを挿入するユーティリティ
function insertTextAtCursor(text) {
    const sel = window.getSelection();

    // 選択範囲がない場合は editor 末尾へ挿入
    if (!sel.rangeCount) {
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    // 挿入したテキストの後ろにカーソルを移動
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
}
// =====================================================
// SuMark - メインアプリケーションロジック
// =====================================================

// グローバルエラーバナー管理
let errorBanner = null;
let errorBannerTimeout = null;
let lastErrorTime = 0;
const ERROR_THROTTLE_MS = 500;  // エラー連打時のスパム表示を抑制

// デバッグ用のグローバルエラーハンドラ
window.onerror = function(msg, url, line, col, error) {
    console.error('Global error:', msg, 'at', url, ':', line, ':', col);
    
    // 直前エラーからERROR_THROTTLE_MS以内なら抑制
    const now = Date.now();
    if (now - lastErrorTime < ERROR_THROTTLE_MS) {
        return;  // このエラーは無視
    }
    lastErrorTime = now;
    
    // エラーバナーを生成または再利用
    if (!errorBanner) {
        errorBanner = document.createElement('div');
        errorBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc3545;color:white;padding:12px;z-index:99999;font-size:14px;display:flex;justify-content:space-between;align-items:center';
        errorBanner.innerHTML = '';
        document.body.appendChild(errorBanner);
    }
    
    // エラーメッセージを更新
    const errorMsg = 'JS Error: ' + msg + ' (line ' + line + ')';
    errorBanner.textContent = errorMsg;
    
    // 既存タイマーをクリアして再設定
    if (errorBannerTimeout) {
        clearTimeout(errorBannerTimeout);
    }
    errorBannerTimeout = setTimeout(function() {
        if (errorBanner && errorBanner.parentNode) {
            errorBanner.remove();
            errorBanner = null;
        }
        errorBannerTimeout = null;
    }, 5000);  // 5秒後に自動で閉じる
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    // 未処理Promise拒否をエラーハンドラへ流す
    window.onerror('Unhandled Promise Rejection: ' + String(event.reason), window.location.href, 0, 0, event.reason);
});

// ========== トーストバナー ==========
// 種別: 'warn'（黄, 3秒）| 'error'（赤, 5秒）
function showBanner(message, type) {
    const isWarn = type !== 'error';
    const bg = isWarn ? '#ffc107' : '#dc3545';
    const color = isWarn ? '#333' : '#fff';
    const duration = isWarn ? 3000 : 5000;

    const banner = document.createElement('div');
    banner.setAttribute('data-banner-type', type || 'warn');
    banner.style.cssText = [
        'position:fixed',
        'top:8px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:' + bg,
        'color:' + color,
        'padding:10px 20px',
        'border-radius:6px',
        'z-index:99998',
        'font-size:14px',
        'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
        'min-width:200px',
        'max-width:480px',
        'text-align:center',
        'pointer-events:none',
    ].join(';');
    banner.textContent = message;
    document.body.appendChild(banner);

    setTimeout(function() {
        if (banner.parentNode) banner.remove();
    }, duration);
}

function showWarn(message) { showBanner(message, 'warn'); }
function showError(message) { showBanner(message, 'error'); }

// ========== State ==========
let isConverting = false; // 自動変換の再帰を防ぐガード
let isComposing = false; // IME変換中フラグ
let initRetryCount = 0;
const INIT_RETRY_MAX = 50;
const INIT_RETRY_DELAY_MS = 100;
let programmaticEditorUpdateDepth = 0;
let isProgrammaticEditorUpdate = false;

let inputCharCount = 0; // 連続入力カウンタ
let isProcessingDrop = false; // ドロップ処理の重複防止ガード

// ========== Emoji Map ==========
const EMOJI_MAP = {
    'smile': '😄', 'laughing': '😆', 'blush': '😊', 'smiley': '😃',
    'relaxed': '☺️', 'smirk': '😏', 'heart_eyes': '😍', 'kissing_heart': '😘',
    'flushed': '😳', 'relieved': '😌', 'grin': '😁', 'wink': '😉',
    'stuck_out_tongue_winking_eye': '😜', 'stuck_out_tongue': '😛',
    'grinning': '😀', 'kissing': '😗', 'sleeping': '😴',
    'worried': '😟', 'open_mouth': '😮', 'grimacing': '😬', 'confused': '😕',
    'hushed': '😯', 'expressionless': '😑', 'unamused': '😒',
    'sweat_smile': '😅', 'sweat': '😓', 'weary': '😩', 'pensive': '😔',
    'disappointed': '😞', 'fearful': '😨', 'cold_sweat': '😰', 'cry': '😢',
    'sob': '😭', 'joy': '😂', 'astonished': '😲', 'scream': '😱',
    'angry': '😠', 'rage': '😡', 'triumph': '😤', 'sleepy': '😪',
    'yum': '😋', 'mask': '😷', 'sunglasses': '😎', 'dizzy_face': '😵',
    'imp': '👿', 'smiling_imp': '😈', 'neutral_face': '😐', 'no_mouth': '😶',
    'innocent': '😇', 'alien': '👽', 'thinking': '🤔', 'nerd': '🤓',
    'rolling_eyes': '🙄', 'upside_down': '🙃', 'robot': '🤖',
    'heart': '❤️', 'broken_heart': '💔', 'star': '⭐', 'star2': '🌟',
    'sparkles': '✨', 'fire': '🔥', 'thumbsup': '👍', '+1': '👍',
    'thumbsdown': '👎', '-1': '👎', 'ok_hand': '👌', 'punch': '👊',
    'fist': '✊', 'v': '✌️', 'wave': '👋', 'hand': '✋',
    'raised_hands': '🙌', 'pray': '🙏', 'clap': '👏', 'muscle': '💪',
    'point_up': '☝️', 'point_down': '👇', 'point_left': '👈', 'point_right': '👉',
    'dog': '🐶', 'cat': '🐱', 'mouse': '🐭', 'rabbit': '🐰',
    'tiger': '🐯', 'bear': '🐻', 'pig': '🐷', 'monkey': '🐵',
    'bird': '🐦', 'penguin': '🐧', 'fish': '🐟', 'whale': '🐳',
    'sunny': '☀️', 'cloud': '☁️', 'umbrella': '☂️', 'snowflake': '❄️',
    'zap': '⚡', 'rainbow': '🌈', 'cyclone': '🌀',
    'apple': '🍎', 'cherries': '🍒', 'grapes': '🍇', 'watermelon': '🍉',
    'pizza': '🍕', 'hamburger': '🍔', 'coffee': '☕', 'beer': '🍺',
    'wine_glass': '🍷', 'cocktail': '🍸',
    'tada': '🎉', 'balloon': '🎈', 'gift': '🎁', 'trophy': '🏆',
    'gem': '💎', 'bulb': '💡', 'wrench': '🔧', 'hammer': '🔨',
    'rocket': '🚀', 'airplane': '✈️', 'car': '🚗', 'bus': '🚌', 'bike': '🚲',
    'warning': '⚠️', 'x': '❌', 'o': '⭕', 'check': '✅',
    'heavy_check_mark': '✔️', 'question': '❓', 'exclamation': '❗',
    'lock': '🔒', 'unlock': '🔓', 'key': '🔑', 'bell': '🔔',
    'link': '🔗', 'pencil': '✏️', 'memo': '📝', 'book': '📖',
    'books': '📚', 'clipboard': '📋', 'calendar': '📅',
    'chart': '📊', 'email': '📧', 'phone': '📱', 'computer': '💻',
    'globe': '🌍', 'earth': '🌎', 'earth_asia': '🌏',
    'white_check_mark': '✅', 'hundred': '💯', 'eyes': '👀',
    'skull': '💀', 'ghost': '👻', 'poop': '💩',
    'red_circle': '🔴', 'blue_circle': '🔵', 'white_circle': '⚪', 'black_circle': '⚫',
    'arrow_up': '⬆️', 'arrow_down': '⬇️', 'arrow_left': '⬅️', 'arrow_right': '➡️',
};

// Tauri API
let invoke, tauriOpen, tauriSave, readTextFile, writeTextFile, readBinaryFile, writeBinaryFile, createDir, readDir, exists, shellOpen, convertFileSrc;

// DOM要素
let editor, wordCountSpan;

// ========== デバッグ補助 ==========
function testConvertFileSrc(path) {
    // asset:// URLを生成するTauriネイティブのconvertFileSrcを使用
    // Tauri推奨の安全な経路を使う
    const assetUrl = convertFileSrc(path);
    console.log('[TEST convertFileSrc] input path:', path);
    console.log('[TEST convertFileSrc] output asset URL:', assetUrl);
    return assetUrl;
}

/**
 * グローバル状態をリセット（ページロード後など）
 * 複数テスト連続実行時のメモリリーク・グローバル状態競合を防止
 */
function resetGlobalState() {
    // Mermaid レンダリングのリトライカウンターをリセット
    if (typeof renderMermaidBlocks !== 'undefined' && renderMermaidBlocks.retryCount) {
        renderMermaidBlocks.retryCount = 0;
    }
    
    // IME 合成フラグをリセット
    isComposing = false;
    
    // 自動変換フラグをリセット
    isConverting = false;

    console.log('[resetGlobalState] グローバル状態をリセット完了');
}

function beginProgrammaticEditorUpdate() {
    programmaticEditorUpdateDepth += 1;
    isProgrammaticEditorUpdate = true;
}

function endProgrammaticEditorUpdate() {
    if (programmaticEditorUpdateDepth > 0) {
        programmaticEditorUpdateDepth -= 1;
    }

    if (programmaticEditorUpdateDepth === 0) {
        requestAnimationFrame(() => {
            if (programmaticEditorUpdateDepth === 0) {
                isProgrammaticEditorUpdate = false;
            }
        });
    }
}

// ========== 初期化 ==========
function init() {
    console.log('=== WYSIWYG Editor Initialization ===');

    // Tauri API
    try {
        if (!window.__TAURI__) {
            const isLikelyTauriRuntime =
                (typeof window.__TAURI_IPC__ === 'function') ||
                (typeof navigator !== 'undefined' && /tauri/i.test(navigator.userAgent || ''));

            // 低速環境（例: Linux ARM64）ではブリッジ注入が遅れることがあるため
            // Tauri環境の可能性が高い場合のみリトライする
            if (isLikelyTauriRuntime && initRetryCount < INIT_RETRY_MAX) {
                initRetryCount += 1;
                if (initRetryCount === 1 || initRetryCount % 10 === 0) {
                    console.warn(`[INIT] Waiting for Tauri bridge... (${initRetryCount}/${INIT_RETRY_MAX})`);
                }
                setTimeout(init, INIT_RETRY_DELAY_MS);
                return;
            }

            console.warn('[WARN] Tauri API not available - running in browser mode with limited functionality');
            // ブラウザ検証向けにTauri APIをモック
            invoke = () => Promise.resolve();
            tauriOpen = () => Promise.resolve(null);
            tauriSave = () => Promise.resolve(null);
            readTextFile = () => Promise.resolve('');
            writeTextFile = () => Promise.resolve();
            readBinaryFile = () => Promise.resolve(new Uint8Array());
            writeBinaryFile = () => Promise.resolve();
            createDir = () => Promise.resolve();
            readDir = () => Promise.resolve([]);
            exists = () => Promise.resolve(false);
            convertFileSrc = (path) => path;
            shellOpen = () => Promise.resolve();
            // ここではreturnせず初期化を継続する
        } else {
            initRetryCount = 0;
            invoke = window.__TAURI__.tauri.invoke;
            tauriOpen = window.__TAURI__.dialog.open;
            tauriSave = window.__TAURI__.dialog.save;
            readTextFile = window.__TAURI__.fs.readTextFile;
            writeTextFile = window.__TAURI__.fs.writeTextFile;
            readBinaryFile = window.__TAURI__.fs.readBinaryFile;
            writeBinaryFile = window.__TAURI__.fs.writeBinaryFile;
            createDir = window.__TAURI__.fs.createDir;
            readDir = window.__TAURI__.fs.readDir;
            exists = window.__TAURI__.fs.exists;
            convertFileSrc = window.__TAURI__.tauri.convertFileSrc;
            shellOpen = window.__TAURI__.shell.open;
            console.log('Tauri APIs OK');

            // アプリ名の横にバージョンを表示
            (async () => {
                try {
                    const appName = await window.__TAURI__.app.getName();
                    const appVersion = await window.__TAURI__.app.getVersion();
                    document.title = `${appName} v${appVersion}`;
                    if (window.__TAURI__.window && window.__TAURI__.window.appWindow) {
                        window.__TAURI__.window.appWindow.setTitle(`${appName} v${appVersion}`);
                    }
                } catch (vErr) {
                    console.warn('Could not set version in title:', vErr);
                }
            })();
        }
    } catch (err) {
        console.error('Tauri API init failed:', err);
        return;
    }

    // DOM要素
    editor = document.getElementById('editor');
    wordCountSpan = document.getElementById('wordCount');

    // タブマネージャを初期化（currentFileSpan, tabList）
    initTabManager();

    if (!editor) {
        console.error('Editor element not found');
        return;
    }

    // Markedを設定（Markdown → HTML）
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false,
        });
        console.log('Marked configured');
    }

    // Turndownを設定（HTML → Markdown）
    configureTurndown();

    // 既定の段落区切りを <p> に設定
    document.execCommand('defaultParagraphSeparator', false, 'p');

    // エディタを空段落で初期化
    editor.innerHTML = '<p><br></p>';

    // イベントリスナーを設定
    setupEventListeners();
    setupTableContextMenu();
    setupImageResize();
    setupImageViewer();
    setupCodeCopyButtons();
    setupImageErrorHandling();
    setupImageMutationObserver(); // エディタに追加された新規画像を監視
    // setupTabKeyboardShortcuts() は呼ばない（N/W は main.js handleKeyDown で処理済み）
    setupZoomKeyboardShortcuts();

    // Mermaidを初期化（defer読込で遅延する可能性あり）
    try {
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
            console.log('Mermaid initialized');
        } else {
            console.log('Mermaid not yet loaded, will initialize on first use');
        }
    } catch (err) {
        console.error('Mermaid init error:', err);
    }

    // 初期タブを作成
    createTab(null, '無題', '<p><br></p>');

    // 起動引数で渡されたファイルを開く（アプリアイコンへのドロップ/「このアプリで開く」）
    if (window.__TAURI__) {
        (async () => {
            try {
                const initialFiles = await invoke('get_initial_files');
                if (initialFiles && initialFiles.length > 0) {
                    for (const filePath of initialFiles) {
                        // ファイル名部分だけから拡張子を抽出（ディレクトリ名のドットを誤検知しない）
                        const filename = filePath.split('/').pop().split('\\').pop();
                        const ext = filename.split('.').pop().toLowerCase();
                        if (['md', 'markdown', 'txt'].includes(ext)) {
                            await openFileFromPath(filePath);
                        }
                    }
                }
            } catch (err) {
                console.warn('[INIT] Could not retrieve initial files:', err);
            }
        })();
    }

    // 初期状態を反映
    updateWordCount();
    editor.focus();
}

// configureTurndown(), getMarkdown(), preprocessNotionMarkdown(), _normalizeNotionTable(), setMarkdown() → modules/markdown.js に移動済み

// getCaretCharacterOffsetWithin(), setCaretCharacterOffset(), highlightCodeBlock(), highlightAllCodeBlocks() は src/codeHighlight.js に移動済み

// エディタ先頭が編集可能要素になるよう補正
function ensureEditableStart() {
    if (!editor || editor.children.length === 0) {
        return;
    }
    
    const firstChild = editor.firstElementChild;
    // 先頭が編集しづらいブロック要素かどうか確認
    const blockElements = ['PRE', 'TABLE', 'UL', 'OL', 'BLOCKQUOTE', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    
    if (firstChild && blockElements.includes(firstChild.tagName)) {
        // 先頭に空段落を挿入
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editor.insertBefore(p, firstChild);
    }
}

// updateLineNumbers(), updateAllLineNumbers(), debouncedHighlightCodeAtCursor() は src/codeHighlight.js に移動済み

// isOnEmptyTrailingLine(), removeTrailingEmptyLines() は src/nodeUtils.js に移動済み

// ========== イベントリスナー ==========
function setupEventListeners() {
    // すべてのツールバーボタンでフォーカス奪取を防止
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
    });

    // エディタ関連イベント
    editor.addEventListener('input', onEditorInput);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('compositionstart', () => { 
        console.log('[DEBUG] IME composition started');
        isComposing = true; 
    });
    editor.addEventListener('compositionend', () => {
        console.log('[DEBUG] IME composition ended');
        isComposing = false;
        // IME確定後に自動変換を実行
        onEditorInput();
    });

    // チェックボックス変更を委譲処理
    editor.addEventListener('change', e => {
        if (e.target.type === 'checkbox') {
            markModified();
        }
    });

    // URLがWeb URLか判定
    function isWebUrl(url) {
        if (!url) return false;
        // 安全なスキームのみを許可（javascript: / vbscript: などを除外）
        return /^https?:\/\//i.test(url) || /^mailto:/i.test(url);
    }

    const IN_APP_TEXT_EXTENSIONS = new Set([
        'md', 'markdown', 'txt', 'text', 'log',
        'csv', 'tsv',
        'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'conf', 'env',
        'xml', 'html', 'htm',
        'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'less',
        'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'php', 'sql',
        'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd',
        'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'cs', 'lua', 'r',
    ]);

    function getFileExtension(filePath) {
        const cleanPath = String(filePath || '').split(/[?#]/)[0].toLowerCase();
        const fileName = cleanPath.split('/').pop() || '';
        const dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex === fileName.length - 1) return '';
        return fileName.slice(dotIndex + 1);
    }

    function shouldOpenInEditor(filePath) {
        const ext = getFileExtension(filePath);
        return ext ? IN_APP_TEXT_EXTENSIONS.has(ext) : false;
    }

    // ローカルファイルパスを解決（相対パス対応）
    async function handleLocalFileLink(filePath) {
        try {
            let resolvedPath = filePath;
            
            // 相対パスなら現在ファイルのディレクトリ基準で解決
            if (!filePath.startsWith('/') && !filePath.startsWith('~') && !(/^[a-zA-Z]:/.test(filePath))) {
                // 相対パスを検出
                const currentTab = getActiveTab();
                const currentFile = currentTab?.filePath;
                if (currentFile) {
                    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
                    resolvedPath = resolveRelativePath(currentDir, filePath);
                } else {
                    showError('現在のファイルが不明なため、相対パスを解決できません');
                    return;
                }
            }
            
            // ファイル存在確認
            const fileExists = await exists(resolvedPath);
            if (!fileExists) {
                showError(`ファイルが見つかりません: ${resolvedPath}`);
                return;
            }
            
            // テキスト系はエディタで開き、それ以外はOS既定アプリで開く
            if (shouldOpenInEditor(resolvedPath)) {
                await openFileFromPath(resolvedPath);
            } else if (shellOpen) {
                await shellOpen(resolvedPath);
            } else {
                showError('ファイルを開けませんでした: ' + resolvedPath);
            }
        } catch (err) {
            console.error('Failed to handle local file link:', err);
            showError('ファイルを開く際にエラーが発生しました: ' + err.message);
        }
    }

    function normalizeAnchorToken(text) {
        if (!text) return '';
        return text
            .trim()
            .toLowerCase()
            .replace(/[\s\u3000]+/g, '-')
            .replace(/[^\w\u3000-\u9fff\uf900-\ufaff\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // ページ内ハッシュリンク（例: #section, ＃section）をエディタ内要素へ解決
    function resolveInPageHashTarget(href) {
        if (!href) return null;

        const trimmed = href.trim();
        if (!(trimmed.startsWith('#') || trimmed.startsWith('＃'))) {
            return null;
        }

        let hash = trimmed.substring(1);
        try {
            hash = decodeURIComponent(hash);
        } catch (_) {
            // デコード失敗時は生のハッシュ文字列を維持
        }
        hash = hash.trim();
        if (!hash) return null;

        const normalizedHash = normalizeAnchorToken(hash);
        const candidateIds = [hash];
        if (normalizedHash && normalizedHash !== hash) {
            candidateIds.push(normalizedHash);
        }
        if (normalizedHash) {
            candidateIds.push('heading-' + normalizedHash);
        }

        // まずID一致を優先
        for (const id of candidateIds) {
            const byId = editor.querySelector('#' + CSS.escape(id));
            if (byId) return byId;
        }

        // フォールバック: 同じ正規化規則で見出し文字列を比較
        const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const h of headings) {
            const headingText = h.textContent.trim();
            if (!headingText) continue;

            const normalizedHeading = normalizeAnchorToken(headingText);
            const normalizedHeadingWithPrefix = normalizedHeading ? ('heading-' + normalizedHeading) : '';

            if (
                headingText === hash ||
                normalizedHeading === normalizedHash ||
                normalizedHeadingWithPrefix === hash
            ) {
                return h;
            }
        }

        return null;
    }

    function scrollToAnchorTarget(targetEl) {
        if (!targetEl) return;
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 一時的にハイライト表示
        targetEl.style.transition = 'background-color 0.3s';
        targetEl.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
            targetEl.style.backgroundColor = '';
            setTimeout(() => { targetEl.style.transition = ''; }, 300);
        }, 1500);
    }

    // リンククリック処理 - Cmd/Ctrl+クリックでブラウザまたはローカルファイルを開く
    editor.addEventListener('click', e => {
        // トグル削除ボタン
        if (e.target.closest('.toggle-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const details = e.target.closest('details');
            if (details) {
                unwrapToggle(details);
            }
            return;
        }
        // TOC削除ボタン
        if (e.target.closest('.toc-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const tocContainer = e.target.closest('.toc-container');
            if (tocContainer) {
                tocContainer.remove();
                markModified();
            }
            return;
        }

        // TOCリンククリック時は見出しへスクロール
        const tocLink = e.target.closest('.toc-link');
        if (tocLink) {
            e.preventDefault();
            const targetEl = resolveInPageHashTarget(tocLink.getAttribute('href') || '');
            if (targetEl) {
                scrollToAnchorTarget(targetEl);
            } else {
                showWarn('ページ内リンクとして未解決: ' + (tocLink.getAttribute('href') || ''));
            }
            return;
        }

        // 非編集要素（TOC, Mermaidプレビュー）クリック時に選択状態にしてBackspace/Deleteで削除可能にする
        const nonEditable = e.target.closest('[contenteditable="false"]');
        if (nonEditable && nonEditable !== editor && editor.contains(nonEditable)) {
            // 非編集要素内の操作系コントロールには干渉しない
            if (e.target.closest('button, select, input, textarea')) return;
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNode(nonEditable);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        const link = e.target.closest('a');
        if (link) {
            const href = link.getAttribute('href') || '';
            const isInPageHash = href.trim().startsWith('#') || href.trim().startsWith('＃');

            // 通常のページ内Markdownリンクは通常クリックでジャンプ
            const inPageTarget = resolveInPageHashTarget(href);
            if (inPageTarget) {
                e.preventDefault();
                scrollToAnchorTarget(inPageTarget);
                return;
            }

            if (isInPageHash) {
                e.preventDefault();
                showWarn('ページ内リンクとして未解決: ' + href.trim());
                return;
            }

            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                const url = href || link.href;
                if (url) {
                    // Web URLかローカルファイルパスかを判定
                    if (isWebUrl(url)) {
                        // Web URLはブラウザで開く
                        if (shellOpen) {
                            shellOpen(url).catch(err => console.error('Failed to open URL:', err));
                        }
                    } else {
                        // ローカルファイルパスはエディタで開く
                        handleLocalFileLink(url);
                    }
                }
            }
        }
    });

    // ツールバーボタン
    const buttons = [
        { id: 'newBtn',       handler: newFile },
        { id: 'openBtn',      handler: openFile },
        { id: 'saveBtn',      handler: saveFile },
        { id: 'saveAsBtn',    handler: saveAsFile },
        { id: 'pdfBtn',       handler: exportPDF },
        { id: 'undoBtn',      handler: performUndo },
        { id: 'redoBtn',      handler: performRedo },
        { id: 'searchBtn',    handler: showFindDialog },
        { id: 'replaceBtn',   handler: showReplaceDialog },
        { id: 'boldBtn',      handler: () => document.execCommand('bold') },
        { id: 'italicBtn',    handler: () => document.execCommand('italic') },
        { id: 'strikeBtn',    handler: () => document.execCommand('strikethrough') },
        { id: 'codeBtn',      handler: applyInlineCode },
        { id: 'linkBtn',      handler: insertLink },
        { id: 'imageBtn',     handler: insertImage },
        { id: 'h1Btn',        handler: () => applyHeading(1) },
        { id: 'h2Btn',        handler: () => applyHeading(2) },
        { id: 'h3Btn',        handler: () => applyHeading(3) },
        { id: 'ulBtn',        handler: insertUnorderedList },
        { id: 'olBtn',        handler: insertOrderedList },
        { id: 'taskBtn',      handler: insertTaskList },
        { id: 'tableBtn',     handler: insertTable },
        { id: 'codeBlockBtn', handler: insertCodeBlock },
        { id: 'quoteBtn',     handler: applyBlockquote },
        { id: 'toggleBtn',    handler: insertToggle },
        { id: 'hrBtn',        handler: insertHorizontalRule },
        { id: 'dateBtn',      handler: insertDate },
        { id: 'timeBtn',      handler: insertTime },
        { id: 'datetimeBtn',  handler: insertDateTime },
        { id: 'tocBtn',       handler: insertTOC },
        { id: 'emojiBtn',     handler: showEmojiPicker },
    ];

    buttons.forEach(({ id, handler }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                handler();
                // 検索ダイアログはモードレスなので editor.focus() を行わない
                if (id !== 'searchBtn') {
                    editor.focus();
                }
            });
        }
    });

    console.log('Event listeners attached');
    
    // ファイルドロップイベント（Tauri v1 drag-and-drop対応）
    if (window.__TAURI__ && window.__TAURI__.event) {
        console.log('[DEBUG] Setting up Tauri file drop listeners...');
        
        // Tauri v1 のイベントAPIを使用
        window.__TAURI__.event.listen('tauri://file-drop', async (event) => {
            console.log('[DEBUG] File drop event received:', event);
            console.log('[DEBUG] Event payload:', event.payload);
            
            const files = event.payload;
            console.log('[DEBUG] Files:', files);
            
            if (files && Array.isArray(files)) {
                console.log('[DEBUG] Processing', files.length, 'dropped files');
                for (const filePath of files) {
                    console.log('[DEBUG] Processing file:', filePath);
                    // Markdownファイルか確認
                    const ext = filePath.split('.').pop().toLowerCase();
                    if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
                        try {
                            await openFileFromPath(filePath);
                            console.log('[DEBUG] Successfully opened:', filePath);
                        } catch (err) {
                            console.error('Error opening dropped file:', err);
                            showError('ファイルを開けませんでした: ' + filePath);
                        }
                    } else {
                        console.log('[INFO] Skipping non-Markdown file:', filePath);
                    }
                }
            } else {
                console.warn('[WARN] No files in drop event or invalid format');
            }
        });
        
        // ファイルドロップのホバーイベント（任意の視覚フィードバック）
        window.__TAURI__.event.listen('tauri://file-drop-hover', (event) => {
            console.log('[DEBUG] File drop hover:', event);
            document.body.style.outline = '3px dashed #007bff';
        });
        
        // ファイルドロップのキャンセルイベント
        window.__TAURI__.event.listen('tauri://file-drop-cancelled', (event) => {
            console.log('[DEBUG] File drop cancelled:', event);
            document.body.style.outline = '';
        });
        
        console.log('[DEBUG] Tauri file drop listeners registered');
    } else {
        console.log('[DEBUG] Tauri event API not available - file drop disabled');
    }
    
    // ========== 統合ファイルドロップ処理（非Tauri時のフォールバック） ==========
    // Tauri外（ブラウザ単体）ではHTML5 Drag & Dropでファイルドロップを処理する。
    // Tauriでは fileDropEnabled=true の場合に native tauri://file-drop が処理するため、
    // このハンドラは非Tauri環境向けフォールバックとしてのみ利用する。
    const setupUnifiedDropHandler = () => {
        console.log('[DEBUG] Setting up unified drop handlers...');

        // 補助: ドラッグ対象にファイル/ファイルURIが含まれるか判定
        const isFileDrag = (e) => {
            const types = Array.from(e.dataTransfer?.types || []);
            return types.includes('Files') || types.includes('text/uri-list');
        };

        // 補助: text/uri-list からファイルパスを抽出
        const parseUriList = (uriListStr) => {
            return uriListStr
                .split(/\r?\n/)
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => {
                    try {
                        const url = new URL(line.trim());
                        if (url.protocol === 'file:') {
                            return decodeURIComponent(url.pathname);
                        }
                    } catch (e) {}
                    return null;
                })
                .filter(Boolean);
        };

        // window dragover: ファイルドラッグを受け入れ、ブラウザ遷移を防止
        window.addEventListener('dragover', (e) => {
            if (isFileDrag(e)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                document.body.style.outline = '3px dashed #007bff';
            }
        });

        window.addEventListener('dragleave', (e) => {
            if (e.clientX === 0 && e.clientY === 0) {
                document.body.style.outline = '';
            }
        });

        // window drop: あらゆる入力元のファイルドロップを処理
        window.addEventListener('drop', async (e) => {
            document.body.style.outline = '';

            // ファイルドロップのみ処理し、テキストドロップはcontenteditableへ通す
            if (!isFileDrag(e)) return;

            e.preventDefault();
            e.stopPropagation();

            // Tauri かつ fileDropEnabled=true では native tauri://file-drop が処理する。
            // このHTML5ハンドラが発火しても重複処理を避けるためスキップする。
            if (window.__TAURI__ && window.__TAURI__.event) {
                console.log('[DEBUG] Tauri native file-drop is active, skipping HTML5 handler');
                return;
            }

            console.log('[DEBUG] ===== DROP EVENT (non-Tauri) =====');
            console.log('[DEBUG] dataTransfer.types:', Array.from(e.dataTransfer.types || []));
            console.log('[DEBUG] dataTransfer.files.length:', e.dataTransfer.files?.length);

            if (isProcessingDrop) {
                console.log('[DEBUG] Drop already in progress, skipping');
                return;
            }
            isProcessingDrop = true;

            try {
                let handled = false;

                // 1. まず text/uri-list を試す（VSCode Explorer、macOS Finder など）
                const uriList = e.dataTransfer.getData('text/uri-list');
                if (uriList) {
                    console.log('[DEBUG] text/uri-list:', uriList);
                    const filePaths = parseUriList(uriList);
                    for (const filePath of filePaths) {
                        const ext = filePath.split('.').pop().toLowerCase();
                        if (['md', 'markdown', 'txt'].includes(ext)) {
                            console.log('[DEBUG] Opening from URI:', filePath);
                            await openFileFromPath(filePath);
                            handled = true;
                        } else {
                            console.log('[INFO] Skipping unsupported file:', filePath);
                        }
                    }
                }

                if (handled) return;

                // 2. text/plain の file:// URI を試す（フォールバック）
                const plainText = e.dataTransfer.getData('text/plain');
                if (plainText && plainText.startsWith('file://')) {
                    console.log('[DEBUG] text/plain has file URI:', plainText);
                    const filePaths = parseUriList(plainText);
                    for (const filePath of filePaths) {
                        const ext = filePath.split('.').pop().toLowerCase();
                        if (['md', 'markdown', 'txt'].includes(ext)) {
                            await openFileFromPath(filePath);
                            handled = true;
                        }
                    }
                }

                if (handled) return;

                // 3. dataTransfer.files を試す（Finderドロップ）
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    console.log('[DEBUG] Processing', e.dataTransfer.files.length, 'files from dataTransfer.files');
                    for (const file of e.dataTransfer.files) {
                        console.log('[DEBUG] File:', file.name, 'type:', file.type, 'size:', file.size, 'path:', file.path || 'N/A');
                        await processDroppedFile(file);
                    }
                    return;
                }

                // 4. dataTransfer.items を試す
                if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                    console.log('[DEBUG] Processing items, count:', e.dataTransfer.items.length);
                    for (let i = 0; i < e.dataTransfer.items.length; i++) {
                        const item = e.dataTransfer.items[i];
                        console.log('[DEBUG] Item', i, '- kind:', item.kind, 'type:', item.type);
                        if (item.kind === 'file') {
                            const file = item.getAsFile();
                            if (file) await processDroppedFile(file);
                        }
                    }
                }
            } catch (err) {
                console.error('[ERROR] Drop handler:', err);
            } finally {
                isProcessingDrop = false;
            }
        });

        console.log('[DEBUG] Unified drop handlers registered');
    };

    // 補助: ドロップされた File オブジェクトを処理（非Tauriフォールバックのみ）
    async function processDroppedFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        console.log('[DEBUG] processDroppedFile:', file.name, 'ext:', ext);

        if (!['md', 'markdown', 'txt'].includes(ext)) {
            console.log('[INFO] Skipping unsupported file type:', ext);
            return;
        }

        try {
            // file.path を試す（Electron等の一部ランタイムで利用可能）
            if (file.path) {
                console.log('[DEBUG] Using file.path:', file.path);
                await openFileFromPath(file.path);
            } else {
                // File APIで直接読み込む（パスが取れないため画像相対解決は不可）
                console.log('[DEBUG] Reading file via text() (no path available)...');
                const text = await file.text();
                console.log('[DEBUG] Loaded', text.length, 'chars from', file.name);
                let processedText = text;
                // インデントされた単独 '-' が Setext H2 と誤解釈されるのを防ぐ
                processedText = processedText.replace(/^(\s+)-(\s*)$/gm, '$1- \u200B');
                const processed = preprocessNotionMarkdown(processedText);
                const html = (typeof marked !== 'undefined') ? marked.parse(processed) : processed;
                createTab(null, file.name, html);
                showWarn('ファイルパスを取得できないため、画像が表示されない場合があります。「開く」ボタンをご利用ください。');
            }
        } catch (err) {
            console.error('[ERROR] processDroppedFile:', err);
            showError('ファイルを開けませんでした: ' + file.name);
        }
    }

    setupUnifiedDropHandler();

    // ブラウザモード用フォールバック（beforeunload）
    window.addEventListener('beforeunload', e => {
        if (!hasUnsavedTabs()) return;
        e.preventDefault();
        e.returnValue = '';
    });

    async function saveUnsavedTabs(unsavedTabs) {
        const originalTab = getActiveTab();
        for (const tab of unsavedTabs) {
            if (!tab.isModified) continue;
            switchTab(tab.id);
            const preview = normalizeFilename(getTabPreviewText(tab));
            const defaultPath = preview.endsWith('.md') ? preview : preview + '.md';
            await saveFile(defaultPath);
            if (tab.isModified) {
                if (originalTab && getActiveTab() && getActiveTab().id !== originalTab.id) {
                    switchTab(originalTab.id);
                }
                return false;
            }
        }
        if (originalTab && getActiveTab() && getActiveTab().id !== originalTab.id) {
            switchTab(originalTab.id);
        }
        return true;
    }

    function showAppCloseDialog(unsavedTabs) {
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

        const names = unsavedTabs.slice(0, 5).map(t => '・' + escapeHtml(getTabPreviewText(t))).join('<br>');
        const extra = unsavedTabs.length > 5 ? '<br>...他 ' + (unsavedTabs.length - 5) + ' 件' : '';
        titleEl.textContent = '確認';
        fieldsEl.innerHTML = '<div class="modal-field" style="margin-bottom:0;">保存されていないタブがあります。アプリを終了しますか？</div>' +
            '<div class="modal-field" style="margin-top: 8px; white-space: pre-wrap;">' + names + extra + '</div>';
        okBtn.textContent = unsavedTabs.length === 1 ? '保存' : 'すべて保存';
        cancelBtn.textContent = 'キャンセル';
        extraBtn.textContent = '保存しない';
        extraBtn.style.display = 'inline-flex';

        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            if (overlay.style.display !== 'none') {
                okBtn.focus({ preventScroll: true });
            }
        });

        let resolveChoice;
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
            const saved = await saveUnsavedTabs(unsavedTabs);
            resolveChoice(saved ? 'save' : 'cancel');
        };

        const handleDiscard = () => {
            cleanup();
            resolveChoice('discard');
        };

        const handleCancel = () => {
            cleanup();
            resolveChoice('cancel');
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

    // Tauri ウィンドウクローズ確認（アプリX / Cmd+Q 共通）
    // ダブル発火防止ガード（CloseRequested と ExitRequested が両方発火する場合に対応）
    let appCloseDialogShowing = false;
    const requestAppClose = async () => {
        if (appCloseDialogShowing) return;
        appCloseDialogShowing = true;
        try {
            const hasUnsaved = hasUnsavedTabs();
            const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;
            console.log('[CloseFlow] app-close-requested', {
                hasUnsaved,
                activeTabId: activeTab ? activeTab.id : null,
                isModified: activeTab ? activeTab.isModified : null,
                filePath: activeTab ? activeTab.filePath : null,
                editorTextLength: editor ? (editor.innerText || '').trim().length : -1,
            });

            if (!hasUnsaved) {
                await invoke('allow_close');
                await invoke('exit_app');
                return;
            }

            const unsavedTabs = getUnsavedTabs();
            const choice = await showAppCloseDialog(unsavedTabs);
            if (choice === 'save') {
                await invoke('allow_close');
                await invoke('exit_app');
            } else if (choice === 'discard') {
                await invoke('allow_close');
                await invoke('exit_app');
            }
        } catch (closeErr) {
            console.error('Failed to close app:', closeErr);
            showError('アプリを終了できませんでした。もう一度お試しください。');
        } finally {
            appCloseDialogShowing = false;
        }
    };

    // keyboard.js からも同じ終了フローを使えるように公開
    window.requestAppClose = requestAppClose;

    if (window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.listen('app-close-requested', requestAppClose);
    }
    
    // 初期状態をUndoスタックへ保存
    saveEditorState();
}

// ========== 拡張Undo/Redo関数 ==========

/**
 * 現在のエディタ状態をUndoスタックへ保存する
 */
// saveEditorState, debouncedSaveEditorState, performUndo, performRedo
// → modules/undoRedo.js に移動済み

// saveSelection(), restoreSelection(), getNodePath(), getNodeByPath() は src/nodeUtils.js に移動済み

// onEditorInput(), handleBlockAutoConversion(), handleInlineAutoConversion(), applyInlineAutoConvert() → modules/autoConvert.js に移動済み

// handleKeyDown(), handleEnterKey(), handleTabKey() → modules/keyboard.js に移動済み

// ========== 大規模処理用の進捗表示 ==========
function showProgressIndicator(message) {
    let indicator = document.getElementById('paste-progress-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'paste-progress-indicator';
        indicator.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:white;padding:20px 40px;border-radius:8px;font-size:16px;z-index:10000;box-shadow:0 4px 6px rgba(0,0,0,0.3);';
        document.body.appendChild(indicator);
    }
    indicator.textContent = message;
    indicator.style.display = 'block';
}

function hideProgressIndicator() {
    const indicator = document.getElementById('paste-progress-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// pasteTextInChunks() は src/pasteUtils.js に移動済み

// ========== ペースト処理 ==========
async function handlePaste(e) {
    // 0. コードブロック内では常にプレーンテキストとして貼り付け
    const sel = window.getSelection();
    const activeRange = sel.rangeCount ? sel.getRangeAt(0) : null;
    const activeContainer = activeRange
        ? (activeRange.startContainer.nodeType === Node.ELEMENT_NODE
            ? activeRange.startContainer
            : activeRange.startContainer.parentElement)
        : null;
    const activeCell = activeContainer && activeContainer.closest
        ? activeContainer.closest('td, th')
        : null;
    const activeOuterTable = activeCell ? activeCell.closest('table') : null;

    if (sel.rangeCount) {
        let node = activeRange ? activeRange.startContainer : null;
        while (node && node !== editor) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                e.preventDefault();
                const rawText = e.clipboardData.getData('text/plain');
                // CRLF正規化（Windows環境でのA5M2等からの貼り付けに対応）
                const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                const codeEl = node;
                const range2 = sel.getRangeAt(0);

                // カーソル/選択範囲をtextContent内の文字オフセットで取得
                const startOffset = getCaretCharacterOffsetWithin(codeEl);
                let endOffset = startOffset;
                if (!range2.collapsed) {
                    const endRange = range2.cloneRange();
                    endRange.selectNodeContents(codeEl);
                    endRange.setEnd(range2.endContainer, range2.endOffset);
                    endOffset = endRange.toString().length;
                }

                // textContentを直接操作（execCommand非依存でWindows WebView2でも安全）
                const currentText = codeEl.textContent;
                codeEl.textContent = currentText.substring(0, startOffset) + normalized + currentText.substring(endOffset);

                // 貼り付け後のカーソル位置を復元
                setCaretCharacterOffset(codeEl, startOffset + normalized.length);

                markModified();
                debouncedHighlightCodeAtCursor();
                return;
            }
            if (node.tagName === 'PRE') {
                e.preventDefault();
                const rawText = e.clipboardData.getData('text/plain');
                const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                // PRE内のCODE要素を優先して使用（通常は <pre><code> 構造）
                const codeEl = node.querySelector('code') || node;
                const range2 = sel.getRangeAt(0);

                const startOffset = getCaretCharacterOffsetWithin(codeEl);
                let endOffset = startOffset;
                if (!range2.collapsed) {
                    const endRange = range2.cloneRange();
                    endRange.selectNodeContents(codeEl);
                    endRange.setEnd(range2.endContainer, range2.endOffset);
                    endOffset = endRange.toString().length;
                }

                const currentText = codeEl.textContent;
                codeEl.textContent = currentText.substring(0, startOffset) + normalized + currentText.substring(endOffset);

                setCaretCharacterOffset(codeEl, startOffset + normalized.length);

                markModified();
                debouncedHighlightCodeAtCursor();
                return;
            }
            node = node.parentElement;
        }
    }

    // 1. クリップボード内の画像を確認
    const items = e.clipboardData && e.clipboardData.items;
    if (items) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) {
                    pasteImageFile(file);
                }
                return;
            }
        }
    }

    // 2. HTMLテーブル（Excelコピー）を確認
    const htmlData = e.clipboardData.getData('text/html');
    // Option+V (Windows/Linux: Ctrl+Alt+V、macOS: Cmd+Option+V) の場合はテキスト貼り付けモード（案B）のため、表処理をスキップ
    if (htmlData && /<table[\s>]/i.test(htmlData) && !e.altKey) {
        e.preventDefault();
        const table = parseHtmlTable(htmlData);
        if (table) {
            if (activeOuterTable && activeOuterTable.parentNode) {
                // セル内では入れ子テーブルを避けるため、外側テーブル直後へ退避挿入する
                activeOuterTable.insertAdjacentHTML('afterend', table + '<p><br></p>');
                showWarn('表セル内では入れ子表を防ぐため、外側の表の直後に貼り付けました。\n(Windows/Linux) Ctrl+Alt+V または (macOS) Cmd+Option+V でテキストとして貼り付けられます。');
            } else {
                document.execCommand('insertHTML', false, table + '<p><br></p>');
            }
            markModified();
            return;
        }
    }

    // 3. テキスト貼り付け
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    // 4. タブ区切りテキスト（TSV）を確認して表へ変換
    // Option+V (Windows/Linux: Ctrl+Alt+V、macOS: Cmd+Option+V) の場合はテキスト貼り付けモード（案B）のため、表処理をスキップ
    if (isTabDelimited(text) && !e.altKey) {
        const table = tsvToHtmlTable(text);
        if (activeOuterTable && activeOuterTable.parentNode) {
            // セル内では入れ子テーブルを避けるため、外側テーブル直後へ退避挿入する
            activeOuterTable.insertAdjacentHTML('afterend', table + '<p><br></p>');
            showWarn('表セル内では入れ子表を防ぐため、外側の表の直後に貼り付けました。\n(Windows/Linux) Ctrl+Shift+V または (macOS) Cmd+Shift+V でテキストとして貼り付けられます。');
        } else {
            document.execCommand('insertHTML', false, table + '<p><br></p>');
        }
        markModified();
        return;
    }

    // 5. Markdown判定
    if (looksLikeMarkdown(text)) {
        // タスクリスト項目を正規化（GFMでは [x]/[ ] 後に空白が必要）
        let normalizedText = text.replace(/^(\s*[-*+]\s+\[[ xX]\])([^\s]|$)/gm, '$1 $2');
        normalizedText = normalizedText.replace(/^(\s*[-*+]\s+\[[ xX]\])\s*$/gm, '$1 \u200B');
        // インデントされた単独 '-' が Setext H2 と誤解釈されるのを防ぐ
        normalizedText = normalizedText.replace(/^(\s+)-(\s*)$/gm, '$1- \u200B');
        const html = marked.parse(preprocessNotionMarkdown(normalizedText));
        document.execCommand('insertHTML', false, html);
        editor.querySelectorAll('input[type="checkbox"][disabled]').forEach(cb => {
            cb.removeAttribute('disabled');
        });
    } else {
        // プレーンテキスト貼り付け時に http(s) URL を自動リンク化
        const urlRegex = /(https?:\/\/[^\s<>\"]+)/g;
        if (urlRegex.test(text)) {
            // 非リンク部分をエスケープし、URLを <a> で包んでHTML生成
            let lastIndex = 0;
            let html = '';
            text.replace(urlRegex, (match, p1, offset) => {
                html += escapeHtml(text.slice(lastIndex, offset));
                const href = escapeHtml(match);
                html += '<a href="' + href + '">' + escapeHtml(match) + '</a>';
                lastIndex = offset + match.length;
            });
            html += escapeHtml(text.slice(lastIndex));
            // 改行を維持
            html = html.replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, html);
        } else {
            document.execCommand('insertText', false, text);
        }
    }
}

// ========== ユーティリティ関数 ==========

function getParentBlock(node) {
    const blockTags = new Set([
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'TD', 'TH'
    ]);
    let current = node;
    while (current && current !== editor) {
        if (current.nodeType === Node.ELEMENT_NODE && blockTags.has(current.tagName)) {
            return current;
        }
        current = current.parentNode;
    }
    return null;
}

function setCursorTo(element) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false); // 末尾に折りたたむ
    sel.removeAllRanges();
    sel.addRange(range);
}

function setCursorToEnd(element) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

function updateWordCount() {
    const text = editor.textContent || '';
    const chars = text.replace(/\u200B/g, '').length; // ゼロ幅スペースは除外
    const lines = text.split('\n').length;
    if (wordCountSpan) {
        wordCountSpan.textContent = chars + ' 文字 | ' + lines + ' 行';
    }
}

// setupTableContextMenu(), showTableContextMenu(), hideTableContextMenu(),
// handleTableAction(), createTableRow() は src/modules/tableManager.js に移動済み

// renderMathBlocks() は src/mathRender.js に移動済み

// renderMermaidBlocks(), showMermaidInsertDialog(), insertMermaidBlock(),
// addMermaidModeButton(), showMermaidModeMenu(), changeMermaidMode(),
// editMermaidBlock(), editMermaidDiagramOnly(), editMermaidCodeAndDiagram()
// は src/mermaidManager.js に移動済み

// unwrapToggle(), ensureToggleContentEditable(), setupToggleBlocks()
// は src/toggleBlock.js に移動済み

// setupTocDeleteButtons(), insertTOC() は src/tocManager.js に移動済み

// ========== コードブロックのコピーボタン ==========
function setupCodeCopyButtons() {
    // 既存コードブロックへコピーボタンを追加
    addCopyButtonsToCodeBlocks();
    
    // コピーボタン追加後に折り返しボタンを追加
    editor.querySelectorAll('pre').forEach(pre => {
        if (typeof setupCodeWrapButton === 'function') {
            setupCodeWrapButton(pre);
        }
    });

    // 新規コードブロック追加を監視し行番号を更新
    const observer = new MutationObserver(() => {
        addCopyButtonsToCodeBlocks();
        // 新規追加されたコードブロックへ折り返しボタンを追加
        editor.querySelectorAll('pre').forEach(pre => {
            if (typeof setupCodeWrapButton === 'function') {
                setupCodeWrapButton(pre);
            }
        });
        updateAllLineNumbers();
    });
    observer.observe(editor, { childList: true, subtree: true });
}

function addCopyButtonsToCodeBlocks() {
    editor.querySelectorAll('pre').forEach(pre => {
        // 既にコピーボタンがある場合はスキップ
        if (pre.querySelector('.code-copy-container')) return;
        // pre直前にツールバーがある場合もスキップ
        if (pre.previousElementSibling && pre.previousElementSibling.classList.contains('code-block-toolbar')) return;
        // Mermaidコンテナは対象外
        if (pre.closest('.mermaid-container')) return;

        const code = pre.querySelector('code');
        // 言語選択ドロップダウンを作成
        const langSelect = document.createElement('select');
        langSelect.className = 'code-lang-select';
        // CODE_LANGUAGESはグローバル定義
        CODE_LANGUAGES.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            langSelect.appendChild(option);
        });
        // 現在の言語を初期値に
        let currentLang = '';
        if (code && code.className) {
            const m = code.className.match(/language-([\w-]+)/);
            if (m) currentLang = m[1];
        }
        langSelect.value = currentLang;

        // 言語変更時の処理
        langSelect.addEventListener('change', e => {
            if (!code) return;
            // クラスを書き換え
            code.className = langSelect.value ? 'language-' + langSelect.value : '';
            // 再ハイライト
            if (typeof hljs !== 'undefined') {
                isConverting = true;
                try {
                    highlightCodeBlock(code);
                } finally {
                    isConverting = false;
                }
            }
        });

        // ツールバーをpreの上に配置
        const toolbar = document.createElement('div');
        toolbar.className = 'code-block-toolbar';
        toolbar.setAttribute('contenteditable', 'false');
        toolbar.appendChild(langSelect);

        // ボタンコンテナをツールバー内に右寄せで配置
        const container = document.createElement('div');
        container.className = 'code-copy-container';
        container.setAttribute('contenteditable', 'false');
        toolbar.appendChild(container);

        pre.parentNode.insertBefore(toolbar, pre);

        // 補助: 生のコードテキストを取得
        function getRawText() {
            return code ? code.textContent : pre.textContent;
        }

        // 補助: 視覚フィードバック付きでクリップボードへコピー
        function copyToClipboard(text, btn, label) {
            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 2000);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 2000);
            });
        }

        // ボタン1: 通常コピー（行番号なし）
        const btnCopy = document.createElement('button');
        btnCopy.className = 'code-copy-btn';
        btnCopy.textContent = 'Copy';
        btnCopy.title = 'コードをコピー';
        btnCopy.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
        btnCopy.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            copyToClipboard(getRawText(), btnCopy, 'Copy');
        });

        // ボタン2: 行番号付きコピー
        const btnNum = document.createElement('button');
        btnNum.className = 'code-copy-btn';
        btnNum.textContent = 'Copy #';
        btnNum.title = '行番号付きでコピー';
        btnNum.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
        btnNum.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const rawText = getRawText();
            const lines = rawText.split('\n');
            if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
            const maxDigits = String(lines.length).length;
            const numberedText = lines.map((line, i) => {
                const num = String(i + 1).padStart(maxDigits, ' ');
                return num + ' | ' + line;
            }).join('\n');
            copyToClipboard(numberedText, btnNum, 'Copy #');
        });

        container.appendChild(btnCopy);
        container.appendChild(btnNum);

        // コピーボタン追加直後に折り返しトグルボタンを表示
        if (typeof setupCodeWrapButton === 'function') {
            setupCodeWrapButton(pre);
        }
    });
}

// setupImageMutationObserver(), handleSingleImage(), setupImageErrorHandling()
// は src/modules/imageManager.js に移動済み

// setupImageResize() は src/modules/imageManager.js に移動済み

// emojiPickerEl, showEmojiPicker
// は src/modules/toolbarActions.js に移動済み

// setupImageViewer(), openImageViewer(), closeImageViewer()
// は src/modules/imageManager.js に移動済み

// ========== ブートストラップ ==========
console.log('Script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
} else {
    setTimeout(init, 200);
}
