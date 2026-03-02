#!/bin/bash

# 緊急ロールバックスクリプト
# Phase 1 実装で問題が発生した場合に実行
# 使い方: ./scripts/emergency-rollback.sh

set -e

echo "⚠️  緊急ロールバック開始"
echo ""
echo "このスクリプトは以下の操作を行います:"
echo "  1. Git で main ブランチに戻る"
echo "  2. Phase 1 ブランチを削除"
echo "  3. src/modules/ ディレクトリを削除"
echo "  4. 最新のバックアップから復元"
echo ""
read -p "続行しますか？ (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルしました"
    exit 0
fi

echo ""
echo "🔄 ロールバック処理中..."

# 1. Git の現在の状態を確認
CURRENT_BRANCH=$(git branch --show-current)
echo "現在のブランチ: $CURRENT_BRANCH"

# 2. 未保存の変更を確認
if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "⚠️  未保存の変更があります"
    read -p "変更を破棄して続行しますか？ (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "キャンセルしました"
        exit 0
    fi
    
    # 変更を破棄
    git reset --hard
    echo "✓ 未保存の変更を破棄"
fi

# 3. main ブランチに戻る
if [ "$CURRENT_BRANCH" != "main" ]; then
    git checkout main
    echo "✓ main ブランチに切替"
fi

# 4. Phase 1 ブランチを削除
if git show-ref --verify --quiet refs/heads/feature/phase1-module-split; then
    git branch -D feature/phase1-module-split
    echo "✓ feature/phase1-module-split ブランチを削除"
fi

# 5. modules/ ディレクトリを削除
if [ -d "src/modules" ]; then
    rm -rf src/modules/
    echo "✓ src/modules/ ディレクトリを削除"
fi

# 6. 最新のバックアップを探す
LATEST_BACKUP=$(ls -t src/main.js.backup-* 2>/dev/null | head -1)

if [ -n "$LATEST_BACKUP" ]; then
    echo ""
    echo "📁 最新のバックアップファイル:"
    echo "  $LATEST_BACKUP"
    echo ""
    read -p "このバックアップから復元しますか？ (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # main.js を復元
        cp "$LATEST_BACKUP" src/main.js
        echo "✓ src/main.js を復元"
        
        # styles.css のバックアップを復元
        TIMESTAMP=$(echo "$LATEST_BACKUP" | sed 's/.*backup-//' | sed 's/$//')
        if [ -f "src/styles.css.backup-$TIMESTAMP" ]; then
            cp "src/styles.css.backup-$TIMESTAMP" src/styles.css
            echo "✓ src/styles.css を復元"
        fi
        
        # package.json のバックアップを復元
        if [ -f "package.json.backup-$TIMESTAMP" ]; then
            cp "package.json.backup-$TIMESTAMP" package.json
            echo "✓ package.json を復元"
            
            echo "📦 依存関係を再インストール中..."
            npm install
        fi
    fi
else
    echo "⚠️  バックアップファイルが見つかりません"
    echo "    手動で復元してください"
fi

# 7. Git の状態を確認
echo ""
echo "📝 Git の状態:"
git status

echo ""
echo "✅ ロールバック完了"
echo ""
echo "次のステップ:"
echo "  1. テスト実行: npm run test:e2e"
echo "  2. 動作確認: npm run dev"
echo ""
echo "さらに前の状態に戻す場合:"
echo "  git checkout v0.5.1-pre-phase1"
echo "  （タグが存在する場合）"
echo ""
