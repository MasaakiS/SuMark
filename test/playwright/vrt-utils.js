/**
 * VRT ユーティリティ
 * 
 * ピクセル単位のスクリーンショット比較。
 * 保存前 vs 保存後のラウンドトリップ表示一致を検証する。
 * ベースラインファイル不要 — 毎回テスト内で直接比較する。
 */

const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const fs = require('fs');
const path = require('path');

const DIFF_OUTPUT_DIR = path.join(__dirname, '../playwright-results/vrt-diffs');

/**
 * 2つのスクリーンショットバッファをピクセル単位で比較
 * @param {Buffer} buffer1 - 保存前スクリーンショット (PNG)
 * @param {Buffer} buffer2 - 保存後スクリーンショット (PNG)
 * @param {Object} options
 * @param {number} options.threshold - ピクセル差分の閾値 (0-1, デフォルト 0.15)
 * @param {number} options.maxDiffPixels - 許容する最大差分ピクセル数 (デフォルト 50)
 * @returns {{ pass, diffPixels, totalPixels, diffPercent, diffBuffer, width, height, reason? }}
 */
function compareImages(buffer1, buffer2, options = {}) {
    const { threshold = 0.15, maxDiffPixels = 50 } = options;

    const img1 = PNG.sync.read(buffer1);
    const img2 = PNG.sync.read(buffer2);

    // サイズが異なる場合は即失敗
    if (img1.width !== img2.width || img1.height !== img2.height) {
        return {
            pass: false,
            reason: `サイズ不一致: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`,
            diffPixels: -1,
            totalPixels: -1,
            diffPercent: 100,
            diffBuffer: null,
            width: img1.width,
            height: img1.height,
        };
    }

    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
        img1.data, img2.data, diff.data,
        width, height,
        { threshold }
    );

    const totalPixels = width * height;
    const diffPercent = (numDiffPixels / totalPixels) * 100;

    return {
        pass: numDiffPixels <= maxDiffPixels,
        diffPixels: numDiffPixels,
        totalPixels,
        diffPercent: Math.round(diffPercent * 100) / 100,
        diffBuffer: PNG.sync.write(diff),
        width,
        height,
    };
}

/**
 * 差分画像 (before / after / diff) を保存
 * テスト失敗時のデバッグ用
 */
function saveDiffImages(testName, beforeBuffer, afterBuffer, diffBuffer) {
    fs.mkdirSync(DIFF_OUTPUT_DIR, { recursive: true });

    const safeName = testName.replace(/[^a-zA-Z0-9_-]/g, '_');
    fs.writeFileSync(path.join(DIFF_OUTPUT_DIR, `${safeName}-before.png`), beforeBuffer);
    fs.writeFileSync(path.join(DIFF_OUTPUT_DIR, `${safeName}-after.png`), afterBuffer);
    if (diffBuffer) {
        fs.writeFileSync(path.join(DIFF_OUTPUT_DIR, `${safeName}-diff.png`), diffBuffer);
    }
}

/**
 * ラウンドトリップ VRT を実行するヘルパー
 * 
 * 1. Markdown を読み込み（編集時の状態）
 * 2. 保存前スクリーンショットを取得
 * 3. getMarkdown() で保存
 * 4. 保存した Markdown を再読み込み（再オープン時の状態）
 * 5. 保存後スクリーンショットを取得
 * 6. ピクセル比較して pass/fail を判定
 * 
 * @param {import('@playwright/test').Page} page
 * @param {string} markdown - テスト対象の Markdown
 * @param {string} testName - テスト名
 * @param {Object} options
 * @param {number} options.maxDiffPixels - 許容する最大差分ピクセル数
 * @param {number} options.waitMs - レンダリング待機時間 (ms)
 * @returns {Promise<{ pass, diffPixels, diffPercent, savedMarkdown }>}
 */
async function roundtripVRT(page, markdown, testName, options = {}) {
    const { maxDiffPixels = 50, waitMs = 800 } = options;

    // 1. エディタをクリアして Markdown を読み込む
    await page.evaluate(() => {
        const editor = document.getElementById('editor');
        editor.innerHTML = '<p><br></p>';
    });
    await page.waitForTimeout(200);
    await page.evaluate(md => window.setMarkdown(md), markdown);
    await page.waitForTimeout(waitMs);

    // 2. 保存前スクリーンショット
    const editor = page.locator('#editor');
    const beforeBuffer = await editor.screenshot();

    // 3. 保存 (getMarkdown)
    const savedMarkdown = await page.evaluate(() => window.getMarkdown());

    // 4. エディタをクリアして再読み込み（ファイルを開き直した状態）
    await page.evaluate(() => {
        const editor = document.getElementById('editor');
        editor.innerHTML = '<p><br></p>';
    });
    await page.waitForTimeout(200);
    await page.evaluate(md => window.setMarkdown(md), savedMarkdown);
    await page.waitForTimeout(waitMs);

    // 5. 保存後スクリーンショット
    const afterBuffer = await editor.screenshot();

    // 6. ピクセル比較
    const result = compareImages(beforeBuffer, afterBuffer, { maxDiffPixels });

    // 7. 失敗時は差分画像を保存
    if (!result.pass) {
        saveDiffImages(testName, beforeBuffer, afterBuffer, result.diffBuffer);
    }

    return {
        ...result,
        savedMarkdown,
        testName,
    };
}

module.exports = { compareImages, saveDiffImages, roundtripVRT, DIFF_OUTPUT_DIR };
