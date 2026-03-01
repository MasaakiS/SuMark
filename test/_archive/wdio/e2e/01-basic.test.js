const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('基本操作テスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
    });

    it('アプリが起動する', async () => {
        const editor = await TestHelpers.getEditor();
        await expect(editor).toBeDisplayed();
    });

    it('エディタにテキストを入力できる', async () => {
        await TestHelpers.typeInEditor('Hello World');
        const text = await TestHelpers.getEditorText();
        expect(text).toContain('Hello World');
    });

    it('テキストを削除できる', async () => {
        await TestHelpers.typeInEditor('Test');
        await TestHelpers.clearEditor();
        const text = await TestHelpers.getEditorText();
        expect(text.trim()).toBe('');
    });

    it('複数行のテキストを入力できる', async () => {
        await TestHelpers.typeInEditor('Line 1');
        await browser.keys('Enter');
        await TestHelpers.typeInEditor('Line 2');
        await browser.keys('Enter');
        await TestHelpers.typeInEditor('Line 3');
        
        const text = await TestHelpers.getEditorText();
        expect(text).toContain('Line 1');
        expect(text).toContain('Line 2');
        expect(text).toContain('Line 3');
    });

    it('日本語を入力できる', async () => {
        await TestHelpers.typeInEditor('こんにちは世界');
        const text = await TestHelpers.getEditorText();
        expect(text).toContain('こんにちは世界');
    });

    it('特殊文字を入力できる', async () => {
        await TestHelpers.typeInEditor('!@#$%^&*()_+-=[]{}|;:,.<>?');
        const text = await TestHelpers.getEditorText();
        expect(text).toContain('!@#$%');
    });

    it('ツールバーが表示される', async () => {
        const toolbar = await $('#toolbar');
        await expect(toolbar).toBeDisplayed();
    });

    it('ステータスバーが表示される', async () => {
        const statusBar = await $('#statusBar');
        await expect(statusBar).toBeDisplayed();
    });

    it('単語数がカウントされる', async () => {
        await TestHelpers.typeInEditor('test word count');
        await TestHelpers.wait(1000);
        const wordCount = await TestHelpers.getWordCount();
        expect(wordCount).toBeGreaterThan(0);
    });
});
