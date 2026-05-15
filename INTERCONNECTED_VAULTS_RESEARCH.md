# Interconnected Vaults: Deep Research & Architectural Analysis

The concept of "Interconnected Vaults" (slated for Alpha 7) is a massive differentiator for Glade. Most PKMs treat a vault as an absolute, isolated silo. Glade's vision is a **network of vaults** where agents can query, cross-reference, and pull data securely across boundaries—even over a network protocol.

To ensure our Alpha 4 and 5 data models support this future, we need to finalize the structural primitives. This document outlines the core challenges, proposed architectural solutions, and open design questions for interconnected vaults.

---

## 0. Product Use Cases & Anti-Goals

Before diving into the technical plumbing, we must rigidly define the product boundaries of interconnected vaults. What are we empowering the user (and their agents) to do, and what are we explicitly preventing?

### ✅ Permitted Capabilities (The "Paved Path")
1. **Semantic Cross-Querying:** An agent in Vault A can run semantic searches or exact-match queries across the content of an explicitly authorized Vault B (e.g., "Find all references to Project X in my Work Vault").
2. **Read-Only Context Injection:** Agents can pull specific markdown files, code blocks, or metadata from a connected vault and inject them into their local context window to inform their local work.
3. **Cross-Vault Referencing (Portable by Design):** To prevent brittle, broken links if a user moves a vault, we explicitly avoid absolute hard links (`glade://vault-b/note.md`). Instead, cross-vault referencing must rely on semantic search queries or imported read-only snapshots to maintain 100% vault portability.
4. **Asynchronous Messaging (The Vault Inbox):** Vault A cannot indirectly mutate Vault B, even by pinging its agent. Instead, Vault A can send a "letter" (a message and a content payload) to Vault B's "Inbox". When the user explicitly opens Vault B later, they can review the Inbox and Vault B's agent can react to the message locally.
5. **File Pulling / Cloning:** A user (or their local agent) in Vault A can physically pull a copy of a file from Vault B into Vault A's directory structure. This safely creates a localized clone of the information without requiring a fragile cross-vault hard link, keeping mutations strictly local to the active vault.
6. **Read-Only File Previews:** When a cross-vault file is found via search or an agent query, the user can open a read-only view of that file directly within their current vault's UI. They can read it, but they cannot edit it unless they explicitly clone it (Capability 5) or switch to the target vault.

