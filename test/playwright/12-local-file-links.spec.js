// @ts-check
const { test, expect } = require('./fixtures');

test.describe('ローカルファイルリンクテスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test('リンク作成ダイアログに「ファイルを選択」ボタンが表示される', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');

        // Wait for modal to be visible
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Check if file selection button exists
        const fileBtn = await app.page.$('.modal-file-select-btn');
        expect(fileBtn).not.toBeNull();

        // Verify button text
        const buttonText = await app.page.locator('.modal-file-select-btn').textContent();
        expect(buttonText).toBe('ファイルを選択');

        // Close modal
        await app.page.click('#modalCancel');
    });

    test('リンク作成で Web URL を入力できる（従来の動作）', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Enter URL
        await app.page.fill('#modalInput0', 'https://example.com');
        await app.page.fill('#modalInput1', 'Example Link');

        // Submit
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Check if link is inserted
        const link = await app.page.$('a[href="https://example.com"]');
        expect(link).not.toBeNull();

        // Verify link text
        const linkText = await app.page.locator('a[href="https://example.com"]').textContent();
        expect(linkText).toBe('Example Link');
    });

    test('リンク作成で相対ファイルパスを入力できる', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Enter relative path (simulating file selection)
        await app.page.fill('#modalInput0', '../test.md');
        await app.page.fill('#modalInput1', 'Related Document');

        // Submit
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Check if link is inserted with the path
        const link = await app.page.$('a[href="../test.md"]');
        expect(link).not.toBeNull();

        // Verify link text
        const linkText = await app.page.locator('a[href="../test.md"]').textContent();
        expect(linkText).toBe('Related Document');
    });

    test('リンク作成で絶対パスを入力できる', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Enter absolute path
        const absolutePath = '/home/user/documents/file.md';
        await app.page.fill('#modalInput0', absolutePath);
        await app.page.fill('#modalInput1', 'Absolute Link');

        // Submit
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Check if link is inserted
        const link = await app.page.$(`a[href="${absolutePath}"]`);
        expect(link).not.toBeNull();

        // Verify link text
        const linkText = await app.page.locator(`a[href="${absolutePath}"]`).textContent();
        expect(linkText).toBe('Absolute Link');
    });

    test('Web リンクと相対パスリンク両方を同じ文書に作成できる', async ({ app }) => {
        // Create a web link
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');
        await app.page.fill('#modalInput0', 'https://example.com');
        await app.page.fill('#modalInput1', 'External Site');
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Create a local file link
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');
        await app.page.fill('#modalInput0', '../local.md');
        await app.page.fill('#modalInput1', 'Local Document');
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Verify both links exist
        const webLink = await app.page.$('a[href="https://example.com"]');
        const localLink = await app.page.$('a[href="../local.md"]');
        expect(webLink).not.toBeNull();
        expect(localLink).not.toBeNull();
    });

    test('絶対パスを含むローカルファイルリンクを作成できる', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Clear default value and enter absolute path
        await app.page.fill('#modalInput0', '');
        await app.page.fill('#modalInput0', '/Users/username/Documents/file.md');
        await app.page.fill('#modalInput1', 'Absolute Path Link');
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Verify the link was created
        const link = await app.page.$('a[href="/Users/username/Documents/file.md"]');
        expect(link).not.toBeNull();
    });

    test('リンク作成でホームディレクトリパス（~）が使用できる', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Enter home directory path
        await app.page.fill('#modalInput0', '~/documents/file.md');
        await app.page.fill('#modalInput1', 'Home File');

        // Submit
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Check if link is inserted
        const link = await app.page.$('a[href="~/documents/file.md"]');
        expect(link).not.toBeNull();
    });

    test('リンク作成ダイアログのモーダルが正常に表示される', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');

        // Wait for modal to appear
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Verify modal title
        const title = await app.page.locator('#modalTitle').textContent();
        expect(title).toBe('リンクを挿入');

        // Verify OK and Cancel buttons exist
        const okBtn = await app.page.$('#modalOk');
        const cancelBtn = await app.page.$('#modalCancel');
        expect(okBtn).not.toBeNull();
        expect(cancelBtn).not.toBeNull();

        // Close modal
        await app.page.click('#modalCancel');
    });

    test('空の URL でリンク作成はキャンセルされる', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Leave URL as default "https://" (empty)
        await app.page.fill('#modalInput1', 'Link Text');

        // Try to submit
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Modal should be closed and no link inserted
        // (or editor should be focused)
        const link = await app.page.$('a');
        expect(link).toBeNull();
    });

    test('リンク作成で URL と テキストの両方が入力される', async ({ app }) => {
        // Click link button
        await app.page.click('#linkBtn');
        await app.page.waitForSelector('#modalOverlay[style*="flex"]');

        // Enter both URL and text
        await app.page.fill('#modalInput0', 'https://test.com/page.html');
        await app.page.fill('#modalInput1', 'Test Page');

        // Submit
        await app.page.click('#modalOk');
        await app.page.waitForTimeout(200);

        // Check if link is properly inserted
        const link = await app.page.$('a[href="https://test.com/page.html"]');
        expect(link).not.toBeNull();

        // Verify both attributes
        const href = await app.page.getAttribute('a', 'href');
        const text = await app.page.locator('a').textContent();
        expect(href).toBe('https://test.com/page.html');
        expect(text).toBe('Test Page');
    });
});
