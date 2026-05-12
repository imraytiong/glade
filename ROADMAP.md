# Glade Product Roadmap

**Glade is an Agentic-Native Knowledge Base.** 
It was built from the ground up for experienced PKM users who want the power of a strictly local, personal knowledge management system completely integrated with a robust Multi-Agent System (MAS). Glade aims to eliminate the clumsiness of bolt-on AI tools by providing native UX controls for agents, highly structured AI guardrails to prevent document sprawl, and first-class support for interconnected vault collections.

## 🎯 Next Milestone: Alpha 2 (The Agentic Foundation)
Our immediate focus is building the core Multi-Agent System (MAS) into Glade, powered exclusively by the **Gemini** API for rapid iteration.
- **The Agent Command Center:** A dual-paradigm UX for interacting with agents.
  - *Right Sidebar Pane:* A persistent conversational interface that is contextually aware of your active document.
  - *Inline Editor Prompts:* Highlight text and type `/agent` to trigger contextual actions (Summarize, Refactor, Elaborate) that inject directly into the Milkdown editor.
- **Multi-Agent System (MAS) Core:** A Rust-based backend registry defining distinct agents (e.g., Research Agent, Organization Agent, Writing Assistant).
- **Tool-Use (Function Calling):** Empower agents with the ability to execute predefined functions to interact with the file system (`create_note`, `read_note`).
- **Vault Context & RAG:** Seamlessly inject the current document's frontmatter and content into the agent's context window.

## 🚧 Alpha 3 & Beyond (Beta Path)
- **Agentic Native UX:** Build intuitive UI controls for the integrated Multi-Agent System to help users seamlessly organize, synthesize, and create knowledge.
- **Interconnected Vault Collections:** Introduce first-class constructs to link 'contained' vaults together. Enable pulling content from one vault to another and performing semantic searches across multiple isolated projects.
- **Local Inference Support:** Alongside cloud-based inference, allow users to plug in their own local inference engines for maximum privacy and control.
- **Enhanced Editor Ergonomics:** Polish the core WYSIWYG editing experience, frontmatter properties, and distraction-free "Zen Mode".

## 🚀 Mid-Term Goals (Beta to v1.0)
- **Agentic Workflows:** Allow users to define specific, highly-structured agentic pipelines (e.g., "Research Agent", "Summarization Agent") that operate gracefully over the interconnected vaults.
- **Semantic Cross-Vault Linking:** AI-driven suggestions for linking concepts not just within a single vault, but across isolated collections and team projects.
- **Git Integration:** Built-in version control for vaults (commit, push, pull) to manage knowledge like code.
- **Graph View:** A node-based visual representation of interlinked notes and agentic relationships.

## 🔮 Long-Term Vision
- **Decentralized Multi-Agent Collaboration:** Real-time peer-to-peer editing sessions where human users and AI agents collaborate synchronously.
- **Mobile Companion Apps:** Native iOS/Android apps that sync with your desktop vaults via decentralized sync protocols.
- **Ecosystem of Agents:** Establish a robust API and marketplace for custom agents that integrate deeply into the Tauri backend and Milkdown editor.