### 🚫 Anti-Goals & Explicit Restrictions
1. **No Direct OR Indirect Remote Mutations:** An agent in Vault A will **never** have the authority to execute `write_file` or `run_command` tools within Vault B. Furthermore, "indirect mutation" (where Vault A commands Vault B's agent to run a job in the background) is strictly forbidden in the first iteration. All cross-boundary mutations must be handled asynchronously via the Vault Inbox and require the user to be actively present in the target vault.
2. **No Hard Cross-Vault Links:** We will not support static cross-vault URL links that break the moment a directory is renamed or moved across machines.
3. **No Vault Merging:** Interconnected vaults do not mean "merged" vaults. The UI and file trees remain strictly isolated. You will never see Vault B's files polluting Vault A's file explorer.
4. **No Automatic Two-Way Trust:** Connecting Vault A to Vault B does not imply Vault B can read Vault A. Trust is strictly one-way and explicitly granted per connection.
5. **No Cross-Vault Index Bleed:** The Vector DB and full-text search indexes must never mix data from different vaults. Vault A's index only knows about Vault A. Cross-vault searches require routing the query to Vault B's discrete index.

---

## 1. The "Collection" Primitive (Replacing the Global Registry)

Since we explicitly outlawed hard cross-vault linking to preserve portability, we do not need to invent a custom `glade://` URI scheme. Instead of addressing specific paths, cross-vault interaction is based entirely on semantic queries and inbox routing.

To manage which vaults are allowed to talk to each other without relying on a brittle machine-specific global registry, we introduce a new first-class architectural concept: **Collections**.

### How Collections Work
A "Collection" is a logical grouping of vaults that establishes a hard security and discovery boundary.

1. **The Default Collection:** Every user starts with a default collection (e.g., "My Collection").
2. **Hard Boundaries:** A vault can only discover, query, and send messages to other vaults that exist within the *same* Collection. A vault in the "Work Collection" has absolutely zero awareness of a vault in the "Personal Collection".
3. **Many-to-Many Relationships:** A single vault can belong to multiple collections simultaneously if the user wishes (e.g., "General Coding Vault" could belong to both the "Work Collection" and a "Side Project Collection").

### The Configuration Layer
Instead of an arbitrary global registry in `~/.glade/registry.json`, the Collection configuration acts as the connective tissue. When Glade boots up, it operates within the context of a Collection. The Daemon restricts agents to querying the localized Vector DBs and Inboxes of the specific vaults defined within that active Collection.

---

## 2. Cross-Vault Access Architectures

When an Agent in Vault A needs to read a file in Vault B, how does that technically happen?

### Architecture Option A: The Unified Local Daemon
Since we are building a Headless CLI/Daemon in Alpha 4, the Daemon could simply read the Global Registry and have direct filesystem access to all local vaults.
*   **How it works:** The Agent uses a tool `read_cross_vault(vault_id, path)`. The Rust Daemon resolves the path from the registry and reads the file directly from disk.
*   **Pros:** Extremely fast. Lowest overhead.
*   **Cons:** Doesn't elegantly solve "Remote Vaults" (Vault C running on a Mac Mini server).

### Architecture Option B: Every Vault is an MCP Server
The Model Context Protocol (MCP) was explicitly designed for this. Instead of direct file reads, Vault B exposes an MCP interface.
*   **How it works:** Vault A's agent connects to Vault B's MCP server. It calls an MCP tool: `vault_b.search_notes(query)`.
*   **Pros:** Radically standardized. "Remote Vaults" over the network work identically to "Local Vaults". Strict security boundaries.
*   **Cons:** High overhead. We would need to spin up lightweight MCP servers/daemons for every registered vault on the machine to allow background cross-talk.

### Architecture Option C: Hybrid Daemon (Recommended)
The Glade Headless Daemon acts as the central router.
1.  **Local to Local:** If Vault A queries Vault B, and both are `type: local` in the registry, the Rust Daemon just reads the disk directly for performance.
2.  **Local to Remote:** If Vault A queries Vault C (`type: remote`), the Daemon translates the request into an MCP client request over HTTP/SSE.

---

## 3. Simplified Security Model (The Collection Boundary)

We are intentionally avoiding an overly complex, fine-grained Role-Based Access Control (RBAC) system (like requiring explicit "Grants" between vaults). We can dramatically simplify the security model by relying on the Collection boundary and the physical laws of the active vault.

### 1. The Collection implies Trust
If a user adds Vault A and Vault B to the same "Work Collection", it is implicitly assumed they want those vaults to share data. There is no need for complex Opt-In handshakes between peers in the same Collection. 

### 2. The Immutable Rule of the "Active Vault"
The "Rogue Agent" problem is neutralized by the architecture itself: **The active vault can never mutate another vault.**
*   If you are currently working in Vault A, your agent can *only* execute mutating tools (`write_file`, `run_command`) on Vault A's local filesystem.
*   When Vault A interacts with Vault B, the protocol is strictly **Read-Only**. Vault A can run queries, semantic searches, and physically pull/copy files *from* Vault B *into* Vault A (the primary use case of interconnectivity).
*   If Vault A wants to influence Vault B, it can only push an asynchronous message to Vault B's inbox. No direct or indirect mutations are permitted across boundaries.

---

## 4. Cross-Vault Semantic Vector Search (ChromaDB)

In Alpha 6, we plan to implement a lightweight vector database.
*   **The Challenge:** Does Glade maintain one massive global vector database for all vaults on the machine, or does each vault maintain its own isolated vector DB in its Shadow FS (`.glade/.shadow/chromadb/`)?
*   **[APPROVED] The Isolated Approach:** Each vault maintains its own local vector index. When Vault A performs a cross-vault semantic search on Vault B, the Rust Daemon simply queries Vault B's specific ChromaDB instance and returns the top K results. This preserves 100% data portability (the vector index travels with the vault). We will proceed with this isolated approach unless performance bottlenecks necessitate a unified index in the future.
