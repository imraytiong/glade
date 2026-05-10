import fs from 'fs';
import path from 'path';

const VAULT_DIR = path.join(process.cwd(), 'test-vault');

const TARGET_FOLDERS = [
  'core',
  'core/memory',
  'core/memory/vector-stores',
  'core/memory/vector-stores/pinecone',
  'patterns',
  'patterns/react',
  'tooling',
  'tooling/mcp',
  'tooling/mcp/servers',
  'ethics'
];

const LOREM_IPSUM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

const generateText = (repeat) => {
    let result = '';
    for(let i=0; i<repeat; i++) {
        result += LOREM_IPSUM + '\n\n';
    }
    return result;
}

const LARGE_TEXT = generateText(50);
const MEDIUM_TEXT = generateText(10);
const SMALL_TEXT = generateText(1);

const TOPICS = [
  'Introduction to Agents',
  'Memory Architectures',
  'Tool Calling Patterns',
  'Multi-Agent Systems',
  'Chain of Thought Prompting',
  'Model Context Protocol',
  'Security in Agentic Systems',
  'Evaluating LLMs',
  'Browser Automation',
  'Code Generation',
  'Self Reflection',
  'RAG Systems',
  'Vector Databases',
  'Prompt Engineering',
  'Alignment Problem'
];

if (fs.existsSync(VAULT_DIR)) {
  fs.rmSync(VAULT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(VAULT_DIR);

TARGET_FOLDERS.forEach(folder => {
  fs.mkdirSync(path.join(VAULT_DIR, folder), { recursive: true });
});

for (let i = 0; i < 15; i++) {
  const folder = TARGET_FOLDERS[Math.floor(Math.random() * TARGET_FOLDERS.length)];
  const topic = TOPICS[i % TOPICS.length];
  const fileName = topic.replace(/ /g, '-').toLowerCase() + '.md';
  const filePath = path.join(VAULT_DIR, folder, fileName);

  const rand = Math.random();
  let content = "# " + topic + "\n\n";
  
  if (rand < 0.33) {
    content += "## Overview (Small File)\n\n" + SMALL_TEXT;
  } else if (rand < 0.66) {
    content += "## Deep Dive (Medium File)\n\n" + MEDIUM_TEXT;
  } else {
    content += "## Comprehensive Guide (Large File)\n\n" + LARGE_TEXT;
  }

  // add some markdown formatting
  content += "\n### Code Example\n\n```javascript\nfunction agent() {\n  return 'hello';\n}\n```\n\n";
  content += "### Key Points\n- Fast\n- Reliable\n- Agentic\n\n";

  if (i > 0) {
    const prevTopic = TOPICS[(i - 1) % TOPICS.length];
    content += "\n\nSee also: [[" + prevTopic.replace(/ /g, '-').toLowerCase() + "]]";
  }

  fs.writeFileSync(filePath, content);
}

fs.writeFileSync(path.join(VAULT_DIR, 'index.md'), "# Agentic Software Development Vault\n\nWelcome to the knowledge base.\n\n" + SMALL_TEXT);
fs.writeFileSync(path.join(VAULT_DIR, 'todo.md'), "# TODO\n\n- [ ] Fix memory leaks\n- [ ] Upgrade MCP server\n- [ ] Write tests\n");

console.log('Test vault generated successfully at:', VAULT_DIR);
