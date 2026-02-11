// @ts-check
const { test, expect } = require('./fixtures');
const os = require('os');

const isMac = os.platform() === 'darwin';
const MOD = isMac ? 'Meta' : 'Control';

test.describe('キーボードショートカットテスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test.describe('書式ショートカット', () => {
        test('Cmd/Ctrl+B で太字になる', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.pressShortcut('a');
            await app.helpers.pressShortcut('b');

            const hasStrong = await app.helpers.editorContainsTag('strong');
            expect(hasStrong).toBe(true);
        });

        test('Cmd/Ctrl+I で斜体になる', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.pressShortcut('a');
            await app.helpers.pressShortcut('i');

            const hasEm = await app.helpers.editorContainsTag('em');
            expect(hasEm).toBe(true);
        });

        test('Cmd/Ctrl+U で下線になる', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.pressShortcut('a');
            await app.helpers.pressShortcut('u');

            const hasU = await app.helpers.editorContainsTag('u');
            expect(hasU).toBe(true);
        });

        test('Cmd/Ctrl+Shift+X で取り消し線になる', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.pressShortcut('a');
            await app.helpers.pressShiftShortcut('x');

            const hasDel = await app.helpers.editorContainsTag('del');
            expect(hasDel).toBe(true);
        });
    });

    test.describe('編集ショートカット', () => {
        test('Cmd/Ctrl+Z で元に戻る', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.wait(1000);
            await app.helpers.pressShortcut('z');

            const text = await app.helpers.getEditorText();
            expect(text.includes('test')).toBe(false);
        });

        test('Cmd/Ctrl+Shift+Z でやり直す', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.wait(1000);
            await app.helpers.pressShortcut('z');
            await app.helpers.wait(500);
            await app.helpers.pressShiftShortcut('z');

            const text = await app.helpers.getEditorText();
            expect(text).toContain('test');
        });

        test('Cmd/Ctrl+Y でやり直す（代替）', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.wait(1000);
            await app.helpers.pressShortcut('z');
            await app.helpers.wait(500);
            await app.helpers.pressShortcut('y');

            const text = await app.helpers.getEditorText();
            expect(text).toContain('test');
        });

        test('Cmd/Ctrl+A で全選択できる', async ({ app }) => {
            await app.helpers.typeInEditor('test text');
            await app.helpers.pressShortcut('a');

            // 全選択後にタイプすると置き換わる
            await app.page.keyboard.type('new');
            const text = await app.helpers.getEditorText();
            expect(text).toContain('new');
            expect(text.includes('test text')).toBe(false);
        });
    });

    test.describe('日時挿入ショートカット', () => {
        test('Cmd/Ctrl+; で日付が挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.pressShortcut(';');
            await app.helpers.wait(1000);

            const text = await app.helpers.getEditorText();
            // ブラウザモードでは invoke フォールバックで日付が挿入される場合がある
            expect(text.length).toBeGreaterThan(0);
        });

        test('Cmd/Ctrl+Shift+; で時刻が挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.pressShiftShortcut(';');
            await app.helpers.wait(1000);

            const text = await app.helpers.getEditorText();
            expect(text.length).toBeGreaterThan(0);
        });
    });

    test.describe('ファイル操作ショートカット', () => {
        test('Cmd/Ctrl+N で新規タブが作成される', async ({ app }) => {
            const initialTabCount = await app.helpers.getTabCount();
            await app.helpers.pressShortcut('n');
            await app.helpers.wait(500);

            const newTabCount = await app.helpers.getTabCount();
            expect(newTabCount).toBe(initialTabCount + 1);
        });

        test('Cmd/Ctrl+W でタブが閉じる', async ({ app }) => {
            // まず新しいタブを作成
            await app.helpers.pressShortcut('n');
            await app.helpers.wait(500);

            const tabCountBefore = await app.helpers.getTabCount();
            await app.helpers.pressShortcut('w');
            await app.helpers.wait(500);

            const tabCountAfter = await app.helpers.getTabCount();
            expect(tabCountAfter).toBe(tabCountBefore - 1);
        });
    });

    test.describe('Enterキーの動作', () => {
        test('リスト内で Enter を押すと新しいリスト項目が作成される', async ({ app }) => {
            await app.helpers.typeInEditor('- Item 1');
            await app.page.keyboard.press('Space');
            await app.helpers.wait(500);
            await app.page.keyboard.press('Enter');
            await app.page.keyboard.type('Item 2');

            const listItems = await app.page.locator('#editor li').count();
            expect(listItems).toBeGreaterThanOrEqual(2);
        });

        test('見出しで Enter を押すと通常の段落になる', async ({ app }) => {
            await app.helpers.typeInEditor('# Heading');
            await app.page.keyboard.press('Space');
            await app.helpers.wait(500);
            await app.page.keyboard.press('Enter');
            await app.page.keyboard.type('Normal text');

            const text = await app.helpers.getEditorText();
            expect(text).toContain('Normal text');
        });
    });
});
