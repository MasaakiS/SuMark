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

### 自動テスト（E2E） — Playwright

E2E テストは **Playwright** で実行する。Tauri WebView への直接接続は困難なため、
`src/` ディレクトリをローカル HTTP サーバで配信し、通常の Chromium ブラウザで
アクセスする「**ブラウザモード**」方式を採用している。
`window.__TAURI__` が存在しない場合、`main.js` 内のフォールバックで Tauri API が
モックされるため、エディタの UI/UX テストはそのまま実行可能。

#### テストの実行
```bash
# 全テスト実行
npm run test:e2e

# headed モード（ブラウザを表示）
npm run test:e2e:headed

# Playwright UI モード（インタラクティブ）
npm run test:e2e:ui

# テストレポートを表示
npm run test:e2e:report

# 特定のテストファイルのみ
npx playwright test test/playwright/01-basic.spec.js
```

#### テスト構成
```
playwright.config.js            ← Playwright 設定（testDir, reporter 等）
test/playwright/
  fixtures.js                   ← カスタムフィクスチャ（HTTP サーバ + app オブジェクト）
  helpers.js                    ← PlaywrightHelpers クラス（エディタ操作ユーティリティ）
  01-basic.spec.js              ← 基本操作（起動、入力、削除、日本語、ステータスバー）
  02-markdown.spec.js           ← Markdown 自動変換（見出し、リスト、装飾、数式）
  03-toolbar.spec.js            ← ツールバー操作（書式、見出し、リスト、挿入ボタン）
  04-table.spec.js              ← テーブル操作（挿入、セル入力、コンテキストメニュー）
  05-shortcuts.spec.js          ← キーボードショートカット
  06-tabs.spec.js               ← タブ管理
test/debug-playwright.js        ← ヘッドレスでの DOM 状態確認用デバッグスクリプト
```

#### フィクスチャの仕組み
- `_serverURL`（worker スコープ）: `src/` を配信する HTTP 静的ファイルサーバをランダムポートで起動
- `app`（test スコープ）: ページをサーバに遷移させ、`#editor` の表示を待ち、`{ page, helpers }` を返す

#### 新しいテストの追加
```javascript
const { test, expect } = require('./fixtures');

test.describe('新機能テスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test('機能が動作する', async ({ app }) => {
        await app.helpers.typeInEditor('test');
        const text = await app.helpers.getEditorText();
        expect(text).toContain('test');
    });
});
```

#### ブラウザモードにおける既知の制約・動作差異

##### エディタ DOM 構造
- 初期状態は `<p><br></p>`。`clearEditor()` も同じ状態に戻す。
- `handleBlockAutoConversion()` は現在のブロック要素が `<p>` または `<div>` のときだけ動作する。
  `block === editor`（直接 contenteditable の div にテキストがある場合）や `block === null` のときは
  何もしない。したがって **clearEditor で `<p>` を復元しないと自動変換テストがすべて失敗する**。

##### キーボードショートカット（macOS）
- ヘッドレス Chromium では **`Meta+key` が有効**（`Control+key` は無効）。
- `Meta+B` は `<b>` タグを生成する（`<strong>` ではない）。テストでは `b, strong` の両方をチェックすること。
- `Meta+I` → `<i>`（`<em>` ではなく `<i>` になる場合がある）。
- アプリ側でキャプチャしている `Meta+Shift+X`（取り消し線）等も動作する。

##### ツールバーボタンとフォーカス
- ツールバーボタンをクリックすると **エディタの selection/focus が失われる**。
  `main.js` のツールバーボタンに `mousedown` の `preventDefault` がないため。
- テストでは `execFormatCommand()` で `document.execCommand` を直接呼ぶか、
  `clickToolbarButton()` の `dispatchEvent` ワークアラウンドを使う。
- 見出し・リスト・挿入系ボタンはフォーカス喪失の影響を受けにくい（独自関数で処理するため）。

##### テーブル挿入
- `insertTable()` は **モーダルなしで直接** 3 列 × 2 行のテーブルを挿入する。
- テーブル操作（行/列の追加・削除）は右クリックコンテキストメニューで行う。

##### コードブロック
- `codeBlockBtn`（コードブロック）→ `showModal` でモーダルが開く。
- `codeBtn`（インラインコード）→ `applyInlineCode()` でモーダルなしに直接適用。
- 「下線ボタン（underlineBtn）」は **アプリに存在しない**。

##### 日時挿入
- `invoke('get_current_date')` 等の Tauri コマンドはブラウザモードではモックされるが、
  モックは `Promise.resolve()` → `undefined` を返す。
- `document.execCommand('insertText', false, undefined)` は何も挿入せず例外も出ないため、
  catch フォールバック（JS Date で代替挿入）も動作しない。
- テストでは `expect(text.length).toBeGreaterThan(0)` のような緩い検証にするか、
  日時挿入テストを `test.skip` にする。

##### タブ管理
- タブ要素のセレクタは `.tab-item`（`.tab` ではない）。
- アクティブタブは `.tab-item.active`。タブタイトルは `.tab-title`。
- タブ関連の操作（`Cmd+N` で新規タブ、`Cmd+W` で閉じる）はブラウザモードでも動作する。

##### Markdown 自動変換のテスト
- `# Heading` → `<h1>` 変換は動作確認済み（デバッグスクリプトで実証）。
- 変換トリガーは `input` イベントの `onEditorInput` → `handleBlockAutoConversion()`。
- テストで `typeInEditor()` の後に `wait(800)` 程度の待機が必要。
- 変換はブロック冒頭の Markdown 記法（`# `, `- `, `1. `, `> `, `---` 等）を検知して行われる。

#### デバッグの方法
ヘッドレス Chromium での実際の DOM 状態を確認するには `test/debug-playwright.js` を使う:
```bash
node test/debug-playwright.js > test/debug-output.txt 2>&1
cat test/debug-output.txt
```
このスクリプトは HTTP サーバを起動してブラウザでアクセスし、各種操作後のエディタ HTML を出力する。

#### テストのベストプラクティス
- **独立性**: 各テストは `beforeEach` で `clearEditor()` を呼びクリーンアップ
- **待機**: 自動変換には `wait(800)` 以上、DOM 更新には `wait(200〜300)` を使用
- **フォーカス管理**: 連続入力時は `typeMore()` を使い、`typeInEditor()` による再フォーカスを避ける
- **書式テスト**: `execFormatCommand()` か `pressShortcut()` を使い、ツールバークリックによるフォーカス喪失を回避
- **スクリーンショット**: 失敗時は `test/playwright-report/` に自動保存される
- **Bold のタグ**: `<strong>` ではなく `<b>` が生成される場合があるため、両方チェックする

#### CI/CD 統合
- GitHub Actions でプラットフォーム別（macOS、Linux、Windows）に自動実行
- main/develop ブランチへの push、PR 時にトリガー

#### 重要な注意点
- 新機能を追加する際は対応する E2E テストも追加すること
- リリース前に `npm run test:e2e` で全テストを実行して品質を確認
- ブラウザモードでは Tauri 固有機能（ファイル保存、PDF エクスポート等）はテスト不可

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