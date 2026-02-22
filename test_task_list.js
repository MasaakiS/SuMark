const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  const editor = await page.locator('div[contenteditable="true"]').first();
  await editor.click();
  await editor.focus();

  console.log('\n=== Testing task list input ===\n');
  await page.keyboard.type('- [ ] test item');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  const content = await editor.innerHTML();
  console.log('\nEditor HTML:');
  console.log(content);

  await browser.close();
})();
