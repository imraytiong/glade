import { test, expect } from './fixtures/vault-fixture';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Agent Management E2E', () => {

  test.beforeEach(async ({ page, dynamicVaultPath }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    await page.addInitScript((vaultPath) => {
      localStorage.setItem('glade-vaults', JSON.stringify([{
        id: 'test-vault',
        name: 'Test Vault',
        path: vaultPath,
        created_at: Date.now(),
        last_accessed: Date.now()
      }]));
      localStorage.setItem('glade-active-vault', 'test-vault');
      localStorage.setItem('glade_vaultPath', vaultPath);
    }, dynamicVaultPath);

    await page.goto('/');
  });

  test('should create a new agent via the UI', async ({ page, dynamicVaultPath }) => {
    // Navigate to agent view
    await page.getByRole('button', { name: 'Fleet Builder' }).click();

    // The Fleet Builder header should be visible
    await expect(page.getByText('Fleet Overview')).toBeVisible();

    // Click "Create New Agent" button
    await page.getByRole('button', { name: '+ Create New Agent' }).click();

    // The name input should exist
    const nameInput = page.locator('label').filter({ hasText: /^Name$/ }).locator('..').locator('input[type="text"]');
    await nameInput.fill('Test E2E Agent');
    await page.waitForTimeout(500);

    // Add a description
    const descInput = page.locator('label').filter({ hasText: /^Description$/ }).locator('..').locator('input[type="text"]');
    await descInput.fill('A test agent for e2e validation.');
    await page.waitForTimeout(500);

    // Add a system prompt (since it is required)
    // The GladeEditor uses Milkdown/ProseMirror. We can focus the contenteditable area and type.
    await page.locator('.ProseMirror').first().click();
    await page.keyboard.type('This is the system prompt.');

    // Save the agent
    await page.getByRole('button', { name: 'Save Agent' }).click();

    // Verify at least one file contains the name and description
    const agentsDir = path.join(dynamicVaultPath, '.glade', 'agents');
    await expect.poll(() => {
      if (!fs.existsSync(agentsDir)) return false;
      const files = fs.readdirSync(agentsDir);
      for (const file of files) {
        if (file.endsWith('.agent.md')) {
          const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
          if (content.includes('Test E2E Agent') && content.includes('e2e validation')) {
            return true;
          }
        }
      }
      return false;
    }, { timeout: 5000 }).toBeTruthy();

    // The agent should appear in the Fleet Overview list
    await expect(page.locator('div').filter({ hasText: 'Test E2E Agent' }).first()).toBeVisible();
  });

  test('should modify an existing agent', async ({ page, dynamicVaultPath }) => {
    // Navigate to agent view
    await page.getByRole('button', { name: 'Fleet Builder' }).click();

    // Click on the existing 'Blog Generator' agent in the list
    // The vault-fixture includes a 'Blog Generator' by default
    await page.locator('.sidebar-item').filter({ hasText: 'Blog Generator' }).first().click();

    // Change the name
    const nameInput = page.locator('label').filter({ hasText: /^Name$/ }).locator('..').locator('input[type="text"]');
    await nameInput.fill('Modified Blog Generator');
    await page.waitForTimeout(500);

    // Save
    await page.getByRole('button', { name: 'Save Agent' }).click();
    await page.waitForTimeout(500);

    // Verify the file was updated
    const agentsDir = path.join(dynamicVaultPath, '.glade', 'agents');
    await expect.poll(() => {
      if (!fs.existsSync(agentsDir)) return false;
      const files = fs.readdirSync(agentsDir);
      for (const file of files) {
        const fullPath = path.join(agentsDir, file);
        if (fs.statSync(fullPath).isDirectory()) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('Modified Blog Generator')) {
          return true;
        }
      }
      return false;
    }, { timeout: 5000 }).toBeTruthy();

    // The fleet list should reflect the change
    await expect(page.locator('div').filter({ hasText: 'Modified Blog Generator' }).first()).toBeVisible();
  });
});
