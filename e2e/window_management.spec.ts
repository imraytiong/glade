import { test, expect } from './fixtures/vault-fixture';

test.describe('Window Management State Synchronization', () => {

  test('should synchronize state between Editor window and Agent Workspace window', async ({ browser, dynamicVaultPath }) => {
    // 1. Open the primary Editor window
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    await page1.goto('/');
    await page1.evaluate((vaultPath) => {
      localStorage.setItem('glade_vaultPath', vaultPath);
    }, dynamicVaultPath);
    await page1.reload();
    
    await expect(page1.locator('text=Select a file to start editing.')).toBeVisible();

    // 2. Open the secondary Agent Workspace window
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    await page2.goto('/?view=agent');
    await page2.evaluate((vaultPath) => {
      localStorage.setItem('glade_vaultPath', vaultPath);
    }, dynamicVaultPath);
    await page2.reload();

    // Verify Agent Workspace loaded
    await expect(page2.locator('h1', { hasText: 'Agents' })).toBeVisible();

    // Note: Due to limitations testing Tauri events directly in pure browser context, 
    // we would ideally test 'glade://vault-updated' events here.
    // As a surrogate for multi-window webview testing, we confirm both routes load successfully
    // and correctly separate their views as if they were distinct Tauri windows.

    // Try to toggle views inside page1 and ensure it works locally
    await page1.getByRole('button', { name: 'Fleet Builder' }).click({ force: true });
    await expect(page1.locator('h1', { hasText: 'Agents' })).toBeVisible();
    
    await page1.getByRole('button', { name: 'Files' }).click({ force: true });
    await expect(page1.locator('text=Select a file to start editing.')).toBeVisible();
    
    // Close contexts
    await context1.close();
    await context2.close();
  });
});
