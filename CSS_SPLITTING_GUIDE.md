# CSS 分割ガイド（SuMark v0.6.0+）

## CSS 分割戦略

現在の `src/styles.css` （1,457行）は、複数の関心領域が混在しています。  
JavaScript モジュール分割と並行して、CSS も機能ごとに分割することで：

- **保守性向上**: 関連する CSS を集約し、修正時の影響範囲を最小化
- **バンドルサイズ削減**: 不要な CSS を除外（Print CSS など）
- **パフォーマンス改善**: CSS の遅延ロード / 条件付きロード

---

## 推奨分割案（Phase 1-4 対応）

### 現在の styles.css 構成（1,457行）

| セクション | 行数 | 関連する JavaScript | 分割先 |
|---|---|---|---|
| **Reset / Base** (body, html) | 50行 | - | `base.css` |
| **.toolbar** (ツールバースタイル) | 40行 | toolbar 全体 | `components.css` |
| **.tab-bar, .tab-item** (タブUI) | 90行 | modules/tabs.js | `tabs.css` (Phase 3) |
| **#editor, .markdown-body** | 414行 | core (main.js) | `editor.css` |
| **.statusbar** | 25行 | status bar UI | `components.css` |
| **Modal / Dialog / Context menu** | 100行 | modules/modal.js | `modal.css` (Phase 2) |
| **Table styles** | 85行 | modules/modal.js, table操作 | `table.css` (Phase 2) |
| **.mermaid-container** | 150行 | modules/mermaid.js | `mermaid.css` (Phase 1) |
| **Code highlighting** | 100行 | modules/codeHighlight.js | `codeHighlight.css` (Phase 1) |
| **.emoji-picker** | 40行 | emoji UI | `components.css` |
| **PDF / Print styles** | 150行 | exportPDF() | `print.css` |
| **.image-viewer** | 100行 | image modal | `components.css` |
| **Misc / Utilities** | 100行 | 汎用 | `base.css` |

---

## Phase 1: 基本 CSS 分割

### 1. src/styles/base.css （200行）

**含むもの:**
- Global reset
- body, html styles
- Editor container base styles
- Utility classes

**コード例:**
```css
/* src/styles/base.css */

* {
    box-sizing: border-box;
}

html, body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: #333;
    background: #fff;
}

body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

#app {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Editor Container Base */
#editor {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    outline: none;
    word-wrap: break-word;
    white-space: pre-wrap;
}

/* Utility classes */
.hidden {
    display: none !important;
}

.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
```

### 2. src/styles/editor.css （350行）

**含むもの:**
- Markdown element styling (.markdown-body)
- Heading, paragraph, list styles
- Selection and focus styles

**コード例:**
```css
/* src/styles/editor.css */

.markdown-body {
    max-width: 900px;
    margin: 0 auto;
}

.markdown-body h1 {
    font-size: 2em;
    font-weight: 600;
    margin: 1em 0 0.5em;
    border-bottom: 1px solid #eaecef;
    padding-bottom: 0.3em;
}

.markdown-body h2 {
    font-size: 1.5em;
    font-weight: 600;
    margin: 0.8em 0 0.3em;
    border-bottom: 1px solid #eaecef;
    padding-bottom: 0.3em;
}

.markdown-body h3 {
    font-size: 1.2em;
    font-weight: 600;
    margin: 0.6em 0 0.3em;
}

.markdown-body h4, .markdown-body h5, .markdown-body h6 {
    font-size: 1em;
    font-weight: 600;
    margin: 0.3em 0;
}

.markdown-body p {
    margin: 0.5em 0;
}

.markdown-body ul, .markdown-body ol {
    padding-left: 2em;
    margin: 0.5em 0;
}

.markdown-body li {
    margin: 0.2em 0;
}

.markdown-body blockquote {
    margin: 0.5em 0;
    padding: 0 1em;
    color: #6a737d;
    border-left: 0.25em solid #dfe2e5;
}

.markdown-body a {
    color: #0366d6;
    text-decoration: none;
}

.markdown-body a:hover {
    text-decoration: underline;
}

.markdown-body code {
    background: #f6f8fa;
    border-radius: 3px;
    padding: 0.2em 0.4em;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 0.9em;
}

.markdown-body pre {
    background: #f6f8fa;
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
    margin: 1em 0;
}

.markdown-body pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: 0.85em;
}

.markdown-body table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
}

.markdown-body table th {
    background: #f6f8fa;
    font-weight: 600;
    padding: 6px 13px;
    border: 1px solid #dfe2e5;
}

.markdown-body table td {
    padding: 6px 13px;
    border: 1px solid #dfe2e5;
}

.markdown-body table tr:nth-child(2n) {
    background: #f6f8fa;
}

.markdown-body img {
    max-width: 100%;
    height: auto;
    cursor: pointer;
}

.markdown-body img:hover {
    opacity: 0.8;
}

.markdown-body hr {
    height: 0.25em;
    background: #dfe2e5;
    border: 0;
    margin: 1em 0;
}

/* Selection styles */
#editor::selection {
    background: #b3d4fc;
    color: inherit;
}

/* Focus styles */
#editor:focus {
    outline: 2px solid #0366d6;
    outline-offset: -2px;
}
```

