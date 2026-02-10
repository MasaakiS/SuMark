const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('テーブル操作テスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
    });

    describe('テーブル挿入', () => {
        it('2x2 テーブルを挿入できる', async () => {
            await TestHelpers.clickToolbarButton('tableBtn');
            await TestHelpers.waitForModal();
            
            await TestHelpers.setModalField('rows', '2');
            await TestHelpers.setModalField('cols', '2');
            await TestHelpers.clickModalOK();
            
            const hasTable = await TestHelpers.editorContainsTag('table');
            expect(hasTable).toBe(true);
            
            const rowCount = await TestHelpers.getTableRowCount();
            expect(rowCount).toBe(3); // header + 2 rows
        });

        it('3x4 テーブルを挿入できる', async () => {
            await TestHelpers.clickToolbarButton('tableBtn');
            await TestHelpers.waitForModal();
            
            await TestHelpers.setModalField('rows', '3');
            await TestHelpers.setModalField('cols', '4');
            await TestHelpers.clickModalOK();
            
            const rowCount = await TestHelpers.getTableRowCount();
            expect(rowCount).toBe(4); // header + 3 rows
            
            const colCount = await TestHelpers.getTableColumnCount();
            expect(colCount).toBe(4);
        });

        it('大きなテーブルを挿入できる', async () => {
            await TestHelpers.clickToolbarButton('tableBtn');
            await TestHelpers.waitForModal();
            
            await TestHelpers.setModalField('rows', '10');
            await TestHelpers.setModalField('cols', '10');
            await TestHelpers.clickModalOK();
            
            const hasTable = await TestHelpers.editorContainsTag('table');
            expect(hasTable).toBe(true);
        });
    });

    describe('テーブル編集', () => {
        beforeEach(async () => {
            // Insert a 2x2 table for editing tests
            await TestHelpers.clickToolbarButton('tableBtn');
            await TestHelpers.waitForModal();
            await TestHelpers.setModalField('rows', '2');
            await TestHelpers.setModalField('cols', '2');
            await TestHelpers.clickModalOK();
            await TestHelpers.wait(500);
        });

        it('テーブルセルにテキストを入力できる', async () => {
            const editor = await TestHelpers.getEditor();
            const firstCell = await editor.$('table td');
            await firstCell.click();
            await browser.keys('Test');
            
            const text = await firstCell.getText();
            expect(text).toContain('Test');
        });

        it('テーブルセルを右クリックでコンテキストメニューが表示される', async () => {
            const editor = await TestHelpers.getEditor();
            const firstCell = await editor.$('table td');
            await firstCell.click({ button: 'right' });
            await TestHelpers.wait(300);
            
            const menu = await $('#tableContextMenu');
            const isDisplayed = await menu.isDisplayed();
            expect(isDisplayed).toBe(true);
        });
    });

    describe('Markdown テーブル貼り付け', () => {
        it('タブ区切りテキストからテーブルが生成される', async () => {
            // This test would require clipboard access
            // Skipping for now as it needs special permissions
        });

        it('Excel からのテーブル貼り付けができる', async () => {
            // This test would require clipboard access
            // Skipping for now as it needs special permissions
        });
    });
});
