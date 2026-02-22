const { test, expect } = require('@playwright/test');

const ERROR_BANNER_PREFIX = 'JS Error:';

async function waitForErrorBanner(page, expectedText) {
    await page.waitForFunction(
        ({ prefix, expected }) => {
            const banners = Array.from(document.body.querySelectorAll('div'))
                .filter(el => el.textContent && el.textContent.includes(prefix));
            if (!banners.length) return false;
            if (!expected) return true;
            return banners.some(el => el.textContent.includes(expected));
        },
        { prefix: ERROR_BANNER_PREFIX, expected: expectedText },
        { timeout: 3000 }
    );
}

async function getErrorBannerText(page) {
    return await page.evaluate((prefix) => {
        const banner = Array.from(document.body.querySelectorAll('div'))
            .find(el => el.textContent && el.textContent.includes(prefix));
        return banner ? banner.textContent : '';
    }, ERROR_BANNER_PREFIX);
}

async function getErrorBannerCount(page) {
    return await page.evaluate((prefix) => {
        return Array.from(document.body.querySelectorAll('div'))
            .filter(el => el.textContent && el.textContent.includes(prefix)).length;
    }, ERROR_BANNER_PREFIX);
}

test.describe('Error Handling - Error Banner', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('file://' + __dirname + '/../../src/index.html');
        // Wait for editor to be ready
        await page.waitForSelector('#editor', { timeout: 5000 });
        // Wait for error handler to be attached
        await page.waitForFunction(() => typeof window.onerror === 'function');
    });

    test('単一のエラーでバナーが表示される', async ({ page }) => {
        // Trigger error in a way that reaches window.onerror
        await page.evaluate(() => {
            window.onerror('Single test error', window.location.href, 1, 0, new Error('Single test error'));
        });

        // Wait for error banner to appear
        await waitForErrorBanner(page, 'Single test error');

        // Check error banner content
        const text = await getErrorBannerText(page);
        expect(text).toContain('JS Error: Single test error');
    });

    test('複数エラーの場合、バナーが1つだけ表示される', async ({ page }) => {
        // Trigger multiple errors with throttling simulation (500ms min between errors)
        await page.evaluate(() => {
            window.onerror('Error 1', window.location.href, 1, 0, new Error('Error 1'));
            // Third error is within throttle window so it will be ignored
            window.onerror('Error 2', window.location.href, 1, 0, new Error('Error 2'));
        });

        // Wait for error banner (first error should display)
        await waitForErrorBanner(page, 'Error 1');

        // Only one banner should exist (multiple errors triggered at once)
        const banners = await getErrorBannerCount(page);
        expect(banners).toBe(1);

        // First error should be displayed (others throttled)
        const text = await getErrorBannerText(page);
        expect(text).toContain('Error 1');
    });

    test('エラースパム（500ms以内）は間引きされる', async ({ page }) => {
        // Trigger multiple errors rapidly within throttle window (500ms)
        await page.evaluate(() => {
            for (let i = 0; i < 5; i++) {
                window.onerror('Spam error ' + i, window.location.href, 1, 0, new Error('Spam error ' + i));
            }
        });

        // Wait for error banner
        await waitForErrorBanner(page, 'Spam error 0');

        // Only one banner should exist (others throttled)
        const banners = await getErrorBannerCount(page);
        expect(banners).toBe(1);

        // First error should be displayed
        const text = await getErrorBannerText(page);
        expect(text).toContain('Spam error 0');
    });

    test('エラーバナーが5秒後に自動削除される', async ({ page }) => {
        // Trigger an error
        await page.evaluate(() => {
            window.onerror('Auto-dismiss test', window.location.href, 1, 0, new Error('Auto-dismiss test'));
        });

        // Wait for error banner to appear
        await waitForErrorBanner(page, 'Auto-dismiss test');
        let bannerCount = await getErrorBannerCount(page);
        expect(bannerCount).toBe(1);

        // Wait for banner to auto-dismiss (5 seconds + buffer)
        await page.waitForTimeout(5500);

        // Banner should be gone
        bannerCount = await getErrorBannerCount(page);
        expect(bannerCount).toBe(0);
    });

    test('Unhandled Promise Rejection がバナーに表示される', async ({ page }) => {
        // Trigger an unhandled promise rejection
        await page.evaluate(() => {
            Promise.reject(new Error('Unhandled rejection test'));
        });

        // Wait for error banner to appear (Promise rejection might take a moment)
        await waitForErrorBanner(page, 'Unhandled Promise Rejection');

        const text = await getErrorBannerText(page);
        expect(text).toContain('Unhandled Promise Rejection');
    });

    test('新しいエラーが出ると自動削除タイマーがリセットされる', async ({ page }) => {
        // First error
        await page.evaluate(() => {
            window.onerror('First error', window.location.href, 1, 0, new Error('First error'));
        });

        await waitForErrorBanner(page, 'First error');

        // Wait 3 seconds (before auto-dismiss at 5s)
        await page.waitForTimeout(3000);

        // Second error (timer resets) - must be after 500ms from first to not be throttled
        await page.waitForTimeout(600);
        await page.evaluate(() => {
            window.onerror('Second error', window.location.href, 1, 0, new Error('Second error'));
        });

        // Banner should still exist
        let banners = await getErrorBannerCount(page);
        expect(banners).toBe(1);

        // Wait for auto-dismiss after the second error (5 seconds + buffer)
        await page.waitForTimeout(5500);

        // Banner should now be gone
        banners = await getErrorBannerCount(page);
        expect(banners).toBe(0);
    });

    test('バナーが表示される（表示位置・色に依存しない）', async ({ page }) => {
        // Trigger an error
        await page.evaluate(() => {
            window.onerror('Color test', window.location.href, 1, 0, new Error('Color test'));
        });

        await waitForErrorBanner(page, 'Color test');

        const text = await getErrorBannerText(page);
        expect(text).toContain('Color test');
    });
});
