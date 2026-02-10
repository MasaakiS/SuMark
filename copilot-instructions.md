# GitHub Copilot 用インストラクション

このファイルは GitHub Copilot（と類似のペアプログラミングAI）向けのガイドです。
プロジェクト固有の方針・実行方法・注意点をまとめています。提案を行う際はまずここに従ってください。

## プロジェクト概要
- 名称: SuMark
- 概要: Tauri ベースのデスクトップ向け WYSIWYG Markdown エディタ。Markdown ↔ HTML の双方向変換、画像/添付ファイルの扱い、PDF 出力などを提供します。

## 開発環境/起動方法
- ルートで依存とビルドを行う（開発中は `tauri dev` を使う）:

```bash
npm install
npm run dev
```

## 主要ファイル
- フロントエンド/ロジック: `src/main.js`
- UI: `src/index.html`, `src/styles.css`
- Tauri (Rust): `src-tauri/Cargo.toml`
- パッケージ設定: `package.json`

ファイル参照の際は必ずワークスペース相対パスを使用してください。

## コーディング方針
- 変更は小さく、目的が明確な単位で行う。既存のスタイルを乱さない。
- バグ修正は根本原因を直すことを優先し、表面的な回避策は最小限にする。
- パフォーマンスや大きなバイナリ処理にはチャンク処理などの安全策を使う。
- DOM 操作は `getAttribute` / `setAttribute` と生の属性値を意識する（ブラウザが `src` をノーマライズすることがあるため）。

## Markdown / テーブルに関する注意点
- エディタは `contenteditable` ベースの WYSIWYG。貼り付けや自動変換で「表の中に表」が生成されないよう、挿入前に必ず挿入先が `td` / `th` 内かどうかをチェックすること。
- 具体的には `closest('td, th')` で検査し、セル内なら外側の `table` の直後へ挿入する、あるいはプレーンテキストで挿入する等の回避を行う。

## セキュリティとサニタイズ
- 外部HTMLを挿入するときは `escapeHtml` 等でテキストをエスケープする。意図的に生HTMLを保持する場合は明記する。

## テスト・検証

### 手動テスト
- 変更後は `npm run dev` で起動し、該当操作（貼り付け、テーブル挿入、画像エクスポートなど）を手動で検証する。

### 自動テスト（E2E）
プロジェクトには WebDriverIO ベースの E2E テストスイートが用意されています。

#### テストの実行
```bash
# ビルド + テスト実行（推奨）
npm test

# テストのみ実行（ビルド済みの場合）
npm run test:e2e

# 特定のテストファイルを実行
npx wdio run wdio.conf.js --spec test/e2e/01-basic.test.js
```

#### テスト構成
- **設定**: `wdio.conf.js` - WebDriverIO 設定
- **ヘルパー**: `test/helpers/TestHelpers.js` - 再利用可能なユーティリティ関数
- **テストスイート**: `test/e2e/*.test.js` - 機能別のテストファイル
  - `01-basic.test.js` - 基本操作（起動、入力、削除）
  - `02-markdown.test.js` - Markdown 自動変換（見出し、リスト、装飾、数式）
  - `03-toolbar.test.js` - ツールバー操作（全ボタン）
  - `04-table.test.js` - テーブル操作
  - `05-shortcuts.test.js` - キーボードショートカット
  - `06-tabs.test.js` - タブ管理

#### 新しいテストの追加
1. `test/e2e/` に新しいテストファイルを作成（例: `07-my-feature.test.js`）
2. `TestHelpers` を使って効率的にテストを記述:
```javascript
const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('新機能のテスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
    });

    it('機能が動作する', async () => {
        await TestHelpers.typeInEditor('test');
        const text = await TestHelpers.getEditorText();
        expect(text).toContain('test');
    });
});
```

#### テストのベストプラクティス
- **独立性**: 各テストは他のテストに依存しない（`beforeEach` でクリーンアップ）
- **待機**: 非同期処理には `TestHelpers.wait()` や `waitForDisplayed()` を使用
- **明確性**: テスト名は何を検証しているか明確に
- **スクリーンショット**: 失敗時は `test/screenshots/` に自動保存される

#### CI/CD 統合
- GitHub Actions でプラットフォーム別（macOS、Linux、Windows）に自動実行
- main/develop ブランチへの push、PR 時にトリガー
- ワークフロー: `.github/workflows/e2e-tests.yml`

#### トラブルシューティング
- テスト失敗時は `test/screenshots/` を確認
- アプリが起動しない場合は `npm run build` を再実行
- 詳細なガイドは `test/README.md` を参照

#### 重要な注意点
- 新機能を追加する際は、対応する E2E テストも追加すること
- ビルド成果物のパスは `wdio.conf.js` の `binaryPath` で設定
- リリース前に必ず全テストを実行して品質を確認

## コミット・タグ規約
- コミットメッセージは `type(scope): description` 形式（例: `fix(export): handle asset:// images for PDF`）を推奨。
- リリースは下記「バージョン管理」のルールに従ってタグを切る。

## バージョン管理（⚠️ 必須）

リリース時は **以下の 3 ファイルすべて** のバージョンを同一に揃えること。
1 つでも漏れると、ビルド成果物のファイル名がバラバラになる。

| ファイル | フィールド | 影響範囲 |
|---|---|---|
| `package.json` | `"version"` | npm / タグ管理 |
| `src-tauri/tauri.conf.json` | `package.version` | **インストーラーのファイル名** (`.dmg`, `.msi`, `.deb`, `.rpm`, `.exe`) |
| `src-tauri/Cargo.toml` | `version` | Rust バイナリのバージョン情報 |

### リリース手順チェックリスト
1. 上記 3 ファイルのバージョンを新しいバージョン（例: `0.4.0`）に更新
2. `git add -A && git commit -m "chore(release): bump version to vX.Y.Z"`
3. `git tag vX.Y.Z && git push origin main && git push origin vX.Y.Z`
4. GitHub Actions が自動でビルド・リリースを作成

### バージョン確認コマンド（リリース前に実行推奨）
```bash
echo "package.json: $(jq -r .version package.json)"
echo "tauri.conf.json: $(jq -r .package.version src-tauri/tauri.conf.json)"
echo "Cargo.toml: $(grep '^version' src-tauri/Cargo.toml | head -1)"
```
3 つの出力が一致していることを確認してからタグを作成すること。

## 禁止事項 / 注意事項
- 無断で大きなファイルフォーマットの置換や他コンポーネントの大改造は行わない。
- ユーザー環境に依存するパスや個人情報をコミットしない（絶対パス等）。

---
もしこのプロジェクトに合わせて追記してほしいルールがあれば教えてください。