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
- フロントエンド/ロジック: 
   - `src/main.js`（エントリーポイント、初期化、イベントハンドリング）
   - `src/utils.js`（ユーティリティ関数、Markdown変換ロジック、ファイル操作など）
   - `src/nodeUtils.js`（DOM ノード操作）
   - `src/pasteUtils.js`（ペースト処理）
   - `src/codeHighlight.js`（コードブロックハイライト）
   - `src/mathRender.js`（KaTeX 数式レンダリング）
   - `src/mermaidManager.js`（Mermaid 図表管理）
   - `src/tocManager.js`（目次生成・管理）
   - `src/toggleBlock.js`（トグルブロック管理）
   - `src/autoConvert.js`（自動変換処理）
   - `src/markdown.js`（Markdown変換ロジック）
   - `src/keyboard.js`（キーボードイベント処理）
- UI: `src/index.html`, `src/styles/`（7ファイルに分割: base, layout, editor, markdown, components, dialogs, print）
- Tauri (Rust): `src-tauri/Cargo.toml`
- ドキュメント: `docs/`（設計・実装ガイド）
- パッケージ設定: `package.json`

ファイル参照の際は必ずワークスペース相対パスを使用してください。

## コーディング方針
- すべてのコーディング作業では、まずSerena MCPを使ってプロジェクト構造を確認し、シンボル検索を実行してください。Serenaにアクセスできない場合を除き、必ず /mcp__serena でオンボーディングを維持。
- 変更は小さく、目的が明確な単位で行う。既存のスタイルを乱さない。
- バグ修正は根本原因を直すことを優先し、表面的な回避策は最小限にする。
- パフォーマンスや大きなバイナリ処理にはチャンク処理などの安全策を使う。
- DOM 操作は `getAttribute` / `setAttribute` と生の属性値を意識する（ブラウザが `src` をノーマライズすることがあるため）。
- インターネット接続できない場所でも動作するよう、外部リソースへの依存しないこと。必要なライブラリはローカルに含める。


## Markdown / テーブルに関する注意点
- エディタは `contenteditable` ベースの WYSIWYG。貼り付けや自動変換で「表の中に表」が生成されないよう、挿入前に必ず挿入先が `td` / `th` 内かどうかをチェックすること。
- 具体的には `closest('td, th')` で検査し、セル内なら外側の `table` の直後へ挿入する、あるいはプレーンテキストで挿入する等の回避を行う。
- テーブルセル内ではブロック要素（コードブロック・水平線・トグル・引用）の挿入を制限している。

## 通知システム / ユーザーフィードバック
- `alert()` の代わりにトースト通知を使用：
  - `showWarn()`: 黄色バナー (3秒表示) - 軽微な警告
  - `showError()`: 赤色バナー (5秒表示) - エラー通知（ファイル操作、PDF出力エラーなど）
- ブロッキングを避けるため、重要なエラーも非ブロッキングの通知で対応。

## Notionエクスポート形式への対応
- Notionからエクスポートされたマークダウン（複数行テーブルセルなど）への対応を実装。
- `preprocessNotionMarkdown()` で前処理し、複数行セルを `<br>` で結合。
- ファイルを開く・ペースト・`setMarkdown()` の全パスで有効。

## セキュリティとサニタイズ
- 外部HTMLを挿入するときは `escapeHtml` 等でテキストをエスケープする。意図的に生HTMLを保持する場合は明記する。

## テスト・検証
- 変更後は `npm run dev` で起動し、該当操作（貼り付け、テーブル挿入、画像エクスポートなど）を手動で検証する。

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

#### 準備フェーズ
1. **CHANGELOG.md を更新**
   - 最新の `## [vX.Y.Z] - YYYY-MM-DD` セクションを追加
   - 改良点・修正点・テスト結果などを記載
   - わかりやすい言葉で簡素にまとめること（例: "ファイルドロップで既に開いているファイルを切り替えるように修正"）
   - 例：
     ```markdown
     ## [v0.6.3] - 2026-03-03
     ### 修正
     - 目次（TOC）の保存・再読み込み時のリンク機能を修正
     - `reconstructTocContainers()`: Markdown保存→再読み込み時に失われた構造を復元
     ```

2. **バージョン同期確認** — 上記 3 ファイルを同一バージョンに更新
   ```bash
   # 確認コマンド
   echo "package.json: $(jq -r .version package.json)"
   echo "tauri.conf.json: $(jq -r .package.version src-tauri/tauri.conf.json)"
   echo "Cargo.toml: $(grep '^version' src-tauri/Cargo.toml | head -1)"
   ```
   3 つの出力が一致していることを確認してからタグを作成すること。

3. **ローカル動作確認**
   ```bash
   npm run dev
   # 機能を手動で軽く検証（テーブル、画像、Markdown変換など）
   ```

#### コミット・プッシュフェーズ
4. **変更をステージ・コミット**
   ```bash
   git add CHANGELOG.md package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json [その他変更ファイル]
   git commit -m "chore(release): bump version to vX.Y.Z"
   ```

