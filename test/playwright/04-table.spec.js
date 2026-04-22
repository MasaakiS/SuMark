// @ts-check
const { test, expect } = require('./fixtures');
const { checkTableDataIntegrity } = require('./copilotMarkdownValidator');

test.describe('テーブル操作テスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test.describe('テーブル挿入', () => {
        test('テーブルボタンでデフォルトテーブルが挿入される', async ({ app }) => {
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('tableBtn');
            await app.helpers.wait(500);

            const hasTable = await app.helpers.editorContainsTag('table');
            expect(hasTable).toBe(true);

            // デフォルトは 3列 × 2行 (ヘッダー含め 3 rows)
            const rowCount = await app.helpers.getTableRowCount();
            expect(rowCount).toBe(3); // header row + 2 data rows

            const colCount = await app.helpers.getTableColumnCount();
            expect(colCount).toBe(3);
        });
    });

    test.describe('テーブル編集', () => {
        test.beforeEach(async ({ app }) => {
            // テーブルを挿入
            await app.helpers.focusEditor();
            await app.helpers.clickToolbarButton('tableBtn');
            await app.helpers.wait(500);
        });

        test('テーブルセルにテキストを入力できる', async ({ app }) => {
            const firstCell = app.page.locator('#editor table td').first();
            await firstCell.click();
            await app.page.keyboard.type('Test');

            const text = await firstCell.innerText();
            expect(text).toContain('Test');
        });

        test('テーブルセルを右クリックでコンテキストメニューが表示される', async ({ app }) => {
            const firstCell = app.page.locator('#editor table td').first();
            await firstCell.click({ button: 'right' });
            await app.helpers.wait(300);

            const menu = app.page.locator('#tableContextMenu');
            await expect(menu).toBeVisible();
        });
    });

    // ─────────────────────────────────────────────
    // テーブルデータ損失チェック (Copilot CLI)
    // test:e2e:md-check スクリプト実行時のみ有効
    // ─────────────────────────────────────────────
    test.describe('テーブルデータ損失チェック (Copilot CLIチェック)', () => {
        test.describe.configure({ timeout: 120000 });

        async function loadMarkdown(page, md) {
            await page.evaluate((markdown) => { window.setMarkdown(markdown); }, md);
            await page.waitForTimeout(600);
        }

        test('シンプルなテーブルのラウンドトリップでデータが失われない', async ({ app }) => {
            const original = [
                '| 名前 | 年齢 | 職業 |',
                '|------|------|------|',
                '| 田中 | 30   | エンジニア |',
                '| 山田 | 25   | デザイナー |',
                '| 鈴木 | 40   | マネージャー |',
            ].join('\n');

            await loadMarkdown(app.page, original);
            const saved = await app.page.evaluate(() => window.getMarkdown());
            await checkTableDataIntegrity(original, saved, '04-table: シンプルテーブル損失チェック');

            // DOM確認も合わせて実施
            await expect(app.page.locator('#editor table')).toHaveCount(1);
            await expect(app.page.locator('#editor tbody tr')).toHaveCount(3);
        });

        test('インライン装飾を含むテーブルのデータが失われない', async ({ app }) => {
            const original = [
                '| 項目 | 説明 |',
                '|------|------|',
                '| **重要** | *注意が必要* |',
                '| `code` | 通常テキスト |',
            ].join('\n');

            await loadMarkdown(app.page, original);
            const saved = await app.page.evaluate(() => window.getMarkdown());
            await checkTableDataIntegrity(original, saved, '04-table: インライン装飾テーブル損失チェック');
        });

        test('多列テーブルのラウンドトリップでデータが失われない', async ({ app }) => {
            const original = [
                '| A | B | C | D | E |',
                '|---|---|---|---|---|',
                '| 1 | 2 | 3 | 4 | 5 |',
                '| 6 | 7 | 8 | 9 | 10 |',
            ].join('\n');

            await loadMarkdown(app.page, original);
            const saved = await app.page.evaluate(() => window.getMarkdown());
            await checkTableDataIntegrity(original, saved, '04-table: 多列テーブル損失チェック');

            await expect(app.page.locator('#editor th')).toHaveCount(5);
            await expect(app.page.locator('#editor tbody tr')).toHaveCount(2);
        });

        test('日本語テキストを含むテーブルのデータが失われない', async ({ app }) => {
            const original = [
                '| カテゴリ | 内容 | 備考 |',
                '|----------|------|------|',
                '| 食料品 | りんご・バナナ | 季節によって変動 |',
                '| 日用品 | 洗剤・シャンプー | 定期購入 |',
                '| 電化製品 | スマートフォン | 年1回更新 |',
            ].join('\n');

            await loadMarkdown(app.page, original);
            const saved = await app.page.evaluate(() => window.getMarkdown());
            await checkTableDataIntegrity(original, saved, '04-table: 日本語テーブル損失チェック');
        });
    });
});
