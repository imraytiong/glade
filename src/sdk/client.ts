export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  modelClass?: string;
  toolsAllowed?: string[];
  skillsAllowed?: string[];
  allowInternalKnowledgeFallback?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
}

export class GladeClient {
  private baseUrl: string;

  constructor(port: number = 1421) {
    this.baseUrl = `http://127.0.0.1:${port}/api`;
  }

  async getAgents(vaultPath: string): Promise<Agent[]> {
    const res = await fetch(`${this.baseUrl}/get_agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath })
    });
    if (!res.ok) throw new Error(`Failed to get agents: ${await res.text()}`);
    return res.json();
  }

  async invokeAgent(vaultPath: string, agent: Agent, messages: ChatMessage[], context: string = ''): Promise<string> {
    const res = await fetch(`${this.baseUrl}/invoke_agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath, agent, messages, context })
    });
    if (!res.ok) throw new Error(`Failed to invoke agent: ${await res.text()}`);
    return res.text();
  }

  async *invokeAgentStream(vaultPath: string, agent: Agent, messages: ChatMessage[], context: string = ''): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${this.baseUrl}/invoke_agent_stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath, agent, messages, context })
    });

    if (!res.ok) throw new Error(`Failed to invoke agent stream: ${await res.text()}`);
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            yield data;
          } else if (line.startsWith('event: error')) {
            // Find the next line which should be data:
            const dataLineIndex = lines.indexOf(line) + 1;
            const dataLine = lines[dataLineIndex];
            throw new Error(`Agent error: ${dataLine}`);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async readDir(vaultPath: string, path: string = ''): Promise<any> {
    const res = await fetch(`${this.baseUrl}/fs_read_dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath, path })
    });
    if (!res.ok) throw new Error(`Failed to read dir: ${await res.text()}`);
    return res.json();
  }

  async readFile(vaultPath: string, path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/fs_read_text_file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath, path })
    });
    if (!res.ok) throw new Error(`Failed to read file: ${await res.text()}`);
    return res.text();
  }

  async writeFile(vaultPath: string, path: string, content: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/fs_write_text_file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath, path, content })
    });
    if (!res.ok) throw new Error(`Failed to write file: ${await res.text()}`);
  }
}
