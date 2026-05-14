The user mentioned the (judge) workflow. Here are its contents:

1. **Trigger Agent-as-a-Judge**
   // turbo-all
   Run `npx tsx scripts/agent_judge.ts` to programmatically review the current repository state and diffs.

2. **Analysis**
   - The Agent-as-a-Judge script will use the Glade SDK to verify the codebase against the Alpha 4 specifications.
   - Wait for the script output.

3. **Report**
   - If the judge reports regressions, highlight the exact files that broke the spec.
   - Provide a plan to immediately remediate the issue, requesting the user's approval.
