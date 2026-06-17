// =====================================================
// SuMark - Markdown変換モジュール
// =====================================================
// Markdown ↔ HTML 双方向変換ロジック
// - configureTurndown(): HTML→Markdown 変換設定 (Turndown + GFM + カスタムルール)
// - getMarkdown(): エディタHTML → Markdown
// - setMarkdown(): Markdown → エディタHTML
// - preprocessNotionMarkdown(): Notion形式テーブル前処理
//
// 依存: editor (main.js)
//       TurndownService, TurndownPluginGfm, marked, DOMPurify, hljs (vendor)
//       resetGlobalState (main.js)
//       renderMermaidBlocks (mermaidManager.js), renderMathBlocks (mathRender.js)
//       reconstructTocContainers, restoreTocHeadingIds, setupTocDeleteButtons (tocManager.js)
//       updateAllLineNumbers (codeHighlight.js), restoreCodeWrapStates (toolbarActions.js)
//       setupToggleBlocks (toggleBlock.js), setupImageErrorHandling (imageManager.js)

// Turndownインスタンス
let turndownService;

// DOMPurify設定: ローカル表示用にTauriの asset:// プロトコルを許可
const DOMPURIFY_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

// ========== Turndown設定 ==========
function configureTurndown() {
    if (typeof TurndownService === 'undefined') {
        console.error('[ERROR] Turndown not loaded - TurndownService is undefined');
        return;
    }

    turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '*',
        strongDelimiter: '**',
        // 末尾スペース（  ）ではなくバックスラッシュ改行を使う
        // 末尾スペースは保存/再読込で消えやすく不安定
        br: '',
    });

    // GFMプラグイン（表、打消し線、タスクリスト）を先に読み込む
    const gfmPlugin = (typeof TurndownPluginGfm !== 'undefined') ? TurndownPluginGfm :
                       (typeof turndownPluginGfm !== 'undefined') ? turndownPluginGfm : null;
    if (gfmPlugin && gfmPlugin.gfm) {
        turndownService.use(gfmPlugin.gfm);
        console.log('Turndown GFM plugin loaded');
    }

    // カスタムルール: bare URL autolink をラウンドトリップ保持する
    // marked の GFM モードが https://... や www.xxx を <a href="...">...</a> に変換するが、
    // Turndown のデフォルト links ルールは [url](url) 形式で出力するため保存時に形式が変化してしまう。
    // このルールで元の bare URL テキストとして保存し、形式変化を防ぐ。
    // 判定条件:
    //   - https?:// bare URL → getAttribute('href') === textContent
    //   - www. bare URL     → marked が "http://" を付加するため href === "http://" + textContent
    // 明示リンク [text](url)（text ≠ url）はこの条件に一致せず、従来どおり保存される。
    turndownService.addRule('bareUrlLink', {
        filter: function(node) {
            if (node.nodeName !== 'A') return false;
            const href = node.getAttribute('href');
            const text = node.textContent.trim();
            if (!href || !text) return false;
            // https?:// bare URL
            if (href === text) return true;
            // www. bare URL（marked が "http://" を付加）
            if (text.startsWith('www.') && href === 'http://' + text) return true;
            return false;
        },
        replacement: function(content, node) {
            return node.textContent.trim();
        }
    });

    // カスタムルール: チェックボックス付きタスクリスト項目（GFMルールを上書きするため後で登録）
    turndownService.addRule('taskListCheckbox', {
        filter: function(node) {
            return node.nodeName === 'LI' &&
                   node.querySelector(':scope > input[type="checkbox"]');
        },
        replacement: function(content, node) {
            const cb = node.querySelector(':scope > input[type="checkbox"]');
            // property と attribute の両方を確認
            // property は実行時状態、attribute はシリアライズ後HTMLの状態
            const checked = cb && (cb.checked || cb.hasAttribute('checked'));

            // 内容先頭のチェックボックス記号を除去（GFMが [ ]/[x] を文字として付与するため）
            let text = content.replace(/^\s*\[([ x])\]\s*/, '').trim();
            // GFMでは [x]/[ ] の直後に空白が必要
            // 空項目はゼロ幅スペースを使用（markedは末尾空白/NBSPを無視するため）
            if (!text) text = '\u200B';

            // ネスト深さを計算（editor内の祖先 <ul>/<ol> 数を数える）
            let depth = 0;
            let parent = node.parentElement;
            while (parent && parent.id !== 'editor') {
                if (parent.nodeName === 'UL' || parent.nodeName === 'OL') {
                    depth++;
                }
                parent = parent.parentElement;
            }
            // depth 1 = 最上位（インデントなし）、depth 2 = 1段ネスト（4スペース）
            const indent = '    '.repeat(Math.max(0, depth - 1));

            return indent + (checked ? '- [x] ' : '- [ ] ') + text + '\n';
        }
    });

    // カスタムルール: <pre><code>...</code></pre> を常にフェンスコードへ変換
    turndownService.addRule('fencedCodeBlock', {
        filter: function(node) {
            return node.nodeName === 'PRE';
        },
        replacement: function(content, node) {
            const codeEl = node.querySelector('code');
            const codeText = codeEl ? codeEl.textContent : node.textContent || '';
            let lang = '';
            if (codeEl && codeEl.className) {
                const match = codeEl.className.match(/language-([\w-]+)/);
                if (match) lang = match[1];
            }
            const fence = turndownService.options.fence || '```';
            return '\n' + fence + (lang ? lang : '') + '\n' + codeText.replace(/\n$/, '') + '\n' + fence + '\n';
        }
    });

    // コードブロック内の <br> を保持
    turndownService.addRule('codeBlockBr', {
        filter: function(node) {
            return node.nodeName === 'BR' &&
                   node.parentNode &&
                   (node.parentNode.nodeName === 'CODE' || node.parentNode.nodeName === 'PRE');
        },
        replacement: function() {
            return '\n';
        }
    });

    // テーブルセル内の <br> はHTMLとして保持（Markdown表は改行をネイティブサポートしない）
    turndownService.addRule('tableCellBr', {
        filter: function(node) {
            if (node.nodeName !== 'BR') return false;
            // テーブルセル内か確認
            let parent = node.parentNode;
            while (parent) {
                if (parent.nodeName === 'TD' || parent.nodeName === 'TH') {
                    return true;
                }
                if (parent.nodeName === 'TABLE') {
                    return false; // tableに到達したがセル内ではない
                }
                parent = parent.parentNode;
            }
            return false;
        },
        replacement: function() {
            return '<br>';
        }
    });

    // Turndown出力からコピーボタン類を除去
    turndownService.addRule('codeCopyBtn', {
        filter: function(node) {
            return node.classList && (
                node.classList.contains('code-copy-btn') ||
                node.classList.contains('code-copy-container') ||
                node.classList.contains('code-wrap-btn') ||
                node.classList.contains('code-lang-select') ||
                node.classList.contains('image-copy-btn') ||
                node.classList.contains('code-block-toolbar')
            );
        },
        replacement: function() {
            return '';
        }
    });

    // Turndown出力から行番号ガターを除去
    turndownService.addRule('lineNumbersGutter', {
        filter: function(node) {
            return node.classList && node.classList.contains('line-numbers-gutter');
        },
        replacement: function() {
            return '';
        }
    });

    // KaTeX インライン数式
    turndownService.addRule('mathInline', {
        filter: function(node) {
            return node.classList && node.classList.contains('math-inline');
        },
        replacement: function(content, node) {
            // data属性またはテキスト内容から元の数式を抽出
            const mathText = node.getAttribute('data-math') || node.textContent.trim();
            return '$' + mathText + '$';
        }
    });

    // KaTeX ブロック数式
    turndownService.addRule('mathDisplay', {
        filter: function(node) {
            return node.classList && node.classList.contains('math-display');
        },
        replacement: function(content, node) {
            const mathText = node.getAttribute('data-math') || node.textContent.trim();
            return '\n$$' + mathText + '$$\n';
        }
    });

    // Mermaidブロック: 描画済みSVGをフェンスコードへ戻す
    turndownService.addRule('mermaidBlock', {
        filter: function(node) {
            return node.classList && node.classList.contains('mermaid-container');
        },
        replacement: function(content, node) {
            const codeEl = node.querySelector('code.language-mermaid');
            const source = node.getAttribute('data-mermaid-source') || (codeEl ? codeEl.textContent.trim() : '');
            return '\n```mermaid\n' + source + '\n```\n';
        }
    });

    // Mermaid diagram only mode: 図形のみ表示モード
    turndownService.addRule('mermaidDiagramOnly', {
        filter: function(node) {
            return node.classList && node.classList.contains('mermaid-diagram-only');
        },
        replacement: function(content, node) {
            const codeEl = node.querySelector('code.language-mermaid');
            const source = node.getAttribute('data-mermaid-source') || (codeEl ? codeEl.textContent.trim() : '');
            // 標準的なMarkdown形式で保存
            return '\n```mermaid\n' + source + '\n```\n';
        }
    });

    // Mermaid code and diagram mode: コード＋図形表示モード
    turndownService.addRule('mermaidCodeAndDiagram', {
        filter: function(node) {
            return node.classList && node.classList.contains('mermaid-code-and-diagram');
        },
        replacement: function(content, node) {
            const codeEl = node.querySelector('code.language-mermaid');
            const source = node.getAttribute('data-mermaid-source') || (codeEl ? codeEl.textContent.trim() : '');
            // 標準的なMarkdown形式で保存
            return '\n```mermaid\n' + source + '\n```\n';
        }
    });

    // サイズ指定画像: HTML出力時に width を保持
    turndownService.addRule('imageWithSize', {
        filter: function(node) {
            return node.tagName === 'IMG' && node.style.width;
        },
        replacement: function(content, node) {
            const alt = node.alt || '';
            const src = node.src || '';
            const width = parseInt(node.style.width);
            return '<img src="' + src + '" alt="' + alt + '" width="' + width + '">';
        }
    });

    // 画像エラー表示コンテナ: Markdown画像記法へ戻す
    turndownService.addRule('imageErrorContainer', {
        filter: function(node) {
            return node.classList && node.classList.contains('img-error-container');
        },
        replacement: function(content, node) {
            const altTextEl = node.querySelector('.img-error-text');
            const srcTextEl = node.querySelector('.img-error-src');
            const alt = altTextEl ? altTextEl.textContent : '画像を読み込めません';
            let src = '';
            if (srcTextEl) {
                const srcMatch = srcTextEl.textContent.match(/\(画像パス: (.+)\)/);
                if (srcMatch) src = srcMatch[1];
            }
            return '![' + alt + '](' + src + ')';
        }
    });

    // トグル（details/summary）ブロック: HTMLとして保持
    turndownService.addRule('detailsBlock', {
        filter: function(node) {
            return node.nodeName === 'DETAILS';
        },
        replacement: function(content, node) {
            const summary = node.querySelector(':scope > summary');
            // 削除ボタンを除外したsummaryテキストを取得
            let summaryText = 'トグル';
            if (summary) {
                const clone = summary.cloneNode(true);
                const deleteBtn = clone.querySelector('.toggle-delete-btn');
                if (deleteBtn) deleteBtn.remove();
                summaryText = clone.textContent.trim() || 'トグル';
            }
            // toggle-content div もしくは summary 以降の内容を取得
            const contentDiv = node.querySelector(':scope > .toggle-content');
            let innerMd = '';
            if (contentDiv) {
                innerMd = turndownService.turndown(contentDiv.innerHTML).trim();
            } else {
                // フォールバック: summary 以外の子ノードを収集
                const tempDiv = document.createElement('div');
                Array.from(node.childNodes).forEach(child => {
                    if (child !== summary) tempDiv.appendChild(child.cloneNode(true));
                });
                innerMd = turndownService.turndown(tempDiv.innerHTML).trim();
            }
            if (!innerMd) innerMd = '内容を入力...';
            return '\n<details>\n<summary>' + summaryText + '</summary>\n\n' + innerMd + '\n\n</details>\n';
        }
    });

    // turndown時は toggle-content ラッパーを除去（detailsBlockルールで処理済み）
    turndownService.addRule('toggleContentDiv', {
        filter: function(node) {
            return node.classList && node.classList.contains('toggle-content');
        },
        replacement: function(content) {
            return content;
        }
    });

    // TOCコンテナ: Markdownの目次へ変換
    turndownService.addRule('tocContainer', {
        filter: function(node) {
            return node.classList && node.classList.contains('toc-container');
        },
        replacement: function(content, node) {
            const items = node.querySelectorAll('li');
            let md = '\n**📑 目次**\n\n';
            items.forEach(li => {
                const marginLeft = parseInt(li.style.marginLeft || '0');
                const indent = '  '.repeat(Math.floor(marginLeft / 20));
                const link = li.querySelector('a.toc-link');
                if (link) {
                    const href = link.getAttribute('href') || '';
                    const text = link.textContent.trim();
                    md += indent + '- [' + text + '](' + href + ')\n';
                } else {
                    md += indent + '- ' + li.textContent.trim() + '\n';
                }
            });
            return md + '\n';
        }
    });

    console.log('Turndown configured');
}

