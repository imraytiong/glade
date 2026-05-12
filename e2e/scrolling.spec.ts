import { test, expect } from '@playwright/test';

test('scrolling', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('glade_vaultPath', '/tmp/mock-vault');
    localStorage.setItem('glade_openFiles', JSON.stringify([{ path: '/tmp/mock-vault/test.md', name: 'test.md', isDirectory: false }]));
    localStorage.setItem('glade_activeFileIndex', '0');
  });
  await page.reload();
  await page.waitForTimeout(1000);
  
  // Fill editor with content
  await page.evaluate(() => {
    const editor = document.querySelector('.ProseMirror');
    if (editor) {
      editor.innerHTML = '<p>Test</p>'.repeat(100);
    }
  });
  
  await page.waitForTimeout(500);

  const heights = await page.evaluate(() => {
    const els = [
      '.app-container',
      '.main-content',
      '.editor-container',
      '.milkdown-container',
      '.milkdown',
      '.ProseMirror'
    ];
    return els.map(sel => {
      const el = document.querySelector(sel);
      if (!el) return { selector: sel, found: false };
      const style = window.getComputedStyle(el);
      return {
        selector: sel,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: style.overflowY,
        flex: style.flex,
        height: style.height,
        minHeight: style.minHeight
      };
    });
  });
  console.log(JSON.stringify(heights, null, 2));
});
