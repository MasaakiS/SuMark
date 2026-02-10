# E2E テストガイド

SuMark の完全な E2E（End-to-End）テストスイートのガイドです。

## 📋 目次

- [前提条件](#前提条件)
- [セットアップ](#セットアップ)
- [テストの実行](#テストの実行)
- [テストの構成](#テストの構成)
- [新しいテストの追加](#新しいテストの追加)
- [トラブルシューティング](#トラブルシューティング)

## 前提条件

- Node.js 18 以上
- Rust および Tauri CLI
- アプリケーションのビルドが成功していること

## セットアップ

1. 依存関係をインストール:
```bash
npm install
```

2. アプリケーションをビルド:
```bash
npm run build
```

## テストの実行

### すべてのテストを実行

```bash
npm test
```

このコマンドは以下を実行します:
1. アプリケーションのビルド
2. E2E テストの実行

### E2E テストのみを実行

ビルド済みの場合、テストのみを実行:

```bash
npm run test:e2e
```

### 特定のテストファイルを実行

```bash
npx wdio run wdio.conf.js --spec test/e2e/01-basic.test.js
```

### ウォッチモードでテストを実行

```bash
npm run test:e2e:watch
```

## テストの構成

### テストスイート一覧

1. **基本操作テスト** (`01-basic.test.js`)
   - アプリの起動確認
   - テキスト入力・削除
   - 日本語入力
   - UI要素の表示確認

2. **Markdown 変換テスト** (`02-markdown.test.js`)
   - 見出し変換 (# → h1, ## → h2, etc.)
   - リスト変換 (-, *, 1.)
   - タスクリスト変換 (- [ ], - [x])
   - 装飾変換 (**, *, ~~, `)
   - 引用・水平線変換
   - 数式変換 (KaTeX)

3. **ツールバー操作テスト** (`03-toolbar.test.js`)
   - 書式ボタン（太字、斜体、下線、取り消し線）
   - 見出しボタン (H1, H2, H3)
   - リストボタン（箇条書き、番号付き、タスク）
   - 挿入ボタン（引用、水平線、テーブル、コード、リンク）
   - Undo/Redo ボタン
   - 日時挿入ボタン

4. **テーブル操作テスト** (`04-table.test.js`)
   - テーブル挿入（様々なサイズ）
   - セルへのテキスト入力
   - コンテキストメニュー表示

5. **キーボードショートカットテスト** (`05-shortcuts.test.js`)
   - 書式ショートカット (Cmd/Ctrl+B, I, U, Shift+X)
   - 編集ショートカット (Cmd/Ctrl+Z, Shift+Z, Y, A)
   - 日時挿入ショートカット (Cmd/Ctrl+;, :)
   - ファイル操作ショートカット (Cmd/Ctrl+N, W)
   - Enter キーの動作

6. **タブ操作テスト** (`06-tabs.test.js`)
   - タブの作成・削除
   - タブの切り替え
   - 各タブの独立性
   - 最後のタブの保護
   - タブタイトル表示
   - 編集マーク表示

### テストヘルパー

`test/helpers/TestHelpers.js` には以下のユーティリティ関数があります:

```javascript
// エディタ操作
TestHelpers.getEditor()
TestHelpers.clearEditor()
TestHelpers.typeInEditor(text)
TestHelpers.getEditorHTML()
TestHelpers.getEditorText()

// キーボード操作
TestHelpers.pressShortcut(key)

// ツールバー操作
TestHelpers.clickToolbarButton(buttonId)

// モーダル操作
TestHelpers.waitForModal()
TestHelpers.closeModal()
TestHelpers.setModalField(fieldName, value)
TestHelpers.clickModalOK()

// 検証
TestHelpers.elementExists(selector)
TestHelpers.editorContainsTag(tagName)

// その他
TestHelpers.takeScreenshot(name)
TestHelpers.wait(ms)
TestHelpers.getTableRowCount()
TestHelpers.getTabCount()
TestHelpers.getWordCount()
```

## 新しいテストの追加

### 1. テストファイルを作成

```bash
touch test/e2e/07-my-feature.test.js
```

### 2. テストを記述

```javascript
const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('新機能のテスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
    });

    it('機能が動作する', async () => {
        // テストコード
        await TestHelpers.typeInEditor('test');
        const text = await TestHelpers.getEditorText();
        expect(text).toContain('test');
    });
});
```

### 3. テストを実行

```bash
npm run test:e2e
```

## トラブルシューティング

### アプリが起動しない

1. アプリケーションが正しくビルドされているか確認:
```bash
npm run build
```

2. バイナリのパスを確認（`wdio.conf.js` の `binaryPath`）

### テストがタイムアウトする

1. `wdio.conf.js` の `mochaOpts.timeout` を増やす
2. テスト内の `waitforTimeout` を増やす

### スクリーンショットが保存されない

1. `test/screenshots/` ディレクトリが存在するか確認:
```bash
mkdir -p test/screenshots
```

### テストが不安定

1. `TestHelpers.wait()` を使って待機時間を追加
2. 要素が表示されるまで待つ: `await element.waitForDisplayed()`

### CI でテストが失敗する

1. GitHub Actions のログを確認
2. テストスクリーンショットのアーティファクトをダウンロード
3. ローカルで該当プラットフォームのテストを実行

## CI/CD 統合

GitHub Actions で自動的にテストが実行されます:

- **トリガー**: main/develop ブランチへの push、PR
- **プラットフォーム**: macOS, Ubuntu, Windows
- **アーティファクト**: テスト失敗時のスクリーンショット

ワークフローファイル: `.github/workflows/e2e-tests.yml`

## ベストプラクティス

1. **テストは独立させる**: 各テストは他のテストに依存しない
2. **クリーンアップ**: `beforeEach` でエディタをクリア
3. **適切な待機**: 非同期処理には十分な待機時間を設定
4. **明確なアサーション**: 何をテストしているか明確に
5. **再現性**: テストは常に同じ結果を返すべき

## 参考資料

- [WebDriverIO Documentation](https://webdriver.io/)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)
- [Mocha Documentation](https://mochajs.org/)

## サポート

問題が発生した場合やテストに関する質問がある場合は、GitHub Issues で報告してください。
