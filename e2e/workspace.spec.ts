import { test, expect } from './fixtures/vault-fixture';

test.describe('Agent Workspace Phase 2', () => {

  test.beforeEach(async ({ page, dynamicVaultPath }) => {
    // Open the app and load the test vault
    await page.goto('/');
    
    // Auto-open vault by setting localStorage
    await page.evaluate((vaultPath) => {
      localStorage.setItem('glade_vaultPath', vaultPath);
    }, dynamicVaultPath);
    
    await page.reload();
  });

  test('should toggle to agent workspace', async ({ page }) => {
    // Default view should be editor
    await expect(page.locator('text=Select a file to start editing.')).toBeVisible();

    await page.screenshot({ path: 'debug.png' });
    
    // Toggle to Agent view
    await page.getByRole('button', { name: 'Fleet Builder' }).click({ force: true });

    // The Agent Workspace should be visible, defaulting to Agents
    await expect(page.locator('h1', { hasText: 'Agents' })).toBeVisible();


    // Toggle back to Editor view
    await page.getByRole('button', { name: 'Files' }).click();
    await expect(page.locator('text=Select a file to start editing.')).toBeVisible();
  });

  test('should navigate to agent workspace directly via URL param', async ({ page }) => {
    // Navigate with ?view=agent
    await page.goto('/?view=agent');
    
    // Should immediately show the agent workspace without needing to toggle
    await expect(page.locator('h1', { hasText: 'Agents' })).toBeVisible();
  });
});
