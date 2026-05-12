const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('Browser log:', msg.text()));
  page.on('pageerror', err => console.log('Browser error:', err));
  page.on('response', response => {
    if (response.status() === 404) console.log('404:', response.url());
  });
  await page.goto('http://localhost:1420/?test=editor');
  await page.waitForTimeout(2000);
  const pmExists = await page.$('.ProseMirror');
  console.log('ProseMirror exists:', !!pmExists);
  await browser.close();
})();
