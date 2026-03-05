# ファイル分割実装ガイド - Phase 2/3/4

## Phase 2 実装ガイド（MEDIUM-RISK）

**期間:** 2-3 週間  
**削減行数:** 1,700行（24%）  
**リスク:** ⚠️ MEDIUM（undoRedo/modal に依存関係あり）

### 実装対象

```
✓ modules/formatting.js  (テキスト形式設定関数)
✓ modules/mermaid-full.js (rendering + dialog)
✓ modules/modal.js        (モーダルダイアログ統一)
```

---

## 2.1 modules/formatting.js 作成

**抽出対象の関数:**
```javascript
- applyHeading()         [現在: 3361行]
- insertUnorderedList()  [現在: 3416行]
- insertOrderedList()    [現在: 3459行]
- insertTaskList()       [現在: 4179行]
- applyBlockquote()      [現在: 3663行]
- applyInlineCode()      [現在: 3687行]
- insertHorizontalRule() [現在: 4324行]
```

**コード例:**
```javascript
// modules/formatting.js

export function applyHeading(level) {
    const editor = document.getElementById('editor');
    const sel = window.getSelection();
    
    let block = sel.anchorNode;
    while (block && block.parentElement !== editor) {
        block = block.parentElement;
    }
    if (!block) return;
    
    // 既存の heading タグを削除
    const existingHeading = block.querySelector('h1, h2, h3, h4, h5, h6');
    if (existingHeading) {
        const text = existingHeading.textContent;
        existingHeading.replaceWith(text);
        return;
    }
    
    // 新しい heading を挿入
    const heading = document.createElement(`h${level}`);
    heading.textContent = block.textContent || 'Heading';
    block.replaceWith(heading);
    
    markModified();
}

export function insertUnorderedList() {
    execCommand('insertUnorderedList');
    markModified();
}

export function insertOrderedList() {
    execCommand('insertOrderedList');
    markModified();
}

export function insertTaskList() {
    const html = '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" /> Task</li></ul>';
    insertHtml(html);
    markModified();
}

export function applyBlockquote() {
    const editor = document.getElementById('editor');
    const sel = window.getSelection();
    
    let block = sel.anchorNode;
    while (block && block.parentElement !== editor) {
        block = block.parentElement;
    }
    if (!block) return;
    
    const blockquote = document.createElement('blockquote');
    blockquote.innerHTML = block.innerHTML;
    block.replaceWith(blockquote);
    
    markModified();
}

export function applyInlineCode() {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    
    let codeEl = range.commonAncestorContainer;
    if (codeEl.nodeType === Node.TEXT_NODE) {
        const parent = codeEl.parentElement;
        if (parent && parent.tagName === 'CODE') {
            // コード削除
            const text = codeEl.textContent;
            codeEl.parentElement.replaceWith(text);
        } else {
            // コード適用
            const code = document.createElement('code');
            code.textContent = sel.toString();
            range.insertNode(code);
        }
    }
    
    markModified();
}

export function insertHorizontalRule() {
    const hr = document.createElement('hr');
    const editor = document.getElementById('editor');
    editor.appendChild(hr);
    
    markModified();
}

// Helper
function execCommand(command) {
    try {
        document.execCommand(command);
    } catch (err) {
        console.error('[Command error]', err);
    }
}

function insertHtml(html) {
    try {
        document.execCommand('insertHTML', false, html);
    } catch (err) {
        console.error('[insertHTML error]', err);
    }
}
```

### 2.2 modules/modal.js 作成

**抽出対象の関数:**
```javascript
- showModal()        (汎用モーダル)
- insertLink()
- insertImage()
- insertTable()
- insertCodeBlock()
```

