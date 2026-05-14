# Alpha 4: Headless Architecture & Frontend Decoupling

The primary goal of the first phase of Alpha 4 is to decouple our React frontend from the Tauri IPC (Inter-Process Communication) layer. By exposing our Rust backend via standard HTTP/WebSockets, we can run the Multi-Agent System completely headless. This unlocks the ability to use standard Playwright browser automation against a regular Chrome/Firefox instance, enabling robust E2E testing and laying the foundation for remote execution and our Agent-as-a-Judge SDK.

## Proposed Changes

### Rust Backend (`src-tauri/src/`)

#### [NEW] `server.rs`
- Add an `axum` web server implementation that runs concurrently with (or instead of) the Tauri app.
- Ensure `axum`, `tower-http` and `cors` dependencies are added to `Cargo.toml`.
- Expose endpoints corresponding to our Tauri commands:
  - `POST /api/list_vaults`
  - `POST /api/open_vault`
  - `POST /api/read_file`
  - `POST /api/save_file`
  - `POST /api/get_agents`
  - `POST /api/save_agents`
  - `POST /api/invoke_agent`
- We will need to extract the core logic out of the `#[tauri::command]` functions into generic async functions that can be called by both Tauri IPC and Axum HTTP routes.

#### [MODIFY] `lib.rs` / `main.rs`
- Add a `--headless` CLI argument parsing.
- If `--headless` is passed, we skip initializing the Tauri window entirely and simply spin up the `axum` server on a dedicated port (e.g., `1421`) to serve the API headless.

### Frontend (`src/`)

#### [NEW] `utils/api.ts`
- Create a unified API wrapper (`api.invoke<T>(command: string, args?: any)`).
- Implement logic to detect the environment (e.g., checking if `window.__TAURI_INTERNALS__` is present). 
- If running inside a Tauri WebView on macOS (or where active testing ensures stability), it uses native IPC `invoke` for maximum performance.
- If running in a regular browser (like during Playwright tests), it falls back to making a `POST http://localhost:1421/api/command_name` `fetch` request.

#### [MODIFY] `App.tsx`, `AgentSidebar.tsx`, `Sidebar.tsx`, etc.
- Replace all direct imports of `@tauri-apps/api/core` `invoke` with our new `utils/api.invoke`.

## Verification Plan

### Automated Tests
- We will write a simple Playwright test `e2e/headless.spec.ts` that runs against the standard Vite dev server (`http://localhost:1420`) while the Rust backend is running in `--headless` mode on port `1421`.
- Verify that vault loading, file reading, and agent invocation work correctly over HTTP.

### Manual Verification
- We will manually launch the app in standard desktop mode (Tauri) and verify that it still works flawlessly using native IPC.
- We will open `http://localhost:1420` in a standard Chrome browser and verify we can interact with the app.
# Alpha 4 Phase 2: Full Headless Decoupling

While we successfully decoupled our custom agentic commands (e.g., `invoke_agent`, `get_agents`) in Phase 1, our React frontend is still tethered to the desktop app because it directly imports `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-store` for file exploration and settings.

To achieve our goal of **standard browser-based E2E testing** (and eventually remote execution), we need to fully decouple these core OS plugins.

## Proposed Changes

### 1. Abstracting Tauri Plugins (`src/utils/fs.ts`, `src/utils/settings.ts`)

Instead of calling `readDir` or `readTextFile` directly from `@tauri-apps/plugin-fs`, we will wrap these calls. If `window.__TAURI_INTERNALS__` is missing (headless mode), we will route them through our HTTP API wrapper (`src/utils/api.ts`).

#### [MODIFY] `src/utils/fs.ts`
- Replace `@tauri-apps/plugin-fs` calls (`readDir`, `readTextFile`, `writeTextFile`) with a conditional fallback.
- In headless mode, send POST requests to `http://localhost:1421/api/fs_read_dir`, `fs_read_text_file`, etc.

#### [MODIFY] `src/utils/settings.ts`
- Replace `@tauri-apps/plugin-store` calls with a conditional fallback.
- In headless mode, send POST requests to `http://localhost:1421/api/store_get` and `store_set`.

### 2. Expanding the Axum Headless Server (`src-tauri/src/server.rs`)

We need to add corresponding HTTP routes to securely handle these OS-level requests in headless mode.

#### [MODIFY] `src-tauri/src/server.rs`
- `POST /api/fs_read_dir`
- `POST /api/fs_read_text_file`
- `POST /api/fs_write_text_file`
- `POST /api/store_get`
- `POST /api/store_set`

