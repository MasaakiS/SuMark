// 推薦追加E2Eテスト: 品質・堅牢性・例外系
const { test, expect } = require('./fixtures');

// ⚠️ モーダル/バナー表示の安定性を確保するため、このファイルのテストはシリアル実行
test.describe.configure({ fullyParallel: false });

// 1. 無効なMarkdownファイル読み込み時のエラー表示
// 2. 超長文・大規模テーブルのパフォーマンステスト
// 3. XSS/HTMLインジェクション対策
// 4. Undo/Redoの例外動作
// 5. 設定保存・復元
// 6. アクセシビリティ: キーボード操作
// 7. ファイル保存エラー時の挙動

test.describe('推奨追加E2Eテスト', () => {
    test('XSS攻撃文字列が無害化される', async ({ app }) => {
        // DOMPurifyのサニタイズをテストするため、Markdownパーサ経由でXSSを注入
        // (typeInEditorでは自動エスケープされるため、setMarkdown経由で危険なHTMLを通す)
        const xssMd = '# テスト\n\n<img src=x onerror=alert(1)>\n\n通常のテキスト';
        await app.page.evaluate((md) => {
            if (typeof window.setMarkdown === 'function') {
                window.setMarkdown(md);
            }
        }, xssMd);
        await app.helpers.wait(500);
        const html = await app.helpers.getEditorHTML();
        // DOMPurifyが危険なonerror属性を除去していることを確認
        expect(html).not.toMatch(/onerror=/i);
    });

    test('Undo/Redoを連打しても状態が壊れない', async ({ app }) => {
        await app.helpers.typeInEditor('A');
        await app.helpers.typeInEditor('B');
        for (let i = 0; i < 10; i++) await app.helpers.pressShortcut('z'); // Undo
        for (let i = 0; i < 10; i++) await app.helpers.pressShortcut('y'); // Redo
        const text = await app.helpers.getEditorText();
        expect(['A', 'B', '', 'AB']).toContain(text.replace(/\s/g, ''));
    });



    test('ファイル保存時にストレージエラーが発生した場合に警告が表示される', async ({ app }) => {
        // 仮: ストレージ容量不足をシミュレート
        await app.helpers.simulateStorageError();
        await app.helpers.pressShortcut('s');
        const banner = app.page.locator('[data-banner-type="error"]');
        await expect(banner).toBeVisible();
    });
});
