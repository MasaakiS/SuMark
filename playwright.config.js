// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');
const os = require('os');

const platform = os.platform();
const excludeVrt = process.env.PW_EXCLUDE_VRT === '1';
let binaryPath;

if (platform === 'darwin') {
    binaryPath = path.join(__dirname, 'src-tauri/target/release/bundle/macos/SuMark.app/Contents/MacOS/SuMark');
} else if (platform === 'win32') {
    binaryPath = path.join(__dirname, 'src-tauri/target/release/SuMark.exe');
} else {
    binaryPath = path.join(__dirname, 'src-tauri/target/release/sumark');
}

module.exports = defineConfig({
    testDir: './test/playwright',
    timeout: 60000,
    expect: {
        timeout: 5000,
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 8,
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'test/playwright-report' }],
    ],
    outputDir: 'test/playwright-results',
    testIgnore: excludeVrt ? ['**/12-visual-regression.spec.js'] : [],

    use: {
        actionTimeout: 10000,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    // Visual Regression Testing (VRT) 設定
    expect: {
        ...module.exports?.expect,
        toHaveScreenshot: {
            // スクリーンショット比較のしきい値（0-1、1が完全一致）
            maxDiffPixels: 100,
            // アニメーションの影響を軽減するため、cssでアニメーションを無効化
            animations: 'disabled',
            // フォントレンダリングの違いを許容
            threshold: 0.2,
        },
    },

    // Tauri app binary path (used by test fixtures)
    metadata: {
        binaryPath,
    },
});
