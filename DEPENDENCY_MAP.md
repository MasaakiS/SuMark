# 依存関係マップ分析 - SuMark (main.js & styles.css)

**作成日**: 2026年3月2日  
**分析対象**: main.js (6,930行), styles.css (1,457行)  
**目的**: ファイル分割の実行可能性を評価

---

## 🔍 主要機能モジュール分類

### **グループ A: 基本的な Markdown 処理（高い相互依存）**

#### a1. Markdown ↔ HTML 変換
```
getMarkdown()           [行 768]
├─ 依存: turndownService, isTabDelimited(), parseHtmlTable()
├─ 被依存: saveFile(), exportPDF(), タブ管理
└─ 状態: MEDIUM 独立度
  
setMarkdown(md)         [行 891]  ★重要
├─ 依存: marked, DOMPurify, preprocessNotionMarkdown()
├─       renderMermaidBlocks(), renderMathBlocks()
├─       setupTocDeleteButtons(), updateAllLineNumbers()
├─       setupToggleBlocks(), setupImageErrorHandling()
└─ 被依存: 多数（UI全体）
  → 状態: HIGH 相互依存（分割困難）
```

#### a2. Markdown 前処理（Notion形式）
```
preprocessNotionMarkdown(md)  [行 821]
├─ 依存: _normalizeNotionTable()
├─ 被依存: setMarkdown() のみ
└─ 状態: ★HIGH 独立度（分割可能）
```

---

### **グループ B: 履歴管理（Undo/Redo）**

```
performUndo()           [行 1604]
├─ 依存: saveSelection(), restoreSelection(), getNodePath(), getNodeByPath()
├─       highlightAllCodeBlocks(), updateAllLineNumbers()
├─       renderMermaidBlocks(), renderMathBlocks()
├─ 被依存: handleKeyDown(), ツールバーボタン
└─ 状態: MEDIUM 独立度（renderが強く依存）

performRedo()           [行 1656]
├─ 依存: performUndo() と同等
└─ 状態: MEDIUM 独立度

saveEditorState()       [行 1486]
├─ 依存: saveSelection(), getNodePath()
├─ 被依存: onEditorInput(), debouncedSaveEditorState()
└─ 状態: ★HIGH 独立度（分割可能）

関連補助関数:
- saveSelection()       [行 1529] - HIGH 独立度
- restoreSelection()    [行 1546] - HIGH 独立度
- getNodePath()         [行 1570] - HIGH 独立度
- getNodeByPath()       [行 1589] - HIGH 独立度
```

---

### **グループ C: コード処理（シンタックスハイライト＆行番号）**

```
highlightCodeBlock(codeEl)    [行 1017]
├─ 依存: hljs (外部ライブラリ), updateLineNumbers()
├─ 被依存: onEditorInput(), debouncedHighlightCodeAtCursor()
└─ 状態: MEDIUM 独立度（updateLineNumbersに依存）

highlightAllCodeBlocks()      [行 1077]
├─ 依存: hljs, updateLineNumbers()
├─ 被依存: performUndo(), performRedo(), setMarkdown()
└─ 状態: MEDIUM 独立度

updateLineNumbers(pre)        [行 1134]
├─ 依存: なし（純粋なDOM操作）
├─ 被依存: highlightCodeBlock(), highlightAllCodeBlocks()
└─ 状態: ★HIGH 独立度（分割可能）

updateAllLineNumbers()        [行 1170]
├─ 依存: updateLineNumbers()
├─ 被依存: performUndo(), performRedo(), setMarkdown()
└─ 状態: ★HIGH 独立度（分割可能）
```

---

### **グループ D: キーボード・入力処理**

