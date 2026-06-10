#!/bin/bash

# バックアップからの復元スクリプト
# 使い方: ./scripts/restore-from-backup.sh <backup-directory>
# 例: ./scripts/restore-from-backup.sh backups/phase1-20260302-143022

set -e

BACKUP_DIR="$1"

if [ -z "$BACKUP_DIR" ]; then
    echo "❌ エラー: バックアップディレクトリを指定してください"
    echo ""
    echo "使い方:"
    echo "  ./scripts/restore-from-backup.sh <backup-directory>"
    echo ""
    echo "利用可能なバックアップ:"
    ls -d backups/phase1-* 2>/dev/null || echo "  （バックアップが見つかりません）"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ エラー: $BACKUP_DIR が見つかりません"
    exit 1
fi

echo "⚠️  復元確認"
echo "以下のファイルを復元します:"
echo "  - src/main.js"
echo "  - src/styles.css"
echo "  - package.json"
echo "  - src/index.html"
echo ""
echo "バックアップ元: $BACKUP_DIR"
echo ""
read -p "続行しますか？ (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルしました"
    exit 0
fi

echo ""
echo "🔄 復元中..."

# ファイル復元
if [ -f "$BACKUP_DIR/main.js" ]; then
    cp "$BACKUP_DIR/main.js" src/main.js
    echo "✓ src/main.js を復元"
fi

if [ -f "$BACKUP_DIR/styles.css" ]; then
    cp "$BACKUP_DIR/styles.css" src/styles.css
    echo "✓ src/styles.css を復元"
fi

if [ -f "$BACKUP_DIR/package.json" ]; then
    cp "$BACKUP_DIR/package.json" package.json
    echo "✓ package.json を復元"
    
    echo "📦 依存関係を再インストール中..."
    if [ -f "package-lock.json" ]; then
        npm ci --ignore-scripts
    else
        npm install --ignore-scripts
    fi
fi

if [ -f "$BACKUP_DIR/index.html" ]; then
    cp "$BACKUP_DIR/index.html" src/index.html
    echo "✓ src/index.html を復元"
fi

# modules/ ディレクトリが存在する場合は削除確認
if [ -d "src/modules" ]; then
    echo ""
    read -p "src/modules/ ディレクトリを削除しますか？ (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf src/modules/
        echo "✓ src/modules/ を削除"
    fi
fi

echo ""
echo "✅ 復元完了"
echo ""
echo "次のステップ:"
echo "  1. テスト実行: npm run test:e2e"
echo "  2. 動作確認: npm run dev"
echo ""

# バックアップ情報の表示
if [ -f "$BACKUP_DIR/git-log.txt" ]; then
    echo "📝 バックアップ時の Git 状態:"
    head -5 "$BACKUP_DIR/git-log.txt"
    echo ""
fi

if [ -f "$BACKUP_DIR/file-sizes.txt" ]; then
    echo "📊 バックアップ時のファイルサイズ:"
    head -10 "$BACKUP_DIR/file-sizes.txt"
    echo ""
fi
