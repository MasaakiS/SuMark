# Phase 1 実装 - ロールバックガイド

## 実装開始前のチェックリスト

### 1. 現状の確認
```bash
# 全てのテストが合格していることを確認
npm run test:e2e

# 期待: 55/55 tests pass
```

### 2. バックアップ作成
```bash
# 自動バックアップスクリプト実行
./scripts/backup-before-phase1.sh

# または手動バックアップ
cp src/main.js src/main.js.backup-$(date +%Y%m%d)
cp src/styles.css src/styles.css.backup-$(date +%Y%m%d)
cp package.json package.json.backup-$(date +%Y%m%d)
```

### 3. Git でのセーフティネット設定
```bash
# 現在の状態をコミット（未コミットの変更がある場合）
git add .
git commit -m "chore: commit before Phase 1 implementation"

# Phase 1 実装前のタグを作成
git tag v0.5.1-pre-phase1 -m "Stable state before Phase 1 module splitting"

# ブランチ作成
git checkout -b feature/phase1-module-split

# 確認
git log --oneline -3
git branch --list
```

---

## 段階的実装とロールバックポイント

### Checkpoint 1: nodeUtils.js 作成後
```bash
# テスト
npm run test:lint
npm run test:e2e

# ✅ 成功したらコミット
git add src/modules/nodeUtils.js src/main.js
git commit -m "feat(modules): add nodeUtils.js - selection and node path utilities"

# 🔴 失敗した場合
git reset --hard HEAD~1  # 直前のコミットに戻る
```

### Checkpoint 2: pasteUtils.js 作成後
```bash
npm run test:lint
npm run test:e2e

# ✅ 成功
git add src/modules/pasteUtils.js src/main.js
git commit -m "feat(modules): add pasteUtils.js - TSV/HTML/Markdown paste utilities"

# 🔴 失敗
git reset --hard HEAD~1
```

### Checkpoint 3: codeHighlight.js 作成後
```bash
npm run test:lint
npm run test:e2e

# ✅ 成功
git add src/modules/codeHighlight.js src/main.js
git commit -m "feat(modules): add codeHighlight.js - syntax highlighting and line numbers"

# 🔴 失敗
git reset --hard HEAD~1
```

### Checkpoint 4: mathRender.js 作成後
```bash
npm run test:lint
npm run test:e2e

# ✅ 成功
git add src/modules/mathRender.js src/main.js
git commit -m "feat(modules): add mathRender.js - KaTeX math rendering"

# 🔴 失敗
git reset --hard HEAD~1
```

### Checkpoint 5: mermaid.js 作成後
```bash
npm run test:lint
npm run test:e2e

# ✅ 成功
git add src/modules/mermaid.js src/main.js
git commit -m "feat(modules): add mermaid.js - Mermaid diagram rendering"

# 🔴 失敗
git reset --hard HEAD~1
```

---

## 緊急ロールバック手順

### シナリオ A: 特定のモジュールに問題がある

**例: codeHighlight.js を追加後にテストが失敗**

```bash
# 1. codeHighlight.js のコミットだけを取り消す
git log --oneline -10
# → codeHighlight.js のコミットハッシュを確認（例: abc1234）

git revert abc1234

# 2. main.js から import を手動削除
# src/main.js の以下の行を削除:
# import { ... } from './modules/codeHighlight.js';

# 3. テスト
npm run test:e2e
```

### シナリオ B: Phase 1 全体をロールバック

**方法 1: ブランチを破棄して main に戻る**
```bash
# 現在の作業を破棄
git checkout main
git branch -D feature/phase1-module-split

# modules/ ディレクトリが残っている場合
rm -rf src/modules/

# 確認
npm run test:e2e
```

**方法 2: タグに戻る**
```bash
# Phase 1 開始前のタグに戻る
git checkout v0.5.1-pre-phase1

# 新しいブランチを作成して作業継続
git checkout -b rollback-phase1

# 確認
npm run test:e2e
```

**方法 3: バックアップファイルから復元**
```bash
# バックアップから復元
cp src/main.js.backup-20260302 src/main.js
cp src/styles.css.backup-20260302 src/styles.css

# modules/ ディレクトリ削除
rm -rf src/modules/

# package.json が変更されている場合は復元
cp package.json.backup-20260302 package.json
npm install

# 確認
npm run test:e2e
```

### シナリオ C: main.js の import 文のみ問題がある