/**
 * テーブル区切り行のアライン記法を正規化する
 * marked は最低3本のハイフンを期待するため、短い区切り（例: --:）を ---: に補正する
 * @param {string} md
 * @returns {string}
 */
function normalizeTableAlignmentDelimiters(md) {
    const lines = md.split('\n');
    const out = [];

    for (const line of lines) {
        const trimmed = line.trim();
        const isSeparator = /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(trimmed);
        if (!isSeparator) {
            out.push(line);
            continue;
        }

        const cells = trimmed
            .replace(/^\|\s*/, '')
            .replace(/\s*\|$/, '')
            .split('|')
            .map(c => c.trim());

        const normalized = cells.map(cell => {
            const left = cell.startsWith(':');
            const right = cell.endsWith(':');
            const core = cell.replace(/^:/, '').replace(/:$/, '').replace(/-/g, '');
            // coreは使わないが、想定外文字が混じった場合も最小安全形へ寄せる
            const dashes = '---';
            return (left ? ':' : '') + dashes + (right ? ':' : '');
        });

        out.push('| ' + normalized.join(' | ') + ' |');
    }

    return out.join('\n');
}

// ========== Markdown変換 ==========
function getMarkdown() {
    const editorEl = editor || document.getElementById('editor');
    if (!editorEl) {
        console.error('[getMarkdown] editor element not found');
        return '';
    }
    if (!editor) {
        editor = editorEl;
    }

    if (!turndownService) {
        console.error('Turndown not available');
        return editorEl.textContent || '';
    }

    // 変換用にエディタ内容をクローン
    const clone = editorEl.cloneNode(true);

    // チェックボックスの checked プロパティを checked 属性へ同期
    // innerHTML シリアライズ時は属性のみ保持され、プロパティは保持されない
    const originalCheckboxes = editorEl.querySelectorAll('input[type="checkbox"]');
    const clonedCheckboxes = clone.querySelectorAll('input[type="checkbox"]');
    originalCheckboxes.forEach((original, i) => {
        const cloned = clonedCheckboxes[i];
        if (cloned) {
            if (original.checked) {
                cloned.setAttribute('checked', '');
            } else {
                cloned.removeAttribute('checked');
            }
        }
    });

    // contenteditable の空段落プレースホルダを除去
    // ブラウザは空ブロックにキャレット用 <br> を入れるため、
    // これがバックスラッシュ改行（\）としてシリアライズされないようにする。
    clone.querySelectorAll('p').forEach(p => {
        if (p.childNodes.length === 1 && p.firstChild.nodeName === 'BR') {
            p.removeChild(p.firstChild);
        }
    });

    let md = turndownService.turndown(clone.innerHTML);
    md = normalizeTableAlignmentDelimiters(md);

    return md;
}