5. **main ブランチにプッシュ**
   ```bash
   git push origin main
   ```

#### リリースタグフェーズ
6. **タグ作成・プッシュ** — CI が自動トリガーされます
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

7. **CI ビルド進捗確認**
   ```bash
   gh run list --limit 5
   # または
   gh run watch [RUN_ID]
   ```

#### リリース完了フェーズ
8. **GitHub Release ページを確認・公開**
   - Draft ステータスのリリースが自動作成されます
   - アセット数やノート内容を確認
   - 必要に応じて "Publish release" ボタンで公開（デフォルトは Draft）

### 注意点
- **重複リリース防止**: Build & Release ワークフローは `create_release` ジョブで単一のドラフトリリースを作成し、各プラットフォーム（macOS/Windows/Linux）のビルドジョブはアセットアップロードのみを行います。レースコンディションは発生しません。
- **オフラインサポート**: v0.5.1 以降、全ライブラリが `src/vendor/` にローカルバンドルされているため、CDN によるダウンロードは不要です。
- **モジュール分割**: v0.6.0 以降、`main.js` の機能は複数のモジュール（`utils.js`, `nodeUtils.js`, `pasteUtils.js`, `codeHighlight.js`, `mathRender.js`, `mermaidManager.js`, `tocManager.js`, `toggleBlock.js`）に分割されています。
- **タグ削除の場合**: 誤ってタグやリリースを作成した場合は以下で削除可能です：
  ```bash
  git push --delete origin vX.Y.Z  # リモートタグ削除
  git tag -d vX.Y.Z               # ローカルタグ削除
  gh api -X DELETE repos/{owner}/{repo}/releases/[RELEASE_ID]  # リリース削除（オプション）
  ```

## バグ予防対策（実装済み）

### A. Husky プリコミットフック
- `npm install --save-dev husky` でインストール済み
- `.husky/pre-commit` で自動検証スクリプトを実行
- コミット前に CSS-JS 整合性チェックを実施

実行コマンド:
```bash
npm run prepare  # husky hooks をセットアップ
```

### B. CSS-JS 検証スクリプト
- `scripts/validate-css-js-sync.js` を実装
- JS で使用しているクラス/ID が CSS で定義されているか自動チェック
- 動的生成クラス（`.math-*`, `.language-*`, `#mermaid-*` など）は自動除外

実行コマンド:
```bash
npm run test:lint  # CSS-JS 検証実行
```

### C. テスト拡充（E2E テスト全体）
- 11 個の Playwright テストファイル（計 147 テスト）
- **基本操作**: 01-basic.spec.js
- **Markdown 変換**: 02-markdown.spec.js（数式・コード・テーブル等）
- **ツールバー**: 03-toolbar.spec.js
- **テーブル操作**: 04-table.spec.js（セル内ブロック要素禁止検証含む）
- **キーボードショートカット**: 05-shortcuts.spec.js
- **タブ操作**: 06-tabs.spec.js
- **エラーハンドリング**: 07-error-handling.spec.js
- **ラウンドトリップ**: 08-roundtrip.spec.js（Markdown ↔ HTML 往復検証）
- **推奨事項**: 09-recommended.spec.js
- **Tauri 拡張アクセス**: 10-tauri-ext-access.spec.js
- **エディタ追加機能**: 11-editor-extras.spec.js
- **合計**: 147 テスト全てパス済み

実行コマンド:
```bash
npm run test:e2e                    # 全テスト実行
npm run test:e2e -- test/playwright/08-roundtrip.spec.js  # ラウンドトリップテストのみ
npm run test:e2e:headed            # ブラウザ表示で実行
```

---

## 禁止事項 / 注意事項
- 無断で大きなファイルフォーマットの置換や他コンポーネントの大改造は行わない。
- ユーザー環境に依存するパスや個人情報をコミットしない（絶対パス等）。

## JSとCSSの連携・UI修正時の注意

### JSとCSSの関係性
- JSで操作・生成するDOM要素のクラス/IDは、必ずCSSで定義・調整すること。
- クラス/ID名の変更時は、JS・CSS両方の影響範囲を必ず確認する。
- 特に`.markdown-body`配下の要素（h1〜h6, blockquote, table, code等）はMarkdown変換後のHTML構造に依存し、影響範囲が広い。
- UI部品追加・修正時は、下記の主要クラス/ID対応表を参考にすること。