```
handleKeyDown(e)        [行 2319]  ★重要（大規模: 180行）
├─ 依存: handleEnterKey(), handleTabKey(), performUndo(), performRedo()
├─       insertLink(), highlightCodeBlock(), handleBlockAutoConversion()
├─ 被依存: setupEventListeners()
└─ 状態: HIGH 相互依存（分割困難）
  ※ 複数の副機能を呼び出すマスターコントローラー

handleEnterKey(e)       [行 2500]  ★重要（大規模: 432行）
├─ 依存: handleBlockAutoConversion(), highlightCodeBlock()
├─       removeTrailingEmptyLines(), isOnEmptyTrailingLine()
├─ 被依存: handleKeyDown() のみ
└─ 状態: MEDIUM 独立度（分割可能な候補）

handleTabKey(e)         [行 2933]
├─ 依存: なし
├─ 被依存: handleKeyDown() のみ
└─ 状態: ★HIGH 独立度（分割可能）

onEditorInput()         [行 1709]
├─ 依存: isConverting, saveEditorState(), debouncedHighlightCodeAtCursor()
├─       handleBlockAutoConversion(), handleInlineAutoConversion()
├─ 被依存: setupEventListeners()
└─ 状態: MEDIUM 依存度
```

---

### **グループ E: 自動変換（ブロック＆インライン）**

```
handleBlockAutoConversion()   [行 1773]  ★重要（大規模: 319行）
├─ 依存: isConverting スタッチ変数（グローバル）
├─       複数の検査・変換ロジック内部に集約
├─ 被依存: handleEnterKey(), onEditorInput()
└─ 状態: MEDIUM 独立度（グローバル状態に依存）

handleInlineAutoConversion()  [行 2096]  （大規模: 187行）
├─ 依存: applyInlineAutoConvert()
├─ 被依存: onEditorInput()
└─ 状態: MEDIUM 独立度

applyInlineAutoConvert()      [行 2284]
├─ 依存: なし（内部補助）
├─ 被依存: handleInlineAutoConversion()
└─ 状態: ★HIGH 独立度
```

---

### **グループ F: 計算（ペースト処理＆テーブル）**

```
handlePaste(e)          [行 3131]  ★重要（大規模: 152行）
├─ 依存: isTabDelimited(), tsvToHtmlTable(), parseHtmlTable()
├─       pasteImageFile(), looksLikeMarkdown()
├─       pasteTextInChunks()
├─ 被依存: setupEventListeners()
└─ 状態: MEDIUM 独立度（多数の補助関数に依存）

関連補助関数:
- isTabDelimited()              [行 3283] - ★HIGH 独立度
- tsvToHtmlTable()              [行 3291] - ★HIGH 独立度
- parseHtmlTable()              [行 3314] - ★HIGH 独立度
- looksLikeMarkdown()           [行 3354] - ★HIGH 独立度
- pasteImageFile()              [行 3342] - MEDIUM (ファイルI/O)
- pasteTextInChunks()           [行 3083] - MEDIUM (async)
```

---

### **グループ G: 要素挿入＆フォーマット**

```
★HIGH 独立度：
- applyHeading(level)          [行 3361] - 独立
- insertUnorderedList()        [行 3416] - 独立
- insertOrderedList()          [行 3459] - 独立
- insertTaskList()             [行 4179] - 独立
- applyBlockquote()            [行 3663] - 独立
- applyInlineCode()            [行 3687] - 独立
- insertHorizontalRule()       [行 4324] - 独立

MEDIUM 依存度：
- insertLink()                 [行 3815] - showModal() に依存
- insertImage()                [行 3872] - async, Tauri API に依存
- insertTable()                [行 3969] - showModal() に依存
- insertCodeBlock()            [行 4091] - showModal() に依存
- insertToggle()               [行 3515] - ensureToggleDeleteButton() に依存
- insertMermaidBlock()         [行 63]   - renderMermaidBlocks() に依存

※ showModal() [行 3721] - ★HIGH 独立度（モーダルUIの純粋関数）
```

---

### **グループ H: Mermaid 図形処理**

```
renderMermaidBlocks()   [行 5725]  （大規模: 111行）
├─ 依存: mermaid ライブラリ, リトライロジック
├─ 被依存: setMarkdown(), performUndo(), performRedo()
│          handleKeyDown() (Cmd+M 時), insertMermaidBlock()
└─ 状態: MEDIUM 独立度（非同期レンダリング）

insertMermaidBlock(source, mode)  [行 63]
├─ 依存: renderMermaidBlocks()
├─ 被依存: イベントハンドラ
└─ 状態: ★HIGH 独立度（可能）

関連: showMermaidInsertDialog() [行 11] - ★HIGH 独立度
```

