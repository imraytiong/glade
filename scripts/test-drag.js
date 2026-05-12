import { webkit } from 'playwright';
(async () => {
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:1420');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  const content = await page.evaluate(() => document.body.innerHTML);
  console.log("Body:\n", content);
  
  await browser.close();
})();
