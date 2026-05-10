import { test, expect } from '@playwright/test';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure fresh state
    await page.evaluate(() => localStorage.clear());
  });

  test('Cmd+P opens command palette and Backspace falls back to file search', async ({ page }) => {
    // Use Meta+p for Mac, Control+p for others. Playwright handles platform differences if we use Meta but it runs tests locally on mac.
    await page.keyboard.press('Meta+p');

    const paletteInput = page.locator('.palette-search input');
    await expect(paletteInput).toBeVisible();
    await expect(paletteInput).toHaveAttribute('placeholder', 'Type a command...');

    // Press Backspace when empty
    await page.keyboard.press('Backspace');

    // Should fall back to files mode
    await expect(paletteInput).toHaveAttribute('placeholder', 'Search files by name... (Type > for commands)');
  });

  test('Typing > switches to command mode', async ({ page }) => {
    // Open in file search mode
    await page.keyboard.press('Meta+f');

    const paletteInput = page.locator('.palette-search input');
    await expect(paletteInput).toBeVisible();
    await expect(paletteInput).toHaveAttribute('placeholder', 'Search files by name... (Type > for commands)');

    // Type >
    await paletteInput.fill('>');

    // Check that we see command results (e.g., 'Toggle Sidebar')
    await expect(page.locator('.palette-results')).toContainText('Toggle Sidebar');
  });
});
