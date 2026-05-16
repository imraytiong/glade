import { test, expect } from './fixtures/vault-fixture';

test.describe('Tool Authorization & Observability', () => {
  test('should display approval prompt and allow approval for human-in-the-loop overrides', async ({ page, dynamicVaultPath }) => {
    // Intercept approve_agent_action so it doesn't fail on the real backend
    await page.route('http://127.0.0.1:1421/api/approve_agent_action', async route => {
      const postData = route.request().postDataJSON();
      expect(postData.id).toBe('mock-approval-id');
      expect(postData.approved).toBe(true);
      await route.fulfill({ status: 200, body: 'true' });
    });

    await page.goto('/');
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, dynamicVaultPath);
    await page.reload();

    // Verify the UI loaded
    await expect(page.locator('.sidebar-content')).toBeVisible();

    // Open Agent Chat
    await page.getByTitle('Agent Chat').click();
    const agentSidebar = page.locator('.agent-sidebar');
    await expect(agentSidebar).toBeVisible();

    // Dispatch a mock TraceEvent: ApprovalRequired
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('mock-tauri-event', {
        detail: {
          event: 'glade://agent-trace',
          payload: {
            ApprovalRequired: {
              id: 'mock-approval-id',
              tool_name: 'delete_directory',
              args: { path: './dist' }
            }
          }
        }
      }));
    });

    // Check if the Agent Chat shows the pending approval message
    await expect(agentSidebar.locator('.agent-message.agent').getByText('Approval required for tool: delete_directory')).toBeVisible();
    
    // Click the Approve button
    const approveBtn = agentSidebar.locator('button:has-text("Approve")');
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Verify it updates to say (Approved)
    await expect(agentSidebar.locator('.agent-message.agent').getByText('(Approved)')).toBeVisible();
  });

  test('should display execution tracing in Telemetry panel', async ({ page, dynamicVaultPath }) => {
    await page.goto('/');
    await page.evaluate((path) => {
      localStorage.setItem('glade_vaultPath', path);
    }, dynamicVaultPath);
    await page.reload();

    // Open Telemetry view
    await page.getByTitle('Activity Traces').click();
    const traceView = page.getByRole('heading', { name: 'Telemetry' }).locator('..').locator('..');
    await expect(traceView).toBeVisible();

    // Dispatch a series of mock TraceEvents
    await page.evaluate(() => {
      const dispatch = (payload: any) => window.dispatchEvent(new CustomEvent('mock-tauri-event', {
        detail: { event: 'glade://agent-trace', payload }
      }));

      dispatch('StepStarted');
      dispatch({ ToolRequested: { name: 'list_files', args: { dir: '.' } } });
      dispatch({ ToolResult: { name: 'list_files', result: '["file.md"]' } });
      dispatch('Completed');
    });

    // Verify the trace logs render
    // Verify the trace logs render
    await expect(page.getByText('Agent step started...')).toBeVisible();
    await expect(page.getByText('Requested tool: list_files')).toBeVisible();
    await expect(page.getByText('Tool result for list_files')).toBeVisible();
    await expect(page.getByText('Agent step completed.')).toBeVisible();
  });
});