### 主要クラス/IDと用途対応表
| クラス/ID | 用途・説明 |
|---|---|
| `#editor` | メインのエディタ領域。WYSIWYG編集、Markdown表示 |
| `.toolbar-btn` | ツールバーの各ボタン |
| `.tab-bar`, `.tab-list`, `.tab-item` | タブUI。ファイル切替など |
| `.code-copy-btn`, `.code-copy-container` | コードブロックのコピー用ボタン |
| `.image-copy-btn` | 画像コピー用ボタン |
| `.line-numbers-gutter` | コードブロックの行番号表示 |
| `.img-error-container`, `.img-error-text`, `.img-error-src` | 画像読み込みエラー時の表示 |
| `.mermaid-container` | Mermaidダイアグラムのラッパー |
| `.toggle-content`, `.toggle-delete-btn` | トグル（details/summary）ブロック |
| `.toc-container`, `.toc-delete-btn`, `.toc-link` | 目次（TOC）ブロック |
| `.task-list-item`, `.contains-task-list` | タスクリスト（チェックボックス付きリスト） |
| `.image-viewer-modal`, `.image-viewer-close`, `.image-viewer-img`, `.image-viewer-info` | 画像拡大ビュー用モーダル |
| `.modal-overlay`, `.modal-dialog`, `.modal-title`, `.modal-btn`, `.modal-btn-ok`, `.modal-btn-cancel` | モーダルダイアログ |
| `#modalOverlay`, `#modalTitle`, `#modalFields`, `#modalOk`, `#modalCancel` | モーダルダイアログの各要素 |
| `#currentFile`, `#wordCount`, `#tabList`, `#emojiBtn` | ステータスバーやタブ、絵文字ボタン |

### 修正時の必須確認項目チェックリスト

**⚠️ AI修正時は、以下のチェックリストを必ず実行してください。**

#### ✓ 全修正共通

- [ ] **ファイル対応確認**: JS修正 → CSS影響範囲も確認（上記対応表を参照）
- [ ] **クラス/ID一貫性**: JS で使用しているクラス/ID が CSS で定義されているか確認
  - 例: `classList.add('xxx')` を追加した場合、`.xxx { ... }` が `src/styles/` 内の該当 CSS ファイルにあるか
- [ ] **複数ファイル編集**: `src/main.js` と `src/styles/` 内の CSS の両方を修正した場合、相互参照が正確か確認
- [ ] **修正対象ファイルが確定**: 「どのファイルを修正するか」をコミット内容から必ず判定

#### ✓ UI/スタイル修正時

- [ ] **クラス/ID変更の追跡**: クラス名を変更した場合、JS側の `querySelector`、`classList` 参照が同期しているか
- [ ] **CSS適用状態テスト**: `npm run dev` で起動し、視覚的に修正が反映されているか確認
- [ ] **影響範囲確認**: `.markdown-body` 配下や共通クラスの修正は、他要素への波及効果を確認
- [ ] **Markdown要素（表・コード・引用）**: 表の中に要素挿入時は `closest('td, th')` で検査済みか確認

#### ✓ 保存機能・データ永続化関連の修正時

- [ ] **保存ロジック確認**: `saveCurrentFile()` および `loadData()` の動作を確認
- [ ] **再オープン保持テスト**: `npm run test:e2e` で E2E テスト `08-roundtrip.spec.js` がパスするか
  - 手動検証: データ入力 → 保存 → アプリ再起動 → データが維持されているか
- [ ] **ローカルストレージ/ファイル同期**: Tauri API との連携（`readTextFile`, `writeTextFile`）で、文字エンコードやパス形式を確認
- [ ] **複数タブでの同期**: タブ切替後も、前のタブの修正内容が失われていないか確認

#### ✓ テーブル操作関連の修正時

- [ ] **セル内挿入確認**: 表セル内に別の表や要素を挿入する際、`closest('td, th')` で検査済みか
- [ ] **貼り付け処理**: HTML 貼り付け時に「表の中に表」が生成されていないか手動確認
- [ ] **スタイル一貫性**: テーブル関連の className 変更時、`src/styles/markdown.css` の `table`, `td`, `th` 定義が同期しているか

#### ✓ Markdown変換関連の修正時

- [ ] **双方向変換テスト**: Markdown → HTML、HTML → Markdown の両方向で、データが欠落しないか
- [ ] **特殊要素**: リンク、画像、コード、表、リスト、引用などの構造が保持されているか確認
- [ ] **サニタイズ確認**: `escapeHtml()` が必要な箇所で適切に使用されているか

#### ✓ 修正後の最終確認

1. **自動テスト実行**:
   ```bash
   npm run test:e2e
   ```
   全テストがパスするか確認。特に以下は チェック：
   - `01-basic.spec.js` （基本操作）
   - `08-roundtrip.spec.js` （保存・再オープン）
   - `04-table.spec.js` （テーブル操作）

2. **手動検証** (`npm run dev` で起動後):
   - 修正した機能が正常に動作しているか
   - UI 修正時は CSS が適用されているか
   - 保存・再オープンで修正の状態が保持されているか

3. **Git差分確認**:
   ```bash
   git diff src/main.js src/styles/
   ```
   不要な変更が含まれていないか確認

4. **コミットメッセージ確認**: `type(scope): description` 形式 ([コミット・タグ規約](#コミットタグ規約) を参照)

