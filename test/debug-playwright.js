const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const srv = http.createServer((req, res) => {
    const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
    let fp = path.join(SRC, safePath === '/' ? 'index.html' : safePath);
    const ext = path.extname(fp);
    fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end(); }
        else { res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' }); res.end(data); }
    });
});

srv.listen(0, '127.0.0.1', async () => {
    const port = srv.address().port;
    console.log('Server on port:', port);
    console.log('SRC dir:', SRC);
    console.log('src exists:', fs.existsSync(SRC));
    console.log('index.html exists:', fs.existsSync(path.join(SRC, 'index.html')));
    
    // Quick HTTP check
    const httpRes = await new Promise(resolve => {
        http.get('http://127.0.0.1:' + port + '/', res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, bodyLen: body.length, first200: body.substring(0, 200) }));
        });
    });
    console.log('HTTP response:', httpRes);
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Debug page state
    console.log('=== PAGE STATE ===');
    console.log('URL:', page.url());
    console.log('Title:', await page.title());
    const bodyHTML = await page.evaluate(() => document.body ? document.body.innerHTML.substring(0, 2000) : 'NO BODY');
    console.log('Body (first 2000):', bodyHTML);
    const editorEl = await page.$('#editor');
    console.log('Editor element exists:', !!editorEl);
    if (editorEl) {
        const box = await editorEl.boundingBox();
        console.log('Editor bounding box:', box);
    }
    const consErrs = [];
    page.on('console', msg => { if (msg.type() === 'error') consErrs.push(msg.text()); });
    page.on('pageerror', err => consErrs.push(err.message));
    await page.waitForTimeout(1000);

    // Check initial state
    console.log('=== INITIAL ===');
    if (!editorEl) { console.log('NO EDITOR - aborting'); await browser.close(); srv.close(); return; }
    console.log('HTML:', await page.locator('#editor').innerHTML());
    console.log('Tab count (.tab):', await page.locator('.tab').count());
    const tabListHTML = await page.evaluate(() => {
        const el = document.getElementById('tabList');
        return el ? el.outerHTML.substring(0, 500) : 'NOT FOUND';
    });
    console.log('tabList:', tabListHTML);

    // Clear and type heading
    await page.evaluate(() => {
        const ed = document.getElementById('editor');
        ed.innerHTML = '<p><br></p>';
        const p = ed.querySelector('p');
        const s = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(p);
        r.collapse(true);
        s.removeAllRanges();
        s.addRange(r);
    });
    await page.waitForTimeout(200);
    console.log('=== AFTER CLEAR ===');
    console.log('HTML:', await page.locator('#editor').innerHTML());

    await page.keyboard.type('# Hello', { delay: 20 });
    await page.waitForTimeout(800);
    console.log('=== AFTER "# Hello" ===');
    console.log('HTML:', await page.locator('#editor').innerHTML());

    // Bold test
    await page.evaluate(() => {
        const ed = document.getElementById('editor');
        ed.innerHTML = '<p><br></p>';
        const p = ed.querySelector('p');
        const s = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(p);
        r.collapse(true);
        s.removeAllRanges();
        s.addRange(r);
    });
    await page.waitForTimeout(200);
    await page.keyboard.type('test', { delay: 20 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+b');
    await page.waitForTimeout(300);
    console.log('=== AFTER Meta+B ===');
    console.log('HTML:', await page.locator('#editor').innerHTML());

    // Try with Control+b (for headless Chromium on macOS)
    await page.evaluate(() => {
        const ed = document.getElementById('editor');
        ed.innerHTML = '<p><br></p>';
        const p = ed.querySelector('p');
        const s = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(p);
        r.collapse(true);
        s.removeAllRanges();
        s.addRange(r);
    });
    await page.waitForTimeout(200);
    await page.keyboard.type('test', { delay: 20 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(300);
    console.log('=== AFTER Control+B ===');
    console.log('HTML:', await page.locator('#editor').innerHTML());

    await browser.close();
    srv.close();
});