---

### **グループ I: 数学「レンダリング」**

```
renderMathBlocks()      [行 5555]
├─ 依存: KaTeX ライブラリ
├─ 被依存: setMarkdown(), performUndo(), performRedo()
└─ 状態: ★HIGH 独立度（可能）
```

---

### **グループ J: ファイル操作**

```
saveFile()              - MEDIUM (getMarkdown() に依存)
openFile()              - MEDIUM (Tauri API に依存)
openFileFromPath()      - MEDIUM
newFile()               - LOW (createTab() に依存)
saveAsFile()            - MEDIUM
exportPDF()             - MEDIUM (複雑なロジック)
loadData()              - 初期化用
saveCurrentFile()       - saveFile() ラッパー

※ 全体的に Tauri API と状態管理に依存
  → 状態: 分割時は注意（ファイルI/Oは単一モジュール化推奨）
```

---

### **グループ K: UI 補助機能**

```
★HIGH 独立度：
- showBanner()                 [行 244] - 純粋なDOM操作
- showWarn(), showError()      [行 277-278]
- insertDate(), insertTime(), insertDateTime()
- setupImageResize()           - イベント設定のみ
- setupImageMutationObserver() - 監視のみ

MEDIUM 依存度：
- setupToggleBlocks()          - トグル機能
- setupTocDeleteButtons()      - TOC削除機能
- setupImageErrorHandling()    - 画像エラー表示
- setupCodeCopyButtons()       - コピーボタン
- showEmojiPicker()            - emoji UI
```

---

### **グループ L: 初期化＆イベント設定**

```
init()                  [行 356] （大規模: 118行）
├─ 依存: 全機能の初期化（marked, Turndown, Mermaid）
├─ 被依存: DOMContentLoaded イベント
└─ 状態: HIGH 相互依存（マスターイニシャライザー）

setupEventListeners()   [行 1282] （大規模: 202行）
├─ 依存: 全キーボード・マウスハンドラ
├─ 被依存: init()
└─ 状態: HIGH 相互依存（全イベントリスナーの集約）
```

---

## 📊 依存関係行列

| モジュール | getMarkdown | setMarkdown | performUndo | handlePaste | handleKeyDown | Formatting | Other |
|-----------|------------|-------------|----------|-----------|--------|-----------|-------|
| **Markdown変換** |            |            |          |           |       |           | ⭐⭐⭐ |
| **Undo/Redo**   | ✓          | 依存       | ⭐依存   |           |       |           | ⭐⭐ |
| **コード処理**  |            | 依存       | ✓ 呼び出し |           |       |           | ⭐⭐ |
| **キーボード** |            | ✓ 呼び出し | ✓ 呼び出し|           | ⭐依存  |           | ⭐⭐⭐ |
| **ペースト**    |            |            |          | ⭐依存    |       |           | ⭐⭐ |
| **挿入/フォーマット** |     |            |          |           | ✓ 呼び出し | ⭐低依存 | ⭐ |
| **Mermaid/数学** |          | 依存       | ✓ 依存   |           |       |           | ⭐⭐ |

---

## 🎯 分割の推奨レベル

### **Tier 1: 即座に分割可能（リスク最小）**

☑️ **候補1: Code Highlighting Module** （推奨度: ★★★★★）
```
modules/codeHighlight.js
├─ updateLineNumbers(pre)
├─ updateAllLineNumbers()
├─ highlightCodeBlock(codeEl)
├─ highlightAllCodeBlocks()
└─ debouncedHighlightCodeAtCursor()

依存: hljs ライブラリのみ
規模: 約150行
リスク: 低（純粋DOM操作）
```

☑️ **候補2: Selection & Node Utils** （推奨度: ★★★★★）
```
modules/nodeUtils.js
├─ saveSelection()
├─ restoreSelection()
├─ getNodePath()
├─ getNodeByPath()
└─ isOnEmptyTrailingLine()

依存: なし（純粋なDOM路線処理）
規模: 約100行
リスク: 低
```

☑️ **候補3: Math Rendering Module** （推奨度: ★★★★★）
```
modules/mathRender.js
├─ renderMathBlocks()
└─ KaTeX 初期化

依存: KaTeX ライブラリのみ
規模: 約170行
リスク: 低（独立したレンダリング）
```

