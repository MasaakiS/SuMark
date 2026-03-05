# SuMark モジュール構成ドキュメント

SuMark のフロントエンド JavaScript は `src/main.js` と `src/modules/` 配下の 19 モジュールで構成されています。  
すべてのファイルは `<script>` タグで読み込まれ、グローバルスコープで関数を公開します（ES Modules 不使用）。

## アーキテクチャ概要

```
index.html
  └── <script> 読み込み順序:
        1. vendor/ (marked, highlight.js, turndown, mermaid, katex, DOMPurify)
        2. modules/ (19 モジュール)
        3. main.js (初期化・イベント登録・残存ロジック)
```

**読み込み順序は厳密に管理されています。** 各モジュールが依存するグローバル関数・変数は、
先に読み込まれるモジュールまたは main.js の初期化前に定義されている必要があります。

## ファイル一覧と行数

| ファイル | 行数 | 主な役割 |
|---|---:|---|
| `main.js` | 1,161 | 初期化、イベント登録、ペースト処理、ユーティリティ |
| `modules/utils.js` | 153 | 共有ユーティリティ（`escapeHtml` 等） |
| `modules/nodeUtils.js` | 175 | DOM ノード操作（パス取得、選択範囲保存/復元、末尾空行判定） |
| `modules/pasteUtils.js` | 144 | ペースト判定・変換（TSV→テーブル、Markdown判定等） |
| `modules/codeHighlight.js` | 320 | シンタックスハイライト、行番号、キャレット管理 |
| `modules/mathRender.js` | 182 | KaTeX 数式レンダリング |
| `modules/mermaidManager.js` | 601 | Mermaid ダイアグラム管理（挿入/表示/編集） |
| `modules/tocManager.js` | 152 | 目次（TOC）生成・復元・操作 |
| `modules/toggleBlock.js` | 276 | トグル（details/summary）ブロック管理 |
| `modules/tabManager.js` | 297 | タブ管理（作成/切替/クローズ/名称同期） |
| `modules/editorZoom.js` | 79 | エディタズーム（拡大/縮小/リセット） |
| `modules/undoRedo.js` | 166 | Undo/Redo スタック管理 |
| `modules/tableManager.js` | 389 | テーブル操作（行列追加/削除、コンテキストメニュー） |
| `modules/imageManager.js` | 484 | 画像管理（エラー表示、リサイズ、保存、ペースト） |
| `modules/toolbarActions.js` | 892 | ツールバーアクション（書式設定、挿入、モーダル） |
| `modules/fileManager.js` | 413 | ファイル操作（新規/開く/保存/画像パス解決） |
| `modules/exportManager.js` | 254 | PDF エクスポート |
| `modules/markdown.js` | 542 | Markdown ↔ HTML 変換（Turndown設定 + marked解析） |
| `modules/autoConvert.js` | 624 | エディタ入力時の自動変換（ブロック/インライン） |
| `modules/keyboard.js` | 778 | キーボードイベント処理（ショートカット、Enter、Tab） |
| **合計** | **8,082** | |

## モジュール詳細

### main.js（1,161 行）

エントリーポイント。初期化処理とイベントリスナー登録、および他モジュールに分類されない機能を保持。

**公開関数/変数:**
- `insertTextAtCursor(text)` — カーソル位置にテキスト挿入
- `showBanner(msg, type, duration)` — 通知バナー表示
- `showWarn(msg)` / `showError(msg)` — 警告/エラー通知
- `resetGlobalState()` — グローバル状態リセット
- `init()` — アプリケーション初期化
- `ensureEditableStart()` — エディタ先頭に編集可能要素を保証
- `setupEventListeners()` — イベントリスナー一括登録
- `showProgressIndicator(msg)` / `hideProgressIndicator()` — 進捗表示
- `handlePaste(e)` — ペーストイベントハンドラ
- `getParentBlock(node)` / `setCursorTo(el)` / `setCursorToEnd(el)` — カーソル操作
- `updateWordCount()` — 文字数カウント更新
- `setupCodeCopyButtons()` / `addCopyButtonsToCodeBlocks()` — コードコピーボタン
- `editor`, `isConverting`, `isComposing`, `inputCharCount`, `EMOJI_MAP` — グローバル状態

### modules/markdown.js（542 行）

Markdown ↔ HTML の双方向変換。Turndown に 20+ のカスタムルールを設定し、
marked.js + DOMPurify でサニタイズされた HTML を生成。

**公開関数:**
- `configureTurndown()` — Turndown インスタンスの初期化とカスタムルール登録
- `getMarkdown()` — エディタ HTML → Markdown 文字列
- `setMarkdown(md)` — Markdown → エディタ HTML（後処理含む）
- `preprocessNotionMarkdown(md)` — Notion 形式テーブルの前処理

**依存先:** `editor`, `resetGlobalState` (main.js), vendor ライブラリ群, 各モジュールの後処理関数

### modules/autoConvert.js（624 行）

エディタ入力時のリアルタイム Markdown 自動変換。ブロックレベル（# → 見出し、- → リスト等）と
インライン（**太字**、`コード`、URL、絵文字、数式等）の両方を処理。

