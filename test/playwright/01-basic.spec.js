// @ts-check
const { test, expect } = require('./fixtures');

test.describe('基本操作テスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test('アプリが起動する', async ({ app }) => {
        await expect(app.page.locator('#editor')).toBeVisible();
    });

    test('エディタにテキストを入力できる', async ({ app }) => {
        await app.helpers.typeInEditor('Hello World');
        const text = await app.helpers.getEditorText();
        expect(text).toContain('Hello World');
    });

    test('テキストを削除できる', async ({ app }) => {
        await app.helpers.typeInEditor('Test');
        await app.helpers.clearEditor();
        const text = await app.helpers.getEditorText();
        expect(text.trim()).toBe('');
    });

    test('複数行のテキストを入力できる', async ({ app }) => {
        await app.helpers.typeInEditor('Line 1');
        await app.page.keyboard.press('Enter');
        await app.helpers.typeMore('Line 2');
        await app.page.keyboard.press('Enter');
        await app.helpers.typeMore('Line 3');

        const text = await app.helpers.getEditorText();
        expect(text).toContain('Line 1');
        expect(text).toContain('Line 2');
        expect(text).toContain('Line 3');
    });

    test('日本語を入力できる', async ({ app }) => {
        await app.helpers.typeInEditor('こんにちは世界');
        const text = await app.helpers.getEditorText();
        expect(text).toContain('こんにちは世界');
    });

    test('特殊文字を入力できる', async ({ app }) => {
        await app.helpers.typeInEditor('!@#$%^&*()');
        const text = await app.helpers.getEditorText();
        expect(text).toContain('!@#$%');
    });

    test('ツールバーが表示される', async ({ app }) => {
        await expect(app.page.locator('.toolbar')).toBeVisible();
    });

    test('ステータスバーが表示される', async ({ app }) => {
        await expect(app.page.locator('.status-bar')).toBeVisible();
    });

    test('単語数がカウントされる', async ({ app }) => {
        await app.helpers.typeInEditor('test word count');
        await app.helpers.wait(1000);
        const text = await app.page.locator('#wordCount').innerText();
        // 数値が含まれている
        expect(text).toMatch(/\d/);
    });
});
