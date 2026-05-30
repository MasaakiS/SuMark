# 依存関係ビジュアル図

## 🔗 モジュール依存関係図（実装済み構成）

```mermaid
graph TD
    A["📄 main.js (オーケストレーション)<br/>初期化, イベント設定, ペースト処理"]
    
    subgraph "🟢 Core Layer"
        B1["utils.js<br/>escapeHtml, debounce, throttle<br/>normalizeFilePath, localStorage 等"]
        B2["nodeUtils.js<br/>getNodePath, getNodeByPath<br/>saveSelection, restoreSelection"]
    end
    
    subgraph "🟡 Render Layer"
        C1["codeHighlight.js<br/>highlightCodeBlock<br/>updateLineNumbers, setupCodeWrapButton"]
        C2["mathRender.js<br/>renderMathBlocks"]
        C3["mermaidManager.js<br/>renderMermaidBlocks<br/>showMermaidInsertDialog, editMermaidBlock"]
    end
    
    subgraph "🟠 Feature Layer"
        D1["toolbarActions.js<br/>applyHeading, insertList<br/>showModal, showFindDialog, showReplaceDialog"]
        D2["undoRedo.js<br/>performUndo, performRedo<br/>saveEditorState"]
        D3["pasteUtils.js<br/>isTabDelimited<br/>tsvToHtmlTable, looksLikeMarkdown"]
        D4["keyboard.js<br/>handleKeyDown, handleEnterKey<br/>handleTabKey, テーブルナビ"]
        D5["autoConvert.js<br/>onEditorInput<br/>handleBlockAutoConversion"]
        D6["tableManager.js<br/>insertTable, handleTableAction<br/>csvToMarkdownTable, contextMenu"]
        D7["imageManager.js<br/>setupImageErrorHandling<br/>pasteImageFile, setupImageViewer"]
        D8["tocManager.js<br/>insertTOC, reconstructTocContainers"]
        D9["toggleBlock.js<br/>insertToggleBlock, setupToggleBlocks"]
        D10["editorZoom.js<br/>applyEditorZoom, zoomIn/Out"]
    end
    
    subgraph "🔴 UI Layer"
        E1["tabManager.js<br/>createTab, switchTab, closeTab<br/>hasUnsavedTabs, renderTabs"]
        E2["fileManager.js<br/>saveFile, openFile<br/>resolveRelativeCsvLinks"]
        E3["exportManager.js<br/>exportPDF"]
    end
    
    subgraph "⚫ Core Logic"
        F1["markdown.js<br/>getMarkdown<br/>setMarkdown<br/>Turndown config (20+ ルール)"]
    end
    
    A -->|init| B1
    A -->|init| B2
    A -->|setup| C1
    A -->|setup| C2
    A -->|setup| C3
    A -->|setup| D1
    A -->|setup| D2
    A -->|setup| D3
    A -->|setup| D4
    A -->|setup| D5
    A -->|setup| D6
    A -->|setup| D7
    A -->|setup| D8
    A -->|setup| D9
    A -->|setup| D10
    A -->|setup| E1
    A -->|setup| E2
    A -->|setup| E3
    
    C1 -->|依存| B2
    D3 -->|依存| B1
    D2 -->|呼び出し| C1
    D4 -->|呼び出し| D1
    D4 -->|呼び出し| D2
    D4 -->|呼び出し| E1
    D4 -->|呼び出し| E2
    D4 -->|呼び出し| E3
    E2 -->|呼び出し| F1
    F1 -->|呼び出し| C1
    F1 -->|呼び出し| C2
    F1 -->|呼び出し| C3
    F1 -->|呼び出し| D7
    F1 -->|呼び出し| D8
    F1 -->|呼び出し| D9
    
    style A fill:#333,color:#fff
    style B1 fill:#2d5016,color:#fff
    style B2 fill:#2d5016,color:#fff
    style C1 fill:#b87333,color:#fff
    style C2 fill:#b87333,color:#fff
    style C3 fill:#b87333,color:#fff
    style D1 fill:#d97934,color:#fff
    style D2 fill:#d97934,color:#fff
    style D3 fill:#d97934,color:#fff
    style D4 fill:#d97934,color:#fff
    style D5 fill:#d97934,color:#fff
    style D6 fill:#d97934,color:#fff
    style D7 fill:#d97934,color:#fff
    style D8 fill:#d97934,color:#fff
    style D9 fill:#d97934,color:#fff
    style D10 fill:#d97934,color:#fff
    style E1 fill:#cc0000,color:#fff
    style E2 fill:#cc0000,color:#fff
    style E3 fill:#cc0000,color:#fff
    style F1 fill:#1a1a1a,color:#fff
```

