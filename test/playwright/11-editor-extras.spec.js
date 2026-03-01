const { test, expect } = require('./fixtures');

test.describe('エディタ拡張機能テスト', () => {
    test('絵文字ピッカーから絵文字を挿入できる', async ({ app }) => {
        await app.helpers.clearEditor();
        await app.helpers.focusEditor();

        await app.helpers.clickToolbarButton('emojiBtn');

        const picker = app.page.locator('.emoji-picker');
        await expect(picker).toBeVisible();

        const firstEmoji = app.page.locator('.emoji-picker .emoji-item').first();
        const picked = await firstEmoji.getAttribute('data-emoji');
        await firstEmoji.click();

        const text = await app.helpers.getEditorText();
        expect(text).toContain(picked || '😀');
    });

    test('ズームショートカットで拡大・リセットできる', async ({ app }) => {
        await app.helpers.clearEditor();
        await app.helpers.focusEditor();

        const before = await app.page.locator('#editor').evaluate(el => el.style.transform || '');

        await app.helpers.pressShortcut('=');
        await app.helpers.wait(150);

        const zoomed = await app.page.locator('#editor').evaluate(el => el.style.transform || '');
        expect(zoomed).toMatch(/scale\(/);
        expect(zoomed).not.toBe(before);

        await app.helpers.pressShortcut('0');
        await app.helpers.wait(150);

        const reset = await app.page.locator('#editor').evaluate(el => el.style.transform || '');
        expect(reset).toBe('scale(1)');
    });

    test('Mermaid挿入ダイアログからコードブロックを挿入できる', async ({ app }) => {
        await app.helpers.clearEditor();
        await app.helpers.focusEditor();

        await app.helpers.clickToolbarButton('mermaidBtn');

        // カスタムダイアログの表示を待機（#mermaidInput）
        const area = app.page.locator('#mermaidInput');
        await expect(area).toBeVisible({ timeout: 8000 });

        const source = 'graph TD\nA[Start] --> B[Done]';
        await area.fill(source);
        await app.page.locator('#mermaidOk').click();
        await app.page.waitForTimeout(2000); // Mermaidレンダリング待ち

        // コード＋図形モードのコンテナが生成されることを確認
        const container = app.page.locator('.mermaid-code-and-diagram');
        await expect(container).toBeVisible({ timeout: 5000 });

        // コンテナ内のコードブロックにソースが含まれることを確認
        const codeText = await container.locator('code.language-mermaid').innerText();
        expect(codeText).toContain('A[Start] --> B[Done]');
    });
});
