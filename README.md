# SuMark

Tauriベースのデスクトップ向けWYSIWYG Markdownエディターです。Markdownを書きながらリアルタイムにリッチテキスト表示を行います。

## 特徴

- 📝 **WYSIWYG 編集**: Markdown を書きながらリアルタイムにリッチテキスト表示
- 🎨 **豊富な機能**: GFM 準拠の Markdown 機能をフルサポート
- ⌨️ **キーボードショートカット**: 日付・日時の素早い挿入、各種書式設定
- 🖥️ **クロスプラットフォーム**: macOS / Windows / Linux (Chromebook) 対応
- 🚀 **軽量高速**: Tauri ベースの高速デスクトップアプリ
- 📊 **Mermaid 図**: フローチャート・シーケンス図などの図表表示
- 😀 **絵文字サポート**: `:smile:` 形式のショートコードと絵文字ピッカー
- 🗂️ **タブ UI**: 複数ファイルの同時編集
- ▶ **トグル**: Notion 風の折りたたみブロック
- 📄 **PDF エクスポート**: HTML 形式での PDF 出力
- 📋 **画像コピー**: 挿入画像をワンクリックでクリップボードにコピー

## 主な機能

### 基本編集
- **太字** (`Cmd/Ctrl+B`), **斜体** (`Cmd/Ctrl+I`), **取り消し線**, **インラインコード** (`Cmd/Ctrl+E`)
- **見出し** (H1〜H6): `# ` 入力で自動変換
- **リンク挿入** (`Cmd/Ctrl+K`): カスタムダイアログで URL とテキストを入力
- **画像挿入**: ローカルファイル選択（Base64 埋め込み）/ クリップボードから貼り付け
- **画像リサイズ**: 画像クリック後、右下のハンドルをドラッグしてサイズ変更
- **画像コピー**: 画像クリックで表示される「📋 Copy」ボタンで画像をクリップボードにコピー

### リスト
- **箇条書きリスト**: `- ` または `* ` で自動変換
- **番号付きリスト**: `1. ` で自動変換
- **タスクリスト**: `- [ ] ` で自動変換、チェックボックス操作可能
- **ネストリスト**: Tab キーでインデント、Shift+Tab でアウトデント

### 書式・構造
- **引用** (`> `): 自動変換、空行 Enter で脱出
- **コードブロック**: ` ``` ` + Enter で自動変換、言語指定でシンタックスハイライト
  - **コピーボタン**: 「Copy」（コードのみ）/「Copy #」（行番号付き）
  - **言語ドロップダウン**: クリックで言語を切り替え
- **テーブル**: ツールバーから挿入、右クリックで行/列の追加・削除
- **トグル**: `>>> ` で自動変換、ツールバーから挿入、テキスト選択→トグル化にも対応
- **水平線**: `---` で自動変換
- **Mermaid 図**: コードブロック言語を `mermaid` に指定すると自動レンダリング（ダブルクリックで編集）
- **目次（TOC）自動生成**: ツールバーのボタンで見出しから自動生成

### 自動変換
- **ブロックレベル**: `# `, `- `, `1. `, `> `, `---`, `- [ ] `, ` ``` `, `>>> ` の入力で即時変換
- **インライン**: `**太字**`, `*斜体*`, `` `コード` ``, `~~取り消し~~` の入力で即時変換
- **数式**: `$E=mc^2$` でインライン数式、`$$\sum_{i=1}^n$$` でブロック数式に自動変換（KaTeX）
- **リンク自動検出**: `https://...` に続けてスペースを入力すると自動的にリンクに変換
- **絵文字変換**: `:smile:`, `:fire:`, `:rocket:` などの入力で絵文字に自動変換

### ファイル・タブ管理
- **新規作成** (`Cmd/Ctrl+N`)
- **開く** (`Cmd/Ctrl+O`): 複数ファイル選択対応、重複検出
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
| `Cmd/Ctrl+K` | リンク挿入 |
| `Cmd/Ctrl+E` | インラインコード |
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
2. Markdown を入力すると、リアルタイムにリッチテキストに変換表示されます
3. ツールバーのボタンやキーボードショートカットで素早く編集
4. `Cmd/Ctrl+S` で保存（Markdown 形式で出力）
5. `Cmd/Ctrl+O` で複数ファイルをタブで同時編集

## プロジェクト構造

```
.
├── src/                    # フロントエンド
│   ├── index.html         # メインHTML
│   ├── styles.css         # スタイルシート
│   └── main.js            # JavaScriptロジック
├── src-tauri/             # Rustバックエンド
│   ├── src/
│   │   └── main.rs       # Tauriメインプロセス
│   ├── Cargo.toml        # Rust依存関係
│   ├── build.rs          # ビルドスクリプト
│   └── tauri.conf.json   # Tauri設定
├── package.json          # Node.js依存関係
└── README.md             # このファイル
```

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

### カスタマイズ

- エディタのスタイルは `src/styles.css` で変更できます
- 新しい機能は `src/main.js` に追加できます
- Rustコマンドは `src-tauri/src/main.rs` に追加できます
