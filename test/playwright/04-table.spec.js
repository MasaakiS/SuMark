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

        test('右クリックメニューで列を右揃えでき、Markdownに保持される', async ({ app }) => {
            const targetCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(1);
            await targetCell.click({ button: 'right' });
            await app.helpers.wait(150);

            await app.page.locator('#tableContextMenu button[data-action="alignRight"]').click();
            await app.helpers.wait(200);

            const styleAlign = await targetCell.evaluate(el => {
                const node = /** @type {HTMLElement} */ (el);
                return node.style.textAlign;
            });
            expect(styleAlign).toBe('right');

            const md = await app.page.evaluate(() => window.getMarkdown());
            expect(md).toContain('| --- | ---: | --- |');
        });

        test('右揃え列は保存後の再読込でも表示が維持される', async ({ app }) => {
            const targetCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(2);
            await targetCell.click({ button: 'right' });
            await app.helpers.wait(120);
            await app.page.locator('#tableContextMenu button[data-action="alignRight"]').click();
            await app.helpers.wait(180);

            const saved = await app.page.evaluate(() => window.getMarkdown());
            await app.page.evaluate((md) => window.setMarkdown(md), saved);
            await app.helpers.wait(300);

            const reloadedCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(2);
            const reloadedAlign = await reloadedCell.evaluate(el => {
                const node = /** @type {HTMLElement} */ (el);
                const inline = node.style.textAlign;
                const attr = node.getAttribute('align') || '';
                const computed = window.getComputedStyle(node).textAlign;
                return { inline, attr, computed };
            });

            expect(reloadedAlign.attr.toLowerCase()).toBe('right');
            expect(['right', '-webkit-right']).toContain(reloadedAlign.computed.toLowerCase());
        });

        test('列揃え設定は後から追加した行にも継承される', async ({ app }) => {
            const targetCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(2);
            await targetCell.click({ button: 'right' });
            await app.helpers.wait(120);
            await app.page.locator('#tableContextMenu button[data-action="alignRight"]').click();
            await app.helpers.wait(150);

            await targetCell.click({ button: 'right' });
            await app.helpers.wait(120);
            await app.page.locator('#tableContextMenu button[data-action="addRowBelow"]').click();
            await app.helpers.wait(180);

            const newRowCell = app.page.locator('#editor table tbody tr').nth(1).locator('td').nth(2);
            const state = await newRowCell.evaluate(el => {
                const node = /** @type {HTMLElement} */ (el);
                return {
                    attr: (node.getAttribute('align') || '').toLowerCase(),
                    computed: (window.getComputedStyle(node).textAlign || '').toLowerCase(),
                };
            });

            expect(state.attr).toBe('right');
            expect(['right', '-webkit-right']).toContain(state.computed);
        });

        test('左端ハンドル領域のドラッグで行を並べ替えできる', async ({ app }) => {
            const rows = app.page.locator('#editor table tbody tr');
            const row1Cell = rows.nth(0).locator('td').nth(0);
            const row2Cell = rows.nth(1).locator('td').nth(0);

            await row1Cell.evaluate(el => { el.textContent = '行A'; });
            await row2Cell.evaluate(el => { el.textContent = '行B'; });

            const fromBox = await row2Cell.boundingBox();
            const toBox = await row1Cell.boundingBox();
            expect(fromBox).not.toBeNull();
            expect(toBox).not.toBeNull();

            await app.page.mouse.move(fromBox.x + 6, fromBox.y + fromBox.height / 2);
            await app.page.mouse.down();
            await app.page.mouse.move(toBox.x + 6, toBox.y + 4, { steps: 8 });
            await app.page.mouse.up();
            await app.helpers.wait(250);

            const firstText = await rows.nth(0).locator('td').nth(0).innerText();
            const secondText = await rows.nth(1).locator('td').nth(0).innerText();
            expect(firstText).toContain('行B');
            expect(secondText).toContain('行A');
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
