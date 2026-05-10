const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:1420', {waitUntil: 'networkidle0', timeout: 5000});
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.evaluate(() => {
    const editor = document.querySelector('.cm-content');
    return editor ? editor.innerHTML : 'No Editor';
  });
  console.log("HTML:", html.substring(0, 1000));
  const bullets = await page.evaluate(() => {
    return document.querySelectorAll('.cm-bullet').length;
  });
  console.log("Bullets count:", bullets);
  const hrs = await page.evaluate(() => {
    return document.querySelectorAll('.cm-hr').length;
  });
  console.log("Hr count:", hrs);
  await browser.close();
})();
