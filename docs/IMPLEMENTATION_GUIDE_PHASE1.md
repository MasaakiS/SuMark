# ファイル分割実装ガイド

## Phase 1 実装ガイド（LOW-RISK）

### 実装対象

```
✓ modules/mathRender.js   (KaTeX 数学レンダリング)
✓ modules/codeHighlight.js (シンタックスハイライト＆行番号)
✓ modules/pasteUtils.js    (ペースト補助関数)
✓ modules/nodeUtils.js     (ノード操作ユーティリティ)
```

---

## 実装手順

### 1. modules/ ディレクトリ作成

```bash
mkdir -p src/modules
```

### 2. modules/nodeUtils.js 作成

**抽出対象の関数:**
```javascript
- saveSelection()           [現在: 1529行]
- restoreSelection()        [現在: 1546行]
- getNodePath()             [現在: 1570行]
- getNodeByPath()           [現在: 1589行]
- isOnEmptyTrailingLine()   [現在: 1205行]
- removeTrailingEmptyLines()[現在: 1258行]
```

**コード例:**
```javascript
// modules/nodeUtils.js

/**
 * Save current selection (cursor position/range)
 */
export function saveSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    
    const range = sel.getRangeAt(0);
    return {
        startContainer: getNodePath(range.startContainer),
        startOffset: range.startOffset,
        endContainer: getNodePath(range.endContainer),
        endOffset: range.endOffset,
        collapsed: range.collapsed
    };
}

/**
 * Restore saved selection
 */
export function restoreSelection(selectionData) {
    if (!selectionData) return;
    
    try {
        const startNode = getNodeByPath(selectionData.startContainer);
        const endNode = getNodeByPath(selectionData.endContainer);
        
        if (!startNode || !endNode) return;
        
        const range = document.createRange();
        range.setStart(startNode, Math.min(selectionData.startOffset, startNode.length || startNode.childNodes.length || 0));
        range.setEnd(endNode, Math.min(selectionData.endOffset, endNode.length || endNode.childNodes.length || 0));
        
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } catch (err) {
        console.warn('[Undo] Failed to restore selection:', err);
    }
}

/**
 * Get path from editor root to target node
 */
export function getNodePath(node) {
    const editor = document.getElementById('editor');
    const path = [];
    let current = node;
    
    while (current && current !== editor) {
        const parent = current.parentNode;
        if (!parent) break;
        
        const index = Array.from(parent.childNodes).indexOf(current);
        path.unshift(index);
        current = parent;
    }
    
    return path;
}

/**
 * Get node by path from editor root
 */
export function getNodeByPath(path) {
    const editor = document.getElementById('editor');
    if (!path || path.length === 0) return editor;
    
    let current = editor;
    for (const index of path) {
        if (!current.childNodes[index]) return null;
        current = current.childNodes[index];
    }
    
    return current;
}

// ... その他の関数も export
```

### 3. modules/pasteUtils.js 作成

**抽出対象の関数:**
```javascript
- isTabDelimited()     [現在: 3283行]
- tsvToHtmlTable()     [現在: 3291行]
- parseHtmlTable()     [現在: 3314行]
- looksLikeMarkdown()  [現在: 3354行]
- pasteTextInChunks()  [現在: 3083行]
```

**コード例:**
```javascript
// modules/pasteUtils.js

export function isTabDelimited(text) {
    const lines = text.split('\n');
    if (lines.length < 2) return false;
    const cols = lines[0].split('\t').length;
    return cols >= 2 && lines.every(line => line.split('\t').length === cols || line.trim() === '');
}

export function tsvToHtmlTable(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return '';
    
    const cols = lines[0].split('\t').length;
    let html = '<table border="1"><tbody>';
    
    lines.forEach(line => {
        const cells = line.split('\t');
        html += '<tr>';
        for (let i = 0; i < cols; i++) {
            html += '<td>' + escapeHtml(cells[i] || '') + '</td>';
        }
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
}

export function parseHtmlTable(htmlStr) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlStr;
    
    const table = tempDiv.querySelector('table');
    return table ? table.cloneNode(true) : null;
}

export function looksLikeMarkdown(text) {
    // Markdown キーワードの検出
    return /^#+\s|^\*\*|^\*\s|^-\s|^>\s|^\`\`\`/.test(text.trim());
}

export async function pasteTextInChunks(lines, codeElement) {
    // ...大規模テキスト貼り付けの処理
}
```

### 4. modules/codeHighlight.js 作成

**抽出対象の関数:**
```javascript
- highlightCodeBlock()           [現在: 1017行]
- highlightAllCodeBlocks()       [現在: 1077行]
- updateLineNumbers()            [現在: 1134行]
- updateAllLineNumbers()         [現在: 1170行]
- debouncedHighlightCodeAtCursor()[現在: 1178行]
```

