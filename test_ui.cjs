const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:1420');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'before_click.png' });
  await browser.close();
})();
