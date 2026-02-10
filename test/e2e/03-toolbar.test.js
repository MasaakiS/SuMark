const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('ツールバー操作テスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
    });

    describe('書式ボタン', () => {
        it('太字ボタンで太字になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a'); // Select all
            await TestHelpers.clickToolbarButton('boldBtn');
            
            const hasStrong = await TestHelpers.editorContainsTag('strong');
            expect(hasStrong).toBe(true);
        });

        it('斜体ボタンで斜体になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a');
            await TestHelpers.clickToolbarButton('italicBtn');
            
            const hasEm = await TestHelpers.editorContainsTag('em');
            expect(hasEm).toBe(true);
        });

        it('取り消し線ボタンで取り消し線になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a');
            await TestHelpers.clickToolbarButton('strikeBtn');
            
            const hasDel = await TestHelpers.editorContainsTag('del');
            expect(hasDel).toBe(true);
        });

        it('下線ボタンで下線になる', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.pressShortcut('a');
            await TestHelpers.clickToolbarButton('underlineBtn');
            
            const hasU = await TestHelpers.editorContainsTag('u');
            expect(hasU).toBe(true);
        });
    });

    describe('見出しボタン', () => {
        it('H1 ボタンで見出し1になる', async () => {
            await TestHelpers.typeInEditor('Heading');
            await TestHelpers.clickToolbarButton('h1Btn');
            
            const hasH1 = await TestHelpers.editorContainsTag('h1');
            expect(hasH1).toBe(true);
        });

        it('H2 ボタンで見出し2になる', async () => {
            await TestHelpers.typeInEditor('Heading');
            await TestHelpers.clickToolbarButton('h2Btn');
            
            const hasH2 = await TestHelpers.editorContainsTag('h2');
            expect(hasH2).toBe(true);
        });

        it('H3 ボタンで見出し3になる', async () => {
            await TestHelpers.typeInEditor('Heading');
            await TestHelpers.clickToolbarButton('h3Btn');
            
            const hasH3 = await TestHelpers.editorContainsTag('h3');
            expect(hasH3).toBe(true);
        });
    });

    describe('リストボタン', () => {
        it('箇条書きボタンでリストが挿入される', async () => {
            await TestHelpers.clickToolbarButton('ulBtn');
            
            const hasUl = await TestHelpers.editorContainsTag('ul');
            expect(hasUl).toBe(true);
        });

        it('番号付きリストボタンでリストが挿入される', async () => {
            await TestHelpers.clickToolbarButton('olBtn');
            
            const hasOl = await TestHelpers.editorContainsTag('ol');
            expect(hasOl).toBe(true);
        });

        it('タスクリストボタンでタスクリストが挿入される', async () => {
            await TestHelpers.clickToolbarButton('taskBtn');
            
            const hasCheckbox = await TestHelpers.elementExists('input[type="checkbox"]');
            expect(hasCheckbox).toBe(true);
        });
    });

    describe('挿入ボタン', () => {
        it('引用ボタンで引用が挿入される', async () => {
            await TestHelpers.clickToolbarButton('quoteBtn');
            
            const hasBlockquote = await TestHelpers.editorContainsTag('blockquote');
            expect(hasBlockquote).toBe(true);
        });

        it('水平線ボタンで水平線が挿入される', async () => {
            await TestHelpers.clickToolbarButton('hrBtn');
            
            const hasHr = await TestHelpers.editorContainsTag('hr');
            expect(hasHr).toBe(true);
        });

        it('テーブルボタンでモーダルが開く', async () => {
            await TestHelpers.clickToolbarButton('tableBtn');
            await TestHelpers.waitForModal();
            
            const modal = await $('#modalOverlay');
            await expect(modal).toBeDisplayed();
            
            await TestHelpers.closeModal();
        });

        it('コードブロックボタンでモーダルが開く', async () => {
            await TestHelpers.clickToolbarButton('codeBtn');
            await TestHelpers.waitForModal();
            
            const modal = await $('#modalOverlay');
            await expect(modal).toBeDisplayed();
            
            await TestHelpers.closeModal();
        });

        it('リンクボタンでモーダルが開く', async () => {
            await TestHelpers.clickToolbarButton('linkBtn');
            await TestHelpers.waitForModal();
            
            const modal = await $('#modalOverlay');
            await expect(modal).toBeDisplayed();
            
            await TestHelpers.closeModal();
        });
    });

    describe('Undo/Redo', () => {
        it('Undo ボタンで元に戻る', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.wait(1000);
            await TestHelpers.clickToolbarButton('undoBtn');
            
            const text = await TestHelpers.getEditorText();
            expect(text.includes('test')).toBe(false);
        });

        it('Redo ボタンでやり直す', async () => {
            await TestHelpers.typeInEditor('test');
            await TestHelpers.wait(1000);
            await TestHelpers.clickToolbarButton('undoBtn');
            await TestHelpers.wait(500);
            await TestHelpers.clickToolbarButton('redoBtn');
            
            const text = await TestHelpers.getEditorText();
            expect(text).toContain('test');
        });
    });

    describe('日時挿入', () => {
        it('日付ボタンで日付が挿入される', async () => {
            await TestHelpers.clickToolbarButton('dateBtn');
            await TestHelpers.wait(500);
            
            const text = await TestHelpers.getEditorText();
            // Check for date format YYYY-MM-DD
            expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it('時刻ボタンで時刻が挿入される', async () => {
            await TestHelpers.clickToolbarButton('timeBtn');
            await TestHelpers.wait(500);
            
            const text = await TestHelpers.getEditorText();
            // Check for time format HH:MM:SS
            expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
        });

        it('日時ボタンで日時が挿入される', async () => {
            await TestHelpers.clickToolbarButton('datetimeBtn');
            await TestHelpers.wait(500);
            
            const text = await TestHelpers.getEditorText();
            // Check for datetime format
            expect(text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
        });
    });
});
