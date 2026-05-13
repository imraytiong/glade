# Alpha 2: The Agentic Foundation

This document serves as the master implementation plan and technical architecture for the Glade Alpha 2 milestone. We will build the foundational Multi-Agent System (MAS) powered by Gemini, featuring a dual-paradigm UX (Right Sidebar Chat + Inline Prompts) and robust context injection.

## Proposed Changes

---

### Phase 1: Gemini API & MAS Backend (Rust)

We will build the core MAS engine in the Tauri backend to handle the actual LLM orchestration, ensuring the frontend remains lightweight and secure.

#### API Key Storage Strategy
We will securely store the Gemini API key using `tauri-plugin-store` combined with OS-level secure storage where possible. The key will be configured by the user via the `SettingsDialog` in the frontend and never logged or exposed.

#### Custom Agent Harness vs. External Frameworks
Since the backend is written in Rust and our use-case (PKM manipulation) is highly specialized, we will build a **custom, lightweight Agent Harness** rather than adopting a heavy, generalized framework. This guarantees extreme performance, minimizes binary bloat, and gives us absolute control over how agents execute local filesystem tools (like modifying Milkdown state or reading markdown files). 

#### [NEW] `src-tauri/src/agent/mod.rs`
- Define the core `Agent` struct: `id`, `name`, `system_prompt`, `capabilities`.
- Implement an `AgentRegistry` managed in Tauri app state.

#### [NEW] `src-tauri/src/gemini/mod.rs`
- Implement the HTTP client for the Gemini API using `reqwest`.
- **Tool Calling Setup:** Define JSON schemas for local functions (e.g., `create_note(title, content)`, `semantic_search(query)`) that the Gemini model can invoke.
- Expose a Tauri command `invoke_agent(agent_id, query, context)` that streams responses back to the frontend.

---

### Phase 2: Agent Orchestration Specification

The heart of Glade's MAS is the **Orchestrator Pattern**, which serves as the entry point, but the custom Rust harness will natively support advanced MAS execution graphs, including **Looped (Iterative)** and **Parallel** patterns.

#### 1. Agent Creation & Extensibility
Glade treats agents as first-class citizens of the vault. 
- **Declarative Agents (YAML/JSON):** Users can create new agents simply by creating a Markdown file with specific Frontmatter, or a YAML file in the `.glade/agents/` folder. This defines the agent's name, system prompt, and allowed tools.
- **Custom Tool Execution (JavaScript/Python):** Users can extend agents by writing custom tools. 
  - **JavaScript/TypeScript:** Custom JS tools can be executed dynamically within a sandboxed hidden WebView or a WebWorker in the Tauri frontend.
  - **Python / Shell:** Agents can be configured to execute local Python scripts or shell commands (e.g., to interact with local APIs or scrape data), bridging the gap between Glade and the user's local dev environment.

#### 2. Telemetry & Tracing
MAS pipelines can become complex "black boxes". Glade will feature a native **Agent Trace View**:
- **Execution Graph:** Visualizing the flow of a prompt from Coordinator -> Worker -> Tool Execution.
- **Token Usage & Latency:** Real-time metrics on token consumption, request latency, and which specific files were pulled into the context window during RAG.
- **Rust Backend Tracing:** Utilizing the Rust `tracing` crate to emit structural logs, streaming them directly to a dedicated Debug/Trace pane in the frontend via Tauri events.

#### 3. Memory Architecture
To truly act as a personal operating system, agents must possess memory.
- **Short-Term Memory:** The active context window maintained in the Sidebar chat session.
- **Long-Term Memory:** A dedicated local vector database (or a hidden "Memory Vault" of Markdown files). When a user tells an agent a fact (e.g., "I prefer concise bullet points"), the agent executes a `store_memory` tool. Future queries automatically trigger a semantic search against this memory vault before the Coordinator routes the request, ensuring the entire MAS adapts to the user's preferences over time.

#### 4. Supported Orchestration Patterns

