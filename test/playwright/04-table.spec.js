// @ts-check
const { test, expect } = require('./fixtures');
const { checkTableDataIntegrity } = require('./copilotMarkdownValidator');
const fs = require('fs');
const path = require('path');

const EMPTY_LAST_ROW_FIXTURE = path.resolve(__dirname, '../../test_data/table_empty_last_row.md');

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

        test('Tabで移動したセルを編集できる', async ({ app }) => {
            const firstCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);
            const secondCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(1);

            await firstCell.click();
            await app.page.keyboard.press('Tab');
            await app.page.keyboard.type('Tab編集');

            await expect(secondCell).toContainText('Tab編集');
        });

        test('Tabでセル移動後に旧列選択の青色ハイライトが残らない', async ({ app }) => {
            const firstCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);

            await firstCell.click();
            await app.page.keyboard.press('Tab');

            const staleColumnSelectionCount = await app.page.locator(
                '#editor .col-anchor, #editor .col-selected'
            ).count();
            expect(staleColumnSelectionCount).toBe(0);
        });

        test('矢印キーで移動したセルを編集できる', async ({ app }) => {
            const upperCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(1);
            const lowerCell = app.page.locator('#editor table tbody tr').nth(1).locator('td').nth(1);

            await lowerCell.click();
            await app.page.keyboard.press('ArrowUp');
            await app.page.keyboard.type('上セル編集');

            await expect(upperCell).toContainText('上セル編集');
        });

        test('テーブルセル内でEnterしても表構造が崩れない', async ({ app }) => {
            const firstCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);
            await firstCell.click();

            await firstCell.evaluate(el => { el.textContent = ''; });
            await firstCell.click();
            await app.page.keyboard.type('行1');
            await app.page.keyboard.press('Enter');
            await app.page.keyboard.type('行2');
            await app.helpers.wait(200);

            // セル内改行は <br> で保持される
            const firstCellHtml = await firstCell.evaluate(el => /** @type {HTMLElement} */ (el).innerHTML);
            expect(firstCellHtml).toContain('<br>');

            // 保存・再読込しても表が分割/崩壊しない
            const saved = await app.page.evaluate(() => window.getMarkdown());
            await app.page.evaluate((md) => window.setMarkdown(md), saved);
            await app.helpers.wait(300);

            await expect(app.page.locator('#editor table')).toHaveCount(1);
            const headerCount = await app.page.locator('#editor table thead tr').first().locator('th').count();
            expect(headerCount).toBe(3);
            const bodyRowCount = await app.page.locator('#editor table tbody tr').count();
            expect(bodyRowCount).toBe(2);
        });

        test('左端セルを空にして再入力後Enterしても表構造が崩れない', async ({ app }) => {
            const firstCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);

            await firstCell.click();
            await app.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
            await app.page.keyboard.press('Backspace');
            await app.page.keyboard.type('再入力');
            await app.page.keyboard.press('Enter');
            await app.helpers.wait(200);

            await expect(app.page.locator('#editor table')).toHaveCount(1);
            await expect(app.page.locator('#editor table tbody tr')).toHaveCount(2);
            await expect(app.page.locator('#editor table tbody tr').nth(0).locator('td')).toHaveCount(3);
            await expect(app.page.locator('#editor table tbody tr').nth(1).locator('td')).toHaveCount(3);
            await expect(firstCell).toContainText('再入力');
        });

        test('左端セルをBackspaceで空にして「あ」入力後Enterしても表構造が崩れない', async ({ app }) => {
            const firstCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);

            await firstCell.click();
            await app.page.keyboard.press('End');
            await app.page.keyboard.press('Backspace');
            await app.page.keyboard.press('Backspace');
            await app.page.keyboard.press('Backspace');
            await app.page.keyboard.type('あ');
            await app.page.keyboard.press('Enter');
            await app.helpers.wait(200);

            await expect(app.page.locator('#editor table')).toHaveCount(1);
            await expect(app.page.locator('#editor table tbody tr')).toHaveCount(2);
            await expect(app.page.locator('#editor table tbody tr').nth(0).locator('td')).toHaveCount(3);
            await expect(app.page.locator('#editor table tbody tr').nth(1).locator('td')).toHaveCount(3);
            await expect(firstCell).toContainText('あ');
        });

        test('左端セルの左側をクリックしても編集後Enterで表構造が崩れない', async ({ app }) => {
            const firstCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);
            const box = await firstCell.boundingBox();
            expect(box).not.toBeNull();

            await firstCell.click({ position: { x: 4, y: box.height / 2 } });
            await app.page.keyboard.press('End');
            await app.page.keyboard.press('Backspace');
            await app.page.keyboard.press('Backspace');
            await app.page.keyboard.press('Backspace');
            await app.page.keyboard.type('あ');
            await app.page.keyboard.press('Enter');
            await app.helpers.wait(200);

            await expect(app.page.locator('#editor table')).toHaveCount(1);
            await expect(app.page.locator('#editor table tbody tr')).toHaveCount(2);
            await expect(app.page.locator('#editor table tbody tr').nth(0).locator('td')).toHaveCount(3);
            await expect(app.page.locator('#editor table tbody tr').nth(1).locator('td')).toHaveCount(3);
        });

        test('IME変換中のEnterでも表セルに既定のセル追加動作を適用しない', async ({ app }) => {
            const state = await app.page.evaluate(() => {
                const cell = document.querySelector('#editor table tbody tr td');
                const editorEl = document.getElementById('editor');
                if (!cell || !editorEl) return null;

                cell.textContent = 'あ';
                const range = document.createRange();
                range.selectNodeContents(cell);
                range.collapse(false);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);

                cell.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
                const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true });
                cell.dispatchEvent(enter);
                cell.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));

                return {
                    prevented: enter.defaultPrevented,
                    tableCount: editorEl.querySelectorAll('table').length,
                    rowCount: editorEl.querySelectorAll('table tbody tr').length,
                    cellCount: editorEl.querySelectorAll('table tbody tr:first-child td').length,
                };
            });

            expect(state).not.toBeNull();
            expect(state.prevented).toBe(true);
            expect(state.tableCount).toBe(1);
            expect(state.rowCount).toBe(2);
            expect(state.cellCount).toBe(3);
        });

        test('表境界をまたぐRangeでEnterしても表構造を維持する', async ({ app }) => {
            const state = await app.page.evaluate(() => {
                const editorEl = document.getElementById('editor');
                const table = editorEl?.querySelector('table');
                const cell = table?.querySelector('tbody tr td');
                if (!editorEl || !table || !cell) return null;

                const outside = document.createElement('p');
                outside.textContent = '外側';
                editorEl.appendChild(outside);

                const range = document.createRange();
                range.selectNodeContents(cell);
                range.setEndAfter(outside);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);

                const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
                cell.dispatchEvent(enter);

                return {
                    prevented: enter.defaultPrevented,
                    tableCount: editorEl.querySelectorAll('table').length,
                    rowCount: table.querySelectorAll('tbody tr').length,
                    firstRowCellCount: table.querySelectorAll('tbody tr:first-child td').length,
                    outsideText: outside.textContent,
                };
            });

            expect(state).not.toBeNull();
            expect(state.prevented).toBe(true);
            expect(state.tableCount).toBe(1);
            expect(state.rowCount).toBe(2);
            expect(state.firstRowCellCount).toBe(3);
            expect(state.outsideText).toBe('外側');
        });

        test('セル選択状態（col-anchor）でEnterしても表構造が崩れない', async ({ app }) => {
            // セル内容を単純化
            const firstCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);
            await firstCell.evaluate(el => { el.textContent = '1'; });

            // キャレットを tr 起点にして、セル選択寄りの状態を再現
            await app.page.evaluate(() => {
                const row = document.querySelector('#editor table tbody tr');
                const sel = window.getSelection();
                const range = document.createRange();
                range.setStart(row, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);

                const first = row.querySelector('td');
                if (first) first.classList.add('col-anchor');
            });

            await app.page.keyboard.press('Enter');
            await app.helpers.wait(150);

            await expect(app.page.locator('#editor table')).toHaveCount(1);
            const headerCount = await app.page.locator('#editor table thead tr').first().locator('th').count();
            expect(headerCount).toBe(3);
            const bodyRowCount = await app.page.locator('#editor table tbody tr').count();
            expect(bodyRowCount).toBe(2);

            const firstCellHtml = await app.page.locator('#editor table tbody tr').first().locator('td').first()
                .evaluate(el => /** @type {HTMLElement} */ (el).innerHTML);
            expect(firstCellHtml).toContain('<br>');
        });

        test('複数セル入力後に行2列1でEnterしてもテーブル分割や列ズレが起きない', async ({ app }) => {
            const row1col1 = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);
            const row1col2 = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(1);
            const row1col3 = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(2);
            const row2col1 = app.page.locator('#editor table tbody tr').nth(1).locator('td').nth(0);

            await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                const r1 = rows[0];
                const r2 = rows[1];
                if (!r1 || !r2) return;

                const r1cells = r1.querySelectorAll('td');
                const r2cells = r2.querySelectorAll('td');
                if (r1cells[0]) r1cells[0].textContent = '1';
                if (r1cells[1]) r1cells[1].textContent = '3';
                if (r1cells[2]) r1cells[2].textContent = '4';
                if (r2cells[0]) r2cells[0].textContent = '2';
            });

            await row2col1.click();

            await app.page.keyboard.press('Enter');
            await app.helpers.wait(200);

            // 症状再現時は table が2つに分割されるため、まず件数を厳密に固定
            await expect(app.page.locator('#editor table')).toHaveCount(1);

            const headerCount = await app.page.locator('#editor table thead tr').first().locator('th').count();
            expect(headerCount).toBe(3);

            const firstBodyRowCells = await app.page.locator('#editor table tbody tr').nth(0).locator('td').count();
            const secondBodyRowCells = await app.page.locator('#editor table tbody tr').nth(1).locator('td').count();
            expect(firstBodyRowCells).toBe(3);
            expect(secondBodyRowCells).toBe(3);

            const r1c1Text = await row1col1.innerText();
            const r1c2Text = await row1col2.innerText();
            const r1c3Text = await row1col3.innerText();
            const r2c1Html = await row2col1.evaluate(el => /** @type {HTMLElement} */ (el).innerHTML);

            expect(r1c1Text.trim()).toContain('1');
            expect(r1c2Text.trim()).toContain('3');
            expect(r1c3Text.trim()).toContain('4');
            expect(r2c1Html).toContain('2');
            expect(r2c1Html).toContain('<br>');
        });

        test('テーブルセルを右クリックでコンテキストメニューが表示される', async ({ app }) => {
            const firstCell = app.page.locator('#editor table td').first();
            await firstCell.click({ button: 'right' });
            await app.helpers.wait(300);

            const menu = app.page.locator('#tableContextMenu');
            await expect(menu).toBeVisible();
        });

        test('マウスドラッグの矩形選択でコピー時にTSVが生成される', async ({ app }) => {
            await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                const r1 = rows[0];
                const r2 = rows[1];
                if (!r1 || !r2) return;
                r1.children[0].textContent = 'A';
                r1.children[1].textContent = 'B';
                r2.children[0].textContent = 'C';
                r2.children[1].textContent = 'D';
            });

            await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                const start = rows[0]?.children[0];
                const end = rows[1]?.children[1];
                if (!start || !end) return;

                start.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
                end.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
                document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            });

            const copied = await app.page.evaluate(() => {
                const store = {};
                const clipboardData = {
                    setData: (type, value) => { store[type] = value; },
                    getData: (type) => store[type] || '',
                };
                const ev = new Event('copy', { bubbles: true, cancelable: true });
                Object.defineProperty(ev, 'clipboardData', { value: clipboardData });
                const editorEl = document.getElementById('editor');
                editorEl.dispatchEvent(ev);
                return {
                    prevented: ev.defaultPrevented,
                    text: store['text/plain'] || '',
                };
            });

            expect(copied.prevented).toBe(true);
            expect(copied.text).toBe('A\tB\nC\tD');
        });
        test('実マウスのドラッグ後も矩形選択が保持されcopyできる', async ({ app }) => {
            await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                const r1 = rows[0];
                const r2 = rows[1];
                if (!r1 || !r2) return;
                r1.children[0].textContent = 'AA';
                r1.children[1].textContent = 'BB';
                r2.children[0].textContent = 'CC';
                r2.children[1].textContent = 'DD';
            });

            const startCell = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);
            const endCell = app.page.locator('#editor table tbody tr').nth(1).locator('td').nth(1);
            const startBox = await startCell.boundingBox();
            const endBox = await endCell.boundingBox();
            expect(startBox).not.toBeNull();
            expect(endBox).not.toBeNull();

            await app.page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
            await app.page.mouse.down();
            await app.page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
            await app.page.mouse.up();

            const selectedCount = await app.page.evaluate(() => {
                const anchors = document.querySelectorAll('#editor .rect-anchor').length;
                const selected = document.querySelectorAll('#editor .rect-selected').length;
                return anchors + selected;
            });
            expect(selectedCount).toBeGreaterThan(1);

            const nativeSelectionRangeCount = await app.page.evaluate(() => window.getSelection()?.rangeCount || 0);
            expect(nativeSelectionRangeCount).toBe(0);

            const copied = await app.page.evaluate(() => {
                const store = {};
                const clipboardData = {
                    setData: (type, value) => { store[type] = value; },
                    getData: (type) => store[type] || '',
                };
                const ev = new Event('copy', { bubbles: true, cancelable: true });
                Object.defineProperty(ev, 'clipboardData', { value: clipboardData });
                const editorEl = document.getElementById('editor');
                editorEl.dispatchEvent(ev);
                return { prevented: ev.defaultPrevented, text: store['text/plain'] || '' };
            });

            expect(copied.prevented).toBe(true);
            expect(copied.text).toBe('AA\tBB\nCC\tDD');
        });

        test('矩形選択中の貼り付けはセル範囲へ適用され、既存テーブル構造を維持する', async ({ app }) => {
            await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                const start = rows[0]?.children[0];
                const end = rows[1]?.children[1];
                if (!start || !end) return;

                start.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
                end.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
                document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            });

            const pasted = await app.page.evaluate(() => {
                const clipboardData = {
                    getData: (type) => {
                        if (type === 'text/plain') return '11\t22\n33\t44';
                        return '';
                    },
                };
                const ev = new Event('paste', { bubbles: true, cancelable: true });
                Object.defineProperty(ev, 'clipboardData', { value: clipboardData });
                const editorEl = document.getElementById('editor');
                editorEl.dispatchEvent(ev);
                return ev.defaultPrevented;
            });

            expect(pasted).toBe(true);

            const values = await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                return [
                    rows[0]?.children[0]?.innerText?.trim() || '',
                    rows[0]?.children[1]?.innerText?.trim() || '',
                    rows[1]?.children[0]?.innerText?.trim() || '',
                    rows[1]?.children[1]?.innerText?.trim() || '',
                ];
            });

            expect(values).toEqual(['11', '22', '33', '44']);
            await expect(app.page.locator('#editor table')).toHaveCount(1);
        });

        test('矩形選択後もShift+クリックの列選択は従来どおり動作する', async ({ app }) => {
            await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                const start = rows[0]?.children[0];
                const end = rows[1]?.children[1];
                if (!start || !end) return;

                start.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
                end.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
                document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            });

            const cell11 = app.page.locator('#editor table tbody tr').nth(0).locator('td').nth(0);
            const cell21 = app.page.locator('#editor table tbody tr').nth(1).locator('td').nth(0);

            await cell11.click();
            await app.page.keyboard.down('Shift');
            await cell21.click();
            await app.page.keyboard.up('Shift');

            const state = await app.page.evaluate(() => {
                const rows = document.querySelectorAll('#editor table tbody tr');
                const a = rows[0]?.children[0];
                const b = rows[1]?.children[0];
                return {
                    anchor: !!a?.classList.contains('col-anchor'),
                    selected: !!b?.classList.contains('col-selected'),
                    rectLeft: document.querySelectorAll('#editor .rect-selected, #editor .rect-anchor').length,
                };
            });

            expect(state.anchor).toBe(true);
            expect(state.selected).toBe(true);
            expect(state.rectLeft).toBe(0);
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

        test('空の最終行を含むテーブルが潰れない', async ({ app }) => {
            const original = fs.readFileSync(EMPTY_LAST_ROW_FIXTURE, 'utf8');

            await loadMarkdown(app.page, original);

            const emptyRow = app.page.locator('#editor table tbody tr').last();
            await expect(emptyRow).toBeVisible();

            const lastRowCells = emptyRow.locator('td, th');
            await expect(lastRowCells).toHaveCount(3);

            const cellText = await lastRowCells.nth(0).innerText();
            expect(cellText.trim()).toBe('');

            const cellHtml = await lastRowCells.nth(0).evaluate(el => /** @type {HTMLElement} */ (el).innerHTML);
            expect(cellHtml).toContain('&nbsp;');
        });
    });
});
