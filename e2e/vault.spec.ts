import { test, expect } from './fixtures/vault-fixture';

test.describe('Vault Management', () => {
  test('should open a vault and display files', async ({ page, dynamicVaultPath }) => {
    // Start with NO vault
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('glade_vaultPath'));
    await page.reload();
    
    // Ensure the welcome screen is visible
    await expect(page.getByRole('button', { name: 'Open Vault' }).first()).toBeVisible();

    // Mock the open dialog result
    await page.evaluate((path) => {
      (window as any).__mockOpenDialogResult = path;
    }, dynamicVaultPath);

    // Click the open vault button
    await page.getByRole('button', { name: 'Open Vault' }).first().click();

    // Verify the vault opens and files are displayed
    await expect(page.getByText('mock-file', { exact: true })).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
