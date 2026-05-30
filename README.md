# SuMark

Tauriベースのデスクトップ向けWYSIWYG Markdownエディターです。Markdownを書きながらリアルタイムにリッチテキスト表示を行います。

## 特徴

- 📝 **WYSIWYG 編集**: Markdown を書きながらリアルタイムにリッチテキスト表示
- 🎨 **豊富な機能**: GFM 準拠の Markdown 機能をフルサポート
- ⌨️ **キーボードショートカット**: 日付・日時の素早い挿入、各種書式設定
- 🖥️ **クロスプラットフォーム**: macOS / Windows / Linux 対応
- 🚀 **デスクトップアプリ**: Tauri を使った軽量なネイティブ実行環境
- 📊 **Mermaid 図**: フローチャート・シーケンス図などの図表表示
- 😀 **絵文字サポート**: `:smile:` 形式のショートコードと絵文字ピッカー
- 🗂️ **タブ UI**: 複数ファイルの同時編集
- ▶ **トグル**: Notion 風の折りたたみブロック
- 📄 **PDF エクスポート**: Markdown を PDF に変換して保存
- 📋 **画像コピー**: 挿入画像をワンクリックでクリップボードにコピー
- 📥 **Notion エクスポート対応**: Notion の Markdown + CSV を Markdown + テーブルに自動変換

## 主な機能

### 基本編集
- **太字** (`Cmd/Ctrl+B`), **斜体** (`Cmd/Ctrl+I`), **取り消し線** (`Cmd/Ctrl+Shift+X`), **インラインコード** (`Cmd/Ctrl+E`)
- **見出し** (H1〜H6): `# ` 入力で自動変換
- **リンク挿入** (`Cmd/Ctrl+K`): カスタムダイアログで URL とテキストを入力
- **画像挿入**: ローカルファイル選択 / クリップボードから貼り付け
- **画像リサイズ**: 画像クリック後、右下のハンドルをドラッグしてサイズ変更
- **画像コピー**: 画像クリックで表示される「📋 Copy」ボタンで画像をクリップボードにコピー

### リスト
- **箇条書きリスト**: `- ` または `* ` で自動変換
- **番号付きリスト**: `1. ` で自動変換
- **タスクリスト**: `- [ ] ` または `[] ` / `[x] `（短縮記法）で自動変換、チェックボックス操作可能
- **ネストリスト**: Tab キーでインデント、Shift+Tab でアウトデント

### 書式・構造
- **引用** (`> `): 自動変換、空行 Enter で脱出
- **コードブロック**: ` ``` ` + Enter で自動変換、言語指定でシンタックスハイライト
  - **コピーボタン**: 「Copy」（コードのみ）/「Copy #」（行番号付き）
  - **言語ドロップダウン**: クリックで言語を切り替え
- **テーブル**: ツールバーから挿入、右クリックで行/列の追加・削除
  - **行ドラッグ**: 行左端のハンドルをドラッグして行の順序を変更（マウス・タッチ対応）
  - **列揃え**: 右クリックメニューから左揃え・中央・右揃えを設定、Markdown 保存時に区切り行（`|:---|:---:|---:|`）へ反映され再読み込み後も維持
- **トグル**: `>>> ` で自動変換、ツールバーから挿入、テキスト選択→トグル化にも対応
- **水平線**: `---` で自動変換
- **Mermaid 図**: コードブロック言語を `mermaid` に指定すると自動レンダリング（ダブルクリックで編集）
- **目次（TOC）自動生成**: ツールバーのボタンで見出しから自動生成

### 自動変換
- **ブロックレベル**: `# `, `- `, `1. `, `> `, `---`, `[] `, `[x] `, ` ``` `, `>>> ` の入力で即時変換
- **インライン**: `**太字**`, `*斜体*`, `` `コード` ``, `~~取り消し~~` の入力で即時変換
- **数式**: `$E=mc^2$` でインライン数式、`$$\sum_{i=1}^n$$` でブロック数式に自動変換（KaTeX）
- **リンク自動検出**: `https://...` に続けてスペースを入力すると自動的にリンクに変換
- **絵文字変換**: `:smile:`, `:fire:`, `:rocket:` などの入力で絵文字に自動変換

### ファイル・タブ管理
- **新規作成** (`Cmd/Ctrl+N`)
- **開く** (`Cmd/Ctrl+O`): 複数ファイル選択対応、重複検出
- **複数の開き方に対応**: 開くボタンに加えて、ウィンドウへのドラッグ&ドロップ、アプリアイコンへのドラッグ&ドロップ、関連付け済みファイルのダブルクリックや「このアプリで開く」に対応
- **対応ファイル形式**: `.md`, `.markdown`, `.txt`
- **保存** (`Cmd/Ctrl+S`)
- **名前を付けて保存** (`Cmd/Ctrl+Shift+S`): 別名で保存
- **PDF エクスポート**: HTML 形式で出力し、ブラウザの印刷機能で PDF 化
- **タブ UI**: 複数ファイルの同時編集、タブ切替、タブ閉じ (`Cmd/Ctrl+W`)
- **ステータスバー**: ファイルフルパス表示、文字数・行数カウント