**コード例:**
```javascript
// modules/modal.js

/**
 * 汎用モーダルダイアログ
 */
export function showModal(options = {}) {
    const {
        title = 'ダイアログ',
        fields = [],
        onOk = null,
        onCancel = null
    } = options;
    
    // モーダルHTML
    const overlay = document.getElementById('modalOverlay');
    const dialog = overlay.querySelector('.modal-dialog');
    
    // タイトル設定
    const titleEl = dialog.querySelector('.modal-title');
    titleEl.textContent = title;
    
    // フィールド設定
    const fieldsContainer = dialog.querySelector('#modalFields');
    fieldsContainer.innerHTML = '';
    
    fields.forEach(field => {
        const label = document.createElement('label');
        label.textContent = field.label;
        
        let input;
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 4;
        } else {
            input = document.createElement('input');
            input.type = field.type || 'text';
        }
        
        input.id = field.id;
        input.placeholder = field.placeholder || '';
        input.value = field.value || '';
        
        fieldsContainer.appendChild(label);
        fieldsContainer.appendChild(input);
    });
    
    // ボタンハンドラ
    const okBtn = dialog.querySelector('#modalOk');
    const cancelBtn = dialog.querySelector('#modalCancel');
    
    okBtn.onclick = () => {
        const values = {};
        fields.forEach(field => {
            values[field.id] = document.getElementById(field.id).value;
        });
        
        if (onOk) onOk(values);
        overlay.style.display = 'none';
    };
    
    cancelBtn.onclick = () => {
        if (onCancel) onCancel();
        overlay.style.display = 'none';
    };
    
    // モーダル表示
    overlay.style.display = 'flex';
}

export function insertLink() {
    showModal({
        title: 'リンク挿入',
        fields: [
            { id: 'url', label: 'URL', type: 'url', placeholder: 'https://...' },
            { id: 'text', label: 'テキスト', type: 'text', placeholder: 'リンククテキスト' }
        ],
        onOk: (values) => {
            const { url, text } = values;
            if (!url) return;
            
            const a = document.createElement('a');
            a.href = url;
            a.textContent = text || url;
            
            const sel = window.getSelection();
            const range = sel.getRangeAt(0);
            range.insertNode(a);
            
            markModified();
        }
    });
}

export function insertImage() {
    showModal({
        title: '画像挿入',
        fields: [
            { id: 'src', label: '画像URL', type: 'text', placeholder: 'https://... または asset://...' },
            { id: 'alt', label: '代替テキスト', type: 'text' }
        ],
        onOk: (values) => {
            const { src, alt } = values;
            if (!src) return;
            
            const img = document.createElement('img');
            img.src = src;
            img.alt = alt || '';
            
            const sel = window.getSelection();
            const range = sel.getRangeAt(0);
            range.insertNode(img);
            
            markModified();
        }
    });
}

export function insertTable() {
    showModal({
        title: '表挿入',
        fields: [
            { id: 'rows', label: '行数', type: 'number', value: '2' },
            { id: 'cols', label: '列数', type: 'number', value: '2' }
        ],
        onOk: (values) => {
            const { rows, cols } = values;
            if (!rows || !cols) return;
            
            let html = '<table border="1"><tbody>';
            for (let r = 0; r < parseInt(rows); r++) {
                html += '<tr>';
                for (let c = 0; c < parseInt(cols); c++) {
                    html += '<td>Cell</td>';
                }
                html += '</tr>';
            }
            html += '</tbody></table>';
            
            document.execCommand('insertHTML', false, html);
            markModified();
        }
    });
}

export function insertCodeBlock() {
    showModal({
        title: 'コードブロック挿入',
        fields: [
            { id: 'language', label: '言語', type: 'text', placeholder: 'javascript, python, ...' },
            { id: 'code', label: 'コード', type: 'textarea', placeholder: 'コードを入力' }
        ],
        onOk: (values) => {
            const { language, code } = values;
            
            const pre = document.createElement('pre');
            const codeEl = document.createElement('code');
            codeEl.className = `language-${language || 'text'}`;
            codeEl.textContent = code;
            pre.appendChild(codeEl);
            
            const editor = document.getElementById('editor');
            editor.appendChild(pre);
            
            // ハイライト更新
            if (window.highlightCodeBlock) {
                window.highlightCodeBlock(codeEl);
            }
            
            markModified();
        }
    });
}
```

---

## Phase 3 実装ガイド（HIGH-RISK）

