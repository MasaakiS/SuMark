# 依存関係マップ - SuMark（現行構成）

**更新日**: 2026年5月（v1.0.1）  
**現行構成**: `main.js` + 19 モジュール（`src/modules/`）  
**関連ドキュメント**: ビジュアル図 → [`DEPENDENCY_MAP_VISUAL.md`](DEPENDENCY_MAP_VISUAL.md)、モジュール詳細 → [`MODULES.md`](MODULES.md)

---

## アーキテクチャ概要

SuMark のフロントエンドは 5 つのレイヤーで構成されています。依存の方向は **上位 → 下位** の一方向を原則とします。

| レイヤー | モジュール | 役割 |
|---|---|---|
| 🎯 Orchestrator | `main.js` | 初期化・イベント登録・ペースト処理・グローバル状態管理 |
| 🔴 UI Layer | `tabManager.js`, `fileManager.js`, `exportManager.js` | ファイル I/O・タブ管理 |
| ⚫ Core Logic | `markdown.js` | Markdown ↔ HTML 双方向変換（中心的ロジック） |
| 🟠 Feature Layer | `pasteUtils.js`, `undoRedo.js`, `keyboard.js`, `autoConvert.js`, `tableManager.js`, `imageManager.js`, `tocManager.js`, `toggleBlock.js`, `editorZoom.js`, `toolbarActions.js` | 複合機能（Core + Render に依存） |
| 🟡 Render Layer | `codeHighlight.js`, `mathRender.js`, `mermaidManager.js` | 外部ライブラリに依存するレンダリング |
| 🟢 Core Layer | `utils.js`, `nodeUtils.js` | 共有ユーティリティ（他モジュールに依存しない） |

---

## スクリプト読み込み順序

`src/index.html` における `<script>` タグの読み込み順序（依存解決のため厳密に管理）:

```
1.  vendor/             → marked, highlight.js, DOMPurify, mermaid, KaTeX, Turndown, turndown-plugin-gfm
2.  utils.js            → 最初に読み込む（全モジュールの基盤）
3.  nodeUtils.js
4.  pasteUtils.js
5.  codeHighlight.js
6.  mathRender.js
7.  mermaidManager.js
8.  tocManager.js
9.  toggleBlock.js
10. tabManager.js
11. editorZoom.js
12. undoRedo.js
13. tableManager.js
14. imageManager.js
15. toolbarActions.js
16. fileManager.js
17. exportManager.js
18. markdown.js
19. autoConvert.js
20. keyboard.js
21. main.js             → 最後に読み込む（初期化フロー起点）
```

---

## モジュール間依存マトリクス

各モジュールが直接依存する他モジュールを示します（vendor ライブラリへの依存は省略）。

| モジュール | 直接依存先モジュール |
|---|---|
| `utils.js` | なし |
| `nodeUtils.js` | なし |
| `pasteUtils.js` | `utils.js` |
| `codeHighlight.js` | `nodeUtils.js` |
| `mathRender.js` | なし（KaTeX のみ） |
| `mermaidManager.js` | `toolbarActions.js`（showModal）, `utils.js` |
| `tocManager.js` | `utils.js` |
| `toggleBlock.js` | なし |
| `editorZoom.js` | `utils.js`（localStorage） |
| `undoRedo.js` | `nodeUtils.js`, `codeHighlight.js`, `mathRender.js`, `mermaidManager.js` |
| `tableManager.js` | `toolbarActions.js`（showModal）, `utils.js` |
| `imageManager.js` | `utils.js` |
| `toolbarActions.js` | `utils.js`, `codeHighlight.js`, `mermaidManager.js`, `tocManager.js`, `toggleBlock.js`, `tableManager.js` |
| `tabManager.js` | `utils.js` |
| `fileManager.js` | `tabManager.js`, `markdown.js`, `utils.js` |
| `exportManager.js` | `markdown.js`, `utils.js` |
| `markdown.js` | `codeHighlight.js`, `mathRender.js`, `mermaidManager.js`, `tocManager.js`, `toggleBlock.js`, `imageManager.js` |
| `autoConvert.js` | `codeHighlight.js`, `mathRender.js`, `mermaidManager.js`, `tableManager.js`, main.js グローバル変数 |
| `keyboard.js` | `undoRedo.js`, `tabManager.js`, `fileManager.js`, `exportManager.js`, `codeHighlight.js`, `mermaidManager.js`, `toolbarActions.js` |
| `main.js` | 全モジュール、`pasteUtils.js`（handlePaste 内） |

