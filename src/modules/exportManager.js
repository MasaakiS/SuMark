// =====================================================
// SuMark - エクスポート管理モジュール
// =====================================================
// exportPDF

async function exportPDF() {
    try {
        const tab = getActiveTab();
        const fileName = tab ? tab.title.replace(/\.md$/i, '') : '無題';

        // 保存先HTMLをユーザーに選択してもらう（ブラウザ側でPDF印刷）
        const savePath = await tauriSave({
            defaultPath: fileName + '.html',
            filters: [{ name: 'HTML', extensions: ['html'] }]
        });
        if (!savePath) return;

        // エディタ内容をクリーンなクローンとして取得
        const clone = editor.cloneNode(true);

        // クローンからUI要素を除去
        clone.querySelectorAll('.code-copy-container, .code-copy-btn, .toc-delete-btn, .image-resize-handle, .image-copy-btn, .line-numbers-gutter, .code-wrap-btn, .code-block-toolbar').forEach(el => el.remove());

        // PDF出力向けに asset:// / https://asset.localhost/ を Base64 へ変換
        // macOS では asset://localhost/ENCODED_PATH
        // Windows では https://asset.localhost/PATH
        // どちらの形式も処理する
        const allImages = clone.querySelectorAll('img');
        for (const img of allImages) {
            try {
                const srcAttr = img.getAttribute('src') || '';
                let imgFilePath = null;

                if (srcAttr.startsWith('asset://localhost/')) {
                    // macOS形式: asset://localhost/%2Fpath%2Fto%2Ffile
                    imgFilePath = decodeURIComponent(srcAttr.substring('asset://localhost/'.length));
                } else if (srcAttr.startsWith('https://asset.localhost/')) {
                    // Windows形式: https://asset.localhost/path/to/file
                    imgFilePath = decodeURIComponent(srcAttr.substring('https://asset.localhost/'.length));
                }

                if (!imgFilePath) continue; // asset形式以外の画像（data:, http: など）はスキップ

                // 画像ファイルを読み込む
                const binaryData = await readBinaryFile(imgFilePath);

                // 拡張子からMIMEタイプを判定
                const lowerPath = imgFilePath.toLowerCase();
                let mimeType = 'image/png';
                if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
                    mimeType = 'image/jpeg';
                } else if (lowerPath.endsWith('.gif')) {
                    mimeType = 'image/gif';
                } else if (lowerPath.endsWith('.webp')) {
                    mimeType = 'image/webp';
                } else if (lowerPath.endsWith('.svg')) {
                    mimeType = 'image/svg+xml';
                } else if (lowerPath.endsWith('.bmp')) {
                    mimeType = 'image/bmp';
                }

                // Base64へ変換（大きいファイルはチャンク処理）
                const bytes = new Uint8Array(binaryData);
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                }
                const base64 = btoa(binary);
                img.setAttribute('src', `data:${mimeType};base64,${base64}`);
            } catch (err) {
                console.error('Failed to convert image to Base64:', img.getAttribute('src'), err);
                // 元URLを維持（壊れる可能性はあるが削除より優先）
            }
        }

        const editorHTML = clone.innerHTML;

        // 現在のスタイルシートを取得
        let cssText = '';
        try {
            const stylesheets = document.styleSheets;
            for (let i = 0; i < stylesheets.length; i++) {
                try {
                    const rules = stylesheets[i].cssRules || stylesheets[i].rules;
                    for (let j = 0; j < rules.length; j++) {
                        cssText += rules[j].cssText + '\n';
                    }
                } catch (e) {
                    // クロスオリジンのスタイルシートはスキップ
                }
            }
        } catch (e) {
            console.error('Failed to read stylesheets:', e);
        }

        // hljsテーマのCSSも取得して埋め込む（ローカルバンドル済みファイルを使用）
        let hljsCSS = '';
        try {
            const resp = await fetch('./vendor/atom-one-light.min.css');
            if (resp.ok) hljsCSS = await resp.text();
        } catch (e) { /* ignore */ }

        // 完全なHTMLドキュメントを構築
        const fullHTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
/* 基本スタイル */
body {
    font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 400;
    margin: 40px auto;
    max-width: 900px;
    padding: 0 20px;
    color: #333;
    line-height: 1.8;
    background: white;
}

/* 見出し */
h1, h2, h3, h4, h5, h6 { font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; color: #1a1a1a; }
h1 { font-size: 2em; border-bottom: 2px solid #eaecef; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }

/* 段落 */
p { margin-bottom: 16px; }

/* リンク */
a { color: #0366d6; text-decoration: none; }

/* インラインコード */
code {
    padding: 0.2em 0.4em;
    font-size: 85%;
    color: #c7254e;
    background-color: #f9f2f4;
    border-radius: 6px;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

/* コードブロック */
pre {
    position: relative;
    margin-bottom: 16px;
    padding: 0;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #fafafa;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    display: flex;
    flex-direction: row;
}
pre code {
    padding: 16px;
    margin: 0;
    color: inherit;
    background-color: transparent;
    border-radius: 0;
    font-size: 100%;
    display: block;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    flex: 1;
    min-width: 0;
}

/* テーブル */
table { border-collapse: collapse; margin-bottom: 16px; width: 100%; }
th, td { padding: 6px 13px; border: 1px solid #ddd; }
th { background-color: #f6f8fa; font-weight: 700; }

/* 引用 */
blockquote {
    margin: 0 0 16px;
    padding: 0 1em;
    color: #6a737d;
    border-left: 4px solid #dfe2e5;
}

/* リスト */
ul, ol { margin-bottom: 16px; padding-left: 2em; }
li { margin-bottom: 4px; }

/* タスクリスト */
.task-list-item { list-style: none; margin-left: -1.5em; }
input[type="checkbox"] { margin-right: 0.5em; }

/* 水平線 */
hr { border: none; border-top: 2px solid #eaecef; margin: 24px 0; }

/* 画像 */
img { max-width: 100%; }

/* 目次 */
.toc-container {
    margin: 16px 0;
    padding: 16px 20px;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    border-left: 4px solid #4a9eff;
}
.toc-container ul { list-style: none; padding-left: 0; }
.toc-container li { padding: 2px 0; font-size: 14px; }
.toc-container a { color: #0366d6; text-decoration: none; }

/* Mermaid */
.mermaid-container { margin: 16px 0; text-align: center; }

/* Highlight.js テーマ */
${hljsCSS}

/* 印刷最適化 */
@media print {
    body { margin: 0; padding: 0; max-width: 100%; }
    pre { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
    img { page-break-inside: avoid; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
    pre code { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    blockquote { border-left-color: #dfe2e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toc-container { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    code { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
${editorHTML}
<script>
// 読み込み後に印刷ダイアログを自動表示
window.onload = function() {
    window.print();
};
<\/script>
</body>
</html>`;

        await writeTextFile(savePath, fullHTML);

        // 既定ブラウザで開いて印刷する
        await invoke('open_in_browser', { path: savePath });
    } catch (err) {
        console.error('PDF export error:', err);
        showError('PDF出力に失敗しました: ' + err);
    }
}
