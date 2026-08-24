# Changelog

すべての重要な変更点をここに記録します。セマンティックバージョニングに従います。

## [v1.1.1] - 2026.08.25
### 修正
- Windows環境で、テーブルの複数セルを矩形選択してコピーした際に、コピーが機能しない場合がある問題を修正
  - ネイティブ選択Rangeを持たない矩形選択では、WebView2の`copy`イベントが`#editor`へ届かない場合があるため、documentのキャプチャ段階でも処理
  - Cmd/Ctrl+C時にClipboard APIへTSVを直接書き込む補助経路を追加

### テスト
- `test/playwright/04-table.spec.js`に、copyイベントがeditor外へ届くWindows相当の回帰テストを追加
- `npm run test:e2e -- test/playwright/04-table.spec.js`
- テーブル操作テスト28件が全件通過

## [v1.1.0] - 2026-08-23
### 保留
- テーブルの左端セルで内容をBackspaceで空にした後、日本語（例:「あ」）を入力してEnterを押すと、テーブルに余分なセルが生成されて崩れる場合がある問題を確認
  - 英字入力（例:「a」）では再現しにくく、日本語IMEや左端セル固有の編集経路が関係している可能性がある
  - 既存の表構造保護およびIME関連の対策を追加したが、実環境で解消を確認できていないため、対応を保留
  - 「あ」入力後の右矢印では再現せず、Enterでのみ再現することを確認
  - Enterの`keydown` / `beforeinput`、異常なRange、ブラウザ標準の表編集動作などを調査したが、実環境での再現原因を特定できず、対応を保留
  - Windows実機では、左端セルをBackspaceで空にして日本語入力後にEnterを押す操作を確認したが再現せず、Windows環境では正常に表構造が維持された

### 改善
- テーブルのセル操作を拡張
  - マウスドラッグによる連続セルの矩形選択に対応
  - 選択範囲をTSV/HTMLテーブルとしてコピーし、選択範囲へ貼り付けできるよう改善
  - Tab/Shift+Tabおよび矢印キーによるセル移動と、移動先セルの編集に対応
  - 行末への貼り付け時に必要な行を自動追加
  - 既存の列選択・行ドラッグ操作と矩形選択を分離
  - 矩形選択中にブラウザ標準の文字選択帯が表示されないよう改善
- 表セル内の編集安定性を改善
  - EnterおよびIME確定時の既定動作を抑止し、Rangeが表境界をまたぐ場合はセル内へ補正
  - 表セル内のCmd/Ctrl+Aをセル内容の選択に限定
  - 行末Tab処理におけるテーブル行生成の引数不整合を修正

### テーブル操作のテスト
- `test/playwright/04-table.spec.js` に矩形選択、TSVコピー/貼り付け、セル移動、選択帯抑止、IME入力後Enterの回帰テストを追加
- `npm run test:e2e -- test/playwright/04-table.spec.js`
- テーブル操作テスト26件が全件通過

### 検索・置換
- VS Code風の検索・置換機能を拡張
  - 検索結果の前後移動と一致件数表示に対応
  - 大文字・小文字の区別、単語単位、正規表現、選択範囲内検索のオプションを追加
  - 1件置換とすべて置換に対応
  - 正規表現のキャプチャグループ（`$1`、`$2`など）を使った置換に対応
  - 置換履歴を保持し、次回以降の置換入力で再利用できるよう改善

### テスト
- `test/playwright/14-find-dialog.spec.js` に検索オプション、前へ移動、キャプチャグループ置換のテストを追加
- `npm run test:e2e -- test/playwright/14-find-dialog.spec.js`
- 検索・置換テスト24件が全件通過

### 未対応
- `Alt+Enter`による全一致箇所への複数カーソル追加
- `Ctrl/Cmd+D`、`Ctrl/Cmd+K Ctrl/Cmd+D`、`Ctrl/Cmd+Shift+L`による複数カーソル操作

## [v1.0.23] - 2026-08-13
### 修正
- Windows環境で、コードブロックの `Copy` / `Copy #` / `↵ Wrap` ボタンが表示されていても操作できなくなる場合がある問題を修正
  - `innerHTML` 復元で再生成された既存ツールバー要素にもイベントハンドラを再バインドするよう改善
  - 既存ボタンへの二重バインドを防止しつつ、復元後の操作性を維持

### テスト
- `npm run test:e2e -- test/playwright/02-markdown.spec.js`
- `test/playwright/02-markdown.spec.js` に、`innerHTML` 再構築後も Copy/Wrap が動作する回帰テストを追加

## [v1.0.22] - 2026-08-02
### 修正
- Windows のコードブロック内で Enter を押した際、カーソルが押下位置へ戻る問題を修正
  - コードブロック内の改行挿入をテキスト直接更新に切り替え、次の行の先頭へカーソルを維持するよう改善
  - 回帰テストを追加し、コードブロック内 Enter の挙動を検証

## [v1.0.21] - 2026-07-26
### 修正
  - Windows は `tauri-action` ではなく `npx tauri build --bundles none` でビルド
  - Linux は従来どおり `tauri-action` で `.deb` を生成

## [v1.0.20] - 2026-07-25
  - macOS / Windows の installer を作成しないよう変更
  - Linux / Chromebook (x86_64) の portable file を作成しないよう変更
  - macOS / Windows の portable file は継続
