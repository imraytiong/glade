import { test, expect } from './fixtures/vault-fixture';
import { GladeClient } from '../src/sdk/client';

test.describe('Glade Headless SDK', () => {
  const client = new GladeClient(1421);

  test('should be able to get agents', async ({ dynamicVaultPath }) => {
    const agents = await client.getAgents(dynamicVaultPath);
    expect(Array.isArray(agents)).toBe(true);
  });

  test('should stream agent responses', async ({ dynamicVaultPath, request }) => {
    // Configure mock server to respond with success message
    await request.post('http://localhost:1422/set-mock-response', {
      data: {
        responses: [
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Glade SDK Test Successful" }]
                }
              }
            ]
          }
        ]
      }
    });

    const agents = await client.getAgents(dynamicVaultPath);
    test.skip(agents.length === 0, 'No agents available to test streaming');

    const agent = agents[0];
    const stream = client.invokeAgentStream(dynamicVaultPath, agent, [
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

  test('should execute tools from agent response', async ({ dynamicVaultPath, request }) => {
    // Set up mock server queue
    await request.post('http://localhost:1422/set-mock-response', {
      data: {
        responses: [
          // First response: Tool call
          {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "list_directory",
                        args: { path: "." }
                      }
                    }
                  ]
                }
              }
            ]
          },
          // Second response: Final text
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Directory listed successfully." }]
                }
              }
            ]
          }
        ]
      }
    });

    const agents = await client.getAgents(dynamicVaultPath);
    test.skip(agents.length === 0, 'No agents available to test streaming');

    const agent = agents.find(a => a.id === 'default') || agents[0];
    const stream = client.invokeAgentStream(dynamicVaultPath, agent, [
      {
        id: 'test-2',
        role: 'user',
        content: 'List the directory.',
        timestamp: Date.now(),
      }
    ]);

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
    }

    expect(fullResponse.trim()).toContain('Directory listed successfully.');
  });
});
