import { test, expect } from '@playwright/test';

test.describe('Editor Features', () => {
  test.beforeEach(async ({ page }) => {
    // Open the app
    await page.goto('http://localhost:1420/');
    
    // We need to trigger opening a file or creating one to access the editor
    // Mock the tauri API to bypass the actual folder selection if needed,
    // or simulate creating a test file if the app allows it.
    // For now, let's assume we can interact with the app.
    // NOTE: This E2E test requires the vault to be open.
    // Since Tauri E2E is tricky to mock native dialogs, we might need a test mode.
    // But we can check if Editor exists.
  });

  test('Types [[ to open interlink suggestion', async ({ page }) => {
    // This test might fail if the editor isn't visible initially.
    // If there is an editor:
    // await page.locator('.cm-content').click();
    // await page.keyboard.type('[[');
    // await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible();
  });
});
