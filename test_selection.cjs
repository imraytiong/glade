const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.addInitScript(() => {
    window.__TAURI_IPC__ = async (message) => {
      return { result: [], json: true };
    };
  });

  await page.goto('http://localhost:1420/');
  
  await page.evaluate(() => {
    localStorage.setItem('glade_vaultPath', '/mock/vault');
    localStorage.setItem('glade_openFiles', JSON.stringify([{ path: '/mock/vault/test.md', name: 'test.md', content: '# Hello World\nThis is text.' }]));
    localStorage.setItem('glade_activeFileIndex', '0');
  });
  
  await page.reload();
  await page.waitForTimeout(1000);

  const editorHTML = await page.evaluate(() => {
    const editor = document.querySelector('.cm-content');
    return editor ? 'Editor found' : 'No .cm-content found';
  });
  console.log(editorHTML);

  if (editorHTML !== 'No .cm-content found') {
    // Select text using mouse events to trigger CM
    const contentBox = await page.locator('.cm-content').boundingBox();
    if (contentBox) {
      await page.mouse.move(contentBox.x + 10, contentBox.y + 10);
      await page.mouse.down();
      await page.mouse.move(contentBox.x + 100, contentBox.y + 10);
      await page.mouse.up();
    }
    await page.waitForTimeout(500);

    const selectionColors = await page.evaluate(() => {
      const selBackground = document.querySelector('.cm-selectionBackground');
      if (selBackground) {
         return window.getComputedStyle(selBackground).backgroundColor;
      }
      return 'No selection background found';
    });
    console.log("Selection Background Color:", selectionColors);

    const contentBg = await page.evaluate(() => {
      const content = document.querySelector('.cm-content');
      return window.getComputedStyle(content).backgroundColor;
    });
    console.log(".cm-content background:", contentBg);
  }

  await browser.close();
})();