- image viewer の操作性を改善
  - ズームコントロール（拡大・縮小・リセット）を追加
  - マウスホイールとキーボード（`+` / `-` / `0` / `Esc`）での操作を追加
  - スクロール可能な表示領域とツールバーを導入し、画像閲覧時の操作性を向上

## [v1.0.19] - 2026-07-24
### 修正
- Windows環境で、Mermaid記法の図を貼り付け/挿入した際にラベル文字が表示されない問題を修正
  - Mermaid初期化で `flowchart.htmlLabels` を無効化し、`foreignObject` 依存のラベル描画を回避
  - SVGサニタイズ後でも文字ラベルが保持される描画方式へ統一

### 検証メモ
- テーブルセル内でEnterキー押下時の表崩れ事象について、以下の配布物で追加確認を実施
  - Windows版配布物: 再現せず
  - macOS版配布物（`SuMark-portable-macos-v1.0.19.zip`）: 再現せず
  - そのため、v1.0.19配布物においては本事象は未再現

### 影響範囲
- `src/modules/mermaidManager.js` の Mermaid 初期化処理（`renderMermaidBlocks`）


## [v1.0.18] - 2026-07-02
### 修正
- Windows環境で、コードブロック内へSQLを貼り付けた際にコードブロック構造が壊れる問題を修正
  - 貼り付けテキストの改行を `CRLF/CR -> LF` に正規化
  - `execCommand('insertLineBreak')` 依存をやめ、`textContent` 直接更新へ変更
  - コードブロック判定の起点を `anchorNode` から `startContainer` に変更し、選択方向による判定揺れを抑制

### 影響範囲
- `src/main.js` のコードブロック内ペースト処理（`handlePaste`）

## [v1.0.17] - 2026-06-19
### 修正
- 表セル内に HTML テーブルまたは TSV（表形式）を貼り付けた場合、入れ子テーブルを作らず外側テーブル直後へ退避挿入するよう修正
- 上記退避挿入時に、ユーザーへ理由をトースト通知するよう改善

### 影響範囲
- `src/main.js` のペースト処理（`handlePaste`）

## [v1.0.16] - 2026-06-17
### 修正
- Markdown読み込み時に、テーブル内の完全な空セル（`td` / `th`）へ `&nbsp;` を補完し、最終行が空のテーブルで行高が潰れる問題を修正
- Tauri の CSP をローカル運用向けに見直し、`connect-src` に `https://tauri.localhost` を追加

### テスト
- `test/playwright/04-table.spec.js` に「空の最終行を含むテーブルが潰れない」回帰テストを追加

## [v1.0.15] - 2026-06-11
### セキュリティ
- Mermaid SVG を `DOMPurify.sanitize()` でサニタイズするよう修正（XSS対策）
- `isWebUrl()` のスキーム許可を `https?://` と `mailto:` のみに限定（`javascript:` などの危険スキームを除外）
- PDF エクスポート時の hljs テーマ CSS を CDN（jsdelivr.net）からローカルバンドル済みファイル（`vendor/atom-one-light.min.css`）に切替え（サプライチェーン攻撃・オフライン問題の解消）

## [v1.0.14] - 2026-06-11
### 修正
- GitHub Actions の `actions/setup-node` を `v4` から `v5` へ更新
- Node.js 20 非推奨警告（ランナー側で Node 24 へ強制移行される警告）への対応

## [v1.0.13] - 2026-06-11
### 修正
- dev依存の脆弱性対応として `jest` を `30.4.2`、`jsdom` を `29.1.1` に更新
- `package-lock.json` を再生成し、`npm audit` で脆弱性 0 件を確認

### CI / セキュリティ
- GitHub Actions の Node/npm を固定（Node `24.11.1`、npm `11.16.0`）
- `.npmrc` にサプライチェーン対策設定を追加（`ignore-scripts=true`, `min-release-age=7`, `audit=true`）
- CI の依存インストールを `npm ci --ignore-scripts` に統一し、本番依存の監査ステップを追加

## [v1.0.10] - 2026-06-09
### 修正
- 事前作成ファイルを開いた際に、コードブロックの Wrap ボタンで改行が効かない場合がある問題を修正
  - `pre` / `code` 間で `wrap-enabled` と `data-wrap` を同期するよう改善
  - 旧データ形式（`pre[data-wrap]`）でも折り返し状態を復元できるよう互換処理を追加
  - 折り返しCSSを強化し、長い行でも改行されやすいよう `min-width: 0` と `overflow-wrap: anywhere` を適用

### テスト
- `npx playwright test test/playwright/02-markdown.spec.js`
- `test/playwright/02-markdown.spec.js` に `pre[data-wrap]` 互換ケースの回帰テストを追加

## [v1.0.9] - 2026-06-03
### 修正
- タブの未保存判定を共通化し、タブ×クローズ確認とアプリ終了確認で同一の補正ロジックを使うよう改善
  - `ensureTabUnsavedState()` を導入し、`closeTab()` / `getUnsavedTabs()` / `hasUnsavedTabs()` の判定経路を統一
- Mermaid の非同期再描画後に未変更タブの保存基準HTMLを再同期し、終了時のみ保存確認が出る誤判定を修正
  - `renderMermaidBlocks()` 完了時に `syncActiveTabContentIfPristine()` を呼び出すよう変更

