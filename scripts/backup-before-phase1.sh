#!/bin/bash

# Phase 1 実装前の自動バックアップスクリプト
# 使い方: ./scripts/backup-before-phase1.sh

set -e

BACKUP_DIR="backups/phase1-$(date +%Y%m%d-%H%M%S)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "🔒 Phase 1 実装前バックアップ開始..."
echo "バックアップ先: $BACKUP_DIR"

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR"

# 重要ファイルのバックアップ
echo "📁 ファイルをバックアップ中..."

# src/main.js
if [ -f "src/main.js" ]; then
    cp src/main.js "$BACKUP_DIR/main.js"
    cp src/main.js "src/main.js.backup-$TIMESTAMP"
    echo "✓ src/main.js"
fi

# src/styles.css
if [ -f "src/styles.css" ]; then
    cp src/styles.css "$BACKUP_DIR/styles.css"
    cp src/styles.css "src/styles.css.backup-$TIMESTAMP"
    echo "✓ src/styles.css"
fi

# package.json
if [ -f "package.json" ]; then
    cp package.json "$BACKUP_DIR/package.json"
    cp package.json "package.json.backup-$TIMESTAMP"
    echo "✓ package.json"
fi

# src/index.html
if [ -f "src/index.html" ]; then
    cp src/index.html "$BACKUP_DIR/index.html"
    cp src/index.html "src/index.html.backup-$TIMESTAMP"
    echo "✓ src/index.html"
fi

# Git の現在の状態を記録
echo "📝 Git 状態を記録中..."
git log --oneline -10 > "$BACKUP_DIR/git-log.txt"
git status > "$BACKUP_DIR/git-status.txt"
git diff > "$BACKUP_DIR/git-diff.txt" 2>/dev/null || true

# 現在のファイルサイズを記録
echo "📊 ファイルサイズを記録中..."
{
    echo "=== ファイルサイズ (Phase 1 実装前) ==="
    echo ""
    wc -l src/main.js src/styles.css
    echo ""
    du -h src/main.js src/styles.css
    echo ""
    echo "=== ディレクトリ構成 ==="
    tree src -L 2 2>/dev/null || ls -lhR src
} > "$BACKUP_DIR/file-sizes.txt"

# テスト結果を記録（オプション）
echo "🧪 テスト結果を記録中..."
{
    echo "=== E2E テスト実行ログ (Phase 1 実装前) ==="
    npm run test:e2e 2>&1 || echo "テスト失敗またはスキップ"
} > "$BACKUP_DIR/test-results.txt"

# バックアップ完了メッセージ
echo ""
echo "✅ バックアップ完了"
echo ""
echo "バックアップ場所:"
echo "  - $BACKUP_DIR/"
echo "  - src/main.js.backup-$TIMESTAMP"
echo "  - src/styles.css.backup-$TIMESTAMP"
echo "  - package.json.backup-$TIMESTAMP"
echo ""
echo "復元方法:"
echo "  cp src/main.js.backup-$TIMESTAMP src/main.js"
echo "  cp src/styles.css.backup-$TIMESTAMP src/styles.css"
echo "  cp package.json.backup-$TIMESTAMP package.json"
echo ""
echo "または:"
echo "  ./scripts/restore-from-backup.sh $BACKUP_DIR"
echo ""

# Git タグ作成の提案
echo "💡 Git タグの作成（推奨）:"
echo "  git tag v0.5.1-pre-phase1 -m 'Stable state before Phase 1'"
echo "  git push origin v0.5.1-pre-phase1"
echo ""