// ========== Notion Markdown 前処理 ==========
/**
 * Notion エクスポート形式の Markdown を正規化する。
 *
 * Notion はテーブルセルの複数行コンテンツをリテラル改行で出力するため、
 * 標準の GFM パーサー（marked.js）では正しく解析できない。
 * このプリプロセッサは:
 *   1. テーブル内の複数行セルを <br> で結合して単一行の GFM テーブルに変換
 *   2. セル途中の | を次のセルの開始として解釈
 *   3. Notion 固有の記号を変換:
 *        •        → そのまま保持（Unicode 箇条書き）
 *        —- / ——  → — (区切り線の代替）
 *        []       → ☐ (未チェックチェックボックス)
 *        [x]      → ☑ (チェック済みチェックボックス)
 */
function preprocessNotionMarkdown(md) {
    const lines = md.split('\n');
    const output = [];
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();

        if (trimmed.startsWith('|')) {
            // テーブルブロックを収集（空行まで）
            const block = [];
            while (i < lines.length && lines[i].trim() !== '') {
                block.push(lines[i]);
                i++;
            }
            // セパレータ行があれば Notion 形式のテーブルとして処理
            const hasSep = block.some(l => /^\|[\s\-:|]+\|/.test(l.trim()));
            if (hasSep) {
                output.push(..._normalizeNotionTable(block));
            } else {
                output.push(...block);
            }
        } else {
            output.push(lines[i]);
            i++;
        }
    }

    return output.join('\n');
}

