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

### Phase 5: Agent Instrumentation & Headless Testing

We will instrument the Rust MAS codebase to establish **Agentic Observability as the Highest Priority**. Over speed or performance, our goal is to emit extensive, machine-readable telemetry designed specifically for agentic coding tools (like Antigravity) to parse, troubleshoot, and self-correct with minimal human intervention. This involves decoupling the core agent execution logic from the Tauri state management, allowing us to write exhaustive End-to-End (E2E) integration tests that output rich structural traces.

We will use a **Two-Level Testing Strategy**:

#### Level 1: Mocked Service Testing (Fast & Deterministic)
Introduce a mock HTTP client (e.g., `wiremock` or mock server) to intercept Gemini API calls during tests.
- **Error Conditions**: Simulate `401 Unauthorized`, `503 Service Unavailable`, `429 Too Many Requests`.
- **Malformed Data**: Simulate API returning malformed JSON.
- **Unexpected LLM Behavior**: Simulate hallucinations or empty responses.

#### Level 2: Real LLM Backed E2E Testing (Expensive but Realistic)
Run true End-to-End tests backed by a real `GEMINI_API_KEY` (gated behind an environment variable like `RUN_LIVE_LLM_TESTS=1`).
- **Test Scenarios:**
  - **Scenario A (Coordinator Routing):** Verify the Coordinator properly synthesizes a response using injected Markdown context.
  - **Scenario B (Refactor Agent Formatting):** Verify the Refactor agent returns strictly formatted markdown without conversational filler text.

#### [MODIFY] `src-tauri/src/agent/mod.rs` & `src-tauri/src/gemini/mod.rs`
- Decouple the core execution logic from Tauri `AppHandle` and `State`, extracting it into a pure `execute_agent` async function that supports injecting a custom HTTP client or overriding the API URL.
- Add structural telemetry (using the `tracing` crate) to log agent prompts, API latencies, and tool usage safely.
- Implement exhaustive headless tests using `tokio::test`.

---

## Verification Plan

Our verification plan demands exhaustive coverage of all Alpha 2 features across the full stack. This includes Headless Integration Tests (for the backend) and UI E2E / Manual Tests (for user-facing features), covering happy paths, corner cases, and error permutations.

### 1. API Configuration & Authentication
*   **Happy Path:** User saves a valid `GEMINI_API_KEY` in settings. Agent calls succeed.
*   **Error (No Key):** User attempts an agent call without a configured key. Verify clear UI error asking for configuration.
*   **Error (Invalid Key):** User saves a malformed key. Verify HTTP 401 is gracefully caught and a user-friendly error is surfaced.
*   **Security (Scrubbing):** Inspect the raw JSON telemetry logs to guarantee the `GEMINI_API_KEY` is scrubbed and never persisted to disk or standard output.

### 2. The Agent Command Center (Sidebar Chat)
*   **Happy Path:** User asks a general question. Agent streams the response into a new chat bubble.
*   **Context Injection:** User opens a document containing specific facts, asks "What does this document say?", and the agent cites the document.
*   **Corner Case (Empty Context):** User asks a question with no active document open. Agent handles it as a zero-shot general query.
*   **Corner Case (Token Limit Exceeded):** Active document is an massive text file exceeding context windows. Verify the system either truncates intelligently or surfaces a "Context Too Large" error rather than crashing.
*   **Error (Service Outage):** Mock a 503 response mid-chat. Verify the UI displays a network error message in the chat log instead of hanging indefinitely.
*   **UI State:** Verify sidebar visibility toggles correctly and retains its state across reloads.

### 3. Inline Editor Prompts (`/agent` Generative Command)
*   **Happy Path:** User types `/agent Write a summary`, presses Enter. The popup shows a loading state, and the `/agent` text is replaced by the streamed markdown response.
*   **Corner Case (Cancellation):** User types `/agent`, opens the popup, but presses `ESC`. Verify the popup closes and the editor cursor returns to the text seamlessly.
*   **Corner Case (Loss of Focus):** User opens the prompt, then clicks elsewhere in the document. The popup should dismiss without altering the document.
*   **Edge Case (Nested Blocks):** User types `/agent` inside a blockquote or a deeply nested list. Verify the generated text inherits the correct block formatting.
*   **Error Handling:** If the Gemini API returns a 500 error during generation, verify the `/agent` prompt block is either preserved for retry or cleaned up gracefully, ensuring the Prosemirror transaction history is not corrupted.

### 4. Contextual Tooltip Refactoring (Selection-based)
*   **Happy Path:** User highlights a paragraph, clicks the "AI" button, types "Make shorter", presses Enter. The exact highlighted selection is replaced with the shorter version.
*   **Corner Case (Multi-Block Selection):** User highlights text spanning across multiple paragraphs, headings, and lists. Verify the RAG context accurately captures the complex selection and replaces the entire multi-block selection cleanly.
*   **Corner Case (Single Character Selection):** User highlights a single letter and clicks AI. Verify it still attempts the operation or provides a sensible prompt constraint.
*   **Error (Reversion):** If the LLM call fails, verify the selected text is NOT deleted. The user must not lose their original text due to an API timeout.
*   **UI Cancellation:** User clicks the AI button to enter refactor mode, but clicks the "X" or presses `ESC`. The tooltip should revert to the standard bold/italic formatting menu.

### 5. Telemetry & Agentic Observability (Headless)
*   **Trace Validation:** Run headless test suites and parse the outputting `tracing` JSON. Assert that fields like `agent_id`, `latency_ms`, `prompt_tokens`, and `completion_tokens` are consistently present.
*   **Mocked Pipeline Exhaustion:** Run Level 1 tests looping through 100 concurrent mocked agent requests to verify the Rust async harness handles backpressure and doesn't leak memory.
