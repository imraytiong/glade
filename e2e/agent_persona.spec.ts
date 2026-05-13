import { test, expect } from '@playwright/test';

test.describe('Agent Persona Framework', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    // Mock Tauri IPC before navigation
    await page.addInitScript(() => {
      // Create a mock state
      const mockState = {
        agents: [
          {
            id: 'coordinator',
            name: 'Coordinator',
            system_prompt: 'You are the Glade Coordinator Agent...',
            model_class: 'fast',
            tools_allowed: ['read_file'],
            skills_allowed: []
          },
          {
            id: 'refactor',
            name: 'Refactor',
            system_prompt: 'You are a refactoring agent.',
            model_class: 'fast',
            tools_allowed: [],
            skills_allowed: []
          }
        ],
        availableTools: ['read_file', 'mcpServer::tool'],
        availableSkills: ['.agents/skills/custom_skill']
      };

      // Mock Tauri IPC using __TAURI_INTERNALS__ which v2 uses
      window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
      window.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        console.log(`Mocked invoke called: ${cmd}`, args);
        if (cmd === 'get_agents') {
          return mockState.agents;
        }
        if (cmd === 'get_available_tools') {
          return mockState.availableTools;
        }
        if (cmd === 'get_available_skills') {
          return mockState.availableSkills;
        }
        if (cmd === 'save_agent') {
          const { agent } = args;
          const index = mockState.agents.findIndex(a => a.id === agent.id);
          if (index >= 0) {
            mockState.agents[index] = agent;
          } else {
            mockState.agents.push(agent);
          }
          return null;
        }
        if (cmd === 'delete_agent') {
          mockState.agents = mockState.agents.filter(a => a.id !== args.agentId);
          return null;
        }
        if (cmd === 'plugin:store|get') {
           return null;
        }
        if (cmd === 'plugin:fs|exists') {
           return false;
        }
        if (cmd === 'plugin:fs|read_text_file') {
           return "";
        }
        if (cmd === 'plugin:fs|read_dir') {
           return [
             { name: 'test.md', isDirectory: false, isFile: true }
           ];
        }
        return null;
      };

      // Set localStorage so the app thinks a vault is open
      localStorage.setItem('glade_vaultPath', '/mock/vault');
    });

    // We can visit the main app because Tauri invoke is mocked!
    await page.goto('http://localhost:1420/');
  });

  test('should display agent config pane and load agents', async ({ page }) => {
    // Open agents pane by clicking the agent sidebar icon
    // Assuming there's a button with an icon or aria-label for 'Agents Config'
    const agentButton = page.locator('button[title="Agents"]');
    if (await agentButton.isVisible()) {
      await agentButton.click();
    } else {
      // In case we don't have a title, let's look for the users icon or similar class
      await page.locator('.sidebar-nav-item .lucide-users').click().catch(() => {});
    }

    // Check if the Agents Config Pane is visible
    await expect(page.locator('.agent-config-pane')).toBeVisible();

    // It should load the mock agents
    await expect(page.locator('.agent-list-item:has-text("Coordinator")')).toBeVisible();
    await expect(page.locator('.agent-list-item:has-text("Refactor")')).toBeVisible();
  });

  test('should be able to create a new agent and persist it', async ({ page }) => {
    // Open agents pane
    const agentButton = page.locator('button[title="Agents"]');
    if (await agentButton.isVisible()) {
      await agentButton.click();
    } else {
      await page.locator('.sidebar-nav-item .lucide-users').click().catch(() => {});
    }

    // Click "New Agent"
    await page.locator('button[title="New Agent"]').click();

    // Edit agent fields
    await page.locator('input').first().fill('My Custom Agent');
    await page.locator('textarea').fill('You are a test agent.');

    // Save
    await page.locator('button:has-text("Save")').click();

    // Verify it appeared in the list
    await expect(page.locator('.agent-list-item:has-text("My Custom Agent")')).toBeVisible();
  });

  test('should display available tools and skills', async ({ page }) => {
    const agentButton = page.locator('button[title="Agents"]');
    if (await agentButton.isVisible()) {
      await agentButton.click();
    } else {
      await page.locator('.sidebar-nav-item .lucide-users').click().catch(() => {});
    }

    // Select the Coordinator agent
    await page.locator('.agent-list-item:has-text("Coordinator")').click();

    // We expect 'read_file' to be checked
    const readfileCheckbox = page.locator('label:has-text("read_file") input[type="checkbox"]');
    await expect(readfileCheckbox).toBeChecked();

    // We expect 'mcpServer::tool' to exist but be unchecked
    const mcpCheckbox = page.locator('label:has-text("mcpServer::tool") input[type="checkbox"]');
    await expect(mcpCheckbox).toBeVisible();
    await expect(mcpCheckbox).not.toBeChecked();

    // We expect 'custom_skill' to exist
    const skillCheckbox = page.locator('label:has-text(".agents/skills/custom_skill") input[type="checkbox"]');
    await expect(skillCheckbox).toBeVisible();
  });
});
