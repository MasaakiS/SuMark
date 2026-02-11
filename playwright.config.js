// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');
const os = require('os');

const platform = os.platform();
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
    timeout: 30000,
    expect: {
        timeout: 5000,
    },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'test/playwright-report' }],
    ],
    outputDir: 'test/playwright-results',

    use: {
        actionTimeout: 10000,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    // Tauri app binary path (used by test fixtures)
    metadata: {
        binaryPath,
    },
});
