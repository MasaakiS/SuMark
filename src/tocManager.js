// ========== TOC (Table of Contents) Manager ==========
// main.js から分離した目次関連の関数群
// 依存: editor (グローバル), escapeHtml() (utils.js), markModified(), saveEditorState() (main.js)

/**
 * 既存のTOCコンテナに削除ボタンを付与し、contenteditable=false を確保する
 */
function setupTocDeleteButtons() {
    editor.querySelectorAll('.toc-container').forEach(toc => {
        // Make sure it's contenteditable=false
        if (toc.getAttribute('contenteditable') !== 'false') {
            toc.setAttribute('contenteditable', 'false');
        }
        // Add delete button if not already present
        if (!toc.querySelector('.toc-delete-btn')) {
            const btn = document.createElement('button');
            btn.className = 'toc-delete-btn';
            btn.title = '目次を削除';
            btn.textContent = '✕';
            toc.insertBefore(btn, toc.firstChild);
        }
    });
}

/**
 * エディタ内の見出し要素から目次を生成して挿入する
 */
function insertTOC() {
    const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
        return;
    }

    // Assign unique IDs to all headings
    const idCounts = {};
    headings.forEach(h => {
        const text = h.textContent.trim();
        if (!text) return;
        // Generate a slug from the heading text
        let slug = 'heading-' + text
            .toLowerCase()
            .replace(/[^\w\u3000-\u9fff\uf900-\ufaff\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]+/g, '-')
            .replace(/^-+|-+$/g, '');
        // Handle duplicates
        if (idCounts[slug] !== undefined) {
            idCounts[slug]++;
            slug = slug + '-' + idCounts[slug];
        } else {
            idCounts[slug] = 0;
        }
        h.id = slug;
    });

    let html = '<div class="toc-container" contenteditable="false">' +
               '<button class="toc-delete-btn" title="目次を削除">✕</button>' +
               '<p><strong>📑 目次</strong></p><ul>';
    headings.forEach(h => {
        const level = parseInt(h.tagName[1]);
        const text = h.textContent.trim();
        if (text && h.id) {
            html += '<li style="margin-left:' + ((level - 1) * 20) + 'px">' +
                    '<a href="#' + h.id + '" class="toc-link">' + escapeHtml(text) + '</a></li>';
        }
    });
    html += '</ul></div><p><br></p>';

    document.execCommand('insertHTML', false, html);
    markModified();
    saveEditorState(); // Save state after inserting TOC
}