**コード例:**
```javascript
// modules/codeHighlight.js

let codeHighlightTimer = null;

export function highlightCodeBlock(codeEl) {
    if (!codeEl || typeof hljs === 'undefined') return;
    
    const editor = document.getElementById('editor');
    const lineCount = codeEl.textContent.split('\n').length;
    
    if (lineCount > 500) {
        // 大規模コードはスキップ
        console.log(`[ハイライトスキップ] ${lineCount}行のコードブロック`);
        
        const pre = codeEl.closest('pre');
        if (pre) {
            updateLineNumbers(pre);
            if (!pre.querySelector('.highlight-skipped-notice')) {
                const notice = document.createElement('div');
                notice.className = 'highlight-skipped-notice';
                notice.textContent = `⚠️ ${lineCount}行 - シンタックスハイライト無効`;
                pre.appendChild(notice);
            }
        }
        return;
    }
    
    delete codeEl.dataset.highlighted;
    codeEl.removeAttribute('data-highlighted');
    hljs.highlightElement(codeEl);
}

export function highlightAllCodeBlocks() {
    if (typeof hljs === 'undefined') return;
    
    const editor = document.getElementById('editor');
    const codeBlocks = editor.querySelectorAll('pre code:not(.language-mermaid)');
    
    codeBlocks.forEach(block => {
        highlightCodeBlock(block);
    });
}

export function updateLineNumbers(pre) {
    if (!pre || pre.tagName !== 'PRE') return;
    if (pre.closest('.mermaid-container')) return;
    
    const code = pre.querySelector('code');
    if (!code) return;
    
    const text = code.textContent;
    const lines = text.split('\n');
    
    if (lines.length > 1 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    
    const lineCount = Math.max(lines.length, 1);
    
    let gutter = pre.querySelector('.line-numbers-gutter');
    if (!gutter) {
        gutter = document.createElement('div');
        gutter.className = 'line-numbers-gutter';
        gutter.setAttribute('contenteditable', 'false');
        gutter.setAttribute('aria-hidden', 'true');
        pre.insertBefore(gutter, pre.firstChild);
    }
    
    const currentCount = gutter.children.length;
    if (currentCount !== lineCount) {
        let html = '';
        for (let i = 1; i <= lineCount; i++) {
            html += '<span>' + i + '</span>';
        }
        gutter.innerHTML = html;
    }
}

export function updateAllLineNumbers() {
    const editor = document.getElementById('editor');
    editor.querySelectorAll('pre').forEach(pre => {
        if (!pre.closest('.mermaid-container')) {
            updateLineNumbers(pre);
        }
    });
}

export function debouncedHighlightCodeAtCursor() {
    if (codeHighlightTimer) clearTimeout(codeHighlightTimer);
    
    codeHighlightTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        let node = sel.anchorNode;
        const editor = document.getElementById('editor');
        
        while (node && node !== editor) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                highlightCodeBlock(node);
                return;
            }
            node = node.parentElement;
        }
    }, 300);
}
```

### 5. modules/mathRender.js 作成

**抽出対象の関数:**
```javascript
- renderMathBlocks()  [現在: 5555行]
```

**コード例:**
```javascript
// modules/mathRender.js

export function renderMathBlocks() {
    if (typeof katex === 'undefined') {
        console.warn('[WARN] KaTeX not loaded');
        return;
    }
    
    const editor = document.getElementById('editor');
    
    // インライン数式 ($$...$$)
    editor.querySelectorAll('.math-inline').forEach(el => {
        const mathText = el.getAttribute('data-math');
        if (mathText) {
            try {
                katex.render(mathText, el, { throwOnError: false });
                el.classList.add('math-rendered');
            } catch (err) {
                console.warn('[KaTeX] Inline math error:', err);
            }
        }
    });
    
    // ブロック数式 ($$...$$)
    editor.querySelectorAll('.math-display').forEach(el => {
        const mathText = el.getAttribute('data-math');
        if (mathText) {
            try {
                katex.render(mathText, el, { displayMode: true, throwOnError: false });
                el.classList.add('math-rendered');
            } catch (err) {
                console.warn('[KaTeX] Display math error:', err);
            }
        }
    });
}
```

### 6. modules/mermaid.js 作成

**抽出対象の関数:**
```javascript
- renderMermaidBlocks()     [現在: 5725行]
- insertMermaidBlock()      [現在: 63行]
- showMermaidInsertDialog() [現在: 11行]
```

