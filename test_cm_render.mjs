import puppeteer from 'puppeteer-core';
import fs from 'fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const allMarkup = fs.readFileSync('test-vault/all_markup.md', 'utf-8');

(async () => {
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  await page.goto('http://localhost:1420');
  
  // Inject React logic to mount Editor directly
  await page.evaluate((content) => {
    // wait for React to be available? No, we can't easily.
    // Let's just create a test component if possible.
  }, allMarkup);
  
  await browser.close();
})();