**期間:** 3-4 週間  
**削減行数:** 1,500行（22%）  
**リスク:** 🔴 HIGH（グローバルステート・複雑な依存）

### 実装対象

```
✓ modules/undoRedo.js  (Undo/Redo スタック) - ⚠️ 要注意
✓ modules/tabs.js      (ファイルタブ管理)
⚠️ modules/keyboard.js (キーボード処理) - Phase 3.x に延期推奨
```

---

## 3.1 modules/undoRedo.js 作成

**抽出対象の関数:**
```javascript
- performUndo()       [現在: 1604行]
- performRedo()       [現在: 1656行]
- saveEditorState()   [現在: 1515行]
- undoStack / redoStack (グローバル)
```

**コード例:**
```javascript
// modules/undoRedo.js

const MAX_STATES = 100;
let undoStack = [];
let redoStack = [];

export function saveEditorState(reason = '') {
    const editor = document.getElementById('editor');
    const state = {
        html: editor.innerHTML,
        selection: saveSelection(),
        timestamp: Date.now(),
        reason: reason
    };
    
    undoStack.push(state);
    redoStack = []; // redo スタック クリア
    
    // スタックサイズ制限
    if (undoStack.length > MAX_STATES) {
        undoStack.shift();
    }
}

export function performUndo(callback = null) {
    const editor = document.getElementById('editor');
    
    if (undoStack.length === 0) return;
    
    // 現在状態を redo スタックに保存
    const currentState = {
        html: editor.innerHTML,
        selection: saveSelection()
    };
    redoStack.push(currentState);
    
    // 前の状態を復元
    const prevState = undoStack.pop();
    editor.innerHTML = prevState.html;
    restoreSelection(prevState.selection);
    
    // 後処理 (Mermaid, 数学, ハイライト再レンダリング)
    if (callback) {
        callback();
    } else {
        defaultAfterRestore();
    }
    
    // イベント通知
    document.dispatchEvent(new CustomEvent('editor-undo', { detail: { reason: prevState.reason } }));
}

export function performRedo(callback = null) {
    const editor = document.getElementById('editor');
    
    if (redoStack.length === 0) return;
    
    // 現在状態を undo スタックに保存
    const currentState = {
        html: editor.innerHTML,
        selection: saveSelection()
    };
    undoStack.push(currentState);
    
    // 次の状態を復元
    const nextState = redoStack.pop();
    editor.innerHTML = nextState.html;
    restoreSelection(nextState.selection);
    
    // 後処理
    if (callback) {
        callback();
    } else {
        defaultAfterRestore();
    }
    
    document.dispatchEvent(new CustomEvent('editor-redo'));
}

export function getUndoStackSize() {
    return undoStack.length;
}

export function getRedoStackSize() {
    return redoStack.length;
}

// ヘルパー
function defaultAfterRestore() {
    // Mermaid, 数学, ハイライト再レンダリング
    if (window.renderMermaidBlocks) window.renderMermaidBlocks();
    if (window.renderMathBlocks) window.renderMathBlocks();
    if (window.highlightAllCodeBlocks) window.highlightAllCodeBlocks();
    if (window.updateAllLineNumbers) window.updateAllLineNumbers();
}
```

### 3.2 modules/tabs.js 作成

**抽出対象の関数:**
```javascript
- addTab()
- switchTab()
- removeTab()
- updateTabTitle()
- loadTabContent()
```

