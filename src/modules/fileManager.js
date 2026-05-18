// =====================================================
// SuMark - ファイル操作モジュール
// =====================================================

// file:// URL で渡されたパスを正規化する（特にWindows向け）
function normalizeFilePath(rawPath) {
    if (!rawPath) return rawPath;
    let p = rawPath.trim();

    // 分岐が多い理由は「同じファイルを同じ文字列表現へ寄せる」ため。
    // これをしないと、OSや入力経路ごとにパス表現が揺れて重複タブ判定が壊れる。

    // file:// スキームを除去する
    if (p.startsWith('file://')) {
        // file:///C:/... → /C:/... → C:/...
        // file://server/share/... → //server/share/... (UNC path)
        // file:////server/share/... → //server/share/... (UNC path alternate form)
        p = p.replace(/^file:\/\//, '');
        // Windows の file URL は /C:/... 形式になるため先頭スラッシュを除去
        if (/^\/[A-Za-z]:\//.test(p)) {
            p = p.substring(1);
        }
        // file:// 経由のUNCパスは /server/share になりやすいため補正する
        // file:////server/share は既に //server/share で正しい
        // file:///C:/... は上の分岐で処理済み
    }

    // パーセントエンコード文字（空白・非ASCIIなど）を復号
    try {
        p = decodeURIComponent(p);
    } catch (e) {
        // 不正なエスケープは無視
    }

    // UNCパス（\\server\share / //server/share）を判定
    const isUNC = /^\\\\|^\/\//.test(p);

    // 区切り文字を正規化
    p = p.replace(/\\/g, '/');

    // 余分なスラッシュを畳み込む（UNC先頭の // は維持）
    if (isUNC) {
        // UNC先頭の // を保持しつつ残りを正規化
        p = '//' + p.substring(2).replace(/\/+/g, '/');
    } else {
        p = p.replace(/\/+/g, '/');
    }

    return p;
}

async function newFile() {
    createTab(null, '無題', '<p><br></p>');
    editor.focus();
}

// 指定パスからファイルを開く（ダイアログ/ドラッグ&ドロップ共通）
async function openFileFromPath(filePath) {
    try {
        // file:// URL をローカルファイルパスへ正規化
        const normalizedFilePath = normalizeFilePath(filePath);
        console.log('[DEBUG openFileFromPath START] filePath:', filePath, 'normalized:', normalizedFilePath);
        
        // 既に開いているファイルか確認
        const existingTab = tabs.find(t => t.filePath === normalizedFilePath);
        if (existingTab) {
            console.log('[DEBUG openFileFromPath] File already open, switching tab');
            switchTab(existingTab.id);
            return;
        }

        console.log('[DEBUG openFileFromPath] Reading file...');
        let contents = await readTextFile(normalizedFilePath);
        console.log('[DEBUG openFileFromPath] File read successfully, contents length:', contents.length);

        // エディタ表示用に相対アセットを解決
        const lastSlash = Math.max(normalizedFilePath.lastIndexOf('/'), normalizedFilePath.lastIndexOf('\\'));
        const fileDir = normalizedFilePath.substring(0, lastSlash);
        console.log('[DEBUG openFileFromPath] fileDir:', fileDir);
        console.log('[DEBUG openFileFromPath] Resolving relative images...');
        contents = resolveRelativeImages(contents, fileDir);
        console.log('[DEBUG openFileFromPath] Resolving CSV links...');
        try {
            contents = await resolveRelativeCsvLinks(contents, fileDir);
            console.log('[DEBUG openFileFromPath] CSV links resolved successfully');
        } catch (err) {
            console.warn('[DEBUG openFileFromPath] CSV link resolution failed (non-critical):', err.message);
            // CSV解決失敗は非致命なので処理を継続
        }

        // Notion エクスポート形式の複数行テーブルセルを正規化
        console.log('[DEBUG openFileFromPath] Preprocessing Notion markdown...');
        contents = preprocessNotionMarkdown(contents);

        // GFMタスク項目は [x]/[ ] の後ろに空白が必要
        contents = contents.replace(/^(\s*[-*+]\s+\[[ xX]\])([^\s]|$)/gm, '$1 $2');
        // ZWSP を挿入する理由:
        // 空タスク項目はそのままだとパーサが通常リスト扱いし、
        // roundtrip 時にチェックボックス情報を失うため。
        // 空タスク項目は ZWSP を入れて marked のタスク判定を維持
        contents = contents.replace(/^(\s*[-*+]\s+\[[ xX]\])\s*$/gm, '$1 \u200B');

        console.log('[DEBUG openFileFromPath] Creating tab...');
        const filename = normalizedFilePath.split('/').pop().split('\\').pop();
        const tab = createTab(normalizedFilePath, filename, '<p><br></p>');
        setMarkdown(contents);
        tab.content = editor.innerHTML;
        console.log('[DEBUG openFileFromPath] SUCCESS');

    } catch (err) {
        console.error('[ERROR openFileFromPath] Exception:', err);
        console.error('[ERROR openFileFromPath] Stack:', err.stack);
        console.error('[ERROR openFileFromPath] Message:', err.message);
        showError('ファイルを開くことができません: ' + (err.message || String(err)));
        throw err;
    }
}

async function openFile() {
    try {
        const selected = await tauriOpen({
            multiple: true,
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
        });

        if (selected) {
            // 単一選択/複数選択の両方に対応
            const files = Array.isArray(selected) ? selected : [selected];
            for (const filePath of files) {
                await openFileFromPath(filePath);
            }
        }
    } catch (err) {
        console.error('Error opening file:', err);
        showError('ファイルを開けませんでした: ' + err);
    }
}

// Markdown内の相対画像パスを asset:// URL へ変換（ファイルI/Oなし）
function resolveRelativeImages(markdown, fileDir) {
    // アルゴリズム意図:
    // まず候補を収集し、最後に一括置換することで
    // 走査中の文字列変化による取りこぼしを防ぐ。
    // fileDir をスラッシュ形式へ統一し、末尾スラッシュを除去
    const isUNC = /^\\\\|^\/\//.test(fileDir);
    fileDir = fileDir.replace(/\\/g, '/');
    if (isUNC) {
        fileDir = '//' + fileDir.substring(2).replace(/\/+/g, '/');
    }
    fileDir = fileDir.replace(/\/$/, '');
    console.log('[DEBUG resolveRelativeImages] fileDir:', fileDir);

    // URL内の入れ子括弧に対応（Notion書き出しなど）
    const imgRegex = /!\[([^\]]*)\]\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
    let match;
    const replacements = [];

    while ((match = imgRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const alt = match[1];
        const rawPath = match[2];
        console.log('[DEBUG resolveRelativeImages] matched image:', fullMatch, 'rawPath:', rawPath);

        // data URI / http(s) / 絶対パス / 既変換のasset URLは除外
        if (rawPath.startsWith('data:') || rawPath.startsWith('http://') ||
            rawPath.startsWith('https://') || rawPath.startsWith('/') ||
            rawPath.startsWith('asset://')) {
            console.log('[DEBUG resolveRelativeImages] skipping:', rawPath);
            continue;
        }

        // パスをURLデコード（Notion書き出しはURLエンコードされる）
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch (e) {
            decodedPath = rawPath;
        }

        // デコード後パスの区切り文字を正規化
        decodedPath = decodedPath.replace(/\\/g, '/');
        console.log('[DEBUG resolveRelativeImages] decodedPath:', decodedPath);

        // 絶対パスへ解決して asset URL に変換
        const absolutePath = fileDir + '/' + decodedPath;
        console.log('[DEBUG resolveRelativeImages] absolutePath:', absolutePath);
        try {
            const assetUrl = testConvertFileSrc(absolutePath);
            console.log('[DEBUG resolveRelativeImages] assetUrl result:', assetUrl);
            if (assetUrl) {
                replacements.push({
                    original: fullMatch,
                    replacement: '![' + alt + '](' + assetUrl + ')'
                });
                console.log('[DEBUG resolveRelativeImages] replacement added');
            } else {
                console.warn('convertFileSrc returned empty/null for path:', absolutePath);
            }
        } catch (err) {
            console.warn('Could not convert to asset URL for path:', absolutePath, 'Error:', err.message);
        }
    }

    // 追加対応: 相対パスの HTML <img> タグも変換（width付き画像保存時など）
    const htmlImgRegex = /<img[^>]*src="([^"]+)"[^>]*>/gi;
    while ((match = htmlImgRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const rawPath = match[1];

        // 絶対URL / data / 既存asset は除外
        if (rawPath.startsWith('data:') || rawPath.startsWith('http://') ||
            rawPath.startsWith('https://') || rawPath.startsWith('/') ||
            rawPath.startsWith('asset://')) {
            continue;
        }

        let decodedPath;
        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch (e) {
            decodedPath = rawPath;
        }

        decodedPath = decodedPath.replace(/\\/g, '/');
        const absolutePath = fileDir + '/' + decodedPath;

        try {
            const assetUrl = testConvertFileSrc(absolutePath);
            if (assetUrl) {
                const replaced = fullMatch.replace(`src="${rawPath}"`, `src="${assetUrl}"`);
                replacements.push({ original: fullMatch, replacement: replaced });
            }
        } catch (err) {
            console.warn('Could not convert HTML image path to asset URL:', absolutePath, 'Error:', err.message);
        }
    }

    // 置換を適用
    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }
    console.log('[DEBUG resolveRelativeImages] final result has', replacements.length, 'replacements');
    return result;
}

