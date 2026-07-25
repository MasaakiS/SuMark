/**
 * SuMark 画像管理モジュール (imageManager.js)
 *
 * 画像貼り付け、リサイズ、エラーハンドリング、ビューア、ファイル保存を担当
 * グローバルスコープで動作（ESM未対応）
 * main.js より前に読み込むこと
 * 依存: main.js (editor, exists, createDir, writeBinaryFile)
 *       tabManager.js (markModified)
 *       undoRedo.js (saveEditorState) ※ pasteImageFile内で使用
 */

// ========== 画像エラーハンドリング ==========
let imageMutationObserver = null;
// DOM変更による不要な変更判定を避けるため、処理済み画像をWeakSetで追跡
let processedImages = new WeakSet();
let failedImages = new WeakSet();

/**
 * 画像のMutationObserverをセットアップ（新規画像の自動エラーハンドリング）
 */
function setupImageMutationObserver() {
    // エディタに追加される新規画像を監視するMutationObserverを作成
    if (imageMutationObserver) {
        imageMutationObserver.disconnect();
    }
    
    imageMutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // 追加ノードを確認
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // ノード自体が画像か確認
                    if (node.tagName === 'IMG') {
                        handleSingleImage(node);
                    }
                    // 追加ノード配下の画像を確認
                    else if (node.querySelectorAll) {
                        const images = node.querySelectorAll('img');
                        if (images.length > 0) {
                            images.forEach(img => handleSingleImage(img));
                        }
                    }
                }
            });
        });
    });
    
    // エディタの監視を開始
    imageMutationObserver.observe(editor, {
        childList: true,
        subtree: true
    });
}

/**
 * 単一画像のエラーハンドリングをセットアップ
 * @param {HTMLImageElement} img - 対象画像要素
 */
function handleSingleImage(img) {
    // 既に処理済みならスキップ
    if (processedImages.has(img)) {
        return;
    }
    processedImages.add(img);
    
    // 読み込み失敗時に代替表示へ置換する関数
    const handleImageError = function() {
        // 既に代替表示済み、または読み込み成功済みならスキップ
        if (failedImages.has(this)) {
            return;
        }
        if (this.complete && this.naturalWidth > 0) {
            return; // 画像読み込み成功
        }
        failedImages.add(this);
        
        const alt = this.getAttribute('alt') || '画像を読み込めません';
        const src = this.getAttribute('src') || '';
        
        // 代替テキスト表示用コンテナを作成
        const container = document.createElement('div');
        container.className = 'img-error-container';
        container.setAttribute('contenteditable', 'false');
        
        const altText = document.createElement('div');
        altText.className = 'img-error-text';
        altText.textContent = alt;
        
        const srcText = document.createElement('div');
        srcText.className = 'img-error-src';
        srcText.textContent = '(画像パス: ' + src + ')';
        
        container.appendChild(altText);
        container.appendChild(srcText);
        
        // 画像をエラー表示コンテナへ置換
        if (this.parentNode) {
            this.parentNode.replaceChild(container, this);

            // 画像読み込み失敗は表示時の実行時問題で、ユーザー編集ではない。
            // 不要なdirty判定を避けるため、未変更タブの内容を描画後HTMLへ揃える。
            const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;
            if (activeTab && !activeTab.isModified) {
                activeTab.content = editor.innerHTML;
            }
        }
    };
    
    // errorイベントリスナーを追加
    img.addEventListener('error', handleImageError);
    
    // 現在状態を確認
    if (img.complete) {
        // 読み込み完了済み（成功または失敗）
        if (img.naturalWidth === 0 && img.naturalHeight === 0) {
            // 読み込み失敗
            handleImageError.call(img);
        }
    }
}

/**
 * 既存画像のエラーハンドリングを初期化
 */
function setupImageErrorHandling() {
    // 画像読み込み失敗時に代替テキスト表示へ切り替える
    const images = editor.querySelectorAll('img');
    
    images.forEach((img) => {
        handleSingleImage(img);
    });
}

// ========== Image Resize ==========

/**
 * 画像リサイズ機能をセットアップ（ドラッグ＋コピーボタン＋ダブルクリック拡大）
 */
