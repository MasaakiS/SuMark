/**
 * 08-roundtrip.spec.js
 *
 * 保存 → 再オープン ラウンドトリップテスト
 *
 * ブラウザモードでは Tauri のファイルシステム API は使えないため、
 * グローバル関数 getMarkdown() / setMarkdown() を使って
 * 「HTML → Markdown → HTML」変換の往復を検証する。
 *
 * テストの流れ:
 *   1. setMarkdown(md) でコンテンツを挿入（ファイルを開く相当）
 *   2. getMarkdown() でMarkdownを取得（ファイルを保存する相当）
 *   3. setMarkdown(取得したMarkdown) で再描画（再度ファイルを開く相当）
 *   4. 期待する DOM 構造が保持されているか検証
 */

const { test, expect } = require('./fixtures');
const { validateMarkdownWithCopilot, checkSemanticEquivalence } = require('./copilotMarkdownValidator');

// ページ上で setMarkdown() を呼んで描画完了を待つヘルパー
async function loadMarkdown(page, md) {
    await page.evaluate((markdown) => {
        window.setMarkdown(markdown);
    }, md);
    // KaTeX / Mermaid レンダリング等が完了するまで待つ
    await page.waitForTimeout(800);
}

// ページ上で getMarkdown() を呼んで返す
async function dumpMarkdown(page) {
    const saved = await page.evaluate(() => window.getMarkdown());
    await validateMarkdownWithCopilot(saved, { source: '08-roundtrip.spec.js:dumpMarkdown' });
    return saved;
}

// フルラウンドトリップ: md → setMarkdown → getMarkdown → setMarkdown → 検証コールバック
async function roundtrip(page, markdown) {
    await loadMarkdown(page, markdown);
    const saved = await dumpMarkdown(page);
    await loadMarkdown(page, saved);
    return saved;
}

