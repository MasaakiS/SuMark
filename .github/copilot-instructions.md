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
- インターネット接続できない場所でも動作するよう、外部リソースへの依存しないこと。必要なライブラリはローカルに含める。

## Markdown / テーブルに関する注意点
- エディタは `contenteditable` ベースの WYSIWYG。貼り付けや自動変換で「表の中に表」が生成されないよう、挿入前に必ず挿入先が `td` / `th` 内かどうかをチェックすること。
- 具体的には `closest('td, th')` で検査し、セル内なら外側の `table` の直後へ挿入する、あるいはプレーンテキストで挿入する等の回避を行う。

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
   - 例：
     ```markdown
     ## [v0.5.1] - 2026-02-21
     ### 改良
     - 外部CDN依存を排除し、全ライブラリをローカルバンドルに変更
     - GitHub Actions ワークフローのリリース重複問題を修正
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
   git commit -m "v0.5.1: [簡潔な説明]"
   # または commit -m "chore(release): bump version to vX.Y.Z"
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
- **タグ削除の場合**: 誤ってタグやリリースを作成した場合は以下で削除可能です：
  ```bash
  git push --delete origin vX.Y.Z  # リモートタグ削除
  git tag -d vX.Y.Z               # ローカルタグ削除
  gh api -X DELETE repos/{owner}/{repo}/releases/[RELEASE_ID]  # リリース削除（オプション）
  ```

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

### 修正時の推奨フロー
1. JSで新たなクラス/IDを追加・変更した場合、CSS側にも必ず定義・調整が必要。
2. CSSでクラス名を変更した場合、JSのDOM操作が動作しなくなるため、両者の整合性を常に確認する。
3. UI部品の追加・修正時は、上記対応表を参考に影響範囲を洗い出す。