> [!WARNING]
> Security context: In headless mode, these file system endpoints provide broad disk access. For Alpha 4 testing purposes, this is acceptable since it runs locally. For production remote hosting in the future, we will need to sandbox these filesystem endpoints to the Vault boundary.

### 3. Headless Playwright Verification (`e2e/headless.spec.ts`)

With plugins decoupled, we can now write a Playwright test that actually hits the Vite dev server (`http://localhost:5173`) using standard Chromium, while the Rust backend serves traffic headless via HTTP.

#### [NEW] `e2e/headless.spec.ts`
- A test script that validates the full agent invocation flow WITHOUT injecting the Tauri IPC mock.

## User Review Required
Does this Phase 2 approach align with your vision for the E2E infrastructure? Once approved, I'll execute the plugin refactoring and the headless test harness.
# Alpha 4 Phase 3: AntiGravity SDK & Automation Pipelines

Now that the Glade backend can run completely headless via our Axum HTTP server, we can unlock programmatic access. The goal of Phase 3 is to build the **AntiGravity SDK**—a client library that allows developers to write automation scripts to orchestrate their agent fleet without needing the Glade IDE UI.

## Goal

Create a Node.js/TypeScript SDK that wraps our local headless REST API (`http://127.0.0.1:1421/api/*`), enabling CI/CD pipelines, bulk operations, and headless agent orchestration.

## Proposed Changes

### 1. The Glade Client SDK (`packages/glade-sdk`)

