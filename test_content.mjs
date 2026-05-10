import puppeteer from 'puppeteer-core';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  // Set localStorage before loading
  await page.goto('http://localhost:1420');
  
  await page.evaluate(() => {
    localStorage.setItem('glade_vaultPath', '/Users/raytiong/projects/glade/test-vault');
    localStorage.setItem('glade_openFiles', JSON.stringify([{name: 'all_markup.md', path: '/Users/raytiong/projects/glade/test-vault/all_markup.md'}]));
    localStorage.setItem('glade_activeFileIndex', '0');
  });
  
  await page.reload();
  
  await new Promise(r => setTimeout(r, 2000));
  
  const content = await page.evaluate(() => document.body.innerHTML);
  console.log("HTML CONTENT (length):", content.length);
  
  await browser.close();
})();
