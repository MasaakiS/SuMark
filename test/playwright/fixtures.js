/**
 * SuMark Playwright テスト用カスタムフィクスチャ
 *
 * ブラウザモード:
 *   src/ ディレクトリをローカル HTTP サーバで配信し、
 *   Playwright のブラウザでアクセスしてテストする。
 *   Tauri API は利用できないが、エディタの UI/UX テストは可能。
 */
const { test: base, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PlaywrightHelpers = require('./helpers');

const SRC_DIR = path.join(__dirname, '../../src');

// 簡易静的ファイルサーバ
function createStaticServer(dir) {
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
    };
    return http.createServer((req, res) => {
        const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
        let filePath = path.join(dir, safePath === '/' ? 'index.html' : safePath);
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    });
}

/**
 * カスタムフィクスチャ:
 *  - server: テスト全体で共有されるローカル HTTP サーバ
 *  - app:    各テストに page + helpers を提供
 */
const test = base.extend({
    // ワーカースコープ: HTTP サーバの起動・停止
    _serverURL: [async ({}, use) => {
        const server = createStaticServer(SRC_DIR);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        const url = `http://127.0.0.1:${port}`;
        await use(url);
        server.close();
    }, { scope: 'worker' }],

    // テストスコープ: ページを開いてヘルパーを付与
    app: async ({ page, _serverURL }, use) => {
        await page.goto(_serverURL, { waitUntil: 'load' });
        // エディタ要素が表示されるまで待つ
        await page.locator('#editor').waitFor({ state: 'visible', timeout: 15000 });
        
        // グローバル状態をリセット（複数テスト連続実行時のメモリリーク防止）
        await page.evaluate(() => {
            if (typeof resetGlobalState === 'function') {
                resetGlobalState();
            }
        });
        
        // 初期化完了を少し待つ (Mermaid / KaTeX ロード等)
        await page.waitForTimeout(1000);

        const helpers = new PlaywrightHelpers(page);
        await use({ page, helpers });
    },
});

module.exports = { test, expect };
