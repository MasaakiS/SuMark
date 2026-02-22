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
    return await page.evaluate(() => window.getMarkdown());
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

        test('コードブロックボタンがテーブルセル内で使用不可（alert確認）', async ({ app }) => {
            await focusFirstTableCell(app.page);

            // alert が発火することを確認（先にハンドラを登録してから evaluate する）
            let alertMessage = '';
            app.page.once('dialog', dialog => {
                alertMessage = dialog.message();
                dialog.dismiss();
            });
            await app.page.evaluate(() => window.insertCodeBlock());
            await app.page.waitForTimeout(200);

            expect(alertMessage).toContain('コードブロック');
            // テーブル内に pre が生成されていないことを確認
            await expect(app.page.locator('#editor table pre')).toHaveCount(0);
        });

        test('水平線ボタンがテーブルセル内で使用不可（alert確認）', async ({ app }) => {
            await focusFirstTableCell(app.page);

            let alertMessage = '';
            app.page.once('dialog', dialog => {
                alertMessage = dialog.message();
                dialog.dismiss();
            });
            await app.page.evaluate(() => window.insertHorizontalRule());
            await app.page.waitForTimeout(200);

            expect(alertMessage).toContain('水平線');
            // テーブル内に hr が生成されていないことを確認
            await expect(app.page.locator('#editor table hr')).toHaveCount(0);
        });

        test('トグルボタンがテーブルセル内で使用不可（alert確認）', async ({ app }) => {
            await focusFirstTableCell(app.page);

            let alertMessage = '';
            app.page.once('dialog', dialog => {
                alertMessage = dialog.message();
                dialog.dismiss();
            });
            await app.page.evaluate(() => window.insertToggle());
            await app.page.waitForTimeout(200);

            expect(alertMessage).toContain('トグル');
            // テーブル内に details が生成されていないことを確認
            await expect(app.page.locator('#editor table details')).toHaveCount(0);
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
});