```bash
# import 文の修正だけで済む場合は、手動修正
code src/main.js

# 以下の import 文をコメントアウトまたは削除:
# import { ... } from './modules/xxx.js';

# テスト
npm run test:lint
npm run test:e2e
```

---

## トラブルシューティング

### 問題 1: テストが突然失敗する

**原因候補:**
- CSS クラス/ID が未定義
- 関数の import 漏れ
- グローバル変数の参照エラー

**デバッグ手順:**
```bash
# 1. CSS-JS 検証
npm run test:lint

# 2. どのテストが失敗しているか確認
npm run test:e2e -- test/playwright/08-roundtrip.spec.js

# 3. ブラウザで手動確認
npm run dev
# → http://localhost:5173 で動作確認

# 4. コンソールエラー確認
# ブラウザの開発者ツール (F12) でエラーメッセージを確認
```

**修正例:**
```javascript
// main.js の import が不足している場合
// 追加:
import { highlightCodeBlock } from './modules/codeHighlight.js';
```

### 問題 2: modules/ 内のファイルが読み込めない

**原因:**
- ファイルパスの間違い
- export/import の構文エラー

**確認:**
```bash
# ファイル存在確認
ls -lh src/modules/

# import パス確認（相対パス）
# 正: './modules/nodeUtils.js'
# 誤: 'modules/nodeUtils.js' (先頭の ./ がない)
```

### 問題 3: Vite ビルドエラー

**原因:**
- ES Module の構文エラー
- 循環依存

**デバッグ:**
```bash
# ビルドエラーの詳細確認
npm run build

# Vite の詳細ログ
npm run dev -- --debug
```

---

## 完全復元スクリプト

緊急時に全てを初期状態に戻すスクリプト:

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

echo "⚠️  緊急ロールバック開始"

# 1. Git で Phase 1 開始前に戻る
git checkout main
git branch -D feature/phase1-module-split 2>/dev/null

# 2. modules/ ディレクトリ削除
rm -rf src/modules/

# 3. バックアップから復元
if [ -f "src/main.js.backup-20260302" ]; then
    cp src/main.js.backup-20260302 src/main.js
    echo "✓ main.js を復元"
fi

if [ -f "src/styles.css.backup-20260302" ]; then
    cp src/styles.css.backup-20260302 src/styles.css
    echo "✓ styles.css を復元"
fi

# 4. テスト実行
echo "テスト実行中..."
npm run test:e2e

echo "✅ ロールバック完了"
```

実行:
```bash
chmod +x scripts/emergency-rollback.sh
./scripts/emergency-rollback.sh
```

---

## Phase 1 完了後の確認

### ✅ 成功基準
- [ ] npm run test:lint → CSS-JS整合性OK
- [ ] npm run test:e2e → 55/55 tests pass
- [ ] main.js サイズ: 252KB → 225KB (約 27KB 削減)
- [ ] npm run dev で正常起動
- [ ] 手動検証:
  - [ ] Markdown 編集
  - [ ] Undo/Redo
  - [ ] テーブル操作
  - [ ] 画像挿入
  - [ ] コードブロック（シンタックスハイライト）
  - [ ] 数学式 (KaTeX)
  - [ ] Mermaid 図形

### Git タグ作成
```bash
git tag v0.5.1-phase1 -m "Phase 1 complete: extracted nodeUtils, pasteUtils, codeHighlight, mathRender, mermaid"
git push origin feature/phase1-module-split
git push origin v0.5.1-phase1
```

### main ブランチへのマージ
```bash
# Phase 1 が完全に成功したことを確認後
git checkout main
git merge feature/phase1-module-split
git push origin main

# Phase 1 ブランチ削除（オプション）
git branch -d feature/phase1-module-split
```

---

## まとめ: 安全な実装のための鉄則

1. **小さく、頻繁にコミット** - 1モジュールごとに必ずコミット
2. **常にテストを実行** - コミット前に `npm run test:e2e`
3. **バックアップを作成** - 実装前に `.backup` ファイルを作成
4. **ブランチで作業** - main ブランチは常に安定状態を保つ
5. **タグでマイルストーン** - 成功ポイントにタグを付ける

**問題が起きたら:**
- 慌てずに `git log` で履歴確認
- `git reset --hard <commit>` で特定のポイントに戻る
- 最悪の場合は `git checkout main` で main ブランチに戻る
