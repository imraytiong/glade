const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:1420'); // Tauri dev server usually runs on 1420
  
  // Wait for the UI to load
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ path: 'before_click.png' });
  
  await browser.close();
})();
