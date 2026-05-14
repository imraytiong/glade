import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// To run this test, ensure you have BOTH the frontend dev server AND the headless backend running:
// Terminal 1: npm run dev
// Terminal 2: cargo run -- --headless

test.describe('Headless Fallback E2E', () => {
  let testVaultPath: string;

  test.beforeAll(() => {
    // Create a temporary vault for testing
    testVaultPath = path.join(os.tmpdir(), 'glade-headless-test-vault-' + Date.now());
    fs.mkdirSync(testVaultPath, { recursive: true });
    fs.mkdirSync(path.join(testVaultPath, '.glade'), { recursive: true });
    fs.writeFileSync(path.join(testVaultPath, 'hello.md'), '# Hello Headless World!');
  });

  test.afterAll(() => {
    fs.rmSync(testVaultPath, { recursive: true, force: true });
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Do NOT mock __TAURI_INTERNALS__ here. We want it to use the HTTP fallback.
    await page.addInitScript((vault) => {
      // Set localStorage so the app opens our test vault
      localStorage.setItem('glade_vaultPath', vault);
    }, testVaultPath);

    await page.goto('http://localhost:1420/');
  });

  test('should load files from real filesystem using headless backend', async ({ page }) => {
    try {
    await expect(page.locator('.node-name:has-text("hello")')).toBeVisible({ timeout: 10000 });
    } catch (e) {
      console.log(await page.content());
      throw e;
    }
  });

  test('should create a new agent using headless backend', async ({ page }) => {
    // Open agents pane
    const agentButton = page.locator('button[title="Agents"]');
    if (await agentButton.isVisible()) {
      await agentButton.click();
    } else {
      await page.locator('.sidebar-nav-item .lucide-users').click().catch(() => {});
    }

    // Wait for Agents pane
    await expect(page.locator('.agent-config-pane')).toBeVisible();

    // Click "New Agent"
    await page.locator('button[title="New Agent"]').click();

    // Edit agent fields
    await page.locator('input').first().fill('Headless Test Agent');
    await page.locator('textarea').fill('You are a headless test agent.');

    // Save
    await page.locator('button:has-text("Save")').click();

    // Verify it appeared in the list
    await expect(page.locator('.agent-list-item:has-text("Headless Test Agent")')).toBeVisible();

    // Verify the file was actually written to the filesystem!
    const agentFileExists = fs.existsSync(path.join(testVaultPath, '.glade', 'agents.json'));
    expect(agentFileExists).toBe(true);

    const agentData = JSON.parse(fs.readFileSync(path.join(testVaultPath, '.glade', 'agents.json'), 'utf-8'));
    expect(agentData.agents.some((a: any) => a.name === 'Headless Test Agent')).toBe(true);
  });
});