// Markdown内の相対CSVリンクをインライン表へ変換
async function resolveRelativeCsvLinks(markdown, fileDir) {
    // .csvリンクを抽出（URL内の入れ子括弧にも対応）
    const linkRegex = /\[([^\]]*)\]\(([^)]*(?:\([^)]*\)[^)]*)*\.csv)\)/g;
    let match;
    const replacements = [];

    while ((match = linkRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const linkText = match[1];
        const rawPath = match[2];

        // http(s) と絶対パスは対象外
        if (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('/')) {
            continue;
        }

        // パスをURLデコード（Notion書き出し対策）
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch (e) {
            decodedPath = rawPath;
        }

        const absolutePath = fileDir + '/' + decodedPath;

        try {
            const csvText = await readTextFile(absolutePath);
            const table = csvToMarkdownTable(csvText, linkText);
            if (table) {
                replacements.push({ original: fullMatch, replacement: table });
            }
        } catch (err) {
            console.warn('Could not resolve CSV link:', absolutePath, err);
        }
    }

    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }
    return result;
}

function normalizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return 'Untitled';
    }
    const clean = filename
        .trim()
        .replace(/[\\/\?%\*:\|"<>]/g, '-')
        .replace(/\s+/g, ' ')
        .slice(0, 120);
    return clean || 'Untitled';
}

async function saveFile(defaultPath = null) {
    const tab = getActiveTab();
    if (!tab) return;

    try {
        let filePath = tab.filePath;

        if (!filePath) {
            const saveOptions = {
                filters: [{ name: 'Markdown', extensions: ['md'] }]
            };
            if (defaultPath) {
                saveOptions.defaultPath = defaultPath;
            }
            filePath = await tauriSave(saveOptions);
        }

        if (filePath) {
            let markdown = getMarkdown();
            markdown = await resolveImagesForSave(markdown, filePath);
            const start = Date.now();
            await writeTextFile(filePath, markdown);
            const elapsed = (Date.now() - start) / 1000;
            if (elapsed >= 30) {
                showError('保存に30秒以上かかりました（' + elapsed.toFixed(1) + '秒）。ファイルサイズやストレージの状態をご確認ください。');
            }
            tab.filePath = filePath;
            tab.title = filePath.split('/').pop().split('\\').pop();
            tab.content = editor.innerHTML;
            tab.isModified = false;
            renderTabs();
            updateStatusBar();
        }
    } catch (err) {
        console.error('Error saving file:', err);
        showError('ファイルを保存できませんでした: ' + err);
    }
}

async function saveAsFile() {
    const tab = getActiveTab();
    if (!tab) return;

    try {
        const defaultPath = tab.filePath || (tab.title.endsWith('.md') ? tab.title : tab.title + '.md');
        const filePath = await tauriSave({
            defaultPath: defaultPath,
            filters: [{ name: 'Markdown', extensions: ['md'] }]
        });

        if (filePath) {
            let markdown = getMarkdown();
            markdown = await resolveImagesForSave(markdown, filePath);
            await writeTextFile(filePath, markdown);
            tab.filePath = filePath;
            tab.title = filePath.split('/').pop().split('\\').pop();
            tab.content = editor.innerHTML;
            tab.isModified = false;
            renderTabs();
            updateStatusBar();
        }
    } catch (err) {
        console.error('Error saving file as:', err);
        showError('ファイルを保存できませんでした: ' + err);
    }
}

// asset:// URL を相対パスへ戻し、Base64画像をファイル保存する
async function resolveImagesForSave(markdown, mdFilePath) {
    // パスをスラッシュ形式へ正規化（UNC接頭辞は保持）
    const isUNC = /^\\\\|^\/\//.test(mdFilePath);
    let normalizedPath = mdFilePath.replace(/\\/g, '/');
    if (isUNC) {
        normalizedPath = '//' + normalizedPath.substring(2).replace(/\/+/g, '/');
    }
    const lastSlash = normalizedPath.lastIndexOf('/');
    const fileDir = normalizedPath.substring(0, lastSlash);
    const mdFileName = normalizedPath.substring(lastSlash + 1).replace(/\.md$/i, '');

    // --- 手順1: asset URL を相対パスへ戻す ---
    // macOS: asset://localhost/ENCODED_PATH
    // Windows: https://asset.localhost/PATH
    // 両方の形式に対応する
    const replacements = [];

    function assetUrlToAbsPath(url) {
        // macOS形式: asset://localhost/%2Fpath%2Fto%2Ffile
        if (url.startsWith('asset://localhost/')) {
            return decodeURIComponent(url.substring('asset://localhost/'.length));
        }
        // Windows形式: https://asset.localhost/PATH
        if (url.startsWith('https://asset.localhost/')) {
            return decodeURIComponent(url.substring('https://asset.localhost/'.length));
        }
        return null;
    }

    // パターン: ![alt](asset://localhost/...) または ![alt](https://asset.localhost/...)
    const mdAssetRegex = /!\[([^\]]*)\]\(((?:asset:\/\/localhost\/|https:\/\/asset\.localhost\/)[^)]+)\)/g;
    let match;
    while ((match = mdAssetRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const alt = match[1];
        const assetUrl = match[2];
        const absPath = assetUrlToAbsPath(assetUrl);
        if (absPath && absPath.startsWith(fileDir + '/')) {
            const relPath = absPath.substring(fileDir.length + 1);
            replacements.push({ original: fullMatch, replacement: '![' + alt + '](' + relPath + ')' });
        }
    }

    // パターン: <img src="asset://localhost/..."> / <img src="https://asset.localhost/...">
    const htmlAssetRegex = /<img\s+src="((?:asset:\/\/localhost\/|https:\/\/asset\.localhost\/)[^"]*)"\s*alt="([^"]*)"(?:\s*width="(\d+)")?\s*\/?>/g;
    while ((match = htmlAssetRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const assetUrl = match[1];
        const alt = match[2];
        const width = match[3];
        const absPath = assetUrlToAbsPath(assetUrl);
        if (absPath && absPath.startsWith(fileDir + '/')) {
            const relPath = absPath.substring(fileDir.length + 1);
            const widthAttr = width ? ' width="' + width + '"' : '';
            replacements.push({ original: fullMatch, replacement: '<img src="' + relPath + '" alt="' + alt + '"' + widthAttr + '>' });
        }
    }

    // 先に asset URL 置換を適用
    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }

    // --- 手順2: Base64画像（貼り付け由来）をファイル保存 ---
    // 新規画像の保存先ディレクトリを決定
    let imageDir = null;

    // 付随ディレクトリ（Notion形式）を確認
    try {
        const exactDir = fileDir + '/' + mdFileName;
        if (await exists(exactDir)) { imageDir = mdFileName; }
    } catch (e) { /* ignore */ }
    if (!imageDir) {
        const notionHashMatch = mdFileName.match(/^(.+)\s+[0-9a-f]{20,32}$/);
        if (notionHashMatch) {
            try {
                const baseDir = fileDir + '/' + notionHashMatch[1];
                if (await exists(baseDir)) { imageDir = notionHashMatch[1]; }
            } catch (e) { /* ignore */ }
        }
    }
    // Markdown内の既存相対画像パスから推定
    if (!imageDir) {
        const existingImgMatch = result.match(/!\[[^\]]*\]\(([^)]+\/)[^/]+\.[a-zA-Z]+\)/);
        if (existingImgMatch) {
            const relDir = existingImgMatch[1].replace(/\/$/, '');
            try {
                if (await exists(fileDir + '/' + relDir)) { imageDir = relDir; }
            } catch (e) { /* ignore */ }
        }
    }
    if (!imageDir) { imageDir = 'images'; }

    // Base64画像（貼り付け由来）を抽出
    const mdImgRegex = /!\[([^\]]*)\]\(data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=\s]+)\)/g;
    // HTML画像正規表現: 属性順が異なっても拾える柔軟パターン
    // 例: <img ... src="data:image/...;base64,..." ... alt="..." ...>
    const htmlImgRegex = /<img[^>]*src="data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=\s]+)"[^>]*alt="([^"]*)"[^>]*>/g;

    // 既存ファイルを走査して上書きを回避
    let imgCounter = 0;
    try {
        const dirPath = fileDir + '/' + imageDir;
        if (await exists(dirPath)) {
            const entries = await readDir(dirPath);
            for (const entry of entries) {
                const name = entry.name || '';
                const counterMatch = name.match(/_(\d{3})\.[a-zA-Z]+$/);
                if (counterMatch) {
                    const num = parseInt(counterMatch[1], 10);
                    if (num > imgCounter) imgCounter = num;
                }
            }
        }
    } catch (e) { /* 失敗時は0から開始 */ }
    const base64Replacements = [];

    while ((match = mdImgRegex.exec(result)) !== null) {
        imgCounter++;
        const fullMatch = match[0];
        const alt = match[1];
        const mime = match[2];
        const base64Data = match[3].replace(/\s/g, '');
        const ext = mimeToExt(mime);
        const fileName = generateImageFileName(alt, imgCounter, ext);
        try {
            await saveImageFile(fileDir, imageDir, fileName, base64Data);
            base64Replacements.push({ original: fullMatch, replacement: '![' + alt + '](' + imageDir + '/' + fileName + ')' });
        } catch (err) { console.warn('Failed to save image:', fileName, err); }
    }

    while ((match = htmlImgRegex.exec(result)) !== null) {
        imgCounter++;
        const fullMatch = match[0];
        const mime = match[1];
        const base64Data = match[2].replace(/\s/g, '');
        const alt = match[3];
        // width 属性があれば fullMatch から抽出（正規表現では未捕捉）
        const widthMatch = fullMatch.match(/width="(\d+)"/);
        const width = widthMatch ? widthMatch[1] : null;
        const ext = mimeToExt(mime);
        const fileName = generateImageFileName(alt, imgCounter, ext);
        try {
            await saveImageFile(fileDir, imageDir, fileName, base64Data);
            const widthAttr = width ? ' width="' + width + '"' : '';
            base64Replacements.push({ original: fullMatch, replacement: '<img src="' + imageDir + '/' + fileName + '" alt="' + alt + '"' + widthAttr + '>' });
        } catch (err) { console.warn('Failed to save image:', fileName, err); }
    }

    for (const r of base64Replacements) {
        result = result.replace(r.original, r.replacement);
    }
    return result;
}