### キーボードショートカット

| ショートカット | 機能 |
|:---|:---|
| `Cmd/Ctrl+N` | 新規作成 |
| `Cmd/Ctrl+O` | ファイルを開く |
| `Cmd/Ctrl+S` | 保存 |
| `Cmd/Ctrl+Shift+S` | 名前を付けて保存 |
| `Cmd/Ctrl+W` | タブを閉じる |
| `Cmd/Ctrl+B` | 太字 |
| `Cmd/Ctrl+I` | 斜体 |
| `Cmd/Ctrl+Shift+X` | 取り消し線 |
| `Cmd/Ctrl+K` | リンク挿入 |
| `Cmd/Ctrl+E` | インラインコード |
| `Cmd/Ctrl+F` | 検索（ハイライト / 次へ） |
| `Cmd/Ctrl+R` | 置換 |
| `Cmd/Ctrl+Z` | 元に戻す |
| `Cmd/Ctrl+Shift+Z` | やり直し |
| `Ctrl+;` | 日付挿入 |
| `Ctrl+:` | 時刻挿入 |
| `Tab` | リスト内: インデント / コードブロック内: 4スペース |
| `Shift+Tab` | リスト内: アウトデント |

### 絵文字ショートコード（一部）

| ショートコード | 絵文字 | ショートコード | 絵文字 |
|:---|:---|:---|:---|
| `:smile:` | 😄 | `:heart:` | ❤️ |
| `:fire:` | 🔥 | `:rocket:` | 🚀 |
| `:tada:` | 🎉 | `:check:` | ✅ |
| `:thumbsup:` | 👍 | `:star:` | ⭐ |
| `:warning:` | ⚠️ | `:memo:` | 📝 |

ツールバーの絵文字ボタンからピッカーで選択することもできます。

### クリップボード
- **画像ペースト**: クリップボードの画像を Base64 で埋め込み
- **Excel/TSV ペースト**: タブ区切りデータをテーブルに自動変換
- **Markdown ペースト**: Markdown テキストを自動検出してリッチテキストに変換


## 非対応の Markdown 機能

以下の Markdown 拡張機能には対応していません：

| 機能 | 記法例 | 備考 |
|:---|:---|:---|
| **脚注** (Footnotes) | `[^1]` / `[^1]: 脚注テキスト` | Markdown-it 拡張で一般的だが標準 GFM には含まれない |
| **定義リスト** (Definition Lists) | `用語\n: 定義` | PHP Markdown Extra の拡張機能 |
| **ハイライト** (Highlight) | `==ハイライトテキスト==` | 一部のエディタ独自の拡張 |
| **上付き文字** (Superscript) | `^上付き^` | 標準 Markdown には含まれない拡張 |
| **下付き文字** (Subscript) | `~下付き~` | 標準 Markdown には含まれない拡張 |
| **略語** (Abbreviation) | `*[HTML]: Hyper Text Markup Language` | PHP Markdown Extra の拡張機能 |

## セットアップ

### 必要な環境

