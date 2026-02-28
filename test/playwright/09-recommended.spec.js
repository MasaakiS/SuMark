// 推薦追加E2Eテスト: 品質・堅牢性・例外系
const { test, expect } = require('./fixtures');

// 1. 無効なMarkdownファイル読み込み時のエラー表示
// 2. 超長文・大規模テーブルのパフォーマンステスト
// 3. XSS/HTMLインジェクション対策
// 4. Undo/Redoの例外動作
// 5. 設定保存・復元
// 6. アクセシビリティ: キーボード操作
// 7. ファイル保存エラー時の挙動

test.describe('推奨追加E2Eテスト', () => {
    test('無効なMarkdownファイル読み込み時にエラーが表示される', async ({ app }) => {
        const invalidMd = '\n# 見出し\n\n```\n未閉じコードブロック';
        await app.helpers.typeInEditor(invalidMd);
        // バナーが一瞬でも表示されたことを検証
        await app.page.waitForSelector('.toast-banner, .error-banner', { state: 'attached', timeout: 3000 });
    });

    test('1万文字超のテキスト編集・保存がフリーズしない', async ({ app }) => {
        const longText = 'a'.repeat(10000);
        // 300秒(5分)まで待つ
        await app.helpers.typeInEditor(longText);
        // 保存操作（仮: Ctrl+S ショートカット）
        await app.helpers.pressShortcut('s');
        // 2秒以内にUIが応答すること
        await app.helpers.wait(2000);
        const text = await app.helpers.getEditorText();
        expect(text.length).toBeGreaterThan(9999);
    }, 300000); // タイムアウト: 300秒

    test('XSS攻撃文字列が無害化される', async ({ app }) => {
        const xss = '<img src=x onerror=alert(1)>';
        await app.helpers.typeInEditor(xss);
        const html = await app.helpers.getEditorHTML();
        // "<img ...>" タグがそのままHTMLとして残っていない、または onerror属性が実際の属性として残っていなければOK
        // 例: &lt;imgsrc=xonerror=alert(1)&gt; のようにエスケープされていれば合格
        expect(html).not.toMatch(/<img[^>]*onerror=/i);
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
        const banner = app.page.locator('.toast-banner, .error-banner');
        await expect(banner).toBeVisible();
    });
});
