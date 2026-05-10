const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:1420/');
  await page.waitForTimeout(1000); // Wait for CodeMirror to render
  
  // Dump the DOM inside the editor
  const editorHTML = await page.evaluate(() => {
    const editor = document.querySelector('.cm-content');
    return editor ? editor.innerHTML : 'No .cm-content found';
  });
  console.log(editorHTML);
  
  await browser.close();
})();
