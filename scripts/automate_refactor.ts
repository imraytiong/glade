import { GladeClient } from '../src/sdk/client';
import * as path from 'path';

async function main() {
  // We assume the headless server is running on 1421
  const client = new GladeClient(1421);
  const vaultPath = process.env.GLADE_VAULT || process.cwd();

  console.log(`Starting automated refactor in vault: ${vaultPath}`);

  // Fetch agents to find the refactor agent
  const agents = await client.getAgents(vaultPath);
  if (agents.length === 0) {
    console.error("No agents found in this vault. Please create an agent first.");
    process.exit(1);
  }
  
  // Pick the first available agent, assuming it's capable
  const agent = agents[0];
  console.log(`Using agent: ${agent.name} (${agent.id})`);

  // Define our automated instruction
  const taskInstruction = `
    Please scan the src/components directory and add JSDoc comments to all React components.
    Do not change the implementation logic, only add comments.
  `;

  const messages = [
    {
      id: Date.now().toString(),
      role: 'user' as const,
      content: taskInstruction,
      timestamp: Date.now(),
    }
  ];

  console.log('Invoking agent stream...');
  
  try {
    const stream = client.invokeAgentStream(vaultPath, agent, messages);
    for await (const chunk of stream) {
      // Print the chunk to stdout without a trailing newline
      process.stdout.write(chunk);
    }
    console.log('\n\n✅ Automation task completed.');
  } catch (err) {
    console.error('\n\n❌ Automation failed:', err);
    process.exit(1);
  }
}

main();
