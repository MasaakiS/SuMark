# E2E テストクイックスタート（Playwright）

`test/README.md` の要点だけを短くまとめた実行手順です。

## 前提条件

- Node.js 18 以上
- Rust および Tauri CLI
- `npm ci` 済み

## セットアップ（初回のみ）

```bash
# 依存関係のインストール
npm ci

# アプリケーションのビルド
npm run build
```

## テストの実行

```bash
# スモークテスト
npm test

# E2E テスト
npm run test:e2e
```

## テスト結果の確認

- すべてのテストが通れば成功です。
- 失敗時は `test/playwright-results/` と Playwright レポートで詳細を確認できます。

## よく使うコマンド

| コマンド | 説明 |
|---------|------|
| `npm test` | ビルド + スモークテスト実行 |
| `npm run test:e2e` | テストのみ実行 |
| `npm run test:build` | ビルドのみ |
| `npx playwright test test/playwright/01-basic.spec.js` | 特定のテストを実行 |
| `npm run test:e2e:headed` | ヘッドありで実行 |
| `npm run test:e2e:ui` | UI モードで実行 |
| `npm run test:e2e:report` | レポートを表示 |

## カバレッジ

現在のテストスイートがカバーする範囲:

- 基本操作（入力、削除、表示）
- Markdown 自動変換（見出し、リスト、装飾、数式）
- ツールバー操作（主要ボタン）
- キーボードショートカット（書式、編集、日時）
- テーブル操作（挿入、編集）
- タブ管理（作成、切替、削除）

詳細は [test/README.md](./README.md) を参照してください。

## トラブルシューティング

### テストが失敗する

1. アプリが最新の状態でビルドされているか確認:
   ```bash
   npm run build
   ```

2. テスト成果物を確認:
   ```bash
   ls -la test/playwright-results/
   ```

3. レポートを表示:
   ```bash
   npm run test:e2e:report
   ```

4. 個別のテストを実行して原因を特定:
   ```bash
   npx playwright test test/playwright/01-basic.spec.js --headed
   ```

### ビルドが失敗する

1. Rust と Tauri CLI がインストールされているか確認
2. `src-tauri/target/` を削除してクリーンビルド:
   ```bash
   rm -rf src-tauri/target
   npm run build
   ```

## さらに詳しく

- [完全なテストガイド](./README.md)
- [Playwright ドキュメント](https://playwright.dev/)
- [Tauri テストガイド](https://tauri.app/v1/guides/testing/)
