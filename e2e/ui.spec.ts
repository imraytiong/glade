import { test, expect } from '@playwright/test';

test.describe('Glade UI Headless', () => {
  test('should load the application and vault', async ({ page }) => {
    // Navigate to the app to initialize the origin
    await page.goto('/');

    // Set the vault path to the current working directory to bypass the native open dialog
    const vaultPath = process.cwd();
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, vaultPath);

    // Reload the page to trigger vault loading from local storage
    await page.reload();

    // Verify the UI loaded by checking for the sidebar content
    await expect(page.locator('.sidebar-content')).toBeVisible();

    // Check that we can see the sidebar files or a state indicating the vault is loaded
    await expect(page.locator('.empty-state p')).toContainText('Select a file to start editing.');
  });
});
