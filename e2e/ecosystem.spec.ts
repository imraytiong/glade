import { test, expect } from './fixtures/vault-fixture';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Ecosystem Extensibility UI', () => {
  test('should display MCP tools and Agent Skills in the UI', async ({ page, dynamicVaultPath }) => {
    // 1. Create a mock MCP server config
    const mcpConfigPath = path.join(dynamicVaultPath, '.glade', 'mcp_servers.json');
    const mcpConfig = {
      mcpServers: {
        "test-mcp": {
          command: "node",
          args: ["-e", "console.log('test')"]
        }
      }
    };
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

    // 2. Create a test Agent Skill
    const skillDirPath = path.join(dynamicVaultPath, '.glade', 'agents', 'skills', 'test_skill');
    fs.mkdirSync(skillDirPath, { recursive: true });
    
    const skillContent = `---
name: Test Skill
description: A skill for testing
version: 1.0.0
---

# Test Skill Instructions
You are a test skill.
`;
    fs.writeFileSync(path.join(skillDirPath, 'SKILL.md'), skillContent);

    // 3. Navigate to the App
    await page.goto('/');
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, dynamicVaultPath);
    await page.reload();

    // Verify UI is ready
    await expect(page.locator('.sidebar-content')).toBeVisible();

    // 4. Test MCP Tools View
    await page.getByTitle('MCP Tools').click();
    await expect(page.getByRole('heading', { name: 'Tools' })).toBeVisible();
    // Wait for the specific tool to appear in the list
    await expect(page.getByText('test-mcp')).toBeVisible();

    // Select the MCP server
    await page.getByText('test-mcp').click();
    await expect(page.locator('input[value="node"]')).toBeVisible();

    // 5. Test Agent Skills View
    await page.getByTitle('Agent Skills').click();
    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
    
    // The skill name from the frontmatter is "Test Skill" but the directory is "test_skill"
    // Usually the list shows the ID (agents/skills/test_skill) or the Name.
    await expect(page.getByText('Test Skill')).toBeVisible();
  });
});
