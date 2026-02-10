# E2E テスト クイックスタート

## 🚀 すぐに始める

### 1. セットアップ（初回のみ）

```bash
# 依存関係のインストール
npm install

# アプリケーションのビルド
npm run build
```

### 2. テストを実行

```bash
# 全テストを実行
npm test

# または、ビルド済みの場合はテストのみ実行
npm run test:e2e
```

### 3. テスト結果の確認

- ✅ すべてのテストが通れば成功
- ❌ 失敗した場合は `test/screenshots/` にスクリーンショットが保存されます

## 📝 よく使うコマンド

| コマンド | 説明 |
|---------|------|
| `npm test` | ビルド + テスト実行 |
| `npm run test:e2e` | テストのみ実行 |
| `npm run test:build` | ビルドのみ |
| `npx wdio run wdio.conf.js --spec test/e2e/01-basic.test.js` | 特定のテストを実行 |

## 🔍 カバレッジ

現在のテストスイートがカバーする範囲:

- ✅ 基本操作（入力、削除、表示）
- ✅ Markdown 自動変換（見出し、リスト、装飾、数式）
- ✅ ツールバー操作（全ボタン）
- ✅ キーボードショートカット（書式、編集、日時）
- ✅ テーブル操作（挿入、編集）
- ✅ タブ管理（作成、切替、削除）

詳細は [test/README.md](./README.md) を参照してください。

## 💡 トラブルシューティング

### テストが失敗する

1. アプリが最新の状態でビルドされているか確認:
   ```bash
   npm run build
   ```

2. スクリーンショットを確認:
   ```bash
   ls -la test/screenshots/
   ```

3. 個別のテストを実行して原因を特定:
   ```bash
   npx wdio run wdio.conf.js --spec test/e2e/01-basic.test.js
   ```

### ビルドが失敗する

1. Rust と Tauri CLI がインストールされているか確認
2. `src-tauri/target/` を削除してクリーンビルド:
   ```bash
   rm -rf src-tauri/target
   npm run build
   ```

## 📚 さらに詳しく

- [完全なテストガイド](./README.md)
- [WebDriverIO ドキュメント](https://webdriver.io/)
- [Tauri テストガイド](https://tauri.app/v1/guides/testing/)

---

**ヒント**: テストは CI/CD で自動実行されます。GitHub Actions でプラットフォーム別の結果を確認できます。
