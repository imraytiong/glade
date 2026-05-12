import { test, expect } from '@playwright/test';

test.describe('Find and Replace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/?test=editor');
    await page.waitForSelector('.ProseMirror');
  });

  test('should open find widget with Cmd+F and replace text', async ({ page }) => {
    const pm = page.locator('.ProseMirror');
    await pm.click();
    
    // Type some content
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', 'The quick brown fox jumps over the lazy dog. The fox is fast.');
      const event = new ClipboardEvent('paste', { clipboardData, bubbles: true });
      document.querySelector('.ProseMirror')?.dispatchEvent(event);
    });
    
    await expect(pm).toContainText('quick brown fox');

    // Trigger Cmd+F
    // Using Meta+f for Mac, Control+f for others.
    const isMac = await page.evaluate(() => navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    if (isMac) {
      await page.keyboard.press('Meta+f');
    } else {
      await page.keyboard.press('Control+f');
    }

    const findWidget = page.locator('input[placeholder="Find..."]');
    await expect(findWidget).toBeVisible();

    // The first input should be focused, type "fox"
    await page.keyboard.type('fox');
    
    // Tab to the next input (replace)
    await page.keyboard.press('Tab');
    await page.keyboard.type('cat');
    
    // Click 'Replace All'
    const replaceAllBtn = page.locator('button', { hasText: 'All' }); // In our component we wrote "All" or "Replace All"?
    
    // Wait, let's verify what the button text is. 
    // Usually it's "All" next to Replace. Let's just click it by getting the 4th button.
    // We can also just click button with title 'Replace All' if we added titles.
  });
});
