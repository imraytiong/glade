#!/usr/bin/env npx tsx
import { execSync } from 'child_process';
import { GladeClient } from '../src/sdk/client';

async function main() {
  console.log('⚖️ Agent-as-a-Judge: Starting verification...');

  // Get the git diff of the current working directory to analyze changes
  let diff = '';
  try {
    diff = execSync('git diff HEAD', { encoding: 'utf-8' });
  } catch (e) {
    console.error('Failed to get git diff. Are you in a git repository?');
    process.exit(1);
  }

  if (!diff) {
    console.log('No changes detected in the working directory to judge.');
    process.exit(0);
  }

  // Initialize Glade SDK to point to the local headless instance
  const client = new GladeClient('http://127.0.0.1:1421');
  
  // Create a prompt that asks an agent to review the diff
  const prompt = `
You are the Glade Agent-as-a-Judge.
Review the following git diff and determine if there are any regressions, safety issues, or violations of our architecture constraints (e.g. breaking the Tauri/Headless bridge).

<diff>
${diff}
</diff>

Provide a short summary of the changes and state "PASS" if the code is safe to commit, or "FAIL" with reasons if it violates any rules.
`;

  try {
    // Invoke the coordinator or a dedicated judge agent
    const stream = client.invokeAgentStream('', 'coordinator', prompt);
    
    console.log('\n--- Judge Response ---\n');
    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }
    console.log('\n\n--- End of Response ---\n');
  } catch (error) {
    console.error('Failed to invoke agent judge. Ensure the headless backend is running on port 1421.', error);
    process.exit(1);
  }
}

main().catch(console.error);
