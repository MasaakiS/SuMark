# E2E テストガイド（Playwright）

SuMark の E2E（End-to-End）テスト運用ガイドです。現行の公式E2E基盤は Playwright です。

まず短い手順だけ確認したい場合は [QUICKSTART.md](./QUICKSTART.md) を参照してください。

## 前提条件

- Node.js 18 以上
- Rust および Tauri CLI
- `npm ci` 済み

## セットアップ

```bash
npm ci
```

## テストの実行

### スモークテスト

```bash
npm test
```

### E2E テスト

```bash
npm run test:e2e
```

### ヘッドあり実行

```bash
npm run test:e2e:headed
```

### UI モード

```bash
npm run test:e2e:ui
```

### レポート表示

```bash
npm run test:e2e:report
```

### 特定ファイルのみ実行

```bash
npx playwright test test/playwright/01-basic.spec.js
```

## テスト構成

- E2E 本体: `test/playwright/*.spec.js`
- フィクスチャ: `test/playwright/fixtures.js`
- ヘルパー: `test/playwright/helpers.js`

主なスイート:

1. `01-basic.spec.js` 基本操作
2. `02-markdown.spec.js` Markdown自動変換
3. `03-toolbar.spec.js` ツールバー
4. `04-table.spec.js` テーブル操作
5. `05-shortcuts.spec.js` ショートカット
6. `06-tabs.spec.js` タブ操作
7. `07-error-handling.spec.js` エラー表示
8. `08-roundtrip.spec.js` 保存・再オープン保持
9. `09-recommended.spec.js` 推奨追加ケース
10. `10-tauri-ext-access.spec.js` Tauri連携

## 新しいテストの追加

1. `test/playwright/NN-feature.spec.js` を作成
2. `fixtures` の `app` を使って操作・検証を記述
3. `npm run test:e2e` で確認

最小テンプレート:

```javascript
const { test, expect } = require('./fixtures');

test.describe('新機能テスト', () => {
    test('機能が動作する', async ({ app }) => {
        await app.helpers.clearEditor();
        await app.helpers.typeInEditor('test');
        const text = await app.helpers.getEditorText();
        expect(text).toContain('test');
    });
});
```

## トラブルシューティング

### タイムアウトする

- `playwright.config.js` の `timeout` / `expect.timeout` を確認
- 固定 `wait` ではなく `expect(locator).toBeVisible()` などの待機を優先

### 起動に失敗する

- `npm run dev` でアプリが正常起動するか確認
- Tauri連携ケースはブラウザモードで一部 `skip` される仕様を確認

### レポートを確認したい

```bash
npm run test:e2e:report
```

## 補足

- 旧WDIOテスト資産は `test/_archive/wdio/` に退避済みです。
