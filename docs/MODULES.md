# SuMark モジュール構成ドキュメント

SuMark のフロントエンド JavaScript は `src/main.js` と `src/modules/` 配下の 19 モジュールで構成されています（合計約 10,412 行）。  
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

## ファイル一覧

| ファイル | 主な役割 |
|---|---|
| `main.js` | 初期化、イベント登録、ペースト処理、ユーティリティ |
| `modules/utils.js` | 共有ユーティリティ（`escapeHtml`、`debounce`、`throttle` 等） |
| `modules/nodeUtils.js` | DOM ノード操作（パス取得、選択範囲保存/復元、末尾空行判定） |
| `modules/pasteUtils.js` | ペースト判定・変換（TSV→テーブル、Markdown判定等） |
| `modules/codeHighlight.js` | シンタックスハイライト、行番号、キャレット管理、折り返し制御 |
| `modules/mathRender.js` | KaTeX 数式レンダリング |
| `modules/mermaidManager.js` | Mermaid ダイアグラム管理（挿入/表示/編集/モード切替） |
| `modules/tocManager.js` | 目次（TOC）生成・復元・操作 |
| `modules/toggleBlock.js` | トグル（details/summary）ブロック管理 |
| `modules/tabManager.js` | タブ管理（作成/切替/クローズ/未保存確認/ステータスバー） |
| `modules/editorZoom.js` | エディタズーム（拡大/縮小/リセット） |
| `modules/undoRedo.js` | Undo/Redo スタック管理 |
| `modules/tableManager.js` | テーブル操作（挿入/行列追加削除/コンテキストメニュー/CSV読込） |
| `modules/imageManager.js` | 画像管理（エラー表示、リサイズ、拡大ビュー、保存、ペースト） |
| `modules/toolbarActions.js` | ツールバーアクション（書式設定、挿入、モーダル、検索/置換） |
| `modules/fileManager.js` | ファイル操作（新規/開く/保存/画像パス解決/CSV読込） |
| `modules/exportManager.js` | PDF エクスポート |
| `modules/markdown.js` | Markdown ↔ HTML 変換（Turndown設定 + marked解析） |
| `modules/autoConvert.js` | エディタ入力時の自動変換（ブロック/インライン） |
| `modules/keyboard.js` | キーボードイベント処理（ショートカット、Enter、Tab、テーブルナビ） |


## モジュール詳細

### main.js

エントリーポイント。初期化処理とイベントリスナー登録、および他モジュールに分類されない機能を保持。

**公開関数/変数:**
- `insertTextAtCursor(text)` — カーソル位置にテキスト挿入
- `showBanner(msg, type)` — 通知バナー表示
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
- `testConvertFileSrc(path)` — asset:// URL テスト用ユーティリティ
- `editor`, `isConverting`, `isComposing`, `inputCharCount`, `isProcessingDrop`, `EMOJI_MAP` — グローバル状態

### modules/markdown.js

Markdown ↔ HTML の双方向変換。Turndown に 20+ のカスタムルールを設定し、
marked.js + DOMPurify でサニタイズされた HTML を生成。テーブル区切り行の正規化処理も含む。

**公開関数:**
- `configureTurndown()` — Turndown インスタンスの初期化とカスタムルール登録
- `getMarkdown()` — エディタ HTML → Markdown 文字列
- `setMarkdown(md)` — Markdown → エディタ HTML（後処理含む）
- `preprocessNotionMarkdown(md)` — Notion 形式テーブルの前処理

**主な内部関数:**
- `normalizeTableAlignmentDelimiters(md)` — テーブル区切り行の揃え記法を正規化（`--:`→`---:` 等、marked.js の最小ハイフン要件対応）
- `normalizeLegacyJapaneseTocNotation(md)` — 旧形式の日本語 TOC 記法を正規化

**依存先:** `editor`, `resetGlobalState` (main.js), vendor ライブラリ群, 各モジュールの後処理関数

### modules/autoConvert.js

エディタ入力時のリアルタイム Markdown 自動変換。ブロックレベル（# → 見出し、- → リスト等）と
インライン（**太字**、`コード`、URL、絵文字、数式等）の両方を処理。

**公開関数:**
- `onEditorInput()` — エディタの `input` イベントハンドラ

