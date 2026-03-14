// =====================================================
// SuMark - File Operations Module
// =====================================================
// newFile, openFileFromPath, openFile, resolveRelativeImages,
// resolveRelativeCsvLinks, saveFile, saveAsFile, resolveImagesForSave

// Normalize file paths that may be provided as file:// URLs (especially on Windows)
function normalizeFilePath(rawPath) {
    if (!rawPath) return rawPath;
    let p = rawPath.trim();

    // Strip file:// scheme if present
    if (p.startsWith('file://')) {
        // file:///C:/... or file://hostname/... need to be normalized to a local file path
        p = p.replace(/^file:\/\//, '');
        // Windows file URLs may start with /C:/... so remove leading slash
        if (/^\/[A-Za-z]:\//.test(p)) {
            p = p.substring(1);
        }
    }

    // Decode percent-encoded characters (spaces, non-ascii, etc.)
    try {
        p = decodeURIComponent(p);
    } catch (e) {
        // Ignore invalid percent escapes
    }

    // Normalize separators
    p = p.replace(/\\/g, '/');

    // Collapse redundant slashes
    p = p.replace(/\/+/g, '/');

    return p;
}

async function newFile() {
    createTab(null, '無題', '<p><br></p>');
    editor.focus();
}

// Open a file from a given path (used by both dialog and drag-and-drop)
async function openFileFromPath(filePath) {
    try {
        // Normalize file:// URLs to local filesystem paths (Windows may provide file:// paths)
        const normalizedFilePath = normalizeFilePath(filePath);
        console.log('[DEBUG openFileFromPath START] filePath:', filePath, 'normalized:', normalizedFilePath);
        
        // Check if file is already open
        const existingTab = tabs.find(t => t.filePath === normalizedFilePath);
        if (existingTab) {
            console.log('[DEBUG openFileFromPath] File already open, switching tab');
            switchTab(existingTab.id);
            return;
        }

        console.log('[DEBUG openFileFromPath] Reading file...');
        let contents = await readTextFile(normalizedFilePath);
        console.log('[DEBUG openFileFromPath] File read successfully, contents length:', contents.length);

        // Resolve relative image paths to asset protocol URLs for display
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
            // Continue even if CSV resolution fails
        }

        // Notion エクスポート形式の複数行テーブルセルを正規化
        console.log('[DEBUG openFileFromPath] Preprocessing Notion markdown...');
        contents = preprocessNotionMarkdown(contents);

        // Normalize task list items: GFM requires a space after [x]/[ ]
        contents = contents.replace(/^(\s*[-*+]\s+\[[ xX]\])([^\s]|$)/gm, '$1 $2');
        // Empty task items need ZWSP for marked to recognize them as task list
        contents = contents.replace(/^(\s*[-*+]\s+\[[ xX]\])\s*$/gm, '$1 \u200B');

        console.log('[DEBUG openFileFromPath] Parsing markdown to HTML...');
        const filename = normalizedFilePath.split('/').pop().split('\\').pop();
        const html = (typeof marked !== 'undefined') ? marked.parse(contents) : contents;
        console.log('[DEBUG openFileFromPath] Creating tab...');
        createTab(normalizedFilePath, filename, html);
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
            // Handle both single and multiple file selections
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

// Resolve relative image paths in Markdown to asset protocol URLs for display
// This is a synchronous, lightweight string replacement (no file I/O)
function resolveRelativeImages(markdown, fileDir) {
    // Normalize fileDir to use forward slashes and remove trailing slash
    fileDir = fileDir.replace(/\\/g, '/').replace(/\/$/, '');
    console.log('[DEBUG resolveRelativeImages] fileDir:', fileDir);

    // Handle nested parentheses in URLs (e.g., Notion exports with unencoded parens)
    const imgRegex = /!\[([^\]]*)\]\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
    let match;
    const replacements = [];

    while ((match = imgRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const alt = match[1];
        const rawPath = match[2];
        console.log('[DEBUG resolveRelativeImages] matched image:', fullMatch, 'rawPath:', rawPath);

        // Skip data URIs, http(s) URLs, absolute paths, and already-converted asset URLs
        if (rawPath.startsWith('data:') || rawPath.startsWith('http://') ||
            rawPath.startsWith('https://') || rawPath.startsWith('/') ||
            rawPath.startsWith('asset://')) {
            console.log('[DEBUG resolveRelativeImages] skipping:', rawPath);
            continue;
        }

        // URL-decode the path (Notion exports use URL-encoded paths)
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch (e) {
            decodedPath = rawPath;
        }

        // Normalize path separators in decoded path
        decodedPath = decodedPath.replace(/\\/g, '/');
        console.log('[DEBUG resolveRelativeImages] decodedPath:', decodedPath);

        // Resolve to absolute path and convert to asset protocol URL
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

    // Apply replacements
    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }
    console.log('[DEBUG resolveRelativeImages] final result has', replacements.length, 'replacements');
    return result;
}

// Resolve relative CSV links in Markdown to inline Markdown tables
async function resolveRelativeCsvLinks(markdown, fileDir) {
    // Match links ending in .csv, handling nested parentheses in URLs
    const linkRegex = /\[([^\]]*)\]\(([^)]*(?:\([^)]*\)[^)]*)*\.csv)\)/g;
    let match;
    const replacements = [];

    while ((match = linkRegex.exec(markdown)) !== null) {
        const fullMatch = match[0];
        const linkText = match[1];
        const rawPath = match[2];

        // Skip http(s) URLs and absolute paths
        if (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('/')) {
            continue;
        }

        // URL-decode the path (Notion exports use URL-encoded paths)
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

async function saveFile() {
    const tab = getActiveTab();
    if (!tab) return;

    try {
        let filePath = tab.filePath;

        if (!filePath) {
            filePath = await tauriSave({
                filters: [{ name: 'Markdown', extensions: ['md'] }]
            });
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

// Convert asset:// URLs back to relative paths, and save Base64 images to files
async function resolveImagesForSave(markdown, mdFilePath) {
    // Normalize file path to use forward slashes
    const normalizedPath = mdFilePath.replace(/\\/g, '/');
    const lastSlash = normalizedPath.lastIndexOf('/');
    const fileDir = normalizedPath.substring(0, lastSlash);
    const mdFileName = normalizedPath.substring(lastSlash + 1).replace(/\.md$/i, '');

    // --- Step 1: Convert asset URLs back to relative paths ---
    // macOS: asset://localhost/ENCODED_PATH
    // Windows: https://asset.localhost/PATH
    // Both forms need to be handled
    const replacements = [];

    function assetUrlToAbsPath(url) {
        // macOS format: asset://localhost/%2Fpath%2Fto%2Ffile
        if (url.startsWith('asset://localhost/')) {
            return decodeURIComponent(url.substring('asset://localhost/'.length));
        }
        // Windows format: https://asset.localhost/PATH
        if (url.startsWith('https://asset.localhost/')) {
            return decodeURIComponent(url.substring('https://asset.localhost/'.length));
        }
        return null;
    }

    // Pattern: ![alt](asset://localhost/...) or ![alt](https://asset.localhost/...)
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

    // Pattern: <img src="asset://localhost/..." or <img src="https://asset.localhost/...">
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

    // Apply asset URL replacements first
    let result = markdown;
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }

    // --- Step 2: Save Base64 images (from paste) to files ---
    // Detect image directory for new images
    let imageDir = null;

    // Check companion directory (Notion-style)
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
    // Check from existing relative image paths in the markdown
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

    // Match Base64 images (from paste operations)
    const mdImgRegex = /!\[([^\]]*)\]\(data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=\s]+)\)/g;
    // HTML image regex: more flexible pattern that handles attributes in any order
    // Matches: <img ... src="data:image/...;base64,..." ... alt="..." ...>
    const htmlImgRegex = /<img[^>]*src="data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=\s]+)"[^>]*alt="([^"]*)"[^>]*>/g;

    // Scan existing files in image directory to avoid overwriting
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
    } catch (e) { /* ignore - start from 0 */ }
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
        // Extract width from the full match if present (new regex doesn't capture it)
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