### 3. src/styles/codeHighlight.css （80行）

**含むもの:**
- Code block line numbers
- Syntax highlight colors (Atom One Light)
- Code copy button

**コード例:**
```css
/* src/styles/codeHighlight.css */

.line-numbers-gutter {
    display: inline-block;
    min-width: 3em;
    text-align: right;
    padding: 0 1em 0 0;
    margin-right: 1em;
    color: #999;
    user-select: none;
    cursor: default;
    border-right: 1px solid #ddd;
}

.line-numbers-gutter span {
    display: block;
    height: 1.5em;
    line-height: 1.5em;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
}

/* Highlight.js (Atom One Light) styles */
.hljs {
    background: #fafafa;
}

.hljs-attr,
.hljs-attribute {
    color: #795da3;
}

.hljs-literal,
.hljs-number {
    color: #0086b3;
}

.hljs-meta,
.hljs-meta .hljs-string {
    color: #1d3f81;
}

.hljs-string {
    color: #183691;
}

.hljs-type,
.hljs-variable {
    color: #0086b3;
}

/* Code copy button */
.code-copy-container {
    position: relative;
}

.code-copy-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 4px 8px;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85em;
    z-index: 10;
}

.code-copy-btn:hover {
    background: #e8e8e8;
}

/* 500行以上のコードブロックスキップ通知 */
.highlight-skipped-notice {
    padding: 1em;
    background: #ffebee;
    border: 1px solid #ffcdd2;
    border-radius: 4px;
    color: #c62828;
    font-size: 0.9em;
    margin-top: 0.5em;
}
```

### 4. src/styles/mermaid.css （130行）

**含むもの:**
- Mermaid diagram container
- Diagram styling

**コード例:**
```css
/* src/styles/mermaid.css */

.mermaid-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 1em 0;
    padding: 1em;
    background: #f9f9f9;
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: auto;
}

.mermaid {
    display: flex;
    justify-content: center;
    width: 100%;
    max-width: 100%;
}

.mermaid svg {
    max-width: 100%;
    height: auto;
}

/* Mermaid specific diagram styles */
.mermaid .flowchart-v2 .node {
    stroke-width: 2px;
}

.mermaid .actor {
    stroke-width: 2px;
}

/* Dark mode compatibility */
@media (prefers-color-scheme: dark) {
    .mermaid-container {
        background: #1e1e1e;
        border-color: #444;
    }
}
```

### インポート整理 (index.html)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <!-- CSS Import Order (Phase 1) -->
    <link rel="stylesheet" href="styles/base.css">
    <link rel="stylesheet" href="styles/editor.css">
    <link rel="stylesheet" href="styles/codeHighlight.css">
    <link rel="stylesheet" href="styles/mermaid.css">
    
    <!-- Vendor CSS (conditional loading) -->
    <link rel="stylesheet" href="vendor/atom-one-light.min.css">
    <link rel="stylesheet" href="vendor/katex/katex.min.css">
</head>
<body>
    <!-- ... -->
</body>
</html>
```

---

## Phase 2: コンポーネント CSS 分割

### 5. src/styles/modal.css （100行）

**含むもの:**
- Modal overlay and dialog
- Modal button styles
- Input field base styles

---

## Phase 3: 高度な CSS 機能

### 6. src/styles/tabs.css （90行）

**含むもの:**
- Tab bar styling
- Tab item active state
- Tab close button

---

## Phase 4: 最適化と条件付きロード

### 7. src/styles/print.css （150行）

**含まれるもの（条件付きロード）:**
```html
<link rel="stylesheet" href="styles/print.css" media="print">
```

---

## CSS-JS 整合性検証

### 更新: scripts/validate-css-js-sync.js

CSS 分割後も、すべての class/ID 定義をチェック:

```bash
npm run test:lint