**内部関数:**
- `handleBlockAutoConversion()` — ブロックレベル変換
- `handleInlineAutoConversion()` — インライン変換
- `applyInlineAutoConvert()` — インライン書式の DOM 適用

**依存先:** `editor`, `isConverting`, `isComposing`, `inputCharCount`, `EMOJI_MAP`, `getParentBlock`, `setCursorTo`, `setCursorToEnd`, `updateWordCount` (main.js), 各モジュール関数

### modules/keyboard.js

キーボードショートカットと特殊キー（Enter、Tab）の処理。テーブルセル間のナビゲーションも含む。

**公開関数:**
- `handleKeyDown(e)` — `keydown` イベントハンドラ

**内部関数:**
- `handleEnterKey(e)` — Enter キー処理（見出し→段落、コードブロック脱出、リスト継続/終了、トグル操作、``` コードブロック生成、Shift+Enter ソフト改行）
- `handleTabKey(e)` — Tab キー処理（コードブロック内タブ、リストインデント/アウトデント）

**ショートカット一覧:**
| キー | 動作 |
|---|---|
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y | Redo |
| Cmd/Ctrl+P | PDF エクスポート |
| Cmd/Ctrl+F | 検索ダイアログ |
| Cmd/Ctrl+R | 置換ダイアログ |
| Cmd/Ctrl+S | 保存 |
| Cmd/Ctrl+Shift+S | 名前を付けて保存 |
| Cmd/Ctrl+N | 新規ファイル |
| Cmd/Ctrl+O | ファイルを開く |
| Cmd/Ctrl+B/I/E/K | 太字/斜体/コード/リンク |
| Cmd/Ctrl+Shift+X | 取り消し線 |
| Cmd/Ctrl+W | タブを閉じる |
| Cmd/Ctrl+Q | アプリ終了確認 |
| Cmd/Ctrl+Tab | 次のタブ |
| Cmd/Ctrl+Shift+Tab | 前のタブ |
| Cmd/Ctrl+; / Cmd/Ctrl+: | 日付/時刻挿入 |
| Shift+Enter | ソフト改行（2スペース＋改行） |
| Arrow keys（テーブルセル内） | セル間ナビゲーション |

**依存先:** `editor`, `isComposing`, `inputCharCount`, `getParentBlock`, `setCursorTo`, `setCursorToEnd` (main.js), tabManager, undoRedo, fileManager, exportManager, codeHighlight, mermaidManager, toolbarActions 各モジュール

### modules/utils.js

全モジュールから参照される共有ユーティリティ。最初に読み込まれる必要がある。

**公開関数:**
- `escapeHtml(str)` — HTML特殊文字をエスケープ
- `debounce(fn, delay)` — デバウンス関数生成
- `throttle(fn, delay)` — スロットル関数生成
- `normalizeFilePath(path)` — ファイルパス正規化（Windows/macOSパス対応）
- `resolveRelativePath(fileDir, relativePath)` — 相対パスを絶対パスに解決
- `simulateKeyPress(element, key)` — キー入力のシミュレーション
- `getLocalStorage(key, defaultValue)` / `setLocalStorage(key, value)` — localStorage 操作
- `uniqueArray(arr)` — 配列の重複排除
- `deepClone(obj)` — オブジェクトのディープクローン

### modules/nodeUtils.js

DOM ノード操作ユーティリティ。

**公開関数:**
- `isOnEmptyTrailingLine(targetEl, range)` — カーソルが末尾空行にあるか判定
- `removeTrailingEmptyLines(targetEl)` — 末尾空行を除去
- `saveSelection()` / `restoreSelection()` — 選択範囲の保存/復元
- `getNodePath(node)` / `getNodeByPath(path)` — DOM パスの取得/復元

### modules/codeHighlight.js

コードブロックのシンタックスハイライトと行番号管理。

**公開関数:**
- `highlightCodeBlock(codeEl)` — 単一コードブロックをハイライト
- `highlightAllCodeBlocks()` — 全コードブロックをハイライト
- `updateLineNumbers(pre)` — 行番号更新
- `updateAllLineNumbers()` — 全行番号更新
- `getCaretCharacterOffsetWithin(el)` / `setCaretCharacterOffset(el, offset)` — キャレット位置管理
- `debouncedHighlightCodeAtCursor()` — デバウンス付きハイライト
- `setupCodeWrapButton(pre)` — コード折り返しボタンの設置
- `toggleCodeWrap(pre)` — コード折り返しのトグル

### modules/tabManager.js

マルチタブ管理。

**公開関数:**
- `initTabManager()` — タブマネージャー初期化（DOM要素取得）
- `createTab(filePath, title, content)` — 新規タブ作成
- `getActiveTab()` — アクティブタブオブジェクト取得
- `switchTab(tabId)` — タブ切替
- `closeTab(tabId)` — タブを閉じる（未保存確認ダイアログ付き）
- `markModified()` — 変更済みマーク
- `getUnsavedTabs()` — 未保存タブ一覧取得
- `hasUnsavedTabs()` — 未保存タブの有無確認
- `updateStatusBar()` — ステータスバー更新
- `renderTabs()` — タブ一覧の再描画
- `setupTabKeyboardShortcuts()` — タブ関連キーボードショートカット設定

**公開変数:** `tabs`, `activeTabId`

### modules/undoRedo.js

Undo/Redo スタック管理（最大 100 履歴）。

**公開関数:**
- `saveEditorState()` — 現在の状態を Undo スタックに保存
- `debouncedSaveEditorState()` — デバウンス版
- `performUndo()` / `performRedo()` — Undo/Redo 実行

**公開変数:** `currentState`, `isUndoRedoOperation`

### modules/tableManager.js

テーブル操作とコンテキストメニュー。行ドラッグによる並び替えと列揃えの永続化機能を含む。

**公開関数:**
- `isInsideTableCell(node)` — テーブルセル内判定
- `insertTable()` — テーブル挿入（モーダル経由）
- `handleTableAction(action)` — テーブル操作（行列追加/削除/揃え設定）
- `createTableRow(table, colCount, tag)` — テーブル行生成
- `setupTableContextMenu()` — テーブル右クリックメニュー設定
- `csvToMarkdownTable(csvText, title)` — CSV テキストを Markdown テーブルに変換
- `parseCsv(text)` — CSV パース
- `refreshTableRowDragSupport()` — 行ドラッグ用クラスをテーブルへ付与/更新
- `applyColumnAlignment(table, colIndex, align)` — 列全体に揃えを適用
- `getColumnAlignment(table, colIndex)` — 指定列の揃え設定を取得

**主な内部関数（行ドラッグ）:**
- `startRowDrag(row, table, clientY)` / `onRowDragMove(e)` / `onRowDragEnd(e)` — ドラッグ開始/移動/終了
- `finishRowDrag(applyDrop)` — ドラッグ確定・キャンセル処理（Undo登録含む）
- `computeRowDropTarget(table, sourceRow, clientY)` — ドロップ先行の計算
- `isRowDragHandleArea(cell, clientX, isTouch)` — ドラッグハンドル領域判定

**列選択（複数セル一括入力）関連:**
- `getCellColIndex(cell)` / `getCellRowIndex(cell, table)` — セル位置取得
- `getCellsBetween(table, colIndex, rowIndexA, rowIndexB)` — 選択セル一覧取得
- `clearColSelection()` — 列選択解除

### modules/imageManager.js

画像管理（エラーハンドリング、リサイズ、ファイル保存、ペースト、拡大ビュー）。

**公開関数:**
- `setupImageMutationObserver()` — 画像要素の動的監視（MutationObserver）
- `setupImageErrorHandling()` — 画像読み込みエラーハンドリング
- `setupImageResize()` — 画像リサイズ機能
- `setupImageViewer()` — 画像拡大ビューア初期化
- `openImageViewer(img)` — 拡大ビューアを開く
- `closeImageViewer()` — 拡大ビューアを閉じる
- `pasteImageFile(file)` — 画像ペースト
- `mimeToExt(mime)` / `generateImageFileName(alt, counter, ext)` / `saveImageFile(...)` — 画像ファイル操作

### modules/toolbarActions.js

ツールバーの全アクション。検索/置換機能を含む。

**公開関数:**
- `applyHeading(level)` — 見出し適用
- `insertUnorderedList()` / `insertOrderedList()` — リスト挿入
- `applyBlockquote()` — 引用適用
- `applyInlineCode()` — インラインコード適用
- `insertLink()` / `insertImage()` — リンク/画像挿入
- `insertCodeBlock()` / `doInsertCodeBlock(lang, savedRange, selectedText)` — コードブロック挿入
- `insertTaskList()` — タスクリスト挿入
- `insertHorizontalRule()` — 水平線挿入
- `insertDate()` / `insertTime()` / `insertDateTime()` — 日時挿入
- `showEmojiPicker()` — 絵文字ピッカー表示
- `showModal(title, fields, callback, options)` — モーダルダイアログ表示
- `restoreCodeWrapStates()` — コード折り返し状態復元
- `showFindDialog()` — 検索ダイアログ表示
- `showReplaceDialog()` — 置換ダイアログ表示
- `showFindReplace()` — 検索/置換パネルのトグル表示
- `highlightSearchMatches(query, caseSensitive)` — 検索ハイライト
- `moveToNextSearchHighlight()` — 次の検索結果へ移動

### modules/fileManager.js

ファイル I/O 操作（Tauri API 経由）。

**公開関数:**
- `newFile()` — 新規ファイル
- `openFile()` — ファイルを開く（ダイアログ）
- `openFileFromPath(path)` — パス指定でファイルを開く
- `saveFile(defaultPath)` — 保存
- `saveAsFile()` — 名前を付けて保存
- `resolveRelativeImages(markdown, fileDir)` — 相対画像パス解決
- `resolveRelativeCsvLinks(markdown, fileDir)` — 相対 CSV リンクパス解決
- `resolveImagesForSave(markdown, mdFilePath)` — 保存時の画像パス解決
- `normalizeFilename(filename)` — ファイル名の正規化

### modules/exportManager.js

PDF エクスポート。

**公開関数:**
- `exportPDF()` — PDF 出力

### modules/mermaidManager.js

Mermaid ダイアグラムの生成・表示・編集。

**公開関数:**
- `renderMermaidBlocks()` — Mermaid ブロックの描画
- `showMermaidInsertDialog()` — Mermaid 挿入ダイアログ
- `insertMermaidBlock(source)` — Mermaid ブロック挿入

### modules/mathRender.js

KaTeX 数式レンダリング。

**公開関数:**
- `renderMathBlocks()` — 数式ブロックの描画

### modules/tocManager.js

目次（Table of Contents）の管理。

**公開関数:**
- `setupTocDeleteButtons()` — TOC 削除ボタン設定
- `insertTOC()` — TOC 挿入
- `reconstructTocContainers()` — Markdown→HTML 復元時の TOC 再構築
- `restoreTocHeadingIds()` — 見出し ID の復元

### modules/toggleBlock.js

トグル（details/summary）ブロックの管理。

**公開関数:**
- `setupToggleBlocks()` — トグルブロック初期化
- `insertToggleBlock()` — トグルブロック挿入
- `ensureToggleDeleteButton(summary)` — 削除ボタン保証

### modules/editorZoom.js

エディタ表示倍率の制御。

**公開関数:**
- `applyEditorZoom()` — ズーム適用
- `zoomIn()` / `zoomOut()` / `zoomReset()` — ズーム操作

### modules/pasteUtils.js

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
| v0.9.x | 各モジュールに機能追加：tabManager に未保存確認・ステータスバー機能追加、tableManager に CSV 読込・コンテキストメニュー追加、toolbarActions に検索/置換機能追加、imageManager に拡大ビューア追加、keyboard.js にテーブルナビ・Shift+Enter・Cmd+Q 対応追加、utils.js に debounce/throttle/localStorage 等ユーティリティ追加、codeHighlight.js にコード折り返し機能追加 |
| v1.0.1 | 合計 9,413 行 |
| v1.0.7 | tabManager に未保存ダイアログ表示時の Enter キー誤操作防止を追加 |
| v1.0.7（現行） | tableManager に行ドラッグ（並び替え）・列揃え永続化を追加（`applyColumnAlignment`, `refreshTableRowDragSupport` 等）、markdown.js に `normalizeTableAlignmentDelimiters` 追加 — 合計 10,412 行 |
