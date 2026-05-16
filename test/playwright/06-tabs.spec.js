// @ts-check
const { test, expect } = require('./fixtures');

test.describe('タブ操作テスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
        // 余分なタブを閉じる（最初の1つだけ残す）
        let tabCount = await app.helpers.getTabCount();
        while (tabCount > 1) {
            await app.helpers.pressShortcut('w');
            await app.helpers.wait(300);
            tabCount = await app.helpers.getTabCount();
        }
    });

    test('初期状態で1つのタブが存在する', async ({ app }) => {
        const tabCount = await app.helpers.getTabCount();
        expect(tabCount).toBeGreaterThanOrEqual(1);
    });

    test('新しいタブを作成できる', async ({ app }) => {
        const initialCount = await app.helpers.getTabCount();
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);

        const newCount = await app.helpers.getTabCount();
        expect(newCount).toBe(initialCount + 1);
    });

    test('複数のタブを作成できる', async ({ app }) => {
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(300);
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(300);
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(300);

        const tabCount = await app.helpers.getTabCount();
        expect(tabCount).toBeGreaterThanOrEqual(4);
    });

    test('タブを切り替えられる', async ({ app }) => {
        // 2つ目のタブを作成
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);

        // 2つ目のタブにテキスト入力
        await app.helpers.typeInEditor('Tab 2 content');
        await app.helpers.wait(500);

        // 最初のタブに切り替え
        const tabs = app.page.locator('.tab');
        const tabCount = await tabs.count();
        if (tabCount >= 2) {
            await tabs.first().click();
            await app.helpers.wait(500);

            // コンテンツが異なるはず
            const text = await app.helpers.getEditorText();
            expect(text.includes('Tab 2 content')).toBe(false);
        }
    });

    test('各タブは独立したコンテンツを持つ', async ({ app }) => {
        // 1つ目のタブにテキスト入力
        await app.helpers.typeInEditor('Content 1');

        // 2つ目のタブ作成・入力
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);
        await app.helpers.typeInEditor('Content 2');

        // 3つ目のタブ作成・入力
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);
        await app.helpers.typeInEditor('Content 3');

        const tabs = app.page.locator('.tab');
        const tabCount = await tabs.count();

        if (tabCount >= 3) {
            // 3つ目のタブ（現在のタブ）
            let text = await app.helpers.getEditorText();
            expect(text).toContain('Content 3');

            // 2つ目のタブに切り替え
            await tabs.nth(1).click();
            await app.helpers.wait(500);
            text = await app.helpers.getEditorText();
            expect(text).toContain('Content 2');

            // 1つ目のタブに切り替え
            await tabs.first().click();
            await app.helpers.wait(500);
            text = await app.helpers.getEditorText();
            expect(text).toContain('Content 1');
        }
    });

    test('タブを閉じることができる', async ({ app }) => {
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);

        const countBefore = await app.helpers.getTabCount();
        await app.helpers.pressShortcut('w');
        await app.helpers.wait(500);

        const countAfter = await app.helpers.getTabCount();
        expect(countAfter).toBe(countBefore - 1);
    });

    test('タブの×ボタンで閉じることができる', async ({ app }) => {
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);

        const tabs = app.page.locator('.tab');
        const countBefore = await tabs.count();

        if (countBefore > 1) {
            const closeBtn = tabs.last().locator('.tab-close');
            await closeBtn.click();
            await app.helpers.wait(500);

            const countAfter = await app.page.locator('.tab').count();
            expect(countAfter).toBe(countBefore - 1);
        }
    });

    test('最後のタブは閉じられない', async ({ app }) => {
        // タブを1つだけにする
        let tabCount = await app.helpers.getTabCount();
        while (tabCount > 1) {
            await app.helpers.pressShortcut('w');
            await app.helpers.wait(300);
            tabCount = await app.helpers.getTabCount();
        }

        // 最後のタブを閉じようとする
        await app.helpers.pressShortcut('w');
        await app.helpers.wait(500);

        const finalCount = await app.helpers.getTabCount();
        expect(finalCount).toBe(1);
    });

    test('アクティブなタブがハイライトされる', async ({ app }) => {
        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);

        await expect(app.page.locator('.tab-item.active')).toBeVisible();
    });

    test('タブタイトルが表示される', async ({ app }) => {
        const title = await app.helpers.getActiveTabTitle();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(0);
    });

    test('編集したタブには更新マークが付く', async ({ app }) => {
        await app.helpers.typeInEditor('Modified content');
        await app.helpers.wait(500);

        const hasMark = await app.helpers.activeTabHasModifiedMark();
        expect(hasMark).toBe(true);
    });
    test('タブ切替後もコードブロックヘッダーが崩れない', async ({ app }) => {
        const md = '```js\nconsole.log("tab switch");\n```';
        await app.page.evaluate((markdown) => {
            if (typeof setMarkdown === 'function') setMarkdown(markdown);
        }, md);
        await app.helpers.wait(800);

        await app.helpers.pressShortcut('n');
        await app.helpers.wait(500);
        await app.helpers.typeInEditor('second tab');
        await app.helpers.wait(500);

        const tabs = app.page.locator('.tab-item');
        await tabs.first().click();
        await app.helpers.wait(800);

        const langSelectCount = await app.page.locator('#editor .code-block-toolbar .code-lang-select').count();
        const copyBtnCount = await app.page.locator('#editor .code-block-toolbar .code-copy-btn').count();
        const preCount = await app.page.locator('#editor pre').count();

        expect(preCount).toBeGreaterThan(0);
        expect(langSelectCount).toBeGreaterThan(0);
        expect(copyBtnCount).toBeGreaterThan(0);
    });
});
