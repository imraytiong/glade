import { test, expect } from '@playwright/test';
import { GladeClient } from '../src/sdk/client';

test.describe('Glade Headless SDK', () => {
  const vaultPath = process.cwd();
  const client = new GladeClient(1421);

  test('should be able to get agents', async () => {
    const agents = await client.getAgents(vaultPath);
    expect(Array.isArray(agents)).toBe(true);
  });

  test('should stream agent responses', async () => {
    const agents = await client.getAgents(vaultPath);
    test.skip(agents.length === 0, 'No agents available to test streaming');

    const agent = agents[0];
    const stream = client.invokeAgentStream(vaultPath, agent, [
      {
        id: 'test-1',
        role: 'user',
        content: 'Say the exact words "Glade SDK Test Successful" and nothing else.',
        timestamp: Date.now(),
      }
    ]);

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
    }

    expect(fullResponse.trim()).toContain('Glade SDK Test Successful');
  });
});