### テスト
- `npm run test:e2e -- test/playwright/06-tabs.spec.js`
- `npm run test:e2e -- test/playwright/11-editor-extras.spec.js`

## [v1.0.5] - 2026-05-21
### 修正
- 画像貼り付け時に`pasteImageFile`が未定義となり、JSエラーで画像貼り付けに失敗する問題を修正
  - `imageManager.js`の`pasteImageFile()`実装を復元し、`FileReader`で画像をbase64化してエディターへ挿入できるよう修正
  - `pasteImageFile()`をグローバル公開し、`main.js`のペースト処理から確実に参照できるよう改善
- Markdown内のコードフェンス・インラインコード中に書かれた画像記法まで相対画像変換してしまう問題を修正
  - `resolveRelativeImages()`でコード範囲を検出し、コード例中の`![...](...)`や`<img ...>`を変換対象から除外

## [v1.0.4] - 2026-05-18
### 改善
- 複数モジュール（18 ファイル）の英語コメントを日本語に統一し、コメント品質を向上
  - `exportManager.js`、`markdown.js`、`undoRedo.js`、`tableManager.js`、`nodeUtils.js`、`imageManager.js`、`toolbarActions.js`、`keyboard.js`、`toggleBlock.js`、`mermaidManager.js`、`mathRender.js`、`tabManager.js`、`codeHighlight.js`、`pasteUtils.js`、`editorZoom.js`、`autoConvert.js`、`tocManager.js`、`main.js`
  - 各モジュールの実装内容・制約・依存関係に関する説明をすべて日本語化
- コメント品質ガイドライン（`docs/COMMENT_POLICY.md`）を新規作成し、今後のコメント統一ルールを定義
- ドキュメント（`docs/README.md`）を更新し、最新の実装状況を反映

## [v1.0.3] - 2026-05-17
### 修正
- 複数ファイル D&D 時に未編集タブへ誤って「更新あり」マーク（●）が付く問題を修正
  - `setMarkdown()` / `switchTab()` のプログラム的 editor 更新中は `onEditorInput()` が dirty 判定を行わないよう制御フラグ（`isProgrammaticEditorUpdate`）を導入
  - タブ復元後の後処理（コードブロックハイライト、TOC 再構築など）が完了した最終 DOM を未変更タブの基準 `content` に同期するよう修正
  - 画像の読み込み失敗時に `markModified()` を呼んでいた箇所を除去し、表示置換後の最終 DOM を未変更タブの `content` に同期するよう変更（`imageManager.js`）
- Mermaid 挿入ダイアログで、カーソル位置ではなく文末に挿入される問題を修正
- 画像挿入ダイアログで、選択した画像がエディタへ挿入されない問題を修正
- タブ切り替え後に Mermaid 図の表示が消えたり、保存後の再オープンで Mermaid の中身が失われる問題を修正
  - タブ復元後に Mermaid の描画済みフラグを再評価し、SVG 実体が無い場合は再描画するよう改善
  - `data-mermaid-source` が欠けた場合でも、`code.language-mermaid` の内容から Mermaid ソースを復元して表示・保存できるよう修正
  - タブ復元時の通常コードハイライトから Mermaid コードブロックを除外し、Mermaid 図が優先して再表示されるよう修正
- タブ系 Playwright テストに再発防止テストを 2 件追加
  - 「タブ復元後の後処理だけでは更新マークが付かない」
  - 「画像読み込み失敗は更新マークを付けない」
- 複数モジュールの英語コメントを日本語化し、コメント品質を統一

