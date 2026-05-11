import { test, expect } from '@playwright/test';

test.describe('Editor Selection', () => {
  test('Selection layer is visible and not obscured by content background', async ({ page }) => {
    // Navigate to the test harness
    await page.goto('http://localhost:1420/?test=editor');

    // Wait for the editor content to appear
    const contentLocator = page.locator('.cm-content');
    await expect(contentLocator).toBeVisible();

    // Select all text
    await contentLocator.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Control+a');

    // The selection layer should now be present
    const selectionBg = page.locator('.cm-selectionBackground').first();
    await expect(selectionBg).toBeVisible();

    // Verify the .cm-content element does NOT have an opaque background color that would hide the selection
    const contentBgColor = await contentLocator.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // We expect the background color of .cm-content to be transparent (rgba(0, 0, 0, 0))
    expect(contentBgColor).toBe('rgba(0, 0, 0, 0)');
  });
});