**コード例:**
```javascript
// modules/tabs.js

const tabs = new Map(); // { tabId -> { name, content, modified } }

export function addTab(name = 'Untitled', content = '') {
    const tabId = 'tab-' + Date.now();
    const tabList = document.getElementById('tabList');
    
    // タブボタン追加
    const li = document.createElement('li');
    li.className = 'tab-item active';
    li.id = tabId;
    li.innerHTML = `
        <span class="tab-name">${escapeHtml(name)}</span>
        <button class="tab-close-btn" aria-label="Close">×</button>
    `;
    
    tabList.appendChild(li);
    
    // タブデータ保存
    tabs.set(tabId, { name, content, modified: false });
    
    // クローズボタンハンドラ
    li.querySelector('.tab-close-btn').onclick = () => removeTab(tabId);
    
    // タブクリックハンドラ
    li.onclick = () => switchTab(tabId);
    
    return tabId;
}

export function switchTab(tabId) {
    const tabList = document.getElementById('tabList');
    const editor = document.getElementById('editor');
    
    // 現在のタブを非アクティブ化
    const currentTab = tabList.querySelector('.tab-item.active');
    if (currentTab) {
        const currentId = currentTab.id;
        if (tabs.has(currentId)) {
            tabs.get(currentId).content = editor.innerHTML;
        }
        currentTab.classList.remove('active');
    }
    
    // 新しいタブをアクティブ化
    const newTab = document.getElementById(tabId);
    if (newTab) {
        newTab.classList.add('active');
        const data = tabs.get(tabId);
        if (data) {
            editor.innerHTML = data.content;
        }
    }
    
    // イベント通知
    document.dispatchEvent(new CustomEvent('tab-switched', { detail: { tabId } }));
}

export function removeTab(tabId) {
    const tab = document.getElementById(tabId);
    if (tab) tab.remove();
    
    tabs.delete(tabId);
    
    // 他のタブに切替
    const remaining = document.querySelectorAll('.tab-item');
    if (remaining.length > 0) {
        switchTab(remaining[0].id);
    }
}

export function updateTabTitle(tabId, newName) {
    const tab = document.getElementById(tabId);
    if (tab) {
        const nameEl = tab.querySelector('.tab-name');
        nameEl.textContent = newName;
    }
    
    if (tabs.has(tabId)) {
        tabs.get(tabId).name = newName;
    }
}

export function getTabContent(tabId) {
    return tabs.has(tabId) ? tabs.get(tabId).content : '';
}

export function setTabContent(tabId, content) {
    if (tabs.has(tabId)) {
        tabs.get(tabId).content = content;
    }
}

export function getAllTabs() {
    return Array.from(tabs.entries()).map(([id, data]) => ({
        id,
        ...data
    }));
}
```

---

## Phase 4 実装ガイド（STRATEGIC）

**期間:** 4-6 週間  
**削減行数:** 1,200行（17%）  
**リスク:** 🔴 CRITICAL（アーキテクチャ再設計必須）

### Phase 4.1: 自動変換モジュール（条件付き）

```javascript
// modules/autoConvert.js
- handleBlockAutoConversion()
- handleInlineAutoConversion()
- applyInlineAutoConvert()

⚠️ 要件:
- グローバルステート (isConverting) の排除
- コールバック型アーキテクチャへの変更
- 既存の Undo/Redo との互換性維持
```

### Phase 4.2: キーボード処理の再設計

```javascript
// modules/keyboard.js
🔴 CRITICAL: handleKeyDown (500行) の分割

推奨分割案:
- keyboard/shortcuts.js  (Ctrl+S, Ctrl+Z, etc.)
- keyboard/textInsert.js (テキスト入力処理)
- keyboard/navigation.js (カーソル移動)

⚠️ 要件:
- イベントディスパッチャーパターン導入
- コマンドパターンでの操作の抽象化
- KeyboardEvent の正規化
```

### Phase 4.3: コアロジック分離

```javascript
// modules/markdown-core.js
- getMarkdown() / setMarkdown()
- Turndown / Marked ラッパー

⚠️ 要件:
- HTML ↔ Markdown 変換の隔離
- DOMPurify サニタイズの統一
- パフォーマンス最適化（大規模ドキュメント対応）
```

---

## 推奨スケジュール

| フェーズ | 期間 | 優先度 | 開始時期 |
|---|---|---|---|
| **Phase 1** | 1-2 週間 | 🟢 HIGH | **すぐ開始** |
| **Phase 2** | 2-3 週間 | 🟢 HIGH | Phase 1 完了後 |
| **Phase 3** | 3-4 週間 | 🟡 MEDIUM | Phase 2 完了後 |
| **Phase 4** | 4-6 週間 | 🔴 LOW | Phase 3 完了後 |

---

## 各フェーズの品質ゲート

### ✓ 合格基準（全フェーズ共通）