**公開関数:**
- `onEditorInput()` — エディタの `input` イベントハンドラ

**内部関数:**
- `handleBlockAutoConversion()` — ブロックレベル変換
- `handleInlineAutoConversion()` — インライン変換
- `applyInlineAutoConvert()` — インライン書式の DOM 適用

**依存先:** `editor`, `isConverting`, `isComposing`, `inputCharCount`, `EMOJI_MAP`, `getParentBlock`, `setCursorTo`, `setCursorToEnd`, `updateWordCount` (main.js), 各モジュール関数

### modules/keyboard.js（778 行）

キーボードショートカットと特殊キー（Enter、Tab）の処理。

**公開関数:**
- `handleKeyDown(e)` — `keydown` イベントハンドラ

**内部関数:**
- `handleEnterKey(e)` — Enter キー処理（見出し→段落、コードブロック脱出、リスト継続/終了、トグル操作、``` コードブロック生成）
- `handleTabKey(e)` — Tab キー処理（コードブロック内タブ、リストインデント/アウトデント）

**ショートカット一覧:**
| キー | 動作 |
|---|---|
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y | Redo |
| Cmd/Ctrl+P | PDF エクスポート |
| Cmd/Ctrl+S | 保存 |
| Cmd/Ctrl+Shift+S | 名前を付けて保存 |
| Cmd/Ctrl+N | 新規ファイル |
| Cmd/Ctrl+O | ファイルを開く |
| Cmd/Ctrl+B/I/E/K | 太字/斜体/コード/リンク |
| Cmd/Ctrl+Shift+X | 取り消し線 |
| Cmd/Ctrl+W | タブを閉じる |
| Cmd/Ctrl+Tab | 次のタブ |
| Cmd/Ctrl+; / Cmd/Ctrl+: | 日付/時刻挿入 |

**依存先:** `editor`, `isComposing`, `inputCharCount`, `getParentBlock`, `setCursorTo`, `setCursorToEnd` (main.js), tabManager, undoRedo, fileManager, exportManager, codeHighlight, mermaidManager, toolbarActions 各モジュール

### modules/utils.js（153 行）

全モジュールから参照される共有ユーティリティ。最初に読み込まれる必要がある。

**公開関数:** `escapeHtml(str)` 等

### modules/nodeUtils.js（175 行）

DOM ノード操作ユーティリティ。

**公開関数:**
- `isOnEmptyTrailingLine(targetEl, range)` — カーソルが末尾空行にあるか判定
- `removeTrailingEmptyLines(targetEl)` — 末尾空行を除去
- `saveSelection()` / `restoreSelection()` — 選択範囲の保存/復元
- `getNodePath(node)` / `getNodeByPath(path)` — DOM パスの取得/復元

### modules/codeHighlight.js（320 行）

コードブロックのシンタックスハイライトと行番号管理。

**公開関数:**
- `highlightCodeBlock(codeEl)` — 単一コードブロックをハイライト
- `highlightAllCodeBlocks()` — 全コードブロックをハイライト
- `updateLineNumbers(pre)` — 行番号更新
- `updateAllLineNumbers()` — 全行番号更新
- `getCaretCharacterOffsetWithin(el)` / `setCaretCharacterOffset(el, offset)` — キャレット位置管理
- `debouncedHighlightCodeAtCursor()` — デバウンス付きハイライト

### modules/tabManager.js（297 行）

マルチタブ管理。

**公開関数:**
- `createTab(filePath, title, content)` — 新規タブ作成
- `switchTab(tabId)` — タブ切替
- `closeTab(tabId)` — タブを閉じる
- `markModified()` — 変更済みマーク
- `updateTabTitle(tabId, title)` — タブタイトル更新

**公開変数:** `tabs`, `activeTabId`

### modules/undoRedo.js（166 行）

Undo/Redo スタック管理（最大 100 履歴）。

**公開関数:**
- `saveEditorState()` — 現在の状態を Undo スタックに保存
- `debouncedSaveEditorState()` — デバウンス版
- `performUndo()` / `performRedo()` — Undo/Redo 実行

**公開変数:** `currentState`, `isUndoRedoOperation`

### modules/tableManager.js（389 行）

テーブル操作とコンテキストメニュー。

**公開関数:**
- `isInsideTableCell(node)` — テーブルセル内判定
- `handleTableAction(action)` — テーブル操作（行列追加/削除）
- `createTableRow(cols)` — テーブル行生成

### modules/imageManager.js（484 行）

画像管理（エラーハンドリング、リサイズ、ファイル保存、ペースト）。

**公開関数:**
- `setupImageErrorHandling()` — 画像読み込みエラーハンドリング
- `setupImageResize()` — 画像リサイズ機能
- `pasteImageFile(file)` — 画像ペースト
- `mimeToExt(mime)` / `generateImageFileName()` / `saveImageFile(...)` — 画像ファイル操作

### modules/toolbarActions.js（892 行）

ツールバーの全アクション。

**公開関数:**
- `applyHeading(level)` — 見出し適用
- `insertUnorderedList()` / `insertOrderedList()` — リスト挿入
- `applyBlockquote()` — 引用適用
- `applyInlineCode()` — インラインコード適用
- `insertLink()` / `insertImage()` — リンク/画像挿入
- `insertCodeBlock()` / `doInsertCodeBlock(lang)` — コードブロック挿入
- `insertTaskList()` — タスクリスト挿入
- `insertHorizontalRule()` — 水平線挿入
- `insertDate()` / `insertTime()` / `insertDateTime()` — 日時挿入
- `showEmojiPicker()` — 絵文字ピッカー表示
- `showModal(options)` — モーダルダイアログ表示
- `restoreCodeWrapStates()` — コード折り返し状態復元

### modules/fileManager.js（413 行）

ファイル I/O 操作（Tauri API 経由）。

**公開関数:**
- `newFile()` — 新規ファイル
- `openFile()` — ファイルを開く（ダイアログ）
- `openFileFromPath(path)` — パス指定でファイルを開く
- `saveFile()` / `saveAsFile()` — 保存 / 名前を付けて保存
- `resolveRelativeImages(html, basePath)` — 相対画像パス解決
- `resolveImagesForSave(html, filePath)` — 保存時の画像パス解決

### modules/exportManager.js（254 行）

PDF エクスポート。

**公開関数:**
- `exportPDF()` — PDF 出力

### modules/mermaidManager.js（601 行）

Mermaid ダイアグラムの生成・表示・編集。

**公開関数:**
- `renderMermaidBlocks()` — Mermaid ブロックの描画
- `showMermaidInsertDialog()` — Mermaid 挿入ダイアログ
- `insertMermaidBlock(source)` — Mermaid ブロック挿入

### modules/mathRender.js（182 行）

KaTeX 数式レンダリング。

**公開関数:**
- `renderMathBlocks()` — 数式ブロックの描画

### modules/tocManager.js（152 行）

目次（Table of Contents）の管理。

**公開関数:**
- `setupTocDeleteButtons()` — TOC 削除ボタン設定
- `insertTOC()` — TOC 挿入
- `reconstructTocContainers()` — Markdown→HTML 復元時の TOC 再構築
- `restoreTocHeadingIds()` — 見出し ID の復元

### modules/toggleBlock.js（276 行）

トグル（details/summary）ブロックの管理。

**公開関数:**
- `setupToggleBlocks()` — トグルブロック初期化
- `insertToggleBlock()` — トグルブロック挿入
- `ensureToggleDeleteButton(summary)` — 削除ボタン保証

### modules/editorZoom.js（79 行）

エディタ表示倍率の制御。

**公開関数:**
- `applyEditorZoom()` — ズーム適用
- `zoomIn()` / `zoomOut()` / `zoomReset()` — ズーム操作

### modules/pasteUtils.js（144 行）

ペースト時の判定・変換ユーティリティ。

**公開関数:**
- `isTabDelimited(text)` — TSV 判定
- `tsvToHtmlTable(text)` — TSV → HTML テーブル変換
- `parseHtmlTable(html)` — HTML テーブル解析
- `looksLikeMarkdown(text)` — Markdown らしさ判定
- `pasteTextInChunks(text, chunkSize)` — チャンク分割ペースト

## 依存関係図

```
vendor/ (marked, hljs, TurndownService, mermaid, katex, DOMPurify)
  │
  ├── utils.js
  ├── nodeUtils.js ──────────────────────────┐
  ├── pasteUtils.js ← utils.js              │
  ├── codeHighlight.js ← hljs               │
  ├── mathRender.js ← katex                 │
  ├── mermaidManager.js ← mermaid           │
  ├── tocManager.js ← utils.js              │
  ├── toggleBlock.js                        │
  ├── tabManager.js                         │
  ├── editorZoom.js                         │
  ├── undoRedo.js                           │
  ├── tableManager.js                       │
  ├── imageManager.js                       │
  ├── toolbarActions.js ← 多数のモジュール   │
  ├── fileManager.js ← tabManager, markdown  │
  ├── exportManager.js                      │
  ├── markdown.js ← vendor, 多数のモジュール │
  ├── autoConvert.js ← main.js globals       │
  ├── keyboard.js ← main.js globals          │
  │                                          │
  └── main.js ← 全モジュール ────────────────┘
        (init, setupEventListeners, handlePaste)
```

## 変更履歴

| バージョン | 変更内容 |
|---|---|
| v0.6.0 | main.js から 8 モジュール分離（utils, nodeUtils, pasteUtils, codeHighlight, mathRender, mermaidManager, tocManager, toggleBlock） |
| v0.7.0 | 8 モジュール追加分離（tabManager, editorZoom, undoRedo, tableManager, imageManager, toolbarActions, fileManager, exportManager） |
| v0.7.1 | モジュールディレクトリ再編成（src/*.js → src/modules/*.js） |
| v0.7.2 | 3 モジュール追加分離（markdown.js, autoConvert.js, keyboard.js）— main.js 3,051→1,161 行 |