function setupImageResize() {
    let activeImage = null;
    let resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    resizeHandle.style.display = 'none';
    resizeHandle.innerHTML = '<div class="resize-grip"></div>';
    document.body.appendChild(resizeHandle);

    // Image copy button
    let copyBtn = document.createElement('button');
    copyBtn.className = 'image-copy-btn';
    copyBtn.textContent = '📋 Copy';
    copyBtn.title = '画像をコピー';
    document.body.appendChild(copyBtn);

    copyBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeImage) return;
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            // 最高品質のため自然な寸法を使用
            canvas.width = activeImage.naturalWidth || activeImage.width;
            canvas.height = activeImage.naturalHeight || activeImage.height;
            ctx.drawImage(activeImage, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (blob) {
                // --- Hybrid clipboard logic start ---
                // 1. Try Tauri native clipboard API if available
                if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
                    try {
                        // blob を base64 へ変換
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        await window.__TAURI__.tauri.invoke('copy_image_to_clipboard', { imageData: base64 });
                        showCopySuccess('(Tauri)');
                        return;
                    } catch (tauriErr) {
                        console.warn('Tauri clipboard failed, fallback to Web API:', tauriErr);
                    }
                }
                // 2. Try Web Clipboard API
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showCopySuccess();
                    return;
                } catch (clipboardErr) {
                    console.warn('Clipboard API image write failed, trying text fallback:', clipboardErr);
                }
                // 3. Fallback: copy image file name to clipboard as text
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    const imgName = activeImage.alt || activeImage.src.split('/').pop() || '画像';
                    await navigator.clipboard.writeText(imgName);
                    showCopySuccess('(ファイル名をコピー)');
                } else {
                    showCopyError('クリップボード API がサポートされていません');
                }
                // --- ハイブリッドクリップボード処理終了 ---
            }
        } catch (err) {
            console.error('Image copy failed:', err);
            showCopyError();
        }

        function showCopySuccess(suffix = '') {
            copyBtn.textContent = '✅ Copied!' + (suffix ? ' ' + suffix : '');
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy';
                copyBtn.classList.remove('copied');
            }, 2500);
        }

        function showCopyError(msg = 'Failed') {
            copyBtn.textContent = '❌ ' + msg;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy';
                copyBtn.classList.remove('copied');
            }, 3000);
        }
    });

    editor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            selectImage(e.target);
        } else if (!e.target.closest('.image-resize-handle') && !e.target.closest('.image-copy-btn')) {
            deselectImage();
        }
    });

    // ダブルクリックで画像ビューアを開く
    editor.addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            openImageViewer(e.target);
        }
    });

    function selectImage(img) {
        deselectImage();
        activeImage = img;
        img.classList.add('image-selected');
        positionHandle();
        resizeHandle.style.display = 'block';
        copyBtn.style.display = 'block';
    }

    function deselectImage() {
        if (activeImage) {
            activeImage.classList.remove('image-selected');
        }
        activeImage = null;
        resizeHandle.style.display = 'none';
        copyBtn.style.display = 'none';
    }

    function positionHandle() {
        if (!activeImage) return;
        const rect = activeImage.getBoundingClientRect();
        resizeHandle.style.left = (rect.right - 12) + 'px';
        resizeHandle.style.top = (rect.bottom - 12) + 'px';
        // コピーボタンを画像の右上へ配置
        copyBtn.style.left = (rect.right - copyBtn.offsetWidth - 4) + 'px';
        copyBtn.style.top = (rect.top + 4) + 'px';
    }

    resizeHandle.addEventListener('mousedown', (e) => {
        if (!activeImage) return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = activeImage.offsetWidth;

        function onMouseMove(ev) {
            const dx = ev.clientX - startX;
            const newWidth = Math.max(50, startWidth + dx);
            activeImage.style.width = newWidth + 'px';
            activeImage.style.height = 'auto';
            positionHandle();
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            markModified();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    const editorContainer = editor.parentElement;
    if (editorContainer) {
        editorContainer.addEventListener('scroll', () => {
            if (activeImage) positionHandle();
        });
    }
    window.addEventListener('resize', () => {
        if (activeImage) positionHandle();
    });
}

// ========== 画像ビューア ==========
let imageViewerModal = null;

/**
 * 画像ビューア（モーダル）をセットアップ（ズームコントロール付き）
 */
function setupImageViewer() {
    let currentZoom = 1.0;
    const ZOOM_STEPS = [0.1, 0.17, 0.25, 0.33, 0.5, 0.67, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
    const MAX_ZOOM = 5.0;
    const MIN_ZOOM = 0.1;

    imageViewerModal = document.createElement('div');
    imageViewerModal.className = 'image-viewer-modal';
    imageViewerModal.innerHTML = `
        <button class="image-viewer-close" title="閉じる (Esc)">✕</button>
        <div class="image-viewer-scroll-area">
            <img class="image-viewer-img" src="" alt="">
        </div>
        <div class="image-viewer-toolbar">
            <button class="iv-zoom-out" title="縮小 (−)">−</button>
            <button class="iv-zoom-reset" title="フィットサイズに戻す (0)">100%</button>
            <button class="iv-zoom-in" title="拡大 (+)">+</button>
            <span class="image-viewer-info"></span>
        </div>
    `;
    document.body.appendChild(imageViewerModal);

    const scrollArea  = imageViewerModal.querySelector('.image-viewer-scroll-area');
    const viewerImg   = imageViewerModal.querySelector('.image-viewer-img');
    const closeBtn    = imageViewerModal.querySelector('.image-viewer-close');
    const zoomOutBtn  = imageViewerModal.querySelector('.iv-zoom-out');
    const zoomResetBtn = imageViewerModal.querySelector('.iv-zoom-reset');
    const zoomInBtn   = imageViewerModal.querySelector('.iv-zoom-in');

    // ---- ズーム計算 ----
    function calcFitRatio() {
        const maxW = window.innerWidth  * 0.92;
        const maxH = (window.innerHeight - 100) * 0.92; // ツールバー分を引く
        const nw = viewerImg.naturalWidth  || 1;
        const nh = viewerImg.naturalHeight || 1;
        // 小さい画像は拡大、大きい画像は縮小してフィット
        return Math.min(maxW / nw, maxH / nh);
    }

    function applyZoom() {
        const nw = viewerImg.naturalWidth  || 1;
        const nh = viewerImg.naturalHeight || 1;
        const fit = calcFitRatio();
        const displayW = Math.round(nw * fit * currentZoom);
        const displayH = Math.round(nh * fit * currentZoom);

        viewerImg.style.width    = displayW + 'px';
        viewerImg.style.height   = displayH + 'px';
        viewerImg.style.maxWidth  = 'none';
        viewerImg.style.maxHeight = 'none';

        zoomResetBtn.textContent = Math.round(currentZoom * 100) + '%';

        // ズーム上下限でボタン無効化
        zoomOutBtn.disabled = currentZoom <= MIN_ZOOM;
        zoomInBtn.disabled  = currentZoom >= MAX_ZOOM;
    }

    function zoomIn() {
        const idx = ZOOM_STEPS.findIndex(s => s > currentZoom + 0.001);
        currentZoom = idx >= 0 ? ZOOM_STEPS[idx] : Math.min(currentZoom * 1.25, MAX_ZOOM);
        applyZoom();
    }

    function zoomOut() {
        const steps = [...ZOOM_STEPS].reverse();
        const idx = steps.findIndex(s => s < currentZoom - 0.001);
        currentZoom = idx >= 0 ? steps[idx] : Math.max(currentZoom / 1.25, MIN_ZOOM);
        applyZoom();
    }

    function zoomReset() {
        currentZoom = 1.0;
        applyZoom();
    }

    // ---- ボタンイベント ----
    zoomInBtn .addEventListener('click', (e) => { e.stopPropagation(); zoomIn();    });
    zoomOutBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomOut();   });
    zoomResetBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomReset(); });

    // ---- ホイールでズーム ----
    imageViewerModal.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else              zoomOut();
    }, { passive: false });

    // ---- 閉じる ----
    closeBtn.addEventListener('click', closeImageViewer);
    imageViewerModal.addEventListener('click', (e) => {
        if (e.target === imageViewerModal || e.target === scrollArea) closeImageViewer();
    });

    // ---- キーボードショートカット ----
    document.addEventListener('keydown', (e) => {
        if (!imageViewerModal || !imageViewerModal.classList.contains('active')) return;
        if (e.key === 'Escape') { closeImageViewer(); }
        else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn();    }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut();   }
        else if (e.key === '0')                  { e.preventDefault(); zoomReset(); }
    });

    // openImageViewer/closeImageViewer から使えるよう公開
    imageViewerModal._resetZoom = function() {
        currentZoom = 1.0;
        if (viewerImg.naturalWidth > 0) applyZoom();
        else viewerImg.onload = applyZoom;
    };
}