1. **The Gateway (Coordinator / Router):** The default pattern. A user query goes to the Coordinator, which determines the single best specialized agent (Worker) to execute the task.
2. **Parallel Execution (The "Review Board"):** The Coordinator splits a task and sends it to multiple distinct agents simultaneously. They execute concurrently, and their outputs are aggregated.
   * *Example:* You write a draft of a blog post. A **Technical Reviewer Agent**, an **SEO Agent**, and a **Copyeditor Agent** all analyze the document in parallel. A final **Synthesizer Agent** aggregates their feedback into a single critique document.
3. **Looped / Sequential Execution (The "Iterative Polish"):** Agents pass their outputs to the next agent in a chain, optionally looping back if quality checks fail.
   * *Example:* A **Writer Agent** drafts a section -> passes to **Critic Agent**. If the Critic finds flaws, it sends it back to the Writer. This loop continues up to a maximum threshold before presenting the final result.

#### 5. PKM Use-Case Examples

**Example A: Synthesizing Research (The "Idea Weaver") [Router Pattern]**
* **User Query:** *"Summarize all my notes on 'Local LLMs'."*
* **Orchestration:** **Coordinator** -> **Retrieval Agent** (performs RAG search) -> **Writer Agent** (drafts and executes `create_note`).

**Example B: The Email Triage Pipeline (Sequential & Tool-Use Pattern)**
* *This demonstrates Glade acting as a personal operating system.*
* **Orchestration:**
  1. The **Chief-of-Staff Agent** uses an external integration tool (`check_email()`) on a scheduled cron-job or via manual trigger.
  2. It identifies high-priority emails and passes them to the **Strategy Agent**.
  3. The **Strategy Agent** reads the user's "Personal OKRs" vault note to determine the best strategic response to each email.
  4. It passes the strategic bullet points to the **Writer Agent**, which is specifically prompted with the user's personal voice.
  5. The **Writer Agent** drafts the emails and creates a new document in the vault called "Drafted Emails - Today", alerting the user via the Sidebar that drafts are ready for manual review.

**Example C: Refactoring Note Structure [Inline Editor Prompts]**
* **User Query:** Highlight a bulleted list and type `/agent Rewrite this.`
* **Orchestration:** Bypasses the Coordinator. The highlighted text is sent directly to the **Refactor Agent**, which streams the markdown back to replace the selection in the Milkdown editor.

---

### Phase 3: The Agent Command Center (Frontend UX)

We will introduce the dual-paradigm UX for interacting with the agents.

#### [NEW] `src/components/layout/AgentSidebar.tsx`
- A new right-hand pane mirroring the left sidebar.
- Contains a conversational chat interface.
- Automatically injects the `activeFileContent` (and frontmatter) into the context payload when the user sends a message.

#### [MODIFY] `src/components/SettingsDialog.tsx`
- Add a new "AI & Agents" tab for configuring the `GEMINI_API_KEY`.

---

### Phase 4: Inline Editor Prompts (Milkdown)

#### [NEW] `src/components/editor/AgentPlugin.ts`
- Create a custom Prosemirror/Milkdown plugin that listens for the `/agent` slash command.
- Open a floating input bar (similar to the link palette) where the user can type a command.
- Send the current selection to the `invoke_agent` Tauri command using the **Refactor Agent**.
- Dynamically replace the selection into the Milkdown transaction stream.

---

## Verification Plan

### Automated Tests
- Build Rust unit tests for the custom Agent Harness to ensure tool-calling JSON schemas are generated perfectly for Gemini.
- Mock the HTTP client to test the Orchestration routing (Coordinator -> Retrieval -> Writer) locally.

### Manual Verification
1. Launch the app and input a valid Gemini API key in Settings via `tauri-plugin-store`.
2. Open the Right Sidebar, ask a question about the currently open document, and verify the model cites the document accurately.
3. Highlight a paragraph in the editor, trigger the inline agent, ask it to "Rewrite this to be more professional," and verify the text is replaced seamlessly.
4. Ask the agent in the sidebar to "Create a new note called Task List", and verify the file appears in the left sidebar explorer.
