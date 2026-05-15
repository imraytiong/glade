# Glade Alpha 5 Release: Advanced Personas & Dedicated Agent View

This implementation plan covers the roadmap for Alpha 5. The primary objective is to elevate agents from simple side-panel chatbots into first-class citizens within the Glade IDE. This involves fundamentally enhancing how agent personas are defined, introducing a dedicated "Agent Workspace," and building sophisticated UI elements for ecosystem management.

---

## Core Architectural Decisions

> [!IMPORTANT]
> **The Dual Agent View Paradigm**
> We will implement a dual-approach for navigating to the Agent View:
> 1. **The Global Toggle (Single Window):** A segmented control at the top center of the UI (`[ 📝 Editor | 🤖 Agent Workspace ]`) that flips the entire center UI. This keeps workflows focused on single-screen devices.
> 2. **Multi-Window Architecture:** A "Pop Out" button in the Agent View that leverages Tauri to spawn a *second* native OS window. This allows power users to keep the Glade Editor open on one monitor while orchestrating the agent in a dedicated workspace window on another.

> [!IMPORTANT]
> **Declarative Agent Definitions (`.agent.md`)**
> We are officially moving away from `agents.json`. Agents will be defined as native Markdown files inside a `.glade/agents/` folder. The YAML frontmatter controls the configuration, while the Markdown body becomes the system prompt. This allows users to edit agent personas using Glade's own rich text editor. *Note: We will design the frontmatter schema to be extensible enough to support Alpha 6 features like "Zones" and "Shadow FS paths" from day one.*

---

## Risks, Impacts, and Mitigations

As we introduce multi-window environments and autonomous agents, we must architect against the following risks:

### 1. Multi-Window State Synchronization
**The Risk:** If the user opens a Markdown file in the Editor Window and the Agent Workspace in a second window, state can diverge. The agent might operate on stale context if the user hasn't saved the file.
**The Mitigation:** The Rust backend must act as the strict single source of truth. The frontend state must rely on real-time Tauri events emitted by the backend (e.g., `file_updated`) to sync all active webviews simultaneously, ensuring the Agent always possesses the exact state of the Editor.

### 2. Autonomous Chaos (The "Sorcerer's Apprentice" Problem)
**The Risk:** Giving agents autonomy to execute tasks via the Fleet Dashboard could lead to infinite loops or destructive actions (e.g., repeatedly trying to fix a compiler error and deleting vital code).
**The Mitigation:**
- **Strict Approval Queues:** All state-mutating tools (`write_file`, `run_command`, `delete`) must default to a Human-in-the-Loop "Requires Approval" state for autonomous runs.
- **The Global Kill Switch:** The Fleet Dashboard must feature a prominent, instantaneous "Halt All Agents" button that kills the underlying Rust async tasks.
- **Hard Iteration Caps:** Enforce strict execution loop limits (e.g., max 5 recursive tool calls without human input).

### 3. LLM Provider Instability (Flakiness & Rate Limits)
**The Risk:** The reality of relying on external LLM servers (like Gemini, OpenAI, or Anthropic) is that they can be flaky, overloaded, or throw 529/429 errors. A single network failure during a long orchestration loop could crash the entire workflow.
**The Mitigation:**
- **Configurable Retry Logic:** The Rust `gemini::call_gemini` execution wrapper must implement exponential backoff retry logic (e.g., retry up to 3 times with increasing delays) to smooth over transient network failures.
- **Model Fallback Routing:** Introduce a fallback capability in the agent configuration. If the primary model (e.g., `reasoning`) fails consecutively, the system can automatically degrade to a secondary model (e.g., `fast`) or a completely different provider to ensure the autonomous job completes without hard-failing back to the user.

### 4. Markdown Parser Fragility
**The Risk:** Since users are manually editing `.agent.md` files, malformed YAML frontmatter (invalid indentation, typos) could cause the Rust parser to panic and crash the IDE upon loading the vault.
**The Mitigation:** The Rust YAML parser must be heavily robust. If parsing fails, it must **never** panic. Instead, it gracefully loads the agent with safe defaults (e.g., `model_class: fast`, no tools) and emits a structured error to the UI displaying a clear "Syntax Error in Frontmatter" banner.

### 5. Context Bank Token Overload
**The Risk:** Automatically injecting entire directories defined in a `context_bank` into the system prompt could easily blow past the LLM's token window or dilute the agent's focus.
**The Mitigation:** The backend must calculate token estimates before injection. If the context bank exceeds a safe threshold (e.g., 50k tokens), the system truncates the input and notifies the user. Long-term, large context banks must be deferred to the Alpha 6 Semantic Vector Search feature rather than raw text injection.

---

## Proposed Changes

### Phase 1: Declarative Agent Definitions (`.agent.md`)
Managing complex system prompts inside a JSON file is tedious. We will migrate agent definitions to be native Markdown files, and introduce AI assistance to generate them.

#### [MODIFY] `src-tauri/src/agent/mod.rs`
- Deprecate `agents.json`.
- Implement a parser that scans the `.glade/agents/` directory for `*.agent.md` files.
- Parse the YAML frontmatter to extract the configuration (e.g., `model_class`, `tools_allowed`, and placeholders for future `allowed_zones`).
- The body of the markdown file becomes the `system_prompt`.

#### [MODIFY] `src/components/layout/AgentConfigPane.tsx`
- Refactor the Left Sidebar Agents view to be a read-only informational panel.
- The UI will display a clean list of active agents and their capabilities.
- Clicking an agent opens the `.agent.md` file in the main Editor View, allowing users to inspect or manually edit the raw configuration.