/**
 * 画像ビューアを開く
 * @param {HTMLImageElement} img - 表示する画像要素
 */
function openImageViewer(img) {
    if (!imageViewerModal) return;

    const viewerImg = imageViewerModal.querySelector('.image-viewer-img');
    const infoDiv   = imageViewerModal.querySelector('.image-viewer-info');

    viewerImg.src = img.src;
    viewerImg.alt = img.alt || '画像';

    // 画像情報表示
    if (img.alt) {
        infoDiv.textContent = img.alt;
    } else if (img.src) {
        const fileName = img.src.split('/').pop().split('?')[0];
        infoDiv.textContent = fileName || '';
    } else {
        infoDiv.textContent = '';
    }

    imageViewerModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // ズームをフィットサイズにリセット
    imageViewerModal._resetZoom && imageViewerModal._resetZoom();
}

/**
 * 画像ビューアを閉じる
 */
function closeImageViewer() {
    if (!imageViewerModal) return;
    imageViewerModal.classList.remove('active');
    document.body.style.overflow = '';
}

// ========== 画像ペースト ==========
// ========== 画像リサイズ ==========
/**
 * @param {File} file - ペーストされた画像ファイル
 */
function pasteImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64 = event.target.result;
        const html = '<img src="' + base64 + '" alt="貼り付け画像">';
        editor.focus();
        document.execCommand('insertHTML', false, html);
        markModified();
    };
    reader.readAsDataURL(file);
}


