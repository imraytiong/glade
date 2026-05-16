import { test, expect } from './fixtures/vault-fixture';

test.describe('Open Vault', () => {
  test('should display Open Vault button when no vault is loaded and allow opening a vault', async ({ page, dynamicVaultPath }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    // Navigate to the app with NO vault loaded
    await page.goto('/');
    
    // Clear local storage just in case
    await page.evaluate(() => {
      localStorage.removeItem('glade_vaultPath');
    });
    
    // Reload to apply empty state
    await page.reload();

    // Verify the empty state is visible
    await expect(page.locator('.sidebar-content')).toContainText('No vault opened.');

    // Verify the Open Vault button is visible
    const openVaultBtn = page.getByTitle('Open Vault');
    await expect(openVaultBtn).toBeVisible();

    // Mock Tauri dialog to return dynamicVaultPath when clicked
    await page.addInitScript((mockPath) => {
      window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
      const originalInvoke = window.__TAURI_INTERNALS__.invoke;
      window.__TAURI_INTERNALS__.invoke = async function (cmd: string, args: any) {
        console.log('MOCK INVOKE CALLED:', cmd, args);
        if (cmd === 'plugin:dialog|open') {
          return mockPath;
        }
        if (cmd === 'plugin:fs|read_dir') {
          return [
            { name: 'mock-file.md', isDirectory: false, isFile: true, isSymlink: false }
          ];
        }
        if (cmd === 'plugin:fs|read_text_file') {
          return '# Mock File';
        }
        if (cmd === 'plugin:fs|exists') {
          return true;
        }
        if (originalInvoke) {
          return originalInvoke.call(this, cmd, args);
        }
        return Promise.resolve();
      };
    }, dynamicVaultPath);
    
    // Actually wait, addInitScript must be called BEFORE page load to affect the window.
    // Let's reload again so the init script takes effect
    await page.reload();
    
    // Click Open Vault
    await page.getByTitle('Open Vault').click();
    
    // The empty state should disappear and files should load
    await expect(page.getByText('Select a file to start editing.')).toBeVisible();
  });
});