1. **Rust** (1.70以上)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js** (16以上)
   - [公式サイト](https://nodejs.org/)からダウンロード

3. **Tauri CLI** (プロジェクトにインストール済み)

### インストール

```bash
# 依存関係のインストール
npm install

# 開発モードで起動
npm run dev
```

> ⚠️ **macOS について**
> 現在の配布物は未署名のため、初回起動時に Gatekeeper でブロックされる場合があります。
> その場合は「システム設定 → プライバシーとセキュリティ」から許可してください。
> どうしても起動できない場合は、アプリの場所に合わせて以下を実行してください（自己責任）：
> 
> ```bash
> # 例: アプリが /Applications にある場合
> sudo xattr -r -d com.apple.quarantine /Applications/SuMark.app
> ```

## ビルド

### macOS向けビルド
```bash
npm run build:mac
```

ビルドされたアプリは `src-tauri/target/release/bundle/` に生成されます。

### Windows向けビルド
```bash
npm run build:win
```

### Linux / Chromebook向けビルド
```bash
# 事前にシステム依存パッケージをインストール
sudo apt-get install -y libwebkit2gtk-4.0-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libssl-dev

npm run build:linux
```

`.deb` と `.AppImage` が `src-tauri/target/release/bundle/` に生成されます。
Chromebook では Linux 開発環境（Crostini）を有効にして `.deb` をインストールするか、`.AppImage` を直接実行できます。

### 全プラットフォーム
```bash
npm run build
```

## 使い方

1. アプリを起動
2. `Cmd/Ctrl+O`、ウィンドウへのドラッグ&ドロップ、アプリアイコンへのドラッグ&ドロップ、関連付け済みファイルのダブルクリックなどで Markdown ファイルを開きます
3. ツールバーのボタンやキーボードショートカットで素早く編集
4. `Cmd/Ctrl+S` で保存（Markdown 形式で出力）
5. 複数ファイルをタブで同時編集できます

## プロジェクト構造

```
.
├── src/                        # フロントエンド
│   ├── index.html              # メインHTML
│   ├── main.js                 # エントリーポイント（初期化・イベント）
│   ├── modules/                # 機能ごとの分割モジュール
│   │   ├── autoConvert.js      # 自動変換（Markdown→リッチテキスト）
│   │   ├── codeHighlight.js    # コードブロックハイライト
│   │   ├── editorZoom.js       # エディタズーム操作
│   │   ├── exportManager.js    # PDFエクスポート
│   │   ├── fileManager.js      # ファイル操作（開く/保存）
│   │   ├── imageManager.js     # 画像挿入・リサイズ・コピー
│   │   ├── keyboard.js         # ショートカット・キーイベント
│   │   ├── markdown.js         # Markdown ↔ HTML 変換
│   │   ├── mathRender.js       # KaTeX 数式レンダリング
│   │   ├── mermaidManager.js   # Mermaid 図表レンダリング
│   │   ├── nodeUtils.js        # DOM操作ユーティリティ
│   │   ├── pasteUtils.js       # ペースト処理（Markdown/テーブル対応）
│   │   ├── tableManager.js     # テーブル操作（行列追加/削除など）
│   │   ├── tabManager.js       # タブ管理
│   │   ├── tocManager.js       # 目次生成・管理
│   │   ├── toggleBlock.js      # トグルブロック管理
│   │   ├── toolbarActions.js   # ツールバー関連（挿入/ダイアログ）
│   │   ├── undoRedo.js         # Undo/Redo スタック管理
│   │   └── utils.js            # 共通ユーティリティ
│   ├── styles/                 # スタイルシート（7ファイル）
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── editor.css
│   │   ├── markdown.css
│   │   ├── components.css
│   │   ├── dialogs.css
│   │   └── print.css
│   └── vendor/                 # サードパーティライブラリ
├── src-tauri/                  # Tauri / Rust バックエンド
│   ├── src/                    # Rust ソース
│   │   └── main.rs             # Tauri メインプロセス
│   ├── Cargo.toml              # Rust 依存関係
│   ├── build.rs                # ビルドスクリプト
│   ├── tauri.conf.json         # Tauri 設定
│   └── icons/                  # バイナリに含めるアイコン
├── docs/                       # 設計・実装ドキュメント
├── test/                       # テスト（Playwright E2E 等）
├── scripts/                    # ビルド/解析用補助スクリプト
├── package.json                # Node.js 依存関係・npmスクリプト
├── CHANGELOG.md                # 変更履歴
└── README.md                   # このドキュメント
```

設計・実装に関する詳細ドキュメントは [docs/](docs/README.md) を参照してください。

## ライセンス

MIT

## AI による開発について

このプロジェクトは **GitHub Copilot (AI)** を活用して開発されました。コードの設計・実装・デバッグにおいて AI アシスタントとの対話的な開発プロセスにより構築されています。

## 開発者向け情報

### 使用技術
- **Tauri 1.6**: デスクトップアプリフレームワーク
- **Rust + chrono**: バックエンド（日付/時刻コマンド）
- **Marked.js 11.1.1**: Markdown → HTML 変換
- **Turndown.js 7.2.0 + GFM Plugin**: HTML → Markdown 変換
- **Highlight.js 11.9.0**: コードシンタックスハイライト
- **Mermaid.js 10**: 図表レンダリング（フローチャート、シーケンス図など）

### 再発防止の方針

- **共通の不変条件をテスト化**: コードブロックは「toolbar が pre より前」「toolbar / pre が 1 個だけ」「同じ幅で縦に積まれる」といった条件を共通ヘルパーで検査する
- **文脈の違いを横断して確認**: 通常段落だけでなく、タスクリスト、ネストリスト、引用、トグル、タブ切替後、保存後再読込後でも同じ条件を通す
- **DOM と見た目を両方見る**: 要素の存在だけでなく、`boundingBox()` やスクリーンショット差分で幅ずれ・位置ずれを検知する
- **selector を direct child に寄せすぎない**: `marked` や DOM の再構成で構造が一段深くなることがあるため、`li:has(input[type="checkbox"])` のように実際のレンダリング構造に合わせて検査する
- **保存・再読込の往復テストを維持する**: Markdown → HTML → Markdown の roundtrip を通し、レイアウト修正がデータ損失や変換崩れに波及しないか確認する

### カスタマイズ

- エディタのスタイルは `src/styles/` 内の各 CSS ファイルで変更できます
- 新しい機能は対応する JS モジュール（`src/*.js`）に追加できます
- Rustコマンドは `src-tauri/src/main.rs` に追加できます