## [v1.0.3] - 2026-05-16
### 修正
- Markdown の内部リンク（[text](#見出し)）をクリックして見出しへジャンプできるよう対応
- 全角混在の目次記法（例：1．［項目］（#見出し））を標準的なMarkdown形式へ正規化して処理
- 見出しIDの自動補完により、一般的なリンク記法をサポート
- 内部リンク（# / ＃）が未解決の場合、ローカルファイル解決に進まず「ページ内リンクとして未解決」で停止するよう修正
- 内部リンクと見出しの対応付けを、同一の正規化ルール（大小文字・空白・記号の吸収）で判定するよう改善

## [v1.0.2] - 2026-05-16
### 修正
- 複数ファイル D&D 時にコードブロックヘッダーが崩れる問題を修正
- DOMPurify のサニタイズ設定で `<select>`, `<option>`, `<button>` タグと属性を許可するよう修正
- タブ復元時に code block toolbar が削除されてしまう問題を解決

### テスト
- GitHub Actions でマルチプラットフォーム（macOS・Windows・Linux）ビルドを実行
- Windows 環境での複数ファイル D&D シナリオを検証予定

## [v1.0.1] - 2026-05-15
### 修正
- コードブロックのヘッダーがタスクリスト内で崩れる問題を修正
- タスクリスト内のコードブロック配置を回帰テストで検証するよう改善

### 変更
- 再発防止の方針を README に追記

## [v0.9.9] - 2026-05-06
### リリース
- アプリを `v0.9.9` にバージョンアップ
- macOS での Markdown ファイル起動引数受け取りの動作確認を実施

## [v0.9.8] - 2026-04-23
### 修正
- リリース準備: バージョン番号を 0.9.8 に更新
- `setMarkdown()` で Notion エクスポート形式の複数行テーブルセルと表示数式を正規化
- 行頭 `$` から始まり `$$` で終わるブロック数式を正しくレンダリングできるよう修正
- `renderMathBlocks()` の数式パースと DOM 置換処理を安定化
- 編集不可要素内の `button`, `select`, `input`, `textarea` クリック時に誤検知しないよう改善
- Markdown ファイル読み込みフローを改善し、タブ作成後に `setMarkdown()` で表示を更新するよう変更

### テスト
- `test/playwright/02-markdown.spec.js` に表示数式の回帰テストを追加

## [v0.9.7] - 2026-04-23
### 修正
- タスクリスト項目内のコードブロックで、Enter キー入力時にコードブロックの内容が消えてツールバーのラベルがテキストとして表示される問題を修正（`keyboard.js` の Enter 分割処理で DOM 構造を保持するよう変更）
- タスクリスト項目内のコードブロックレイアウトが崩れる問題を修正（`markdown.css` の flex レイアウト調整）
- Turndown 変換ルールにコードブロック UI 要素（折返しボタン・言語セレクタ）の除外フィルターを追加
- `src/vendor/highlight.min.js` が誤った内容（73 バイトのエラーメッセージ）になっていた問題を修正（Highlight.js 11.11.1 を正しく復元）

### テスト
- bash コードブロックのシンタックスハイライト回帰テストを追加
- Windows PC で動作確認済み

## [v0.9.6] - 2026-04-23
### 修正
- ドキュメント幅が固定されている問題を修正（`#editor` の `max-width: 900px` を解除し、ウィンドウ幅に追従するよう変更）
- 行末スペース入力時に文字が消える問題を修正（`normalizeMarkdownPrefix()` の空白正規化を先頭部分のみに限定し、末尾スペースが削除されないよう修正）
- コードブロック内でのインライン自動変換（Markdown記法）をスキップするよう修正
- コードブロックツールバーのボタン（コピー・行番号・折返し）が正しく表示されない問題を修正（ツールバーを `pre` 内部からpre直前の独立要素に移動）

### テスト
- E2E テスト 97 個全てパス確認（01-basic・02-markdown・04-table・08-roundtrip）
- スペース入力回帰テスト追加: `test/playwright/13-space-input.spec.js`

## [v0.9.5] - 2026-04-22
### 変更
- **ベンダーライブラリを最新バージョンに更新**
  - marked: 11.1.1 → 18.0.2 (CommonMark 準拠強化、HTML 生成の安定性向上)
  - highlight.js: 11.9.0 → 11.11.1 (Rust 文法リグレッション修正)
  - DOMPurify: 3.0.6 → 3.4.1 (XSS テストハーネス強化、セキュリティ改善)
  - Mermaid: 10.9.5 → 11.14.0 (図表レンダリング改善、エッジケース対応)
  - KaTeX: 0.16.11 → 0.16.45 (数式レンダリング改善、フォント処理最適化)

### テスト
- E2E テスト 41 個全てパス確認（基本操作・Markdown 変換・テーブル・高度な機能）
- 更新ライブラリとの互換性検証完了（marked 18.0.2 の大型アップデート、Mermaid 11.x での動作確認）

## [v0.9.4] - 2026-04-15
### 修正
- 行末スペース入力時に文字が消える問題を修正（`normalizeMarkdownPrefix()` で末尾のノーブレークスペースが削除されていた問題）
- `handleBlockAutoConversion()` の正規化反映条件を調整し、空白種別差分（通常スペース/NBSP/全角スペース）のみでは `textContent` を再代入しないよう修正
- エディター本文の横幅制限を解除し、ウィンドウ幅に追従するよう修正（`#editor` の `max-width: 900px` を解除）
- 改行時の段落間隔を調整（`.markdown-body p` の `margin-bottom` を `16px` から `10px` に変更）

### テスト
- スペース入力回帰テストを追加: `test/playwright/13-space-input.spec.js`（「文字列入力→Space→末尾スペース保持」を検証）

## [v0.9.3] - 2026-03-26
### 修正
- コードブロックで「Copy」「Copy #」「↵ Wrap」ボタンが表示されない場合がある問題を修正
- `setupCodeCopyButtons` / `addCopyButtonsToCodeBlocks` / `setupCodeWrapButton` の順序を安定化

## [v0.9.1] - 2026-03-18
### 修正
- リリース準備: バージョン番号を 0.9.1 に更新

## [v0.9.0] - 2026-03-16
### 追加
- 置換機能（Cmd/Ctrl+R）を追加し、検索（Cmd/Ctrl+F）と分離
- 検索機能にヒット箇所ハイライトと「次へ」移動機能を追加
- 検索/置換ダイアログをドラッグ移動可能に変更

### 修正
- 検索ダイアログ開始時の位置ギャップ（右下へ飛ぶ問題）を修正

## [v0.8.8] - 2026-03-16
### 修正
- Windows での UNC パス（\\server\share\file.md）を開くとき、パス先頭の `\\` が `\` に変換されてしまいファイルが開けない問題を修正（`normalizeFilePath` の UNC プレフィックス保護）

## [v0.8.7] - 2026-03-15
### 修正
- **Windows ドラッグ&ドロップでの画像表示問題を修正**
  - `fileDropEnabled: true` で Tauri ネイティブファイルドロップを有効化（ファイルパスが取得可能に）
  - HTML5 フォールバックハンドラに Tauri 検出ガードを追加（重複処理防止）
  - パスなしフォールバック時にユーザーへ警告メッセージを表示
- GitHub Actions の Node.js を 24 にアップグレード（v20 非推奨警告解消）
- ファイルパスの percent-encoding デコード対応（`normalizeFilePath` 改善）

## [v0.8.6] - 2026-03-14
### 修正
- **リリース版で DevTools を有効化**
  - `tauri.conf.json` に `devTools: true` を追加し、`Ctrl+Shift+I` で DevTools が開くようにした

## [v0.8.5] - 2026-03-14
### 修正
- **テーブルセル内でのキーボード移動を強化**
  - Tab/Shift+Tab でセル間移動（右端は次行先頭、左端は前行末尾）
  - 矢印キーでセル間移動（上/下は同列、左/右はセル内端で移動）

## [v0.8.4] - 2026-03-10
### 修正
- **未保存確認: アーキテクチャを完全周化**
  - `CLOSE_ALLOWED` フラグと `allow_close` コマンドを廃止
  - `CloseRequested` / `ExitRequested` は常に`prevent`+`emit`（フラグチェックなし）
  - JS 側は確認OK後に `window.__TAURI__.app.exit(0)` で直接終了（イベントハンドラをバイパス）
  - ダブル発火防止ガード `appCloseDialogShowing` を追加（Cmd+Q時に CloseRequested+ExitRequested が両方発火する場合でもダイアログが1回のみ表示）

## [v0.8.3] - 2026-03-10
### 修正
- **未保存確認: allow_close を Rust 側で直接終了する方式に統一**
  - `allow_close` Tauri コマンドに `app_handle.exit(0)` を追加（JS 側の `appWindow.close()` を削除）
  - allowlist に `window > close` 権限がなくても動作するように修正
  - `CLOSE_ALLOWED` フラグが `true` のまま残る問題を解決（Cmd+Q の再確認をスキップしてしまうバグを修正）

## [v0.8.2] - 2026-03-10
### 修正
- **未保存確認の全パス対応（根本対応）**
  - Cmd+Q: `RunEvent::ExitRequested` でインターセプト、JS に `app-close-requested` イベントを送信
  - タブX / アプリX: Tauri `dialog.confirm`（非同期ネイティブダイアログ）に統一し、WebView の innerHTML 競合問題を完全解決
  - ブラウザモード: `beforeunload` フォールバックを維持

## [v0.8.1] - 2026-03-10
### 修正
- **アプリ終了時の未保存確認ダイアログを全パスに対応**
  - タブXボタン: `confirm()` 前後にエディタ内容を保存・復元し、本文クリアバグを修正
  - アプリXボタン / Cmd+Q: Rust 側 `on_window_event` で `CloseRequested` をインターセプトし、JS にカスタムイベント `app-close-requested` を送信する方式に統一
  - `allow_close` Tauri コマンドを追加（JS 側で確認OK後に呼び出してウィンドウを閉じる）

## [v0.8.0] - 2026-03-08
### 新機能
- **Visual Regression Test (VRT) を全面改善**
  - ベースライン不要の直接ピクセル比較方式に変更（pixelmatch + pngjs 使用）
  - 29テストケース追加：基本要素、4階層ネストリスト、リッチテーブル、複合トグル、数式、複合ドキュメント等
  - 自動判定スクリプト（`scripts/analyze-vrt-diff.js`）：差分領域分析・重要度判定・レポート生成
  - npm scripts 追加：`test:vrt`, `test:vrt:full`, `test:vrt:json`, `test:vrt:analyze`

### テスト
- 全 177 E2E テスト通過（VRT 29 + 既存 148）

## [v0.7.2] - 2026-03-06
### 改良
  - `base.css`: グローバルリセット・スクロールバー・ユーティリティ
  - `editor.css`: エディタ本体（#editor）・プレースホルダー
  - `markdown.css`: .markdown-body レンダリング（見出し・リスト・コード・テーブル等）
  - `components.css`: Mermaid・TOC・画像リサイズ/ビューア・絵文字ピッカー
  - `dialogs.css`: モーダルダイアログ・テーブルコンテキストメニュー
- **ドキュメント整備**: 設計・実装ドキュメントを `docs/` フォルダに集約
  - `MODULES.md`, `CSS_SPLITTING_GUIDE.md`, `DEPENDENCY_MAP*.md`, `IMPLEMENTATION_GUIDE*.md`, `ROLLBACK_GUIDE.md` を移動
  - `docs/README.md` を新規作成（ドキュメント一覧・案内）
- **README.md 更新**: プロジェクト構造セクションを最新のモジュール構成・CSS分割に対応
- **CSS-JS検証スクリプト更新**: `src/styles/` ディレクトリ対応に修正
- 全 176 E2E テスト通過（1 skipped）

- **Week 7-8 モジュール分割 Phase 4 を完了**
  - `src/modules/toolbarActions.js`: ツールバー操作・モーダル・日付挿入・絵文字ピッカーを分離
  - `src/modules/fileManager.js`: 新規/開く/保存/画像解決のファイル操作を分離
  - `src/modules/exportManager.js`: PDF（HTML経由）エクスポート処理を分離
  - `src/index.html`: モジュール読み込み順を更新
  - main.js サイズ削減: 4,579 → 3,042 行（1,537 行削減、約 34%）

### 修正
- ネストしたリスト末尾の単独 `-` を含むMarkdown読込時に、最終行が Setext 見出し解釈で `h2` 相当表示になる不具合を修正
  - `setMarkdown()` / ドラッグ&ドロップ読込 / ペースト変換で、インデント付き単独 `-` を安全に正規化
- 回帰テストを追加: `test/playwright/02-markdown.spec.js`

### テスト
- 全 147 E2E テスト通過（1 skipped）

## [v0.7.0] - 2026-03-05
### 改良
- **Week 5-6 モジュール分割 Phase 3 を完了**
  - `src/modules/tableManager.js`: テーブル挿入、コンテキストメニュー、行列操作、CSV変換（9関数、389行）
  - `src/modules/imageManager.js`: 画像貼り付け、リサイズ、エラー処理、拡大ビュー、ファイル保存（11関数、484行）
  - main.js サイズ削減: 5,528 → 4,577 行（952行削減、約17%）
- タスクリストのカーソル位置修正：`[] ` 入力時にチェックボックスの右側に正しく表示されるよう改善
- 全 147 E2E テスト通過

## [v0.6.4] - 2026-03-05
### 改良
- **Week 1-2 緊急対応の実装**
  - 重複ファイル削除：`mermaidManager 2.js`, `tocManager 2.js`, `toggleBlock 2.js` を削除
  - E2E テスト安定化：`resetGlobalState()` 関数を追加し、グローバル状態を確実にリセット（複数テスト連続実行時のメモリリーク防止）
  - utils.js の充実：共通ユーティリティ関数を追加（debounce, throttle, normalizeFilePath, resolveRelativePath, deepClone 等 10 関数）
- 全 147 E2E テスト通過

## [v0.6.3] - 2026-03-03
### 修正
- 目次（TOC）の保存・再読み込み時のリンク機能を修正
  - `reconstructTocContainers()`: Markdown保存→再読み込み時に失われた `.toc-container` 構造を復元
  - `restoreTocHeadingIds()`: 目次リンクから見出しIDを復元
  - 保存後にファイルを開き直しても目次からのジャンプが正常に機能
- `setMarkdown()` と `switchTab()` の両方で TOC 復元処理を実行

## [v0.6.2] - 2026-03-02
### 改良
- main.js のモジュール分割 Phase 2 を完了（6297 → 5397 行、-900 行）
  - `src/mermaidManager.js`: Mermaid 図表管理（showMermaidInsertDialog, renderMermaidBlocks, editMermaidBlock 等 9 関数）
  - `src/tocManager.js`: 目次生成・管理（setupTocDeleteButtons, insertTOC）
  - `src/toggleBlock.js`: トグルブロック管理（insertToggle, unwrapToggle, setupToggleBlocks 等 5 関数）
- Phase 1 との合計削減: 6931 行 → 5397 行、-1534 行（約22%削減）
- 全 147 E2E テスト通過

## [v0.6.1] - 2026-03-02
### 修正
- CI の package-lock.json 同期問題を修正

## [v0.6.0] - 2026-03-02
### 改良
- main.js のモジュール分割 Phase 1 を完了（6931 → 6297 行、-634 行）
  - `src/utils.js`: 共有ユーティリティ（escapeHtml）
  - `src/nodeUtils.js`: DOM ノード操作（saveSelection, restoreSelection 等 6 関数）
  - `src/pasteUtils.js`: ペースト処理（tsvToHtmlTable, parseHtmlTable 等 5 関数）
  - `src/codeHighlight.js`: コードブロックハイライト（highlightCodeBlock 等 7 関数 + codeHighlightTimer）
  - `src/mathRender.js`: KaTeX 数式レンダリング（renderMathBlocks）
- 全 147 E2E テスト通過を各ステップで確認済み

## [v0.5.6] - 2026-03-02
### 修正
- E2Eテストの表示数式（`$$...$$`）検証を実装仕様に合わせて修正
  - `test/playwright/02-markdown.spec.js` の対象セレクタを `.math-inline` から `.math-display` に変更

### テスト
- `npx playwright test -g "ディスプレイ数式"` を実行し、対象ケースの通過を確認
- `npx playwright test test/playwright/02-markdown.spec.js` を実行し、19件全通過を確認

## [v0.5.5] - 2026-03-01
### 改良
- npm依存関係を整理・統一
  - WDIO/WebdriverIO関連パッケージをすべてv9系（^9.24.0）で統一
  - peer dependencyの競合を解消
- package-lock.jsonの同期を修正
  - turndown, turndown-plugin-gfm, @mixmark-io/dominoを明示的に依存に追加
  - npm ciのエラーを解消

## [v0.5.4] - 2026-03-01
### 修正
- タスクリストのチェック状態が保存されない不具合を修正
  - `getMarkdown()` で DOM プロパティ `checked` を HTML 属性に同期
  - Turndown ルールでプロパティと属性の両方をチェック
  - チェックボックスのクリックが Markdown 変換に正しく反映されるように修正
- タスクリストの保存・再オープン時の重複を修正
  - Turndown のカスタムルール `taskListCheckbox` を GFM プラグインの**後に**追加
  - 後から追加されたルールが優先されるため、カスタムルールが正しく機能するように修正
  - チェック済みタスクを保存して再オープンしても箇条書きと重複しない
- テキストなしのタスクリスト (`- [x]`) が保存後に箇条書きになる不具合を修正
  - GFM 仕様では `[x]` の後にスペースが必要（`- [x] `）
  - Turndown: 空のタスク項目に NBSP を使用して有効な形式を保持
  - `setMarkdown()` / `openFileFromPath()` / ペーストで正規化を追加
- タスクリストのテキスト・チェックボックスの上下センタリング・位置調整（v0.5.4）
  - CSSで`.task-list-item`のflex化・テキストの上寄せ・チェックボックスの中央揃え

### テスト
- タスクリストのインタラクティブなチェック状態テストを追加 (+5 tests)
  - チェックボックスのクリックが Markdown に反映される
  - チェック済みタスクのチェックを外すと Markdown に反映される
  - チェック済みタスクを保存して再オープンしても重複しない
  - テキストなしのタスクリストが正しく保持される
  - `- [x]`（スペースなし）が正しくタスクリストとして表示される
- 合計 122 テスト全通過（タスクリスト関連 11 テスト全通過）

## [v0.5.3] - 2026-02-24
### 新機能
- Notion エクスポート形式の複数行テーブルセルの読み込みに対応
  - `preprocessNotionMarkdown()` による前処理で複数行セルを `<br>` 結合
  - ファイルを開く・ペースト・`setMarkdown()` の全パスで有効
- `alert()` をすべて非ブロッキングのトースト通知に置換
  - `showWarn()`: 黄色バナー (3秒)、テーブルセル内のブロック要素制限
  - `showError()`: 赤色バナー (5秒)、ファイル/PDF エラー

### 修正
- テーブルセル内でブロック要素（コードブロック・水平線・トグル・引用）を挿入できないよう制限
- DOMPurify の `ALLOWED_TAGS` に `del`・`s` を追加（取り消し線の round-trip 修正）

### テスト
- ラウンドトリップ E2E テスト (08-roundtrip.spec.js) を新規追加
  - Markdown → HTML → Markdown の往復検証 17 テスト
  - ネストコンテンツ（引用+リスト、多重リスト等）4 テスト
  - テーブルセル内ブロック要素禁止 9 テスト
  - Notion テーブルインポート 6 テスト
  - バナー通知の DOM 検証 4 テスト
- 合計 119 テスト全通過

## [v0.5.2] - 2026-02-22
### 修正
- 引用入力後の Enter で内容が消える不具合を修正
  - Enter は引用を終了し、引用の直後に新しい段落を挿入
  - Shift+Enter は引用内の改行として維持
- タスクリストの短縮入力を追加
  - `[] ` と `[x] ` でタスクリストを生成
  - `- [ ]` / `- [x]` は箇条書きの自動変換により到達不能なため非対応

### テスト
- E2E テストを実装仕様に合わせて更新
  - タスクリスト: `[]` / `[x]` 形式を検証
  - 引用: Enter で引用が終了し、blockquote が残る挙動を検証

## [v0.5.1] - 2026-02-21
### 改良
- 外部CDN依存を排除し、全ライブラリをローカルバンドルに変更
  - インターネット接続のないクローズド環境でも利用可能に
  - 対象ライブラリ：Marked, Turndown, Highlight.js, Mermaid, KaTeX, DOMPurify
  - `src/vendor/` にライブラリファイルとKaTeXフォントを配置
- GitHub Actions ワークフローのリリース重複問題を修正
  - リリース作成を独立ジョブに分離し、レースコンディションを解消

## [v0.5.0] - 2026-02-21
### 改良
- 画像のコピー機能を大幅改善
  - Tauri ネイティブ API（arboard）を使用したシステムクリップボードへの直接出力に対応
  - アプリ内から Web Clipboard API、Tauri API の順による段階的なフォールバック処理を実装
  - PNG 画像を Base64 エンコード→PNG バイナリデコード→RGBA ピクセル変換の流れで確実にコピー
  - 依存クレート追加：arboard 3.4、base64 0.22、image 0.25
- ウィンドウタイトルにアプリバージョンを表示
  - 起動時に Tauri の `app.getName()` と `app.getVersion()` から動的に取得
  - 例：「SuMark v0.5.0」
  - Tauri allowlist に `app` と `window.setTitle` を追加
- 引用（blockquote）入力後の改行動作を改善
  - 引用内で Enter を押した際、常に引用から抜けるように変更
  - 従来は「空行でのみ抜ける」動作でしたが、テキスト入力後の Enter でも確実に引用が終了
  - blockquote 要素内のコンテンツ全体を新しい段落に移動し、blockquote 自体を削除

### 注記
- E2E テストで「引用入力後の改行で引用が終了する」テストケースを追加
- すべて Pass（48 tests passed）

## [v0.4.2] - 2026-02-13
### 修正
- トグル内でタスクリストを作成できない問題を修正（issue #11）
- 箇条書きで Shift+Tab によるアウトデントが効かない問題を修正（issue #10）

### 改良
- 画像に代替テキストを設定・編集できるように改善（issue #9）

## [v0.4.1] - 2026-02-11
### 修正
- コードブロックへの大量コード貼り付け時のパフォーマンス問題を解決（issue #7）
  - 500行を超えるコードブロックではシンタックスハイライトを自動的にスキップ
  - 視覚的な警告表示を追加（⚠️ X行 - シンタックスハイライト無効）
  - 100行を超えるコードの貼り付け時にチャンク分割処理を実装
  - `requestAnimationFrame` を使用した非同期処理によりUIのブロックを防止
  - 500行以上の貼り付け時にプログレスインジケーターを表示
  
### 改良
- コードブロックの行数に応じた段階的な最適化
  - 100行以下：従来通りの高速処理
  - 100〜500行：チャンク分割による非同期処理
  - 500行超：チャンク処理 + シンタックスハイライトスキップ
- 大量コード貼り付け時のデバウンス時間を動的に調整（100行超の場合は500ms）

### 備考
- この版では1000行レベルのコードもスムーズに貼り付けられるようになり、アプリが固まる問題が解消されました。

## [v0.4.0] - 2026-02-11
### 追加
- ファイルドラッグ&ドロップ機能を実装
  - マークダウンファイル（.md、.markdown、.txt）をアプリウィンドウにドラッグ&ドロップして開けるようになりました
  - 複数ファイルの同時ドロップに対応
  - ドラッグ時に視覚的なフィードバック（青い破線の枠）を表示
  - 既に開いているファイルをドロップした場合は、そのタブに切り替わります
  - Tauri v1 の event.listen API を使用してファイルドロップイベントをハンドリング

### 改良
- `openFileFromPath()` 関数を追加し、ファイルパスから直接ファイルを開く処理を共通化
- ファイルオープン処理のリファクタリングにより、ダイアログとドラッグ&ドロップで同じロジックを使用

### 備考
- この版では、ユーザーがFinderから直接ファイルをドラッグ&ドロップしてアプリで開けるようになり、より直感的なファイル操作が可能になりました。

## [v0.3.2] - 2026-02-10
### 追加
- 高度な Undo/Redo システムを実装
  - 独自の undo/redo スタックによる堅牢な編集履歴管理（最大100件）
  - 選択範囲（カーソル位置）の保存・復元機能
  - キーボードショートカット対応：Cmd/Ctrl+Z（元に戻す）、Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y（やり直し）
  - すべての編集操作（テキスト入力、書式変更、要素挿入）で自動的に状態を保存

### 改良
- Turndown（HTML→Markdown 変換）の大幅な改善
  - タスクリストのチェックボックスを正確に `- [ ]` / `- [x]` 形式に変換
  - コードブロックを常にフェンスド形式（` ``` `）で出力
  - KaTeX 数式（インライン `$...$`、ディスプレイ `$$...$$`）の双方向変換に対応（`data-math` 属性を使用）
  - Mermaid ダイアグラムの Markdown への逆変換をサポート
- エディタの堅牢性と互換性の向上
  - Tauri API が利用できない環境（ブラウザモード）でのフォールバック処理を追加
  - IME（日本語入力など）のコンポジション処理を改善し、変換確定時の Enter キーを適切にハンドリング
  - `ensureEditableStart()` 関数により、エディタの先頭が常に編集可能な要素になるよう保証
  - すべての挿入操作（リンク、画像、テーブル、コードブロック、タスクリスト、区切り線、絵文字、日付／時刻、目次）で undo スタックに状態を保存
  - タブ切り替え時に undo/redo スタックをリセットし、各タブで独立した編集履歴を管理
- UI/UX の改善
  - コードブロックの行の高さを統一（line-height: 1.6）
  - 行番号ガターのスタイルを調整し、可読性を向上
  - デバッグログを追加し、開発時のトラブルシューティングを容易化

### 備考
- この版では undo/redo 機能が大幅に強化され、ブラウザ標準の `document.execCommand` から独自実装に移行しました。より細かな制御と、自動変換処理との連携が可能になっています。

## [v0.3.1] - 2026-02-09 (hotfix)
### 修正
- フロントエンドの軽微な不具合修正
  - タスクリスト挿入時のカーソル位置と表示に関する不具合を修正。チェックボックスの右側にカーソルが来るように DOM 操作を用いて挿入ロジックを改善し、ゼロ幅スペースの代わりに非改行スペース（\u00A0）を利用してカーソルが確実に表示されるようにしました。
  - タスクリスト項目の CSS を調整し、チェックボックスとテキストの垂直位置を揃えました（`display: flex; align-items: center; gap: 4px`）。
  - コードブロック挿入ダイアログの再オープン時に、Enter で複数挿入される不具合を修正。
- 取り消し線のショートカットを追加（Cmd/Ctrl+Shift+X）し、ツールバーの説明に追記。
- リリースバージョン情報を `package.json` / `Cargo.toml` / `tauri.conf.json` に反映（`0.3.1`）

## [v0.3.0] - 2026-02-08
### 追加
- KaTeX を導入して数式レンダリングをサポート（インライン `$...$` とブロック `$$...$$`）。フロントエンドに KaTeX の CSS/JS を追加し、`handleInlineAutoConversion()` で自動変換を行うようにしました。

### 改良
- 自動変換ロジックの微調整と README の更新（数式入力方法の説明を追加）。

### 備考
- v0.3.1 は v0.3.0 のソースに含まれていた、一部 UI 挙動の不具合に対するホットフィックスです。ユーザーに配布する際は署名・notarize を行って Gatekeeper 警告を防ぐことを推奨します。

---

開発チームへ: 次回リリースでは、`CHANGELOG.md` を手動で更新するフローを継続するか、GitHub Releases と連携して CI から自動生成するか決めましょう。