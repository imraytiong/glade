import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { GladeClient } from '../sdk/client.js';

export async function runMcpServer(vaultPath: string, port: number = 1421) {
  const client = new GladeClient(port);
  
  const server = new Server(
    {
      name: 'glade-mcp',
      version: '0.0.1-alpha.3',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const agents = await client.getAgents(vaultPath);
      
      return {
        tools: agents.map(agent => ({
          name: `glade_${agent.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          description: `Invoke the ${agent.name} agent in Glade. System Prompt: ${agent.systemPrompt.substring(0, 100)}...`,
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The instruction or prompt to send to the agent.',
              },
            },
            required: ['prompt'],
          },
        })),
      };
    } catch (error: any) {
      console.error("Error fetching agents:", error);
      return { tools: [] };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const match = request.params.name.match(/^glade_(.+)$/);
    if (!match) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    const agentIdOrNormalized = match[1];
    
    try {
      const agents = await client.getAgents(vaultPath);
      const agent = agents.find(a => a.id.replace(/[^a-zA-Z0-9_-]/g, '_') === agentIdOrNormalized);

      if (!agent) {
        throw new McpError(ErrorCode.InvalidParams, `Agent not found: ${agentIdOrNormalized}`);
      }

      const args = request.params.arguments as { prompt?: string };
      if (!args || !args.prompt) {
        throw new McpError(ErrorCode.InvalidParams, "Missing 'prompt' argument");
      }

      const response = await client.invokeAgent(vaultPath, agent, [
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: args.prompt,
          timestamp: Date.now(),
        }
      ]);

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error invoking agent: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Glade MCP server running on stdio');
}
