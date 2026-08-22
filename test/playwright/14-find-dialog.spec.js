// @ts-check
/**
 * 14-find-dialog.spec.js
 * モードレス浮動検索ダイアログのE2Eテスト
 */
const { test, expect } = require('./fixtures');

test.describe('検索ダイアログ（モードレス）', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    // ============================
    // 1. ダイアログの開閉
    // ============================
    test.describe('ダイアログの開閉', () => {
        test('検索ボタンでダイアログが開く', async ({ app }) => {
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            const dialog = app.page.locator('#findDialog');
            await expect(dialog).toBeVisible();
        });

        test('ダイアログ表示時にモーダルオーバーレイが表示されない', async ({ app }) => {
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            // 既存のモーダルオーバーレイは非表示のまま
            const overlay = app.page.locator('#modalOverlay');
            await expect(overlay).toBeHidden();
        });

        test('ダイアログ表示時に検索入力欄にフォーカスがある', async ({ app }) => {
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            const focusedId = await app.page.evaluate(() => document.activeElement?.id);
            expect(focusedId).toBe('findInput');
        });

        test('「閉じる」ボタンでダイアログが閉じる', async ({ app }) => {
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.locator('#findCloseBtn').click();
            await app.page.waitForTimeout(200);

            const dialog = app.page.locator('#findDialog');
            await expect(dialog).toBeHidden();
        });

        test('Escape キーでダイアログが閉じる', async ({ app }) => {
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.keyboard.press('Escape');
            await app.page.waitForTimeout(200);

            const dialog = app.page.locator('#findDialog');
            await expect(dialog).toBeHidden();
        });

        test('ダイアログが既に開いている時に再度開いてもフォーカスが入力欄に移る', async ({ app }) => {
            // 1回目
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            // フォーカスを別の場所へ移す
            await app.helpers.focusEditor();
            await app.page.waitForTimeout(100);

            // 2回目 — ダイアログはすでに開いている
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            const focusedId = await app.page.evaluate(() => document.activeElement?.id);
            expect(focusedId).toBe('findInput');
        });
    });

    // ============================
    // 2. 検索ヒットとハイライト
    // ============================
    test.describe('検索ヒットとハイライト', () => {
        test('一致する語がハイライトされる', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBeGreaterThanOrEqual(1);
        });

        test('複数ヒットが同時にハイライトされる', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple cherry apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBe(3);
        });

        test('アクティブハイライトが1つだけ存在する', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const active = await app.page.locator('#editor .active-search-highlight').count();
            expect(active).toBe(1);
        });

        test('「次へ」で次のハイライトに移動する', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple cherry apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');

            // 1回目: 検索実行 (index 0)
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const count1Text = await app.page.locator('#findDialogCount').innerText();
            expect(count1Text).toBe('1 / 3');

            // 2回目: 次へ (index 1)
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(200);

            const count2Text = await app.page.locator('#findDialogCount').innerText();
            expect(count2Text).toBe('2 / 3');

            // 3回目: 次へ (index 2)
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(200);

            const count3Text = await app.page.locator('#findDialogCount').innerText();
            expect(count3Text).toBe('3 / 3');

            // 4回目: 折り返し (index 0)
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(200);

            const count4Text = await app.page.locator('#findDialogCount').innerText();
            expect(count4Text).toBe('1 / 3');
        });

        test('Enter キーで「次へ」と同じ動作をする', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.keyboard.press('Enter');
            await app.page.waitForTimeout(300);

            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBeGreaterThanOrEqual(1);
        });

        test('一致なし時にカウント表示が空になる', async ({ app }) => {
            await app.helpers.typeInEditor('banana cherry');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBe(0);

            const countText = await app.page.locator('#findDialogCount').innerText();
            expect(countText).toBe('');
        });

        test('大/小文字を区別した検索が機能する', async ({ app }) => {
            await app.helpers.typeInEditor('Apple apple APPLE');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            // 大/小文字区別ON
            await app.page.check('#findCaseSensitive');
            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBe(1); // 小文字のみ
        });

        test('大/小文字を区別しない検索（デフォルト）が機能する', async ({ app }) => {
            await app.helpers.typeInEditor('Apple apple APPLE');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBe(3);
        });

        test('単語単位と正規表現の検索オプションが機能する', async ({ app }) => {
            await app.helpers.typeInEditor('cat scatter cat2 cat');
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.fill('#findInput', 'cat');
            await app.page.locator('#findWholeWord').click();
            await app.page.locator('#findNextBtn').click();
            await expect(app.page.locator('#editor .search-highlight')).toHaveCount(2);

            await app.page.locator('#findRegex').click();
            await app.page.fill('#findInput', 'c.t2');
            await app.page.locator('#findNextBtn').click();
            await expect(app.page.locator('#editor .search-highlight')).toHaveCount(1);
        });

        test('前へボタンで検索結果を逆順に移動できる', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple cherry apple');
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.locator('#findNextBtn').click();
            expect(await app.page.locator('#findDialogCount').innerText()).toBe('2 / 3');
            await app.page.locator('#findPreviousBtn').click();
            expect(await app.page.locator('#findDialogCount').innerText()).toBe('1 / 3');
        });
    });

    // ============================
    // 3. ダイアログ中のフォーカス挙動
    // ============================
    test.describe('フォーカス挙動', () => {
        test('「次へ」クリック後もフォーカスが検索入力欄に戻る', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            const focusedId = await app.page.evaluate(() => document.activeElement?.id);
            expect(focusedId).toBe('findInput');
        });

        test('文書クリック後もハイライトが残存する', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            // 文書をクリックしてフォーカスを文書側へ
            await app.page.locator('#editor').click();
            await app.page.waitForTimeout(200);

            // ハイライトが消えていないことを確認
            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBeGreaterThanOrEqual(1);
        });

        test('文書クリック後もダイアログが開いたままである', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.locator('#editor').click();
            await app.page.waitForTimeout(200);

            const dialog = app.page.locator('#findDialog');
            await expect(dialog).toBeVisible();
        });

        test('ダイアログを閉じるとハイライトが消去される', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);

            // ハイライトが存在することを確認
            expect(await app.page.locator('#editor .search-highlight').count()).toBeGreaterThan(0);

            // ダイアログを閉じる
            await app.page.locator('#findCloseBtn').click();
            await app.page.waitForTimeout(200);

            // ハイライトが消えていることを確認
            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBe(0);
        });

        test('ダイアログを閉じるとエディタにフォーカスが戻る', async ({ app }) => {
            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            await app.page.locator('#findCloseBtn').click();
            await app.page.waitForTimeout(200);

            const focusedId = await app.page.evaluate(() => document.activeElement?.id);
            expect(focusedId).toBe('editor');
        });
    });

    // ============================
    // 4. 検索入力変更時の動作
    // ============================
    test.describe('検索入力変更', () => {
        test('検索語を変更するとハイライトがリセットされる', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana apple');

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            // 最初の検索
            await app.page.fill('#findInput', 'apple');
            await app.page.locator('#findNextBtn').click();
            await app.page.waitForTimeout(300);
            expect(await app.page.locator('#editor .search-highlight').count()).toBe(2);

            // 検索語を変更（inputイベントでリセット）
            await app.page.fill('#findInput', 'banana');
            await app.page.waitForTimeout(200);

            // ハイライトがクリアされていること
            const highlights = await app.page.locator('#editor .search-highlight').count();
            expect(highlights).toBe(0);

            // カウント表示もクリアされていること
            const countText = await app.page.locator('#findDialogCount').innerText();
            expect(countText).toBe('');
        });
    });

    test.describe('置換', () => {
        test('正規表現のキャプチャグループで全置換できる', async ({ app }) => {
            await app.helpers.typeInEditor('name: taro\nname: hanako');
            await app.helpers.clickToolbarButton('replaceBtn');
            await app.page.fill('#findInput', 'name: (\\w+)');
            await app.page.locator('#findRegex').click();
            await app.page.fill('#replaceInput', 'user: $1');
            await app.page.locator('#replaceAllBtn').click();
            await app.helpers.wait(200);

            const text = await app.page.locator('#editor').innerText();
            expect(text).toContain('user: taro');
            expect(text).toContain('user: hanako');
        });
    });

    // ============================
    // 5. 選択テキストの自動入力
    // ============================
    test.describe('選択テキストの自動入力', () => {
        test('テキスト選択後に検索ダイアログを開くと選択テキストが入力欄に入る', async ({ app }) => {
            await app.helpers.typeInEditor('apple banana');

            // テキストを選択
            await app.page.evaluate(() => {
                const editor = document.getElementById('editor');
                const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
                let node = walker.nextNode();
                while (node) {
                    if (node.nodeValue && node.nodeValue.includes('apple')) {
                        const range = document.createRange();
                        const idx = node.nodeValue.indexOf('apple');
                        range.setStart(node, idx);
                        range.setEnd(node, idx + 5);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                        break;
                    }
                    node = walker.nextNode();
                }
            });
            await app.page.waitForTimeout(200);

            await app.helpers.clickToolbarButton('searchBtn');
            await app.page.waitForTimeout(300);

            const inputValue = await app.page.locator('#findInput').inputValue();
            expect(inputValue).toBe('apple');
        });
    });
});