**コード例:**
```javascript
// modules/mermaid.js

renderMermaidBlocks.retryCount = 0;

export async function renderMermaidBlocks() {
    if (typeof mermaid === 'undefined') {
        if (!renderMermaidBlocks.retryCount) renderMermaidBlocks.retryCount = 0;
        if (renderMermaidBlocks.retryCount < 10) {
            renderMermaidBlocks.retryCount++;
            setTimeout(renderMermaidBlocks, 200);
        }
        return;
    }
    
    const editor = document.getElementById('editor');
    const containers = editor.querySelectorAll('.mermaid-container');
    
    for (const container of containers) {
        const source = container.getAttribute('data-mermaid-source');
        if (!source) continue;
        
        try {
            const svg = await mermaid.render('mermaid-' + Math.random().toString(36).slice(2), source);
            // レンダリング処理...
        } catch (err) {
            console.error('[Mermaid] Render error:', err);
        }
    }
    
    renderMermaidBlocks.retryCount = 0;
}

export function insertMermaidBlock(source, mode = 'code-and-diagram') {
    // Mermaid ブロックの挿入処理
}

export function showMermaidInsertDialog() {
    // Mermaid ダイアログの表示
}
```

---

## 6. main.js の修正

### import 文追加（ファイルの先頭に追加）

```javascript
// ========== Module Imports ==========
import { saveSelection, restoreSelection, getNodePath, getNodeByPath, isOnEmptyTrailingLine, removeTrailingEmptyLines } from './modules/nodeUtils.js';
import { isTabDelimited, tsvToHtmlTable, parseHtmlTable, looksLikeMarkdown, pasteTextInChunks } from './modules/pasteUtils.js';
import { highlightCodeBlock, highlightAllCodeBlocks, updateLineNumbers, updateAllLineNumbers, debouncedHighlightCodeAtCursor } from './modules/codeHighlight.js';
import { renderMathBlocks } from './modules/mathRender.js';
import { renderMermaidBlocks, insertMermaidBlock, showMermaidInsertDialog } from './modules/mermaid.js';
```

### 元の関数定義を削除

main.js から以下の関数定義を削除（export した modules で定義されているため）

```javascript
❌ 削除対象:
- saveSelection()
- restoreSelection()
- getNodePath()
- getNodeByPath()
- isOnEmptyTrailingLine()
- removeTrailingEmptyLines()
- isTabDelimited()
- tsvToHtmlTable()
- parseHtmlTable()
- looksLikeMarkdown()
- pasteTextInChunks()
- highlightCodeBlock()
- highlightAllCodeBlocks()
- updateLineNumbers()
- updateAllLineNumbers()
- debouncedHighlightCodeAtCursor()
- renderMathBlocks()
- renderMermaidBlocks()
```

---

## 7. テスト実行

### CSS-JS 整合性確認

```bash
npm run test:lint
```

**期待結果:**
```
✅ CSS-JS整合性OK
✅ 検証成功
```

### E2E テスト実行

```bash
npm run test:e2e -- test/playwright/08-roundtrip.spec.js
```

**期待結果:**
```
✅ 55 passed (30-35s)
```

### 全E2Eテスト実行

```bash
npm run test:e2e
```

**期待結果:**
```
✅ All tests passed (2-3 min)
```

---

## 8. パフォーマンス計測

### バンドルサイズ確認

```bash
# main.js のサイズ確認
du -h src/main.js src/modules/*.js

# 期待値:
# src/main.js: ~225KB (元: 252KB)
# modules/: ~60KB
```

### HMR テスト

```bash
npm run dev

# ブラウザで以下の変更を試す:
1. src/modules/codeHighlight.js を編集
   → リロードが高速 (modules/codeHighlight.js のみ再コンパイル)
   
2. src/main.js を編集
   → リロードが遅い (main.js とすべての import が再コンパイル)
```

---

## 9. ドキュメント更新

### README.md に追加

```markdown
### プロジェクト構成

SuMark v0.6.0 以降、コードは以下のように分割されています:

```
src/
├── main.js (3,000行) - アプリケーション初期化・オーケストレーション
├── markdown.js (700行) - Markdown ↔ HTML 変換 (core logic)
└── modules/ - 機能別モジュール
    ├── nodeUtils.js - ノード操作ユーティリティ
    ├── pasteUtils.js - ペースト処理補助
    ├── codeHighlight.js - シンタックスハイライト
    ├── mathRender.js - KaTeX 数学レンダリング
    └── mermaid.js - Mermaid 図形レンダリング
```

各モジュールの詳細は [MODULES.md](./MODULES.md) を参照してください。
```

---

## チェックリスト（Phase 1 完了時）

- [ ] modules/ ディレクトリ作成
- [ ] modules/nodeUtils.js 作成・テスト
- [ ] modules/pasteUtils.js 作成・テスト
- [ ] modules/codeHighlight.js 作成・テスト
- [ ] modules/mathRender.js 作成・テスト
- [ ] main.js に import 文追加
- [ ] 元の関数定義を main.js から削除
- [ ] npm run test:lint 合格 (✅ CSS-JS整合性OK)
- [ ] npm run test:e2e 合格 (✅ 55/55 tests pass)
- [ ] git commit: "refactor(modules): extract Phase 1 modules"
- [ ] main.js サイズ確認 (252KB → 225KB程度)
- [ ] HMR テスト（modules/codeHighlight.js 修正時の反応速度確認）

---

次のステップ: **Phase 2 への移行**（2-3週間後推奨）
