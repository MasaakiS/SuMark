const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('キーボードショートカットテスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
    });

    describe('書式ショートカット', () => {
        it('Cmd/Ctrl+B で太字になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a');
            await TestHelpers.pressShortcut('b');
            
            const hasStrong = await TestHelpers.editorContainsTag('strong');
            expect(hasStrong).toBe(true);
        });

        it('Cmd/Ctrl+I で斜体になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a');
            await TestHelpers.pressShortcut('i');
            
            const hasEm = await TestHelpers.editorContainsTag('em');
            expect(hasEm).toBe(true);
        });

        it('Cmd/Ctrl+U で下線になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a');
            await TestHelpers.pressShortcut('u');
            
            const hasU = await TestHelpers.editorContainsTag('u');
            expect(hasU).toBe(true);
        });

        it('Cmd/Ctrl+Shift+X で取り消し線になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a');
            
            const modifier = process.platform === 'darwin' ? 'Command' : 'Control';
            await browser.keys([modifier, 'Shift', 'x']);
            await TestHelpers.wait(300);
            
            const hasDel = await TestHelpers.editorContainsTag('del');
            expect(hasDel).toBe(true);
        });
    });

    describe('編集ショートカット', () => {
        it('Cmd/Ctrl+Z で元に戻る', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.wait(1000);
            await TestHelpers.pressShortcut('z');
            
            const text = await TestHelpers.getEditorText();
            expect(text.includes('test')).toBe(false);
        });

        it('Cmd/Ctrl+Shift+Z でやり直す', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.wait(1000);
            await TestHelpers.pressShortcut('z');
            await TestHelpers.wait(500);
            
            const modifier = process.platform === 'darwin' ? 'Command' : 'Control';
            await browser.keys([modifier, 'Shift', 'z']);
            await TestHelpers.wait(300);
            
            const text = await TestHelpers.getEditorText();
            expect(text).toContain('test');
        });

        it('Cmd/Ctrl+Y でやり直す（代替）', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.wait(1000);
            await TestHelpers.pressShortcut('z');
            await TestHelpers.wait(500);
            await TestHelpers.pressShortcut('y');
            
            const text = await TestHelpers.getEditorText();
            expect(text).toContain('test');
        });

        it('Cmd/Ctrl+A で全選択できる', async () => {
            await TestHelpers.typeInEditor('test text');
            await TestHelpers.pressShortcut('a');
            
            // After selecting all, typing should replace
            await browser.keys('new');
            const text = await TestHelpers.getEditorText();
            expect(text).toContain('new');
            expect(text.includes('test text')).toBe(false);
        });
    });

    describe('日時挿入ショートカット', () => {
        it('Cmd/Ctrl+; で日付が挿入される', async () => {
            await TestHelpers.pressShortcut(';');
            await TestHelpers.wait(500);
            
            const text = await TestHelpers.getEditorText();
            expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it('Cmd/Ctrl+: で時刻が挿入される', async () => {
            const modifier = process.platform === 'darwin' ? 'Command' : 'Control';
            await browser.keys([modifier, 'Shift', ';']); // Shift+; = :
            await TestHelpers.wait(500);
            
            const text = await TestHelpers.getEditorText();
            expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('ファイル操作ショートカット', () => {
        it('Cmd/Ctrl+N で新規タブが作成される', async () => {
            const initialTabCount = await TestHelpers.getTabCount();
            await TestHelpers.pressShortcut('n');
            await TestHelpers.wait(500);
            
            const newTabCount = await TestHelpers.getTabCount();
            expect(newTabCount).toBe(initialTabCount + 1);
        });

        it('Cmd/Ctrl+W でタブが閉じる', async () => {
            // Create a new tab first
            await TestHelpers.pressShortcut('n');
            await TestHelpers.wait(500);
            
            const tabCountBefore = await TestHelpers.getTabCount();
            await TestHelpers.pressShortcut('w');
            await TestHelpers.wait(500);
            
            const tabCountAfter = await TestHelpers.getTabCount();
            expect(tabCountAfter).toBe(tabCountBefore - 1);
        });
    });

    describe('検索ショートカット', () => {
        it('Cmd/Ctrl+F で検索が開く', async () => {
            await TestHelpers.pressShortcut('f');
            await TestHelpers.wait(500);
            
            // Check if search UI appears (if implemented)
            // This depends on your implementation
        });
    });

    describe('Enterキーの動作', () => {
        it('リスト内で Enter を押すと新しいリスト項目が作成される', async () => {
            await TestHelpers.typeInEditor('- Item 1');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            await browser.keys('Enter');
            await browser.keys('Item 2');
            
            const editor = await TestHelpers.getEditor();
            const listItems = await editor.$$('li');
            expect(listItems.length).toBeGreaterThanOrEqual(2);
        });

        it('見出しで Enter を押すと通常の段落になる', async () => {
            await TestHelpers.typeInEditor('# Heading');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            await browser.keys('Enter');
            await browser.keys('Normal text');
            
            const text = await TestHelpers.getEditorText();
            expect(text).toContain('Normal text');
        });
    });
});