// ========== 画像ファイルユーティリティ ========== 

// グローバル公開
if (typeof window !== 'undefined') {
    window.pasteImageFile = pasteImageFile;
}

/**
 * MIMEタイプから拡張子に変換
 * @param {string} mime - MIMEタイプ
 * @returns {string} 拡張子
 */
function mimeToExt(mime) {
    const map = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/bmp': 'bmp',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
    };
    return map[mime] || 'png';
}

/**
 * 画像ファイル名を生成
 * @param {string} alt - 代替テキスト
 * @param {number} counter - カウンタ
 * @param {string} ext - 拡張子
 * @returns {string} 生成されたファイル名
 */
function generateImageFileName(alt, counter, ext) {
    // altテキストが拡張子付きファイル名ならそれをベースに使う
    if (alt && /^[\w.-]+$/.test(alt) && alt.includes('.')) {
        const name = alt.replace(/\.[^.]+$/, '');
        const origExt = alt.split('.').pop();
        return name + '_' + String(counter).padStart(3, '0') + '.' + origExt;
    }
    // altテキスト（サニタイズ済み）+連番で一意化
    if (alt && alt.trim()) {
        const sanitized = alt.trim()
            .replace(/[^\w\u3000-\u9FFF\u4E00-\u9FFF\uF900-\uFAFF-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50);
        if (sanitized) {
            return sanitized + '_' + String(counter).padStart(3, '0') + '.' + ext;
        }
    }
    return 'image_' + String(counter).padStart(3, '0') + '.' + ext;
}

/**
 * 画像ファイルをディスクに保存（base64デコード→バイナリ書き込み）
 * @param {string} fileDir - ファイルのディレクトリパス
 * @param {string} imageDir - 画像サブディレクトリ名
 * @param {string} fileName - ファイル名
 * @param {string} base64Data - Base64エンコードされた画像データ
 */
async function saveImageFile(fileDir, imageDir, fileName, base64Data) {
    const dirPath = fileDir + '/' + imageDir;

    // ディレクトリがなければ作成
    try {
        const dirExists = await exists(dirPath);
        if (!dirExists) {
            await createDir(dirPath, { recursive: true });
        }
    } catch (e) {
        // 念のため作成を試みる
        try {
            await createDir(dirPath, { recursive: true });
        } catch (e2) {
            // 既に存在する可能性があるため継続
        }
    }

    // Base64をバイナリへデコード
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    // ファイル書き込み
    const filePath = dirPath + '/' + fileName;
    await writeBinaryFile(filePath, bytes);
}