☑️ **候補4: Mermaid Module** （推奨度: ★★★★★）
```
modules/mermaid.js
├─ renderMermaidBlocks()
├─ insertMermaidBlock()
└─ showMermaidInsertDialog()

依存: Mermaid ライブラリのみ
規模: 約180行
リスク: 低（独立したレンダリング）
```

☑️ **候補5: Formatting Commands** （推奨度: ★★★★）
```
modules/formatting.js
├─ applyHeading()
├─ insertUnorderedList()
├─ insertOrderedList()
├─ applyBlockquote()
├─ applyInlineCode()
├─ insertTaskList()
├─ insertHorizontalRule()
└─ その他のフォーマット

依存: markModified() のみ
規模:  約400行
リスク: 低~中（DOM編集）
```

☑️ **候補6: Paste Utils** （推奨度: ★★★★）
```
modules/pasteUtils.js
├─ isTabDelimited()
├─ tsvToHtmlTable()
├─ parseHtmlTable()
├─ looksLikeMarkdown()
└─ pasteTextInChunks()

依存: なし（データ変換）
規模: 約150行
リスク: 低
```

---

### **Tier 2: 条件付き分割可能（要設計）**

⚠️ **候補7: Undo/Redo Stack Management**
```
modules/undoRedo.js
├─ saveEditorState()
├─ performUndo()
├─ performRedo()
└─ 状態変数管理

依存: nodeUtils.js, codeHighlight.js, mermaid.js, math.js
規模: 約250行
リスク: 中（多くの機能が復元時に再レンダリング）
※ 分割時は"redo completion callbacks"設計が必要
```

⚠️ **候補8: Modal Dialog UI**
```
modules/modal.js
├─ showModal()
├─ insertLink()
├─ insertImage()
├─ insertTable()
├─ insertCodeBlock()
└─ Tauri API 統合

依存: Tauri API
規模: 約400行
リスク: 中（async + ファイルI/O）
```

⚠️ **候補9: Tab Management**
```
modules/tabs.js
├─ createTab(), closeTab(), switchTab()
├─ タブ UI の操作
└─ 状態管理（tabs[] 配列）

依存: getMarkdown(), setMarkdown(), fileOps
規模: 約200行
リスク: 中（全体との連携）
```

---

### **Tier 3: 分割困難（密結合度がhigh）**

❌ **分割非推奨: Markdown処理** 
```
主要関数: getMarkdown(), setMarkdown(), preprocessNotionMarkdown()
理由: 依存関係が複雑で多方向
- setMarkdown() は renderMermaidBlocks, renderMathBlocks,  
  setupTocDeleteButtons, updateAllLineNumbers を同期的に呼び出す
- getMarkdown() は TSV→HTML, HTML Table parsing を行う 
- Turndown configuration が大規模（300+行）

分割時レベル: CRITICAL
```

❌ **分割非推奨: キーボード処理**
```
主要関数: handleKeyDown() (180行), handleEnterKey() (432行)
理由: 支配的なマスターコントローラー
- 複数の副機能を条件分岐で呼び出す
- handleEnterKey() 単体でも430行超えの複雑性

分割時レベル: HIGH（後期段階の設計が必要）
```

❌ **分割非推奨: 自動変換**
```
主要関数: handleBlockAutoConversion() (319行), handleInlineAutoConversion() (187行)
理由: グローバル状態に大きく依存
- isConverting フラッグでの再帰防止
- editor.innerHTML の複数回読書き
- performUndo() との相互作用

分割時レベル: CRITICAL
```

---

## 🛠️ 推奨実装計画

### **Phase 1: Low-Risk 分割 (実装期間: 1-2 週間)**

1. **modules/mathRender.js** - 数学レンダリング
2. **modules/codeHighlight.js** - シンタックスハイライト
3. **modules/pasteUtils.js** - ペースト補助関数
4. **modules/nodeUtils.js** - ノード操作ユーティリティ

**期待効果**: 
- main.js を 6,930行 → 6,200行 に削減
- 約10% の行数削減で、最小限のリスク

---

