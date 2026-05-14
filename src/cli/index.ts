#!/usr/bin/env node
import { Command } from 'commander';
import { GladeClient } from '../sdk/client.js';

const program = new Command();

program
  .name('glade')
  .description('Glade Agentic Environment Headless CLI')
  .version('0.0.1-alpha.3');

program
  .command('invoke <agentName> <prompt>')
  .description('Invoke a Glade agent on a specific vault')
  .option('-v, --vault <path>', 'Vault path to execute on', process.cwd())
  .option('-p, --port <port>', 'Glade Headless Server Port', '1421')
  .action(async (agentName, prompt, options) => {
    try {
      const client = new GladeClient(parseInt(options.port));
      
      const agents = await client.getAgents(options.vault);
      const agent = agents.find(a => a.id === agentName || a.name === agentName);
      
      if (!agent) {
        console.error(`Error: Agent '${agentName}' not found in vault: ${options.vault}`);
        console.error('Available agents:', agents.map(a => a.name).join(', '));
        process.exit(1);
      }

      console.log(`Invoking agent '${agent.name}' on vault '${options.vault}'...\n`);

      const stream = client.invokeAgentStream(options.vault, agent, [
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        }
      ]);

      for await (const chunk of stream) {
        process.stdout.write(chunk);
      }
      
      console.log('\n\n--- Execution Complete ---');
    } catch (err: any) {
      console.error('\nError invoking agent:', err.message);
      process.exit(1);
    }
  });

program
  .command('mcp')
  .description('Run as an MCP server over stdio')
  .option('-v, --vault <path>', 'Vault path to expose to MCP', process.cwd())
  .option('-p, --port <port>', 'Glade Headless Server Port', '1421')
  .action(async (options) => {
    const { runMcpServer } = await import('./mcp.js');
    await runMcpServer(options.vault, parseInt(options.port));
  });

program.parse(process.argv);