We will create a new sub-package within the repository (or a dedicated folder `src/sdk/` if we don't want a monorepo structure just yet) that exports a clean, typed `GladeClient`.

#### [NEW] `sdk/client.ts`
- **Class `GladeClient`:**
  - `constructor(endpoint: string = 'http://127.0.0.1:1421')`
  - `async openVault(path: string): Promise<void>`
  - `async readDir(path: string): Promise<FsDirEntry[]>`
  - `async readFile(path: string): Promise<string>`
  - `async writeFile(path: string, content: string): Promise<void>`
  - `async getAgents(vaultPath: string): Promise<Agent[]>`
  - `async *invokeAgentStream(vaultPath: string, agentId: string, prompt: string): AsyncGenerator<string, void, unknown>` (Returns an async generator to consume Server-Sent Events (SSE) from the backend)

### 2. Backend SSE Support

To support streaming, we need to update the Rust headless server to emit SSE.

#### [MODIFY] `src-tauri/src/server.rs`
- Add an `axum::response::sse::Sse` endpoint for `/api/invoke_agent_stream`.
- Update the underlying `AgentManager::invoke` to return a `Stream` of chunks, or expose a streaming variant of the invocation logic that the Axum handler can consume and forward as SSE events to the client.

### 2. Example Automation Pipeline

To prove the SDK works, we will build a sample automation script that uses the SDK to perform a bulk operation across the vault.

#### [NEW] `scripts/automate_refactor.ts`
- A script that uses the `GladeClient` to:
  1. Connect to the headless backend.
  2. Load a specific vault.
  3. Find all `.md` files in a specific directory.
  4. Programmatically invoke a "Formatter" or "Summarizer" agent on each file in parallel.
  5. Save the results back to the vault.



## Verification Plan

### Automated Tests
- We will write a test in `e2e/sdk.spec.ts` that imports the `GladeClient` directly, points it at the headless Playwright backend, and verifies that the SDK successfully creates an agent, prompts it, and reads the output file.

### Manual Verification
- We will run the `automate_refactor.ts` script from the terminal and watch the files in the vault magically update as the headless agent processes them in the background.
# Alpha 4 Phase 4: Automated QA Pipelines & Headless CLI

This phase focuses on the final objectives of the Alpha 4 release: establishing robust Automated QA Pipelines via Playwright CI/CD integration and providing a Headless CLI for remote execution.

## Goal

1. **Automated QA Pipelines**: Integrate Playwright UI testing into a local testing suite. Playwright allows us to script headless browsers (like Chromium) to click around the Glade UI and verify it behaves correctly. We will configure package scripts to easily run these tests locally, ensuring the frontend still correctly communicates with the decoupled headless backend without needing to wait for a CI pipeline.
2. **Headless CLI**: Expose the Glade SDK as a global CLI (`glade`), enabling developers to invoke the MAS and perform workspace operations directly from the terminal.

## Architecture Decisions
> [!NOTE]
> Based on your feedback, the MCP server will be built as an extension of the Node CLI (e.g., `glade mcp`) rather than a native Rust implementation. This allows us to rapidly leverage the new Glade SDK for MCP integration.

## Proposed Changes

### 1. Automated QA Pipelines

#### [NEW] `e2e/ui.spec.ts`
- A Playwright test suite that opens `http://localhost:1420` in a headless browser and verifies standard UI workflows (e.g., loading a vault, prompting an agent via the Agent Sidebar) without relying on native Tauri IPC.

#### [MODIFY] `package.json`
- Add npm scripts to facilitate testing:
  - `"test:e2e": "playwright test"`
  - `"start:headless": "cargo run --manifest-path src-tauri/Cargo.toml -- --headless"`
- Add configuration to Playwright (if not already present) to automatically start the local dev server and headless backend before running tests.

### 2. Headless CLI

#### [NEW] `src/cli/index.ts`
- Create a simple CLI wrapper around the `GladeClient`.
- Provide commands such as:
  - `glade invoke <agent_name> <prompt> --vault <path>`
  - `glade mcp` (Spins up a stdio MCP server proxying requests via the SDK to the Glade Engine)

#### [MODIFY] `package.json`
- Expose the CLI via the `bin` field:
  ```json
  "bin": {
    "glade": "./dist/cli.js"
  }
  ```
- Add a build step for the CLI if necessary.

## Verification Plan

### Automated Tests
- Local verification using `npm run test:e2e` which will execute `e2e/ui.spec.ts` and `e2e/sdk.spec.ts`.

### Manual Verification
- We will install the package globally (`npm link`) and run `glade invoke coordinator "Hello"` from the terminal to verify the CLI correctly instantiates the `GladeClient` and communicates with the background server.
# Alpha 4 Phase 5: AntiGravity Development Harness

Ah, you're completely right! When I refactored the Alpha 4 plan based on the "Glade SDK / Headless CLI" feedback, I accidentally dropped the internal **AntiGravity Harness** (Agent-as-a-Judge, workflows, and skills) from the roadmap entirely. My apologies! 

We need to formalize the environment that *I* (Antigravity) use to autonomously develop and verify the Glade codebase. 

## Goal
Establish a first-class, agentic development harness within the `.agents/` directory of the Glade repository. This will provide standardized workflows, aggressive regression testing harnesses, and an "Agent-as-a-Judge" verification loop to ensure a provably correct and maintainable codebase using Test-Driven Development (TDD).

## Proposed Additions

### 1. Standardized Workflows (`.agents/workflows/`)
We will create slash-command workflows that allow you to instantly trigger complex, multi-step agentic routines.

#### [NEW] `verify.md` (`@[/verify]`)
- **Action:** Runs `npm run test:e2e` and `cargo test`.
- **Logic:** If tests fail, it automatically analyzes the Playwright logs/Cargo output, isolates the failure, and attempts to fix the code autonomously.

#### [NEW] `judge.md` (`@[/judge]`)
- **Action:** Triggers the "Agent-as-a-Judge" flow.
- **Logic:** Evaluates the current state of the repository against the Alpha 4 specifications to ensure no regressions have been introduced visually or structurally.

#### [NEW] `tdd.md` (`@[/tdd]`)
- **Action:** A workflow tailored for writing tests *first*. 
- **Logic:** Prompts the user for a feature, writes the failing Playwright/Cargo test, verifies it fails, implements the feature, and verifies it passes.

### 2. AntiGravity Skills (`.agents/skills/`)
Reusable capabilities that give me deep, pre-configured insights into the Glade architecture.

#### [NEW] `analyze_e2e_failure.md`
- A skill that teaches me exactly how to read Playwright traces and logs within the Glade UI context (e.g., understanding the headless DOM structure, the Tauri mock limitations, and Vite startup sequences).

#### [NEW] `rust_tauri_bridge.md`
- A skill that defines the structural relationship between `src-tauri/src/server.rs` (the headless backend), the Tauri commands, and the frontend `utils/api.ts` so I don't break the IPC/HTTP fallback architecture.

### 3. CI / Automation Scripts
#### [NEW] `scripts/agent_judge.ts`
- A headless script that uses our new `glade invoke` CLI (or standard SDK) to programmatically ask an agent to review a recent git diff or test output, acting as an automated reviewer before commits.

## User Review Required
Does this accurately capture the AntiGravity-specific support you were expecting for the Alpha 4 roadmap? Let me know if you want to adjust the specific workflows or skills before we implement them!