**凡例:**

-   🟢 Core Layer: 最小限のユーティリティ（他に依存しない）
-   🟡 Render Layer: 外部ライブラリに依存（相互依存なし）
-   🟠 Feature Layer: 複数機能が統合（Core に依存）
-   🔴 UI Layer: ユーザーインタラクション・ファイル操作
-   ⚫ Core Logic: Markdown 処理（中心的ロジック）
-   矢印：実線 = 直接依存

---

## 実装済みモジュール構成（v1.0.7 現在）

```css
src/
├── main.js (1,544行) ← オーケストレーション・ペースト・グローバル状態
├── modules/
│   ├── utils.js (160行)          ← 共有ユーティリティ
│   ├── nodeUtils.js (175行)      ← DOM ノード操作
│   ├── pasteUtils.js (144行)     ← ペースト判定・変換
│   ├── codeHighlight.js (340行)  ← シンタックスハイライト・折り返し
│   ├── mathRender.js (194行)     ← KaTeX 数式レンダリング
│   ├── mermaidManager.js (675行) ← Mermaid ダイアグラム管理
│   ├── tocManager.js (227行)     ← 目次（TOC）管理
│   ├── toggleBlock.js (276行)    ← トグルブロック管理
│   ├── tabManager.js (494行)     ← タブ管理・未保存確認
│   ├── editorZoom.js (79行)      ← エディタズーム
│   ├── undoRedo.js (166行)       ← Undo/Redo スタック管理
│   ├── tableManager.js (856行)   ← テーブル操作・CSV読込
│   ├── imageManager.js (490行)   ← 画像管理・拡大ビューア
│   ├── toolbarActions.js (1,365行) ← ツールバー・検索/置換
│   ├── fileManager.js (561行)    ← ファイル I/O
│   ├── exportManager.js (254行)  ← PDF エクスポート
│   ├── markdown.js (678行)       ← Markdown ↔ HTML 変換
│   ├── autoConvert.js (656行)    ← リアルタイム自動変換
│   └── keyboard.js (1,078行)     ← キーボード処理
│
└── styles/
    ├── base.css        ← リセット、body、コンテナ
    ├── layout.css      ← レイアウト
    ├── editor.css      ← エディタ本体スタイル
    ├── markdown.css    ← Markdown レンダリングスタイル
    ├── components.css  ← モーダル・ポップアップ・UI部品
    ├── dialogs.css     ← ダイアログ固有スタイル
    └── print.css       ← 印刷/PDF 専用スタイル
```

**合計**: 10,412 行（modules + main.js）

---

## 循環依存チェック

### **許可された依存パターン**

```css
✓ 一方向依存
  UI Layer → Feature Layer → Render Layer → Core Layer
  
✓ 水平依存（同一レイヤー内、非循環）
  tableManager.js → toolbarActions.js (showModal 呼び出し)  OK

✓ main.js グローバル参照
  各モジュール → editor, isConverting 等（グローバル変数）  OK
```

### **禁止パターン**

```css
✗ 循環依存
  A → B → A  NG
  
✗ 上位レイヤーへの依存
  Core → Feature  NG
  Render → UI  NG
```