# Glade: Strategic Architecture & Long-Term Planning

This document serves as a staging ground to deeply explore and resolve the major architectural questions that bridge our current Alpha milestones with our long-term `PRODUCT_VISION_DRAFT.md`. 

Please add your thoughts, constraints, and ideas under each section so we can collaboratively arrive at a concrete technical design.

---

## 1. The Monorepo Architecture (The Structural Shift)

**The Context:** We are building an AntiGravity SDK, a Headless CLI, an MCP Server, and a React/Tauri Desktop App. Continuing in a single flat directory structure will lead to dependency hell and tightly coupled code.
**The Goal:** Restructure into a formal NPM Workspace (e.g., using Turborepo or simple npm workspaces) combined with a Cargo Workspace for the Rust backend.

### Open Questions to Explore:
*   **Timing:** Do we pause to restructure into a monorepo *now* (as part of the Alpha 4 SDK work), or push it until Beta when the dust settles?
*   **Workspace Boundaries:** What is the ideal package boundary? 
    *   *Proposed Structure:*
        *   `packages/core-lib` (Shared TS interfaces, pure logic)
        *   `packages/sdk` (The AntiGravity SDK wrapper)
        *   `apps/desktop` (The Tauri + React app)
        *   `apps/cli` (The Headless Daemon/MCP server)
*   **Rust Integration:** How should the Rust backend (`src-tauri`) map to this? Should we extract the core MAS engine into a separate local Rust crate (e.g., `glade-core`) that both the Tauri app and the CLI daemon depend on?

**[Your Thoughts / Notes Here]**


---

## 2. The "Inter-Connected Vaults" Superpower

**The Context:** A major differentiator for Glade is treating vaults not as isolated silos, but as a connected network (slated for Alpha 7). Agents should be able to semantic search and pull context across different vaults.
**The Goal:** Design a mechanism that allows the local machine to know about and safely query multiple distinct vault directories.

### Open Questions to Explore:
*   **The Global Registry:** Do we need a global configuration file (e.g., `~/.glade/registry.json`) that tracks the absolute paths of all known vaults on the user's machine?
*   **Security & Boundaries:** If Vault A is interconnected with Vault B, does an agent in Vault A get automatic read access to Vault B? How do we handle permissions when executing tools across boundaries?
*   **Network Protocol:** The roadmap mentions querying "over a network protocol." Does this mean we anticipate users running a Glade Daemon on a home server (Vault C) and querying it from their laptop (Vault A)? 

**[Your Thoughts / Notes Here]**


---

## 3. Local-First & Data Portability

**The Context:** Glade is strictly local. In Alpha 6, we are introducing a "Shadow FS" (e.g., `.glade/.shadow/`) to store agent-generated metadata, fleet memory, and context banks.
**The Goal:** Guarantee 100% data portability so users never feel locked in, and can easily back up or sync their vaults using tools like Git, Dropbox, or Syncthing.

### Open Questions to Explore:
*   **Pathing Strategy:** We must strictly enforce relative pathing within the `.glade/` directory. If a user moves their vault from `~/Documents/Vault` to `~/Desktop/Vault`, nothing should break. How do we ensure the backend and the Vector DB (ChromaDB) handle this relocation gracefully?
*   **Sync Conflicts:** If a user syncs their vault via Dropbox, and two different machines update the `.agent.md` memory or the local Vector DB index simultaneously, how do we handle the resulting sync conflict?
*   **Clean Uninstalls:** If a user decides to stop using Glade and just use Obsidian, what happens to the Shadow FS? Is it purely additive, leaving their standard Markdown files 100% untouched and pristine?

**[Your Thoughts / Notes Here]**


---

## 4. CRDTs and The Path to Real-Time Collaboration

**The Context:** The long-term vision includes "Decentralized Multi-Agent Collaboration" (real-time peer-to-peer editing between humans and agents).
**The Goal:** Ensure our current Alpha architectural decisions do not prevent us from implementing true multiplayer syncing in the future.

### Open Questions to Explore:
*   **State Management:** True multiplayer text editing requires Conflict-free Replicated Data Types (CRDTs) like *Yjs* or *Automerge*. While we don't need to implement CRDTs today, our headless architecture involves the Rust backend mutating files that the React frontend is actively displaying.
*   **The Single Source of Truth:** Should the Rust backend be the definitive source of truth that pushes diffs to the React frontend, or should they both rely on a shared CRDT data structure eventually?
*   **Agent Typing Indicators:** When an agent is autonomously editing a file in the background, how do we visually represent that to the user in the UI (e.g., ghost cursors, locked blocks) before full collaboration is implemented?

**[Your Thoughts / Notes Here]**