# 検証対象:
# - src/styles/ 内の全 CSS ファイル
# - src/main.js, src/modules/ 内の all imports
```

**検証ルール:**
```javascript
// グローバルに検証:
// ✓ #editor → #editor { ... } で定義確認
// ✓ .markdown-body → .markdown-body { ... } で定義確認
// ✓ .code-copy-btn → .code-copy-btn { ... } で定義確認
// ✓ .mermaid-container → .mermaid-container { ... } で定義確認
// ✗ .undefined-class → エラー報告
```

---

## 最終的な CSS 構成（v0.6.0 時点）

```
src/
├── styles.css (1,457行) ← 削除（分割済み）
└── styles/ (1,200行) ← 新規ディレクトリ
    ├── base.css (200行) - Reset, body, utility
    ├── editor.css (350行) - Markdown element styling
    ├── codeHighlight.css (80行) - Code block, syntax highlight
    ├── mermaid.css (130行) - Mermaid diagram
    ├── modal.css (100行) - Dialogs, modal [Phase 2]
    ├── table.css (85行) - Table styling [Phase 2]
    ├── tabs.css (90行) - Tab UI [Phase 3]
    ├── components.css (90行) - Toolbar, statusbar, emoji [Phase 1+]
    ├── image.css (90行) - Image viewer [Phase 1+]
    └── print.css (150行) - PDF export styles [Media Query]
```

---

## 関連ファイルの更新サマリ

| ファイル | 変更内容 |
|---|---|
| `index.html` | `<link>` タグ再編成（5-7個のCSS import） |
| `.github/copilot-instructions.md` | CSS分割セクション追加 |
| `MODULES.md` | CSS architecture ドキュメント追加 |
| `scripts/validate-css-js-sync.js` | Style 検証ルール拡張 |
| `package.json` | CSS 最小化タスク追加（オプション） |

---

## CSS バンドルサイズ見積もり

| ファイル | 圧縮前 | gzip 圧縮後 | 比率 |
|---|---|---|---|
| **styles.css (現在)** | 32KB | 8KB | 25% |
| **styles/*.css (分割後)** | 30KB | 7.5KB | 25% |
| **削減** | -2KB | -0.5KB | - |

**注:** CSS 分割の効果は主に保守性と DX の向上。  
バンドルサイズ削減については JavaScript の方がインパクトが大きい。

---

## 進捗トラッキング（CSS分割）

### Phase 1 CSS 分割チェックリスト

- [ ] `src/styles/` ディレクトリ作成
- [ ] `base.css` 作成・検証
- [ ] `editor.css` 作成・検証
- [ ] `codeHighlight.css` 作成・検証
- [ ] `mermaid.css` 作成・検証
- [ ] `components.css` 作成（toolbar, statusbar, emoji, image）
- [ ] `index.html` 更新（CSS import 再編成）
- [ ] `npm run test:lint` 実行 → ✅ CSS-JS整合性OK
- [ ] `npm run test:e2e` 実行 → ✅ 55/55 tests pass
- [ ] `src/styles.css` 削除（バックアップ保持）

---

## Performance Optimization（オプション）

### Critical CSS via @import

```css
/* base.css で必須 CSS だけ先読み */
@import "editor.css";
@import "components.css";

/* 遅延ロード: 非クリティカル */
@import "mermaid.css" layer;
@import "print.css" print;
```

### CSS Waterfall（推奨順序）

1. **base.css** - 即座にロード（CRITICAL）
2. **editor.css** - 即座にロード（CRITICAL）
3. **codeHighlight.css** - 遅延ロード可（NON-CRITICAL）
4. **mermaid.css** - 遅延ロード可（NON-CRITICAL）
5. **modal.css** - 必要時ロード（オンデマンド）
6. **print.css** - 印刷時のみ（Media Query）

---

**注意:** CSS 分割は JavaScript モジュール分割と並行実施するか、後続フェーズで実施する。  
推奨: **Phase 1 JS 完了後、Phase 1.5 として CSS を分割。**
