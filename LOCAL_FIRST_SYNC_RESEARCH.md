# Local-First Data Portability & Syncing: Deep Research

Glade is strictly local-first. We must guarantee 100% data portability so users never feel locked in, and can easily back up or sync their vaults using tools like Git, Dropbox, iCloud, or Syncthing.

## 1. Clean Uninstalls & The "Shadow FS" Boundary

If a user uninstalls Glade and opens their vault in Obsidian or VS Code, their core Markdown files must be pristine. Agent metadata cannot pollute the user's primary namespace.

### The Shadow FS Concept
All agentic data must live in a hidden `.glade/` directory at the root of the vault.
*   **What goes in here?**
    *   `.glade/agents/` (Custom `.agent.md` personas)
    *   `.glade/memory/` (Agent context banks and conversation histories)
    *   `.glade/chromadb/` (The local Vector DB for semantic search)
    *   `.glade/inbox/` (Asynchronous cross-vault messages)

### The Portability Guarantee
By isolating everything into `.glade/`, we achieve the "Clean Uninstall". A user can simply delete the `.glade/` folder, and their vault is instantly reverted to a standard, vanilla Markdown directory. 

---

## 2. Pathing Strategy & Vault Relocation

Users move folders. A user might rename "Work Vault" to "Acme Corp", or move it from `~/Documents` to an external hard drive. 

### The Relative Path Mandate
*   **Rule:** Glade must **never** write absolute paths to any file inside the vault.
*   **Implementation:** All file references inside agent memory, trace logs, or the Vector DB metadata must be strictly relative to the vault root (e.g., `./projects/spec.md`).
*   **Vector DB Challenge:** ChromaDB often stores absolute file paths as document metadata to map vectors back to files. We must explicitly intercept and sanitize this, ensuring only relative paths are stored in the database.

---

## 3. Sync Conflicts (Dropbox, iCloud, Syncthing)

When users sync a local vault across multiple machines via cloud storage, race conditions and sync conflicts are inevitable.

### Scenario A: Vector DB Corruption
*   **The Risk:** A user has their vault open on their Mac and their Windows PC simultaneously. Dropbox tries to sync the binary SQLite files inside `.glade/chromadb/` while both machines are actively writing to it. The SQLite database corrupts.
*   **Proposed Mitigation:** 
    1. **Exclude from Sync:** We strongly advise users to `.gitignore` or add `.glade/chromadb/` to their sync exclusion list.
    2. **Deterministic Rebuilds:** The Vector DB should be treated as an ephemeral cache, not source-of-truth storage. If Glade detects database corruption on startup (or if the folder is missing because it was excluded from sync), it silently re-indexes the vault in the background based on the source markdown files.

### Scenario B: Agent Memory Collisions
*   **The Risk:** Two agents on different machines append to the same `.glade/memory/global_context.md` simultaneously. Syncthing creates a `global_context.sync-conflict.md` file.
*   **Proposed Mitigation:**
    1. **Append-Only Event Logs:** Instead of mutating a single state file, agent memory could be stored as append-only event logs (e.g., JSON Lines format).
    2. **Conflict Resolution:** If Glade detects a `.sync-conflict` file in the `.glade/` directory, it can parse both JSON Lines files, merge them chronologically by timestamp, and delete the conflict file automatically.

---

## User Review Required

Please review the proposed strategies and provide feedback on the following Open Questions:

1. **Vector DB Syncing:** Do you agree that the Vector DB (`.glade/chromadb/`) should be treated as an ephemeral cache and explicitly excluded from cloud syncing?
2. **Memory Format:** Do you prefer storing agent memory as readable Markdown files (which are prone to messy sync conflicts) or as structured, append-only JSONL event logs (which can be auto-resolved by Glade)?
3. **Shadow FS Structure:** Does the `.glade/` directory structure look correct for your vision of the Shadow FS?