/**
 * Notion 形式の複数行テーブルブロックを、
 * 単一行の GFM テーブル行の配列に変換する。
 *
 * 判定: 先頭に | があり末尾に | がない行を複数行セルの開始とし、
 *       末尾が | の行まで収集して改行を <br> に変換する。
 */
function _normalizeNotionTable(lines) {
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const t = lines[i].trim();

        if (t.startsWith('|') && !t.endsWith('|')) {
            // 先頭に | があるが末尾に | がない → 複数行セルの開始
            // | で終わる行まで収集し、間の改行を全て <br> に変換
            const parts = [t];
            i++;
            while (i < lines.length) {
                const next = lines[i].trim();
                if (next === '') break; // 安全策: 空行で打ち切り
                parts.push(next);
                i++;
                if (next.endsWith('|')) break;
            }
            const joined = parts.join('<br>');
            result.push(joined);
        } else {
            result.push(t);
            i++;
        }
    }

    return result;
}

/**
 * 一部ドキュメントで使われる全角混在の目次表記を、標準的なMarkdownリンクへ正規化する。
 * 例: 1．［項目］（#見出し） → 1. [項目](#見出し)
 */
function normalizeLegacyJapaneseTocNotation(md) {
    let normalized = md;

    // "##目次" のような見出しを "## 目次" に正規化
    normalized = normalized.replace(/^(\s*#{1,6})(目次)\s*$/gm, '$1 $2');

    // 全角/半角記号が混在した目次リンク形式を標準リンクへ寄せる
    normalized = normalized.replace(
        /^(\s*\d+)\s*[\.．]\s*[［\[](.+?)[\]］]\s*[（(]\s*[#＃]([^)）\s]+)\s*[)）]\s*$/gm,
        '$1. [$2](#$3)'
    );

    return normalized;
}

/**
 * 読み込んだテーブルの空セルにプレースホルダを入れる。
 * DOM上で完全に空の td/th は高さが潰れやすいため、
 * 内部生成時と同じく non-breaking space を補う。
 * @param {HTMLElement} root
 */
function ensureTableCellPlaceholders(root) {
    if (!root) return;

    root.querySelectorAll('table td, table th').forEach(cell => {
        if (!cell.children.length && cell.textContent.trim() === '') {
            cell.innerHTML = '&nbsp;';
        }
    });
}



function setMarkdown(md) {
    console.log('[setMarkdown] called, md.length:', md.length);
    const editorEl = editor || document.getElementById('editor');
    if (!editorEl) {
        console.error('[setMarkdown] editor element not found');
        return;
    }
    if (!editor) {
        editor = editorEl;
    }

    beginProgrammaticEditorUpdate();

    try {
        // リセット: グローバル状態をクリア（複数ページロード時のメモリリーク防止）
        resetGlobalState();
        
        if (typeof marked === 'undefined') {
            editorEl.textContent = md;
            return;
        }

        // タスクリスト項目を正規化（GFMでは [x]/[ ] の直後に空白が必要）
        // 例: "- [x]"（空白なし）→ "- [x] "（空白あり）
        md = md.replace(/^(\s*[-*+]\s+\[[ xX]\])([^\s]|$)/gm, '$1 $2');
        // 空タスク項目（[x]後ろが空白/NBSPのみ）は marked 認識のため ZWSP が必要
        md = md.replace(/^(\s*[-*+]\s+\[[ xX]\])\s*$/gm, '$1 \u200B');

        // インデントされた単独 '-' が Setext H2 見出しと誤解釈されるのを防ぐ
        // （例: ネストリスト末尾空項目 "- 3\n    -" で marked が "3\n-" を H2 と解釈）
        // 対象はインデント行のみ（"Title\n-" のようなトップレベルSetextには影響しない）
        md = md.replace(/^(\s+)-(\s*)$/gm, '$1- \u200B');

        // Notion エクスポート形式の複数行テーブルセルを正規化
        let preprocessed = preprocessNotionMarkdown(md);

        // 過去ドキュメントの非標準TOC表記を標準Markdownリンクに寄せる
        preprocessed = normalizeLegacyJapaneseTocNotation(preprocessed);

        // 単独行 "$" で始まり "$$" で終わるブロック数式を正規化
        // 一部エクスポートで現れる形式を標準の表示数式として扱う
        preprocessed = preprocessed.replace(/^\$\s*\n([\s\S]+?)\n\$\$\s*$/gm, '$$$$\n$1\n$$$$');

        let dirtyHtml = marked.parse(preprocessed);

        // Markdownパーサが改行を <br> として挿入した表示数式ブロックを正規化
        // 本来1つの $$...$$ ブロックであるべき内容を整える
        dirtyHtml = dirtyHtml.replace(/\$\$<br\s*\/?>\s*([\s\S]*?)<br\s*\/?>\$\$/g, '$$$$\n$1\n$$$$');
        dirtyHtml = dirtyHtml.replace(/\$<br\s*\/?>\s*([\s\S]*?)<br\s*\/?>\$\$/g, '$$$$\n$1\n$$$$');

        // カスタムUI要素を維持しつつ、XSS対策としてHTMLをサニタイズ
        const cleanHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(dirtyHtml, {
        ALLOWED_TAGS: [
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'blockquote', 'pre', 'code', 'hr',
            'br', 'strong', 'em', 'del', 's', 'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'details', 'summary',  // toggle support
            'div', 'span', 'input',  // custom elements containers
        ],
        ALLOWED_ATTR: [
            'href', 'title', 'src', 'alt', 'width', 'height',
            'class', 'id', 'style', 'align',
            'type', 'checked', 'disabled',
            'open',
            'contenteditable',
            'data-mermaid-source', 'data-math', 'data-wrap',  // custom data attributes
        ],
        ALLOW_DATA_ATTR: true,
        ALLOWED_URI_REGEXP: DOMPURIFY_URI_REGEXP,
        }) : dirtyHtml;
        
        try {
            editorEl.innerHTML = cleanHtml;
            console.log('[setMarkdown] editor.innerHTML length:', editorEl.innerHTML.length);
            ensureTableCellPlaceholders(editorEl);
        } catch (e) {
            console.error('[setMarkdown] Exception:', e);
        }

        // チェックボックスを操作可能にする
        editorEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.removeAttribute('disabled');
        });

        // コードブロックをハイライト
        editorEl.querySelectorAll('pre code').forEach(block => {
            if (typeof hljs !== 'undefined') {
                hljs.highlightElement(block);
            }
        });

        // Mermaid図を描画
        renderMermaidBlocks();

        // KaTeX数式を描画
        renderMathBlocks();

        // 解析済みMarkdownからTOCコンテナを再構築し、見出しID復元と削除ボタン付与を行う
        reconstructTocContainers();
        restoreTocHeadingIds();
        ensureHeadingIdsForInPageLinks();
        setupTocDeleteButtons();

        // コードブロックへ行番号を追加
        updateAllLineNumbers();

        // コードブロックのコピー/折り返しUI初期化を保証（レース対策経路）
        if (typeof addCopyButtonsToCodeBlocks === 'function') {
            addCopyButtonsToCodeBlocks();
            editorEl.querySelectorAll('pre').forEach(pre => {
                if (typeof setupCodeWrapButton === 'function') {
                    setupCodeWrapButton(pre);
                }
            });
        }
        
        // コード折り返し状態を復元
        restoreCodeWrapStates();

        // トグルブロックをセットアップ
        setupToggleBlocks();
        
        // altテキスト表示用の画像エラーハンドリングをセットアップ
        // ハンドラは img.complete を見るため同期呼び出しで即時失敗検知できる
        setupImageErrorHandling();
        
        // DOMPurify未読込時は警告ログを出す
        if (typeof DOMPurify === 'undefined') {
            console.warn('[WARN] DOMPurify not loaded - XSS protection unavailable');
        }
    } finally {
        endProgrammaticEditorUpdate();
    }
}
