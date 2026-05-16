import { test, expect } from './fixtures/vault-fixture';

test.describe('Agent Chat E2E', () => {
  test('should open right sidebar, send a message, and receive response', async ({ page, dynamicVaultPath, request }) => {
    // Navigate to the app and bypass the open vault dialog
    await page.goto('/');
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, dynamicVaultPath);
    await page.reload();

    // Verify the UI loaded
    await expect(page.getByText('Select a file to start editing.')).toBeVisible();

    // Configure mock LLM server response
    await request.post('http://localhost:1422/set-mock-response', {
      data: {
        responses: [
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Hello from the agent!" }]
                }
              }
            ]
          }
        ]
      }
    });

    // Open Agent Chat
    await page.getByTitle('Agent Chat').click();

    // Verify sidebar opened
    await expect(page.locator('.agent-sidebar')).toBeVisible();

    // Type and send message
    await page.locator('.agent-input').fill('Hello agent');
    await page.locator('.agent-send-btn').click();

    // Verify user message appears
    await expect(page.locator('.agent-message.user').getByText('Hello agent')).toBeVisible();

    // Verify agent response appears (mock LLM returns "Hello from the agent!")
    await expect(page.locator('.agent-message.agent').getByText('Hello from the agent!')).toBeVisible({ timeout: 10000 });
  });

  test('should include active file content in context (RAG)', async ({ page, dynamicVaultPath, request }) => {
    // Navigate to the app and bypass the open vault dialog
    await page.goto('/');
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, dynamicVaultPath);
    await page.reload();

    // Open a file
    await page.getByText('mock-file', { exact: true }).click();
    await expect(page.locator('.ProseMirror')).toBeVisible();
    
    // Wait for the file content to load before typing!
    await expect(page.locator('.ProseMirror')).toContainText('Mock File');

    // Type something in the file
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is a secret RAG context.');
    
    // Give it a moment to save to state
    await page.waitForTimeout(500);

    // Clear mock requests
    await request.post('http://localhost:1422/clear-mock-requests');

    // Configure mock LLM server response
    await request.post('http://localhost:1422/set-mock-response', {
      data: {
        responses: [
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Context received!" }]
                }
              }
            ]
          }
        ]
      }
    });

    // Open Agent Chat
    await page.getByTitle('Agent Chat').click();
    await expect(page.locator('.agent-sidebar')).toBeVisible();

    // Type and send message
    await page.locator('.agent-input').fill('What is the context?');
    await page.locator('.agent-send-btn').click();

    // Verify agent response appears
    await expect(page.locator('.agent-message.agent').getByText('Context received!')).toBeVisible({ timeout: 10000 });

    // Fetch the mock requests to verify the context was sent
    const response = await request.get('http://localhost:1422/get-mock-requests');
    const data = await response.json();
    
    const requests = data.requests || [];
    expect(requests.length).toBeGreaterThan(0);
    
    // Check if the "This is a secret RAG context." was sent as part of the context
    // It should be embedded somewhere in the requests sent to the LLM
    const allRequestsStr = JSON.stringify(requests);
    expect(allRequestsStr).toContain('This is a secret RAG context.');
  });

  test('should retain conversation memory across view switches', async ({ page, dynamicVaultPath, request }) => {
    // Navigate to the app and bypass the open vault dialog
    await page.goto('/');
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, dynamicVaultPath);
    await page.reload();

    await request.post('http://localhost:1422/set-mock-response', {
      data: { responses: [{ candidates: [{ content: { parts: [{ text: "Memory active." }] } }] }] }
    });

    // Open Agent Chat and send message
    await page.getByTitle('Agent Chat').click();
    await page.locator('.agent-input').fill('Remember this message');
    await page.locator('.agent-send-btn').click();
    await expect(page.locator('.agent-message.agent').getByText('Memory active.')).toBeVisible({ timeout: 10000 });

    // Switch to Models view (which hides editor and agent chat)
    await page.getByTitle('AI Models').click();
    await expect(page.locator('.agent-sidebar')).not.toBeVisible();
    await expect(page.getByText('Role-Based Model Assignment')).toBeVisible();
    // Switch back to Editor view (which should reopen agent chat because it was open)
    await page.getByTitle('Files').click();
    
    // Or we click Agent Chat button again
    // The sidebar state logic: `setCurrentView("editor"); if (!isAgentSidebarOpen) setIsAgentSidebarOpen(true);`
    await page.getByTitle('Agent Chat').click();
    await expect(page.locator('.agent-sidebar')).toBeVisible();

    // Verify message is still there
    await expect(page.locator('.agent-message.user').getByText('Remember this message')).toBeVisible();
    await expect(page.locator('.agent-message.agent').getByText('Memory active.')).toBeVisible();
  });

  test('should invoke inline /agent prompt and modify editor content', async ({ page, dynamicVaultPath, request }) => {
    // Navigate and setup
    await page.goto('/');
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, dynamicVaultPath);
    await page.reload();

    // Open a file
    await page.getByText('mock-file', { exact: true }).click();
    await expect(page.locator('.ProseMirror')).toBeVisible();
    await expect(page.locator('.ProseMirror')).toContainText('Mock File');

    // Type something
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Old text');

    // Select the text (Ctrl+A / Cmd+A)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+A`);

    await request.post('http://localhost:1422/set-mock-response', {
      data: { responses: [{ candidates: [{ content: { parts: [{ text: "New shiny text" }] } }] }] }
    });

    // Dispatch the custom event to open agent prompt
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('open-agent-prompt'));
    });

    // Verify prompt menu appears
    await expect(page.locator('.agent-prompt-menu')).toBeVisible();

    // Type prompt
    await page.locator('.agent-prompt-menu input[type="text"]').fill('Rewrite this better');
    await page.keyboard.press('Enter');

    // Wait for prompt to close
    await expect(page.locator('.agent-prompt-menu')).not.toBeVisible({ timeout: 10000 });

    // Verify editor text contains "New shiny text"
    await expect(page.locator('.ProseMirror')).toContainText('New shiny text');
  });
});
