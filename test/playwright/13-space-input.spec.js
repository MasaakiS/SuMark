// @ts-check
const { test, expect } = require('./fixtures');

test.describe('スペース入力保持テスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test('文字列入力後の末尾スペースが保持される', async ({ app }) => {
        await app.helpers.typeInEditor('Ffdf');
        await app.page.keyboard.press('Space');
        await app.helpers.wait(400);

        const state = await app.page.evaluate(() => {
            const editor = document.getElementById('editor');
            const block = editor && editor.firstElementChild;
            const text = block ? (block.textContent || '') : '';
            const lastCharCode = text.length ? text.charCodeAt(text.length - 1) : null;
            return {
                text,
                lastCharCode,
                innerText: editor ? (editor.innerText || '') : '',
            };
        });

        expect(state.text.startsWith('Ffdf')).toBe(true);
        // Browser/contenteditable may keep trailing space as normal space (32) or NBSP (160)
        expect([32, 160]).toContain(state.lastCharCode);
        expect(state.innerText.includes('Ffdf')).toBe(true);
    });
});