### **Phase 2: Medium-Risk 分割 (実装期間: 2-3 週間)**

5. **modules/formatting.js** - フォーマットコマンド
6. **modules/mermaid.js** - Mermaid 図形
7. **modules/modal.js** - モーダルダイアログ＆リンク/テーブル挿入

**期待効果**: 
- main.js を 6,200行 → 4,500行 に削減
- 約35% の行数削減、保守性向上

---

### **Phase 3: High-Risk 分割 (実装期間: 3-4 週間)**

8. **modules/undoRedo.js** - Undo/Redo 管理（設計重要）
9. **modules/tabs.js** - タブ管理

**期待効果**: 
- main.js を 4,500行 → 3,500行 に削減
- 約50% の行数削減

---

### **Phase 4: Refactoring (長期計画)**

- **handleKeyDown()** の分割（副機能の抽出）
- **handleBlockAutoConversion()** のリファクタリング
- TypeScript 導入による型安全化

---

## 📈 CSS 分割案

```
styles/
├── base.css (400行)
│   ├─ Reset, body, container
│   └─ Toolbar, Tab Bar
│
├── editor.css (350行)
│   ├─ #editor styles
│   ├─ Markdown Body styles
│   └─ Selection, Scrollbar
│
├── components.css (300行)
│   ├─ Modal dialogs
│   ├─ Table context menu
│   ├─ Image viewer
│   └─ Image error containers
│
├── mermaid.css (130行)
│   ├─ Mermaid diagram styles
│   └─ Mode buttons
│
├── codeHighlight.css (80行)
│   ├─ Code block styles
│   ├─ Line numbers
│   └─ Highlight notice
│
└── print.css (200行)
    └─ PDF/Print specific styles
```

**期待効果**: CSS メンテナンス性向上、モジュール別スタイル管理

---

## ⚠️ 分割実装時の注意点

### **1. グローバル状態の一元管理**
```javascript
// ❌ 悪い例: 各モジュールがグローバル状態を持つ
modules/undoRedo.js - undoStack, redoStack, currentState
modules/formatting.js - isConverting

// ✓ 良い例: store.js に集約
modules/store.js
├─ undoStack, redoStack, currentState
├─ isConverting
├─ isComposing
├─ tabs
└─ 状態変更用メソッド
```

### **2. 循環依存の防止**
```
推奨構造:
Core Layer: store, nodeUtils
↓ 依存
Render Layer: codeHighlight, mathRender, mermaid
↓ 依存
Feature Layer: formatting, undoRedo, paste
↓ 依存
UI Layer: modal, tabs, fileOps
↓ 依存
main.js (オーケストレーション)
```

### **3. テスト可能性の確保**
- 各モジュール単位でユニットテスト作成
- 統合テスト (08-roundtrip.spec.js) で全体動作確認
- CSS-JS 整合性チェックスクリプト更新

### **4. バンドル最適化**
```javascript
// Vite で自動最適化
vite.config.js
├─ rollupOptions.input で複数entry points 指定
└─ 自動的にツリーシェーキング
```

---

## 📋 チェックリスト

### 実装前
- [ ] PR テンプレート更新（モジュール分割対応）
- [ ] 各モジュールの public API を設計
- [ ] グローバル状態の整理
- [ ] 依存関係ダイアグラム作成

### 実装中
- [ ] 各モジュールのユニットテスト作成
- [ ] npm run test:e2e で全テスト合格
- [ ] npm run test:lint で CSS-JS 整合性確認
- [ ] Git コミットの粒度を小さく保つ

### 実装後
- [ ] パフォーマンス計測（バンドルサイズ）
- [ ] HMR (Hot Module Replacement) の検証
- [ ] GitHub リリースノート更新
- [ ] ドキュメント更新（モジュール構造）

---

## 🎓 次のステップ

1. **Phase 1 承認**: LOW-RISK モジュール分割許可
2. **実装スケジュール**: 1-2週間 for Phase 1
3. **テスト強化**: 各モジュールのユニットテスト追加
4. **ドキュメント**: モジュール設計書 (modules/README.md) 作成

推奨: **まず Phase 1 から開始し、テスト結果に基づいて Phase 2 へ進行**
