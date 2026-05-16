import { test, expect } from './fixtures/vault-fixture';
import { GladeClient } from '../src/sdk/client';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Vault Intelligence (Semantic Search & Shadow FS)', () => {
  const client = new GladeClient(1421);

  test('should execute semantic_search and log execution to Shadow FS', async ({ dynamicVaultPath, request }) => {
    test.setTimeout(60000); // LanceDB can take a while to initialize the first time or under load
    // 1. Setup mock LLM server to trigger semantic_search
        // 2. Setup mock LLM server to trigger semantic_search and agent_log
    await request.post('http://localhost:1422/set-mock-response', {
      data: {
        responses: [
          // 1st response: call semantic_search
          {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "semantic_search",
                        args: { 
                          query: "how to use semantic search",
                          limit: 2
                        }
                      }
                    }
                  ]
                }
              }
            ]
          },
          // 2nd response: call agent_log
          {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "agent_log",
                        args: { 
                          entry: "Logged semantic search results."
                        }
                      }
                    }
                  ]
                }
              }
            ]
          },
          // 3rd response: final response
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "I have searched the vault and logged the results." }]
                }
              }
            ]
          }
        ]
      }
    });

    // Define the agent
    const testAgent: any = {
      id: "search_agent",
      name: "Search Agent",
      system_prompt: "You are a search agent.",
      tools_allowed: ["semantic_search", "agent_log"]
    };

    // Invoke the agent
    const stream = client.invokeAgentStream(dynamicVaultPath, testAgent, [
      {
        id: 'test-msg-1',
        role: 'user',
        content: 'Please search for semantic search documentation and log it.',
        timestamp: Date.now(),
      }
    ]);

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
    }

    // Check that mock server received the tool responses
    const mockRequestsResponse = await request.get('http://localhost:1422/get-mock-requests');
    const mockRequestsData = await mockRequestsResponse.json();
    const requests = mockRequestsData.requests;

    expect(requests.length).toBeGreaterThan(1);
    // The second request (index 1) to the LLM should contain the tool result for BOTH semantic_search and agent_log
    const secondReq = requests[1];
    const contents = JSON.stringify(secondReq.contents || []);
    
    // Verify the tool result contains the semantic_search function response
    expect(contents).toContain('semantic_search');
    expect(contents).toContain('functionResponse');

    // Verify the tool result contains the agent_log function response
    expect(contents).toContain('agent_log');
    expect(contents).toContain('Appended to execution log');

    // Verify Shadow FS logged the execution
    const shadowFsLogPath = path.join(dynamicVaultPath, '.glade', '.shadow', 'agents', 'search_agent', 'execution.log');
    const logExists = fs.existsSync(shadowFsLogPath);
    expect(logExists).toBe(true);

    const logContent = fs.readFileSync(shadowFsLogPath, 'utf-8');
    expect(logContent).toContain('Logged semantic search results.');
  });
});
