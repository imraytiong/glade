import { test, expect } from './fixtures/vault-fixture';
import { GladeClient } from '../src/sdk/client';
import * as fs from 'fs';
import * as path from 'path';

test.describe('File System Zones & Security', () => {
  const client = new GladeClient(1421);

  test('should restrict agent file operations based on allowed_zones', async ({ dynamicVaultPath, request }) => {
    // 1. Setup mock LLM server to attempt writing outside allowed zones
    await request.post('http://localhost:1422/set-mock-response', {
      data: {
        responses: [
          // The agent attempts to write to /etc/passwd or something outside the vault,
          // or outside its specific allowed zone.
          {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "write_file",
                        args: { 
                          path: "restricted/secret.txt", 
                          content: "Agent wants to steal data." 
                        }
                      }
                    }
                  ]
                }
              }
            ]
          },
          // Final text response to conclude the stream
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Attempted to write file." }]
                }
              }
            ]
          }
        ]
      }
    });

    // Define a restricted agent that can only write to the "public" folder.
    const restrictedAgent: any = {
      id: "restricted_agent",
      name: "Restricted Agent",
      system_prompt: "You are a restricted agent.",
      tools_allowed: ["write_file"],
      allowed_zones: [
        {
          path: "public",
          permission: "write"
        }
      ]
    };

    // Invoke the agent
    const stream = client.invokeAgentStream(dynamicVaultPath, restrictedAgent, [
      {
        id: 'test-msg-1',
        role: 'user',
        content: 'Write to restricted/secret.txt',
        timestamp: Date.now(),
      }
    ]);

    let fullResponse = '';
    let errorMessage = '';

    try {
      for await (const chunk of stream) {
        fullResponse += chunk;
      }
    } catch (e: any) {
      // The stream throws an error if the tool execution fails inside Rust
      errorMessage = e.message;
    }

    // Since the tool call is handled internally by AgentManager and errors are reported 
    // back to the LLM as tool_results, the stream might actually succeed but the 
    // LLM receives the error. Wait, if the tool fails, does the stream throw?
    // Let's check how mock-server or the agent handles it. Usually tool errors are fed back 
    // to the agent. If it's fed back, the mock server doesn't know it. But wait, our mock 
    // server has a fixed queue. The second response is "Attempted to write file."
    
    // So the stream won't throw. We need to check if the file was created on disk!
    // So the stream won't throw. We need to check if the file was created on disk!
    const secretPath = path.join(dynamicVaultPath, 'restricted', 'secret.txt');
    const fileExists = fs.existsSync(secretPath);

    expect(fileExists).toBe(false);

    // Also we can fetch Trace events from mock-server (if any) or just assert that 
    // the tool result contains "Access denied" by checking the mock server requests.
    const mockRequestsResponse = await request.get('http://localhost:1422/get-mock-requests');
    const mockRequestsData = await mockRequestsResponse.json();
    const requests = mockRequestsData.requests;

    expect(requests.length).toBeGreaterThan(1);
    
    // The second request (index 1) to the LLM should contain the tool result
    const toolResultReq = requests[1];
    const contents = JSON.stringify(toolResultReq.contents || []);
    
    // Verify the tool result contains the access denied message
    expect(contents).toContain('Access denied');
    expect(contents).toContain('restricted/secret.txt');
  });
});
