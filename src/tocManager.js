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

/**
 * Markdown保存→再読み込み時に失われた .toc-container 構造を復元する。
 * marked.parse() は「📑 目次」を <p><strong>📑 目次</strong></p> + <ul> として出力するため、
 * これを検出して .toc-container で囲み直し、リンクに .toc-link クラスを付与する。
 */
function reconstructTocContainers() {
    // 既に .toc-container がある場合は何もしない
    if (editor.querySelector('.toc-container')) {
        return;
    }

    // 「📑 目次」を含む <strong> 要素を探す
    const strongs = editor.querySelectorAll('strong');
    for (const strong of strongs) {
        if (!strong.textContent.includes('📑 目次')) {
            continue;
        }
        
        const titleP = strong.closest('p');
        if (!titleP) continue;

        // titleP の次の兄弟要素が <ul> であることを確認
        let nextEl = titleP.nextElementSibling;
        if (!nextEl || nextEl.tagName !== 'UL') continue;

        // UL 内のリンクが #heading- or # で始まるか確認（目次リンクかどうか）
        const links = nextEl.querySelectorAll('a[href^="#"]');
        if (links.length === 0) continue;

        // .toc-container を構築
        const container = document.createElement('div');
        container.className = 'toc-container';
        container.setAttribute('contenteditable', 'false');

        // titleP の前に container を挿入
        titleP.parentNode.insertBefore(container, titleP);

        // titleP と ul を container の中に移動
        container.appendChild(titleP);
        container.appendChild(nextEl);

        // UL 内のリンクに .toc-link クラスを付与
        links.forEach(link => {
            link.classList.add('toc-link');
        });
    }
}

/**
 * 保存後に再読み込みされた目次のリンクに基づいて、見出し要素にIDを復元する。
 * reconstructTocContainers() の後に呼ぶこと。
 * （marked.jsでheaderIds: falseのため、保存→再読み込み時にIDが失われる問題を修正）
 */
function restoreTocHeadingIds() {
    // .toc-container 内のリンクから見出しIDを復元
    const tocLinks = editor.querySelectorAll('.toc-container a.toc-link[href^="#"]');
    if (tocLinks.length === 0) {
        return;
    }

    const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');

    tocLinks.forEach(link => {
        const href = link.getAttribute('href');
        const linkText = link.textContent.trim();
        if (!href || !href.startsWith('#')) return;

        const targetId = href.substring(1); // # を除去

        // 既にIDが存在するか確認
        if (editor.querySelector('#' + CSS.escape(targetId))) return;

        // リンクテキストと一致する見出し要素を探してIDを付与
        for (const h of headings) {
            if (h.textContent.trim() === linkText && !h.id) {
                h.id = targetId;
                break;
            }
        }
    });
}
