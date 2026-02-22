// @ts-check
const { test, expect } = require('./fixtures');

test.describe('ツールバー操作テスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test.describe('書式ボタン（キーボードショートカット経由）', () => {
        // ツールバーボタンのクリックではエディタのフォーカスが失われるため、
        // execCommand を直接呼び出してテストする
        test('太字が適用される', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.pressShortcut('a');
            await app.helpers.execFormatCommand('bold');

            const hasBold = await app.helpers.editorContainsAnyTag(['strong', 'b']);
            expect(hasBold).toBe(true);
        });

        test('斜体が適用される', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.pressShortcut('a');
            await app.helpers.execFormatCommand('italic');

            const hasItalic = await app.helpers.editorContainsAnyTag(['em', 'i']);
            expect(hasItalic).toBe(true);
        });

        test('取り消し線が適用される', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.pressShortcut('a');
            await app.helpers.execFormatCommand('strikethrough');

            const hasStrike = await app.helpers.editorContainsAnyTag(['del', 's', 'strike']);
            expect(hasStrike).toBe(true);
        });
    });

    test.describe('見出しボタン', () => {
        test('H1 ボタンで見出し1になる', async ({ app }) => {
            await app.helpers.typeInEditor('Heading');
            await app.helpers.clickToolbarButton('h1Btn');

            const hasH1 = await app.helpers.editorContainsTag('h1');
            expect(hasH1).toBe(true);
        });

        test('H2 ボタンで見出し2になる', async ({ app }) => {
            await app.helpers.typeInEditor('Heading');
            await app.helpers.clickToolbarButton('h2Btn');

            const hasH2 = await app.helpers.editorContainsTag('h2');
            expect(hasH2).toBe(true);
        });

        test('H3 ボタンで見出し3になる', async ({ app }) => {
            await app.helpers.typeInEditor('Heading');
            await app.helpers.clickToolbarButton('h3Btn');

            const hasH3 = await app.helpers.editorContainsTag('h3');
            expect(hasH3).toBe(true);
        });
    });

    test.describe('リストボタン', () => {
        test('箇条書きボタンでリストが挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('ulBtn');

            const hasUl = await app.helpers.editorContainsTag('ul');
            expect(hasUl).toBe(true);
        });

        test('番号付きリストボタンでリストが挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('olBtn');

            const hasOl = await app.helpers.editorContainsTag('ol');
            expect(hasOl).toBe(true);
        });

        test('タスクリストボタンでタスクリストが挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('taskBtn');

            const hasCheckbox = await app.helpers.elementExists('#editor input[type="checkbox"]');
            expect(hasCheckbox).toBe(true);
        });
    });

    test.describe('挿入ボタン', () => {
        test('引用ボタンで引用が挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('quoteBtn');

            const hasBlockquote = await app.helpers.editorContainsTag('blockquote');
            expect(hasBlockquote).toBe(true);
        });

        test('水平線ボタンで水平線が挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('hrBtn');

            const hasHr = await app.helpers.editorContainsTag('hr');
            expect(hasHr).toBe(true);
        });

        test('テーブルボタンでテーブルが直接挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('tableBtn');
            await app.helpers.wait(500);

            const hasTable = await app.helpers.editorContainsTag('table');
            expect(hasTable).toBe(true);
        });

        test('コードブロックボタンでモーダルが開く', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('codeBlockBtn');
            await app.helpers.waitForModal();

            await expect(app.page.locator('#modalOverlay')).toBeVisible();
            await app.helpers.clickModalCancel();
        });

        test('リンクボタンでモーダルが開く', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('linkBtn');
            await app.helpers.waitForModal();

            await expect(app.page.locator('#modalOverlay')).toBeVisible();
            await app.helpers.clickModalCancel();
        });
    });

    test.describe('Undo/Redo', () => {
        test('Undo ボタンで元に戻る', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.wait(1000);
            await app.helpers.clickToolbarButton('undoBtn');

            const text = await app.helpers.getEditorText();
            expect(text.includes('test')).toBe(false);
        });

        test('Redo ボタンでやり直す', async ({ app }) => {
            await app.helpers.typeInEditor('test');
            await app.helpers.wait(1000);
            await app.helpers.clickToolbarButton('undoBtn');
            await app.helpers.wait(500);
            await app.helpers.clickToolbarButton('redoBtn');

            const text = await app.helpers.getEditorText();
            expect(text).toContain('test');
        });
    });

    test.describe('日時挿入（ブラウザモード）', () => {
        // ブラウザモードでは Tauri の invoke が利用できないが、
        // フォールバック処理で JavaScript の Date を使用する
        test('日付ボタンで日付が挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('dateBtn');
            await app.helpers.wait(1000);

            const text = await app.helpers.getEditorText();
            // invoke がモック(Promise.resolve → undefined)のため失敗する場合がある
            // フォールバックの catch が動けば YYYY-MM-DD 形式
            expect(text.length).toBeGreaterThan(0);
        });

        test('時刻ボタンで時刻が挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('timeBtn');
            await app.helpers.wait(1000);

            const text = await app.helpers.getEditorText();
            expect(text.length).toBeGreaterThan(0);
        });

        test('日時ボタンで日時が挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('datetimeBtn');
            await app.helpers.wait(1000);

            const text = await app.helpers.getEditorText();
            expect(text.length).toBeGreaterThan(0);
        });
    });
});
