# Glade Product Roadmap

**Glade is an Agentic-Native Knowledge Base.** 
It was built from the ground up for experienced PKM users who want the power of a strictly local, personal knowledge management system completely integrated with a robust Multi-Agent System (MAS). Glade aims to eliminate the clumsiness of bolt-on AI tools by providing native UX controls for agents, highly structured AI guardrails to prevent document sprawl, and first-class support for interconnected vault collections.

## ✅ Completed Milestone: Alpha 2 (The Agentic Foundation)
Our focus was building the core Multi-Agent System (MAS) into Glade, powered exclusively by the **Gemini** API for rapid iteration.
- **The Agent Command Center:** A dual-paradigm UX for interacting with agents.
  - *Right Sidebar Pane:* A persistent conversational interface that is contextually aware of your active document.
  - *Inline Editor Prompts:* Highlight text and type `/agent` to trigger contextual actions (Summarize, Refactor, Elaborate) that inject directly into the Milkdown editor.
- **Multi-Agent System (MAS) Core:** A Rust-based backend registry defining distinct agents (e.g., Coordinator, Refactor Agent).
- **Tool-Use & Execution:** Exhaustively tested Rust execution harness, completely decoupled from Tauri state for robust testing and structural tracing.
- **Vault Context & RAG:** Seamlessly inject the current document's frontmatter and content into the agent's context window.

## ✅ Completed Milestone: Alpha 3 (Pluggable Agentic Core)
- **Tool-Use & Execution:** Exhaustively tested Rust execution harness with a universal Tool Authorization prompt override and graceful safety fallback.
- **Persistent Conversational Memory:** Lifted chat state and provided full historical context to agent invocations.
- **Native Workspace Integration:** Built-in tools for reading, writing, and searching files, as well as terminal command execution.
- **Extensible Skills:** Support for dynamic Markdown-based skills loaded directly from the `.glade/agents/skills` directory.
- **Model Context Protocol (MCP) Foundation:** Built an async Rust MCP client for dynamic discovery and execution of external tools.

## 🚧 Current Milestone: Alpha 4 (Headless Architecture & AntiGravity SDK)
Our focus for Alpha 4 is significantly increasing agentic developer autonomy by building robust infrastructure for headless operation, automated testing, and Agent-as-a-Judge workflows.
- **Frontend Decoupling:** Decouple the React frontend from Tauri (using WebSockets/HTTP) to enable standard browser-based E2E testing via Playwright.
- **Headless CLI & MCP Server:** Expose the core Multi-Agent System and workspace APIs through a headless CLI and as an MCP Server for remote execution.
- **AntiGravity SDK:** Establish a first-class SDK with standardized workflows, aggressive regression testing harnesses, and "Agent-as-a-Judge" verification to ensure a provably correct and maintainable codebase.
- **Automated QA Pipelines:** Implement robust CI/CD integration with Playwright UI testing against the decoupled frontend.

## 🔭 Upcoming Milestone: Alpha 5 (Advanced Personas & Agent Workspace)
Our focus for Alpha 5 is to elevate agents into first-class citizens with a dedicated workspace and declarative configuration.
- **Declarative Agent Definitions (`.agent.md`):** Native markdown-based agent personas with AI-aided scaffolding to replace `agents.json`.
- **The Agent Workspace (Fleet Dashboard):** A dual-window UI (Global Toggle + Multi-Window Popout) dedicated to orchestrating fleets of agents.
- **Autonomous Approvals & Observability:** Strict human-in-the-loop approval queues for autonomous runs and real-time execution tracing.
- **Ecosystem Management UI:** Visual dashboards for MCP setup, Custom Local Tool creation, and Skills Definition.

## 🔭 Upcoming Milestone: Alpha 6 (Intelligent Storage & Routines)
- **Semantic Vector Search:** Deep semantic search across the vault powered by a lightweight local vector database (like ChromaDB or Qdrant).
- **File System "Zones" (RBAC):** Restricting agent access to specific vault directories for security.
- **Side-Car Agent Data (Shadow FS):** Storing agent-generated metadata and files in a hidden `.glade/.shadow/` directory.
- **Automated Routines & Routing:** Visually defining complex multi-agent workflows and event-triggered routines.
- **Specialized Agent Editors:** GUI-driven form editors overlaid on `.agent.md` files.

## 🔭 Upcoming Milestone: Alpha 7 (The Inter-Connected Ecosystem)
- **Inter-Connected Vaults:** The capability to seamlessly connect separate Glade vaults, allowing agents to query and cross-reference information securely over a network protocol.

## 🚀 Mid-Term Goals (Beta to v1.0)
- **NPM Monorepo Migration:** Restructure the repository into a proper workspace (e.g. `packages/app`, `packages/sdk`) to cleanly share configurations and isolate boundaries.
- **Git Integration:** Built-in version control for vaults (commit, push, pull) to manage knowledge like code.
- **Graph View:** A node-based visual representation of interlinked notes and agentic relationships.

## 🔮 Long-Term Vision
- **Decentralized Multi-Agent Collaboration:** Real-time peer-to-peer editing sessions where human users and AI agents collaborate synchronously.
- **Mobile Companion Apps:** Native iOS/Android apps that sync with your desktop vaults via decentralized sync protocols.
- **Ecosystem of Agents:** Establish a robust API and marketplace for custom agents that integrate deeply into the Tauri backend and Milkdown editor.