1. **CSS-JS 検証**
   ```bash
   npm run test:lint
   ```
   ✅ CSS-JS整合性OK

2. **E2E テスト**
   ```bash
   npm run test:e2e
   ```
   ✅ 55/55 tests pass (または合格数増加)

3. **パフォーマンス**
   - main.js サイズ: 段階的減少
   - HMR 時間: 50-70% 改善 (Phase 4 完了時)

4. **機能検証** (`npm run dev`)
   - Markdown 编辑 (テーブル, 画像, コード)
   - Undo/Redo
   - ファイルタブ （Phase 2+）
   - キーボードショートカット （Phase 3+）

---

## リスク対応表

| リスク | 原因 | 対応 |
|---|---|---|
| **Undo/Redo 破損** | HTML 復元時の不整合 | Unit test + E2E test で十分検証 |
| **モーダル競合** | showModal() の多重呼び出し | キュー実装 + lock フラグ導入 |
| **キーボード誤入力** | イベント伝播制御トラブル | 各フェーズで preventDefault() 確認 |
| **CSS 修正漏れ** | 新 class/ID の定義忘れ | `npm run test:lint` で自動検出 |

---

## 成功チェックリスト（Phase 4 完了時）

- [ ] main.js: 252KB → 140KB (44% 削減)
- [ ] modules/: 9個のモジュール統合
- [ ] E2E テスト: 55 → 80+ テスト (追加機能カバー)
- [ ] HMR 時間: 50-70% 改善測定完了
- [ ] TypeScript 準備完了
- [ ] MODULES.md ドキュメント完成
- [ ] GitHub リリース v0.6.0 (ファイル分割版)

---

## 注意: Phase ごとの main.js 更新方針

各フェーズ完了時、以下を実施:

1. **modules/ に新規 JS ファイル作成**
2. **main.js に import 文追加**
3. **元の関数定義を main.js から削除**
4. **git commit メッセージ:**
   ```
   refactor(modules): Phase N - add modules/xxx.js
   
   - Extract functions from main.js to modules/xxx.js
   - Update imports
   - Main.js size: XXX KB → YYY KB
   - E2E test: 55/55 passing
   ```
5. **タグは各フェーズ完了時に v0.5.X+Phase で記録**
   ```bash
   git tag v0.5.1-phase1 -m "Phase 1: nodeUtils, pasteUtils, codeHighlight, mathRender, mermaid"
   ```

---

**最終形態 (v0.6.0):**

```
src/
├── main.js (1,600行) ← 60%削減
├── styles.css (1,457行)
└── modules/ (2,900行) ← 9個のモジュール)
    ├── nodeUtils.js
    ├── pasteUtils.js
    ├── codeHighlight.js
    ├── mathRender.js
    ├── mermaid.js
    ├── formatting.js
    ├── modal.js
    ├── undoRedo.js
    ├── tabs.js
    ├── keyboard.js (Phase 3)
    ├── autoConvert.js (Phase 4)
    └── markdown-core.js (Phase 4)
```

**バンドルサイズ:**
- 現在: 284KB
- Phase 1 後: 270KB
- Phase 2 後: 245KB
- Phase 3 後: 215KB
- Phase 4 後: 160KB (44% 削減)

---

**フィードバック例:**

各フェーズ完了時、ユーザーに報告:

```
Phase 1 完了報告
================
✅ 成果:
- modules/ 5個作成: nodeUtils, pasteUtils, codeHighlight, mathRender, mermaid
- main.js: 252KB → 225KB (9% 削減)

✅ テスト:
- CSS-JS整合性OK
- E2E: 55/55 tests pass
- HMR: 15-20% 改善

⏭️ 次: Phase 2 に進行予定 (2-3 週間)
```

---

**プロジェクト管理内容:**
各フェーズについて GitHub Issues で追跡:

```
Issue: SuMark v0.6.0 ファイル分割 Phase 1
- [ ] modules/ ディレクトリ作成
- [ ] nodeUtils.js 作成テスト
- [ ] pasteUtils.js 作成テスト
(以下続く)
```