---

## main.js が各モジュールから利用する主要関数

| 依存先 | 呼び出す主要関数 |
|---|---|
| `utils.js` | `escapeHtml`, `debounce`, `throttle`, `getLocalStorage`, `setLocalStorage` |
| `nodeUtils.js` | `saveSelection`, `restoreSelection`, `getNodePath`, `getNodeByPath` |
| `codeHighlight.js` | `highlightAllCodeBlocks`, `updateAllLineNumbers`, `setupCodeWrapButton` |
| `mathRender.js` | `renderMathBlocks` |
| `mermaidManager.js` | `renderMermaidBlocks`, `showMermaidInsertDialog` |
| `toolbarActions.js` | `applyHeading`, `insertList`, `showModal`, `showFindDialog`, `showReplaceDialog` 等 |
| `undoRedo.js` | `saveEditorState`, `performUndo`, `performRedo` |
| `keyboard.js` | `handleKeyDown` |
| `autoConvert.js` | `onEditorInput` |
| `tableManager.js` | `insertTable`, `handleTableAction`, `setupTableContextMenu` |
| `imageManager.js` | `setupImageErrorHandling`, `setupImageViewer`, `pasteImageFile` |
| `tocManager.js` | `insertTOC`, `reconstructTocContainers` |
| `toggleBlock.js` | `insertToggleBlock`, `setupToggleBlocks` |
| `editorZoom.js` | `applyEditorZoom`, `zoomIn`, `zoomOut` |
| `tabManager.js` | `createTab`, `switchTab`, `closeTab`, `hasUnsavedTabs`, `renderTabs` |
| `fileManager.js` | `saveFile`, `openFile`, `newFile`, `openFileFromPath` |
| `exportManager.js` | `exportPDF` |
| `markdown.js` | `setMarkdown`, `getMarkdown`, `configureTurndown` |
| `pasteUtils.js` | `isTabDelimited`, `tsvToHtmlTable`, `looksLikeMarkdown`, `pasteTextInChunks` |

---

## 依存関係ルール

```
✓ 推奨: 一方向依存
  Orchestrator → UI Layer → Feature Layer → Render Layer → Core Layer

✓ 許容: 水平依存（同一レイヤー内、非循環）
  tableManager.js → toolbarActions.js  (showModal 呼び出し)

✓ 許容: main.js グローバル変数の参照
  各モジュール → editor, isConverting, isComposing 等

✗ 禁止: 循環依存
  A → B → A

✗ 禁止: 下位レイヤーから上位レイヤーへの依存
  Core Layer → Feature Layer
  Render Layer → UI Layer
```

---

## 変更履歴

| バージョン | 変更内容 |
|---|---|
| v0.6.0 | main.js から最初の 8 モジュール分離 |
| v0.7.0 | さらに 8 モジュール追加分離 |
| v0.7.1 | モジュールディレクトリ再編成（`src/*.js` → `src/modules/*.js`） |
| v0.7.2 | `markdown.js`, `autoConvert.js`, `keyboard.js` 追加分離 |
| v0.9.x | 各モジュールに機能追加（tabManager に未保存確認、tableManager に CSV 読込 等） |
| v1.0.1 | 現行バージョン — main.js + 19 モジュール |