---

### Phase 2: The Agent Workspace (Fleet Management Dashboard)
The "Agent Workspace" is not just a chat window—it is a comprehensive control center for managing your AI ecosystem.

#### [NEW] `src/components/agent/AgentWorkspace.tsx`
- **Fleet Management Center:** A unified dashboard to overview all defined agents in the vault. From here, you can quickly manage your entire fleet of specialized agents.
- **Agent-to-Build-Agents (Agent Builder):** An AI prompt box in the control center to spawn new agents (e.g., "I need a marketing expert who knows SEO"). This flow uses a specialized **Builder Agent** (rather than the Coordinator) to autonomously generate the YAML frontmatter and draft a highly-structured Markdown system prompt, saving the new `.agent.md` file instantly.
- **Autonomous Orchestration & Approvals:** Shift from simple QA chat to high-level orchestration. Agents can be dispatched to run autonomously in the background on complex tasks. The UI will feature an "Approval Queue" where autonomous agents pause and explicitly ask the user for permission before executing sensitive actions (like running terminal commands or bulk deleting files).
- **Tracing and Observability:** An expandable, real-time observability panel. This provides a transparent, low-level trace of exactly what every agent is doing in the vault at any given time (e.g., `Agent X is currently parsing /docs/api.md...`, `Agent Y executed tool search_files`).

#### [MODIFY] `src/App.tsx` & `src-tauri/src/main.rs`
- Implement the `[ 📝 Editor | 🤖 Agent ]` Global Toggle state logic in the main layout.
- Implement a Tauri command `open_agent_window` that spawns a secondary Tauri webview window pointing to a dedicated `/agent-workspace` route.

---



### Phase 4: Ecosystem Management UI (Ribbon Integration)
To make Glade truly extensible, we need dedicated interfaces for the user to quickly expand the agent's capabilities without manually writing configuration files. We will integrate these as top-level buttons on the main Ribbon.

#### [MODIFY] `src/App.tsx`
- **Routing State:** Update the main view state to support new routes: `useState<"editor" | "agent" | "ecosystem-models" | "ecosystem-tools" | "ecosystem-skills">`.
- **Ribbon Config:** Add `"ecosystem-models"`, `"ecosystem-tools"`, and `"ecosystem-skills"` to the default ribbon configuration.
- **Icons:** Use `Brain` (Models), `Wrench` (Tools), and `Zap` (Skills) icons from `lucide-react`.

#### [NEW] `src/components/ecosystem/`
- **ModelsPanel:** Move the Gemini API Key input and Model selector from the old settings dialog here.
- **ToolsPanel:** Move the local MCP Server setup and configuration text area here.
- **SkillsPanel:** Create a placeholder for the Skills Definition Builder.

#### [MODIFY] `src/components/agent/AgentWorkspace.tsx`
- Revert the tabbed navigation ("Fleet" vs "Ecosystem") entirely, returning `AgentWorkspace` to solely focus on agent fleet orchestration and editing.

---

## Future Roadmap

### Alpha 6: Intelligent Storage & Routines
To maintain velocity, we are designing Alpha 5's data models to support the following advanced orchestration features coming in Alpha 6:
- **Semantic Vector Search:** Implementing a lightweight, local vector database (like ChromaDB or Qdrant) to allow agents to perform deep semantic searches across the entire vault instantly.
- **Context Banks & Memory:** Adding `context_bank` arrays to agent frontmatter. These paths are automatically injected into the LLM context window, managed via a dedicated "Fleet-Wide Memory" tab in the Agent Workspace.
- **File System "Zones" (RBAC):** Defining specific directory "zones" where agents have varying read/write access rights, preventing a rogue agent from overwriting critical areas of the vault.
- **Side-Car Agent Data (Shadow FS):** The ability to attach agent-generated metadata and markdown files completely separated from the shared user content. This will likely live in a "shadow file system" directory (e.g. `.glade/.shadow/`) so it doesn't clutter the user's primary view, but remains contextually linked.
- **Automated Routines & Routing:** The ability to visually define complex automated workflows where agents pass outputs to one another (routing) or trigger automatically based on vault events (routines).
- **Specialized Agent Editors:** A GUI-driven form editor that sits on top of the `.agent.md` file, providing visual toggles for tools, skills, and model selection while preserving the underlying markdown state.

### Alpha 7: The Inter-Connected Ecosystem
- **Inter-Connected Vaults:** The capability to seamlessly connect separate Glade vaults, allowing agents in Vault A to query, cross-reference, and orchestrate actions in Vault B securely over a network protocol.

---

## Verification Plan

### Automated Tests (Rust & Playwright)
- **Frontmatter Parsing Test:** Write Rust unit tests asserting that reading a `.agent.md` file correctly maps YAML to the `Agent` struct.
- **Window Management Test:** Use Playwright to verify the UI toggle between Edit View and Agent View works, and ensure the state is synchronized between two distinct Tauri windows.

### Manual Verification
- **Multi-Window Interaction:** Pop out the Agent Workspace to a second window. Open a file in the primary Editor window, ask the agent in the second window to summarize the open file, and verify it successfully reads the correct context.
- **AI Tool Creation:** Use the new Ecosystem UI to prompt the creation of a simple "Reverse String" tool. Verify the tool is generated, instantly registered, and successfully invoked by the agent in the same session.