test.describe('保存・再オープン ラウンドトリップテスト', () => {

    // ─────────────────────────────────────────────
    // 見出し
    // ─────────────────────────────────────────────
    test.describe('見出し', () => {
        test('H1 が保持される', async ({ app }) => {
            await roundtrip(app.page, '# 見出し1');
            const h1 = app.page.locator('#editor h1');
            await expect(h1).toHaveCount(1);
            await expect(h1).toContainText('見出し1');
        });

        test('H1〜H3 が順番通りに保持される', async ({ app }) => {
            const md = '# H1\n\n## H2\n\n### H3';
            await roundtrip(app.page, md);
            await expect(app.page.locator('#editor h1')).toHaveCount(1);
            await expect(app.page.locator('#editor h2')).toHaveCount(1);
            await expect(app.page.locator('#editor h3')).toHaveCount(1);
        });
    });

    // ─────────────────────────────────────────────
    // 箇条書き・番号付きリスト
    // ─────────────────────────────────────────────
    test.describe('リスト', () => {
        test('箇条書きが保持される', async ({ app }) => {
            const md = '- アイテムA\n- アイテムB\n- アイテムC';
            await roundtrip(app.page, md);
            const items = app.page.locator('#editor ul li');
            await expect(items).toHaveCount(3);
            await expect(items.nth(0)).toContainText('アイテムA');
            await expect(items.nth(2)).toContainText('アイテムC');
        });

        test('番号付きリストが保持される', async ({ app }) => {
            const md = '1. 最初\n2. 次\n3. 最後';
            await roundtrip(app.page, md);
            const items = app.page.locator('#editor ol li');
            await expect(items).toHaveCount(3);
            await expect(items.nth(0)).toContainText('最初');
        });
    });

    // ─────────────────────────────────────────────
    // タスクリスト
    // ─────────────────────────────────────────────
    test.describe('タスクリスト', () => {
        test('未チェックのタスクが保持される', async ({ app }) => {
            const md = '- [ ] 未完了タスク';
            await roundtrip(app.page, md);
            const cb = app.page.locator('#editor input[type="checkbox"]').first();
            await expect(cb).not.toBeChecked();
            const li = app.page.locator('#editor li').first();
            await expect(li).toContainText('未完了タスク');
        });

        test('チェック済みのタスクが保持される', async ({ app }) => {
            const md = '- [x] 完了済みタスク';
            await roundtrip(app.page, md);
            const cb = app.page.locator('#editor input[type="checkbox"]').first();
            await expect(cb).toBeChecked();
            const li = app.page.locator('#editor li').first();
            await expect(li).toContainText('完了済みタスク');
        });

        test('混合タスクリストが保持される', async ({ app }) => {
            const md = '- [x] 完了\n- [ ] 未完了';
            await roundtrip(app.page, md);
            const checkboxes = app.page.locator('#editor input[type="checkbox"]');
            await expect(checkboxes).toHaveCount(2);
            await expect(checkboxes.nth(0)).toBeChecked();
            await expect(checkboxes.nth(1)).not.toBeChecked();
        });

        test('チェックボックスのクリックがMarkdownに反映される', async ({ app }) => {
            // 未チェックのタスクを作成
            const md = '- [ ] タスク';
            await app.page.evaluate((markdown) => window.setMarkdown(markdown), md);
            await app.helpers.wait(500);

            // チェックボックスをクリック
            const cb = app.page.locator('#editor input[type="checkbox"]').first();
            await expect(cb).not.toBeChecked();
            await cb.click();
            await app.helpers.wait(300);

            // Markdownを取得してチェック状態が反映されているか確認
            const resultMd = await app.page.evaluate(() => window.getMarkdown());
            expect(resultMd).toContain('- [x] タスク');
        });

        test('チェック済みタスクのチェックを外すとMarkdownに反映される', async ({ app }) => {
            // チェック済みタスクを作成
            const md = '- [x] 完了タスク';
            await app.page.evaluate((markdown) => window.setMarkdown(markdown), md);
            await app.helpers.wait(500);

            // チェックボックスをクリックしてチェックを外す
            const cb = app.page.locator('#editor input[type="checkbox"]').first();
            await expect(cb).toBeChecked();
            await cb.click();
            await app.helpers.wait(300);

            // Markdownを取得してチェックが外れているか確認
            const resultMd = await app.page.evaluate(() => window.getMarkdown());
            expect(resultMd).toContain('- [ ] 完了タスク');
        });

        test('チェック済みタスクを保存して再オープンしても重複しない', async ({ app }) => {
            // チェック済みタスクを作成してMarkdownを取得（保存相当）
            const md = '- [x] 完了タスク';
            await app.page.evaluate((markdown) => window.setMarkdown(markdown), md);
            await app.helpers.wait(500);
            const savedMd = await app.page.evaluate(() => window.getMarkdown());
            
            // 再度読み込み（再オープン相当）
            await app.page.evaluate((markdown) => window.setMarkdown(markdown), savedMd);
            await app.helpers.wait(500);
            
            // チェックボックスが1つだけ存在することを確認（重複していない）
            const checkboxes = app.page.locator('#editor input[type="checkbox"]');
            await expect(checkboxes).toHaveCount(1);
            
            // リストアイテムも1つだけ
            const listItems = app.page.locator('#editor li');
            await expect(listItems).toHaveCount(1);
        });

        test('テキストなしのタスクリストが正しく保持される', async ({ app }) => {
            // テキストありとテキストなしの混合タスクリスト
            const md = '- [x] fdfd\n- [x] ';
            await app.page.evaluate((markdown) => window.setMarkdown(markdown), md);
            await app.helpers.wait(500);

            // 両方チェックボックスとして表示されること
            const checkboxes = app.page.locator('#editor input[type="checkbox"]');
            await expect(checkboxes).toHaveCount(2);

            // getMarkdown() して再度読み込み
            const savedMd = await app.page.evaluate(() => window.getMarkdown());
            await app.page.evaluate((markdown) => window.setMarkdown(markdown), savedMd);
            await app.helpers.wait(500);

            // 再オープン後も両方チェックボックスとして表示されること
            const checkboxes2 = app.page.locator('#editor input[type="checkbox"]');
            await expect(checkboxes2).toHaveCount(2);
        });

        test('- [x] (スペースなし)が正しくタスクリストとして表示される', async ({ app }) => {
            // 外部ファイルから読み込まれる可能性のある形式
            const md = '- [x] fdfd\n- [x]';
            await app.page.evaluate((markdown) => window.setMarkdown(markdown), md);
            await app.helpers.wait(500);

            // 両方チェックボックスとして表示されること
            const checkboxes = app.page.locator('#editor input[type="checkbox"]');
            await expect(checkboxes).toHaveCount(2);
        });

        test('タスクリスト内の改行(BR)が保存後も保持される', async ({ app }) => {
            // BR を含むタスクリストの HTML をセット
            const html = '<ul><li><input type="checkbox"> 1</li><li><input type="checkbox"> 2<br>3</li><li><input type="checkbox"> 4</li></ul>';
            await app.page.evaluate((h) => {
                document.getElementById('editor').innerHTML = h;
            }, html);
            await app.helpers.wait(300);

            // Markdown に変換
            const md = await app.page.evaluate(() => getMarkdown());

            // Markdownで「2」と「3」が別行になっていることを検証
            const lines = md.split('\n');
            const idx = lines.findIndex(line => line.includes('- [ ] 2'));
            expect(lines[idx + 1].trim()).toBe('3');

            // Markdown を再セット（ファイル保存→再オープンを模擬）
            await app.page.evaluate((m) => setMarkdown(m), md);
            await app.helpers.wait(300);

            // チェックボックスが 3 つ保持されること
            const checkboxes = app.page.locator('#editor input[type="checkbox"]');
            await expect(checkboxes).toHaveCount(3);

            // アイテム 2 に BR が保持されること
            const item2 = app.page.locator('#editor li:nth-child(2)');
            const hasBr = await item2.evaluate(el => !!el.querySelector('br'));
            expect(hasBr).toBe(true);
        });
    });

    // ─────────────────────────────────────────────
    // 改行 (BR) ラウンドトリップ
    // ─────────────────────────────────────────────
    test.describe('改行 (BR) ラウンドトリップ', () => {
        test('通常リスト内の改行が保持される', async ({ app }) => {
            const html = '<ul><li>item1<br>continued</li><li>item2</li></ul>';
            await app.page.evaluate((h) => {
                document.getElementById('editor').innerHTML = h;
            }, html);
            await app.helpers.wait(300);

            const md = await app.page.evaluate(() => getMarkdown());
            await app.page.evaluate((m) => setMarkdown(m), md);
            await app.helpers.wait(300);

            const item1 = app.page.locator('#editor li').first();
            const hasBr = await item1.evaluate(el => !!el.querySelector('br'));
            expect(hasBr).toBe(true);
            await expect(item1).toContainText('item1');
            await expect(item1).toContainText('continued');
        });

        test('引用内の改行が保持される', async ({ app }) => {
            const html = '<blockquote><p>line1<br>line2</p></blockquote>';
            await app.page.evaluate((h) => {
                document.getElementById('editor').innerHTML = h;
            }, html);
            await app.helpers.wait(300);

            const md = await app.page.evaluate(() => getMarkdown());
            await app.page.evaluate((m) => setMarkdown(m), md);
            await app.helpers.wait(300);

            const hasBr = await app.page.evaluate(() => {
                return !!document.querySelector('#editor blockquote br');
            });
            expect(hasBr).toBe(true);
        });

        test('段落内の改行が保持される', async ({ app }) => {
            const html = '<p>line1<br>line2</p>';
            await app.page.evaluate((h) => {
                document.getElementById('editor').innerHTML = h;
            }, html);
            await app.helpers.wait(300);

            const md = await app.page.evaluate(() => getMarkdown());
            await app.page.evaluate((m) => setMarkdown(m), md);
            await app.helpers.wait(300);

            const hasBr = await app.page.evaluate(() => {
                return !!document.querySelector('#editor p br');
            });
            expect(hasBr).toBe(true);
        });
    });

    // ─────────────────────────────────────────────
    // 文字装飾
    // ─────────────────────────────────────────────
    test.describe('文字装飾', () => {
        test('太字が保持される', async ({ app }) => {
            await roundtrip(app.page, '**太字テキスト**');
            const bold = app.page.locator('#editor strong, #editor b').first();
            await expect(bold).toContainText('太字テキスト');
        });

        test('斜体が保持される', async ({ app }) => {
            await roundtrip(app.page, '*斜体テキスト*');
            const italic = app.page.locator('#editor em, #editor i').first();
            await expect(italic).toContainText('斜体テキスト');
        });

        test('インラインコードが保持される', async ({ app }) => {
            await roundtrip(app.page, '`const x = 1;`');
            const code = app.page.locator('#editor code').first();
            await expect(code).toContainText('const x = 1;');
        });

        test('取り消し線が保持される', async ({ app }) => {
            // setMarkdown() で ~~text~~ が <del> にレンダリングされるか確認
            await loadMarkdown(app.page, '~~削除済み~~');
            const del = app.page.locator('#editor del').first();
            await expect(del).toContainText('削除済み');
        });
    });

    // ─────────────────────────────────────────────
    // 引用
    // ─────────────────────────────────────────────
    test.describe('引用', () => {
        test('blockquote が保持される', async ({ app }) => {
            await roundtrip(app.page, '> 引用テキスト');
            const bq = app.page.locator('#editor blockquote');
            await expect(bq).toHaveCount(1);
            await expect(bq).toContainText('引用テキスト');
        });
    });

    // ─────────────────────────────────────────────
    // テーブル
    // ─────────────────────────────────────────────
    test.describe('テーブル', () => {
        test('テーブル構造が保持される', async ({ app }) => {
            const md = [
                '| 名前 | 年齢 |',
                '|------|------|',
                '| 田中 | 30   |',
                '| 山田 | 25   |',
            ].join('\n');
            await roundtrip(app.page, md);

            await expect(app.page.locator('#editor table')).toHaveCount(1);
            // ヘッダー行
            const th = app.page.locator('#editor th');
            await expect(th).toHaveCount(2);
            // データ行
            const rows = app.page.locator('#editor tbody tr');
            await expect(rows).toHaveCount(2);
            // セルの内容
            await expect(app.page.locator('#editor td').nth(0)).toContainText('田中');
            await expect(app.page.locator('#editor td').nth(2)).toContainText('山田');
        });
    });

    // ─────────────────────────────────────────────
    // コードブロック
    // ─────────────────────────────────────────────
    test.describe('コードブロック', () => {
        test('コードブロックの内容が保持される', async ({ app }) => {
            const md = '```javascript\nconsole.log("hello");\n```';
            await roundtrip(app.page, md);
            const pre = app.page.locator('#editor pre').first();
            await expect(pre).toContainText('console.log');
        });

        test('保存後の再オープンでもコードブロックヘッダーが崩れない', async ({ app }) => {
            const md = '```javascript\nconsole.log("roundtrip");\n```';
            await roundtrip(app.page, md);

            await app.helpers.assertStackedCodeBlockLayout('#editor');

            const langSelectCount = await app.page.locator('#editor .code-block-toolbar .code-lang-select').count();
            const copyBtnCount = await app.page.locator('#editor .code-block-toolbar .code-copy-btn').count();

            expect(langSelectCount).toBeGreaterThan(0);
            expect(copyBtnCount).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────
    // インライン数式 (KaTeX)
    // ─────────────────────────────────────────────
    test.describe('数式', () => {
        test('インライン数式が Markdown として保持される', async ({ app }) => {
            // setMarkdown() は marked.parse() を使うが KaTeX のリアルタイムレンダリングは
            // ユーザー入力時にのみ行われるため、DOM の .math-inline ではなく
            // getMarkdown() で返る Markdown テキストに $ が含まれることを検証する
            const md = '数式: $E=mc^2$ です';
            await loadMarkdown(app.page, md);
            const saved = await dumpMarkdown(app.page);
            // $ 記法が Markdown に残っているかチェック
            expect(saved).toContain('$');
        });
    });

    // ─────────────────────────────────────────────
    // 複合コンテンツ
    // ─────────────────────────────────────────────
    test.describe('複合コンテンツ', () => {
        test('複数の要素が混在するドキュメントが保持される', async ({ app }) => {
            const md = [
                '# ドキュメントタイトル',
                '',
                '**重要**: これはサンプル文書です。',
                '',
                '## セクション1',
                '',
                '- 箇条書き1',
                '- 箇条書き2',
                '',
                '## セクション2',
                '',
                '| 項目 | 値 |',
                '|------|-----|',
                '| A    | 100 |',
                '',
                '> 引用文',
                '',
                '```python',
                'print("done")',
                '```',
            ].join('\n');

            await roundtrip(app.page, md);

            await expect(app.page.locator('#editor h1')).toHaveCount(1);
            await expect(app.page.locator('#editor h2')).toHaveCount(2);
            await expect(app.page.locator('#editor ul li')).toHaveCount(2);
            await expect(app.page.locator('#editor table')).toHaveCount(1);
            await expect(app.page.locator('#editor blockquote')).toHaveCount(1);
            await expect(app.page.locator('#editor pre')).toHaveCount(1);
        });
    });

    // ─────────────────────────────────────────────
    // Markdown 文字列の安定性（2回変換後の一致）
    // ─────────────────────────────────────────────
    test.describe('Markdown テキストの安定性', () => {
        test('保存されたMarkdownを再変換しても同じMarkdownになる', async ({ app }) => {
            const original = [
                '# タイトル',
                '',
                '- アイテム1',
                '- アイテム2',
            ].join('\n');

            // 1回目の変換
            await loadMarkdown(app.page, original);
            const firstSave = await dumpMarkdown(app.page);

            // 2回目の変換
            await loadMarkdown(app.page, firstSave);
            const secondSave = await dumpMarkdown(app.page);

            // 2回目と3回目が一致する（安定している）
            expect(secondSave).toBe(firstSave);
        });
    });

    // ─────────────────────────────────────────────
    // 入れ子コンテンツ
    // ─────────────────────────────────────────────
    test.describe('入れ子コンテンツ', () => {
        test('引用の中のリストが保持される', async ({ app }) => {
            const md = '> - リストitem1\n> - リストitem2';
            await roundtrip(app.page, md);
            const bq = app.page.locator('#editor blockquote');
            await expect(bq).toHaveCount(1);
            await expect(bq.locator('li')).toHaveCount(2);
        });

        test('引用の中のコードブロックが保持される', async ({ app }) => {
            const md = '> ```javascript\n> console.log("hello");\n> ```';
            await roundtrip(app.page, md);
            const bq = app.page.locator('#editor blockquote');
            await expect(bq).toHaveCount(1);
            await expect(bq.locator('pre')).toHaveCount(1);
            await expect(bq.locator('code')).toContainText('console.log');
        });

        test('ネストリストが保持される', async ({ app }) => {
            const md = '- 親\n  - 子\n    - 孫';
            await roundtrip(app.page, md);
            // 3項目が存在する
            const items = app.page.locator('#editor li');
            await expect(items).toHaveCount(3);
            // 入れ子の ul が存在する
            const nestedUl = app.page.locator('#editor ul ul');
            await expect(nestedUl.first()).toBeVisible();
        });

        test('テーブルセル内のインラインコードが保持される', async ({ app }) => {
            const md = '| `code` | plain |\n|--------|-------|\n| cell   | cell  |';
            await roundtrip(app.page, md);
            // th または td 内に code がある
            const code = app.page.locator('#editor th code, #editor td code');
            await expect(code).toHaveCount(1);
            await expect(code.first()).toContainText('code');
        });

        test('テーブルセル内の太字が保持される', async ({ app }) => {
            const md = '| **太字** | plain |\n|----------|-------|\n| cell     | cell  |';
            await roundtrip(app.page, md);
            const strong = app.page.locator('#editor th strong, #editor td strong');
            await expect(strong).toHaveCount(1);
            await expect(strong.first()).toContainText('太字');
        });

        test('テーブルセル内の斜体が保持される', async ({ app }) => {
            const md = '| *斜体* | plain |\n|--------|-------|\n| cell   | cell  |';
            await roundtrip(app.page, md);
            const em = app.page.locator('#editor th em, #editor td em');
            await expect(em).toHaveCount(1);
            await expect(em.first()).toContainText('斜体');
        });

        test('テーブルセル内の数式テキストが保持される', async ({ app }) => {
            // KaTeX はユーザー入力時のみレンダリングされるため、
            // setMarkdown() は $ をテキストとして保持する
            const md = '| $E=mc^2$ | plain |\n|----------|-------|\n| cell     | cell  |';
            await loadMarkdown(app.page, md);
            const saved = await dumpMarkdown(app.page);
            expect(saved).toContain('$');
        });
    });

    // ─────────────────────────────────────────────
    // テーブルセル内のブロック要素禁止
    // ─────────────────────────────────────────────
    test.describe('テーブルセル内のブロック要素禁止', () => {
        // ヘルパー：テーブルをロードしてセルにフォーカス
        async function focusFirstTableCell(page) {
            await loadMarkdown(page, '| セル |\n|------|\n| 内容 |');
            await page.locator('#editor td').first().click();
            await page.waitForTimeout(200);
        }

        test('コードブロックボタンがテーブルセル内で使用不可（警告バナー確認）', async ({ app }) => {
            await focusFirstTableCell(app.page);

            await app.page.evaluate(() => window.insertCodeBlock());
            await app.page.waitForTimeout(200);

            // 警告バナーが表示され、メッセージにコードブロックが含まれる
            const banner = app.page.locator('[data-banner-type="warn"]');
            await expect(banner).toBeVisible();
            await expect(banner).toContainText('コードブロック');
            // テーブル内に pre が生成されていないことを確認
            await expect(app.page.locator('#editor table pre')).toHaveCount(0);
        });

        test('水平線ボタンがテーブルセル内で使用不可（警告バナー確認）', async ({ app }) => {
            await focusFirstTableCell(app.page);

            await app.page.evaluate(() => window.insertHorizontalRule());
            await app.page.waitForTimeout(200);

            const banner = app.page.locator('[data-banner-type="warn"]');
            await expect(banner).toBeVisible();
            await expect(banner).toContainText('水平線');
            // テーブル内に hr が生成されていないことを確認
            await expect(app.page.locator('#editor table hr')).toHaveCount(0);
        });

        test('トグルボタンがテーブルセル内で使用不可（警告バナー確認）', async ({ app }) => {
            await focusFirstTableCell(app.page);

            await app.page.evaluate(() => window.insertToggle());
            await app.page.waitForTimeout(200);

            const banner = app.page.locator('[data-banner-type="warn"]');
            await expect(banner).toBeVisible();
            await expect(banner).toContainText('トグル');
            // テーブル内に details が生成されていないことを確認
            await expect(app.page.locator('#editor table details')).toHaveCount(0);
        });

        test('引用ボタンがテーブルセル内で使用不可（警告バナー確認）', async ({ app }) => {
            await focusFirstTableCell(app.page);

            await app.page.evaluate(() => window.applyBlockquote());
            await app.page.waitForTimeout(200);

            const banner = app.page.locator('[data-banner-type="warn"]');
            await expect(banner).toBeVisible();
            await expect(banner).toContainText('引用');
            // テーブル内に blockquote が生成されていないことを確認
            await expect(app.page.locator('#editor table blockquote')).toHaveCount(0);
        });

        test('引用のオートコンバージョンがテーブルセル内で動作しない', async ({ app }) => {
            await loadMarkdown(app.page, '| |\n|---|\n| |');
            const td = app.page.locator('#editor td').first();
            await td.click();
            await app.page.waitForTimeout(200);

            // "> " を入力して引用への自動変換を試みる
            await app.page.keyboard.type('> 引用 ');
            await app.page.waitForTimeout(500);

            // テーブル内に blockquote が生成されていないことを確認
            await expect(app.page.locator('#editor table blockquote')).toHaveCount(0);
            // テキストはセル内に残っていること
            await expect(td).toContainText('引用');
        });

        test('水平線のオートコンバージョンがテーブルセル内で動作しない', async ({ app }) => {
            await loadMarkdown(app.page, '| |\n|---|\n| |');
            const td = app.page.locator('#editor td').first();
            await td.click();
            await app.page.waitForTimeout(200);

            // "---" を入力して水平線への自動変換を試みる
            await app.page.keyboard.type('---');
            await app.page.waitForTimeout(500);

            // テーブル内に hr が生成されていないことを確認
            await expect(app.page.locator('#editor table hr')).toHaveCount(0);
            // セルに --- のテキストが残ること
            await expect(td).toContainText('---');
        });

        test('箇条書きオートコンバージョンがテーブルセル内で動作しない', async ({ app }) => {
            await loadMarkdown(app.page, '| |\n|---|\n| |');
            const td = app.page.locator('#editor td').first();
            await td.click();
            await app.page.waitForTimeout(200);

            // "- " を入力してリストへの自動変換を試みる
            await app.page.keyboard.type('- アイテム ');
            await app.page.waitForTimeout(500);

            // テーブル内に ul が生成されていないことを確認
            await expect(app.page.locator('#editor table ul')).toHaveCount(0);
            // テキストはセル内に残ること
            await expect(td).toContainText('アイテム');
        });
    });

    // ─────────────────────────────────────────────
    // Notion エクスポート形式のインポート
    // ─────────────────────────────────────────────
    test.describe('Notion エクスポート形式のインポート', () => {
        test('単純な複数行テーブルセルが正しく表示される', async ({ app }) => {
            // Notion エクスポート形式: セル内で改行を使う
            const md = [
                '| 列1 | 列2 |',
                '| --- | --- |',
                '| 通常セル | 複数行セル',
                '2行目',
                '3行目 |',
            ].join('\n');
            await loadMarkdown(app.page, md);

            // テーブルが1つ表示される
            await expect(app.page.locator('#editor table')).toHaveCount(1);
            // セルが正しく存在する
            const cells = app.page.locator('#editor td');
            await expect(cells).toHaveCount(2);
            // 複数行セルの内容に <br> が含まれて表示される
            await expect(cells.nth(1)).toContainText('複数行セル');
            await expect(cells.nth(1)).toContainText('2行目');
            await expect(cells.nth(1)).toContainText('3行目');
        });

        test('Notion の • 箇条書きがセル内に表示される', async ({ app }) => {
            const md = [
                '| 項目 |',
                '| --- |',
                '| • リストA',
                '• リストB',
                '• リストC |',
            ].join('\n');
            await loadMarkdown(app.page, md);

            const cell = app.page.locator('#editor td').first();
            await expect(cell).toContainText('リストA');
            await expect(cell).toContainText('リストB');
            await expect(cell).toContainText('リストC');
        });

        test('テーブル途中の | でセルが分割される（Notion 形式）', async ({ app }) => {
            const md = [
                '| A | B | C |',
                '| --- | --- | --- |',
                '| セル1 | セル2の1行目',
                '2行目',
                'セル2の末尾 | セル3 |',
            ].join('\n');
            await loadMarkdown(app.page, md);

            const cells = app.page.locator('#editor td');
            await expect(cells).toHaveCount(3);
            // セル2が複数行内容を持つ
            await expect(cells.nth(1)).toContainText('セル2の1行目');
            await expect(cells.nth(1)).toContainText('2行目');
            // セル3が独立している
            await expect(cells.nth(2)).toContainText('セル3');
        });

        test('通常の Markdown テーブルは前処理後も正常に表示される', async ({ app }) => {
            const md = [
                '| 名前 | 年齢 |',
                '| --- | --- |',
                '| 田中 | 30 |',
                '| 山田 | 25 |',
            ].join('\n');
            await roundtrip(app.page, md);

            await expect(app.page.locator('#editor table')).toHaveCount(1);
            const rows = app.page.locator('#editor tbody tr');
            await expect(rows).toHaveCount(2);
            await expect(app.page.locator('#editor td').nth(0)).toContainText('田中');
        });
    });

    // ─────────────────────────────────────────────
    // CSS適用状態の検証 (修正時必須チェック)
    // ─────────────────────────────────────────────
    test.describe('CSS適用状態の検証', () => {
        test('見出しのスタイルが保存後も適用されていること', async ({ app }) => {
            const md = '# 見出し1\n\n## 見出し2';
            await roundtrip(app.page, md);

            const h1 = app.page.locator('#editor h1').first();
            const h2 = app.page.locator('#editor h2').first();

            // CSSが適用されていることを確認（computed styleで検証）
            const h1ComputedStyle = await h1.evaluate(el => {
                return getComputedStyle(el).fontSize;
            });
            const h2ComputedStyle = await h2.evaluate(el => {
                return getComputedStyle(el).fontSize;
            });

            // H1 と H2 のフォントサイズが異なることを確認（CSSが適用済み）
            expect(h1ComputedStyle).not.toBe(h2ComputedStyle);
        });

        test('コードブロックの背景色が保存後も適用されていること', async ({ app }) => {
            const md = '```javascript\nconst x = 1;\n```';
            await roundtrip(app.page, md);

            const codeBlock = app.page.locator('#editor pre').first();
            const backgroundColor = await codeBlock.evaluate(el => {
                return getComputedStyle(el).backgroundColor;
            });

            // 背景色が設定されていることを確認（rgb値が返されること）
            expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(backgroundColor).not.toBe('transparent');
        });

        test('テーブルの枠線が保存後も表示されていること', async ({ app }) => {
            const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
            await roundtrip(app.page, md);

            // テーブルセルに枠線スタイルが適用されていることを確認
            // (table自体ではなく td に border が適用されることが多い)
            const td = app.page.locator('#editor td').first();
            const borderWidth = await td.evaluate(el => {
                return getComputedStyle(el).borderWidth;
            });

            // 枠線が設定されていることを確認（0pxでない）
            expect(borderWidth).not.toBe('0px');
        });

        test('ツールバーボタンのcss classが正しく適用されていること', async ({ app }) => {
            // ツールバーを確認（DOM構造の検証）
            const toolbarButtons = app.page.locator('.toolbar-btn');
            const count = await toolbarButtons.count();
            expect(count).toBeGreaterThan(0);

            // 最初のボタンが toolbar-btn クラスを持つことを確認
            const hasClass = await toolbarButtons.first().evaluate(el => {
                return el.classList.contains('toolbar-btn');
            });
            expect(hasClass).toBe(true);
        });
    });

    // ─────────────────────────────────────────────
    // DOM構造の整合性検証
    // ─────────────────────────────────────────────
    test.describe('DOM構造の整合性', () => {
        test('Markdown変換後のDOM構造が有効なHTMLであること', async ({ app }) => {
            const md = '# 見出し\n\nテキスト\n\n- リスト1\n- リスト2';
            await roundtrip(app.page, md);

            // Editor の HTML を取得
            const html = await app.page.locator('#editor').innerHTML();

            // 基本的なタグ対応が取れていることを確認
            const openH1 = (html.match(/<h1/g) || []).length;
            const closeH1 = (html.match(/<\/h1>/g) || []).length;
            expect(openH1).toBe(closeH1);

            const openUL = (html.match(/<ul/g) || []).length;
            const closeUL = (html.match(/<\/ul>/g) || []).length;
            expect(openUL).toBe(closeUL);
        });

        test('保存したコンテンツを再度読み込み後、要素数が変わらないこと', async ({ app }) => {
            const md = '# H1\n\nテキスト\n\n## H2\n\nリスト\n\n- A\n- B\n- C';
            await loadMarkdown(app.page, md);

            // 初回の要素数を数える
            const h1Count1 = await app.page.locator('#editor h1').count();
            const h2Count1 = await app.page.locator('#editor h2').count();
            const liCount1 = await app.page.locator('#editor li').count();

            // ラウンドトリップ後
            const saved = await dumpMarkdown(app.page);
            await loadMarkdown(app.page, saved);

            const h1Count2 = await app.page.locator('#editor h1').count();
            const h2Count2 = await app.page.locator('#editor h2').count();
            const liCount2 = await app.page.locator('#editor li').count();

            // 要素数が同じであることを確認
            expect(h1Count1).toBe(h1Count2);
            expect(h2Count1).toBe(h2Count2);
            expect(liCount1).toBe(liCount2);
        });

        test('表内に表が生成されないこと（セル内安全性）', async ({ app }) => {
            // 通常のテーブル
            const md = '| A | B |\n| --- | --- |\n| cell1 | cell2 |';
            await roundtrip(app.page, md);

            // テーブル全体の数が1であることを確認
            const tableCount = await app.page.locator('#editor table').count();
            expect(tableCount).toBe(1);

            // テーブル内にネストされた別のテーブルがないことを確認
            const nestedTables = await app.page.locator('#editor table table').count();
            expect(nestedTables).toBe(0);
        });
    });

    // ─────────────────────────────────────────────
    // 複数要素の同時保存検証
    // ─────────────────────────────────────────────
    test.describe('複数要素の同時保存', () => {
        test('複数の異なる形式の要素が混在するコンテンツが保持されること', async ({ app }) => {
            const md = `# タイトル

段落テキスト

- リスト1
- リスト2

\`\`\`
code block
\`\`\`

| 列1 | 列2 |
| --- | --- |
| 値1 | 値2 |

> 引用

**bold** と *italic*`;

            await roundtrip(app.page, md);

            // 各要素が保持されていることを確認
            await expect(app.page.locator('#editor h1')).toHaveCount(1);
            await expect(app.page.locator('#editor ul li')).toHaveCount(2);
            await expect(app.page.locator('#editor pre')).toHaveCount(1);
            await expect(app.page.locator('#editor table')).toHaveCount(1);
            await expect(app.page.locator('#editor blockquote')).toHaveCount(1);
            await expect(app.page.locator('#editor strong')).toHaveCount(1);
            await expect(app.page.locator('#editor em')).toHaveCount(1);
        });

        test('連続して複数回ラウンドトリップしても内容が変わらないこと', async ({ app }) => {
            const md = '# テスト\n\nテキスト\n\n- リスト';
            
            // 1回目
            await loadMarkdown(app.page, md);
            const md1 = await dumpMarkdown(app.page);

            // 2回目
            await loadMarkdown(app.page, md1);
            const md2 = await dumpMarkdown(app.page);

            // 3回目
            await loadMarkdown(app.page, md2);
            const md3 = await dumpMarkdown(app.page);

            // 全て同じMarkdownであることを確認
            expect(md1).toBe(md2);
            expect(md2).toBe(md3);
        });
    });

    // ─────────────────────────────────────────────
    // エラー耐性テスト
    // ─────────────────────────────────────────────
    test.describe('エラー耐性', () => {
        test('空のMarkdownが正しく処理されること', async ({ app }) => {
            await roundtrip(app.page, '');
            // エラーが発生せず、エディタが空の状態で維持されることを確認
            const content = await app.page.locator('#editor').innerHTML();
            expect(content.trim().length).toBeLessThan(50); // ほぼ空
        });

        test('不正なHTMLが含む場合でもクラッシュしないこと', async ({ app }) => {
            const md = '# テスト\n\nテキスト';
            await loadMarkdown(app.page, md);
            const saved = await dumpMarkdown(app.page);
            
            // 2回以上のラウンドトリップが成功することを確認
            await loadMarkdown(app.page, saved);
            const saved2 = await dumpMarkdown(app.page);
            
            expect(saved2.length).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────
    // 意味的同等性チェック (Copilot CLI)
    // test:e2e:md-check スクリプト実行時のみ有効
    // ─────────────────────────────────────────────
    test.describe('意味的同等性 (Copilot CLIチェック)', () => {
        test.describe.configure({ timeout: 120000 });

        test('見出し・リスト・テーブルが混在するドキュメントで意味が保持される', async ({ app }) => {
            const original = [
                '# タイトル',
                '',
                '## セクション1',
                '',
                '- リスト項目A',
                '- リスト項目B',
                '',
                '## セクション2',
                '',
                '| 名前 | 値 |',
                '|------|-----|',
                '| Alpha | 100 |',
                '| Beta  | 200 |',
                '',
                '> 重要な引用文',
            ].join('\n');

            await loadMarkdown(app.page, original);
            const converted = await dumpMarkdown(app.page);
            await checkSemanticEquivalence(original, converted, '08-roundtrip: 混在ドキュメント意味的同等性');
        });

        test('太字・斜体・取り消し線が変換後も意味的に保持される', async ({ app }) => {
            const original = '**太字** と *斜体* と ~~取り消し線~~ のテキスト';

            await loadMarkdown(app.page, original);
            const converted = await dumpMarkdown(app.page);
            await checkSemanticEquivalence(original, converted, '08-roundtrip: インライン装飾意味的同等性');
        });

        test('ネストリストが変換後も意味的に保持される', async ({ app }) => {
            const original = [
                '- 親項目1',
                '  - 子項目1-1',
                '  - 子項目1-2',
                '- 親項目2',
                '  - 子項目2-1',
            ].join('\n');

            await loadMarkdown(app.page, original);
            const converted = await dumpMarkdown(app.page);
            await checkSemanticEquivalence(original, converted, '08-roundtrip: ネストリスト意味的同等性');
        });

        test('コードブロックの内容が変換後も意味的に保持される', async ({ app }) => {
            const original = [
                '```javascript',
                'function hello(name) {',
                '    return `Hello, ${name}!`;',
                '}',
                '```',
            ].join('\n');

            await loadMarkdown(app.page, original);
            const converted = await dumpMarkdown(app.page);
            await checkSemanticEquivalence(original, converted, '08-roundtrip: コードブロック意味的同等性');
        });
    });
});
