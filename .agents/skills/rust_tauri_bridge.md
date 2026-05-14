# Rust Tauri Bridge Skill

The Glade architecture uses a dual-interface approach for the backend to support both native Desktop (Tauri) and Headless SDK/Browser clients.

## Core Principles
1. **Shared Logic:** All core agent logic, filesystem operations, and vault management must reside in generic asynchronous Rust functions (e.g., in `src-tauri/src/agent/` or similar modules).
2. **Tauri Commands:** The `#[tauri::command]` functions must be thin wrappers. They should only handle Tauri-specific concepts like AppHandles or Windows, extract the parameters, and call the shared logic functions.
3. **Axum HTTP Handlers:** The headless REST API (`src-tauri/src/server.rs`) uses `axum`. These handlers must be thin wrappers around the EXACT SAME shared logic functions used by the Tauri commands.
4. **No UI State in Core:** Never embed Tauri window state or UI events inside the core logic functions. If you need to emit events, use a decoupled channel or return a stream that the Tauri command or Axum handler can forward.

## Frontend Fallback
- `src/utils/api.ts` handles the branching logic.
- If it detects a Tauri environment (macOS app), it calls `invoke()`.
- If it detects a standard browser (Playwright/Headless SDK), it makes an HTTP `POST` to `http://localhost:1421`.
- Do not break this fallback. Always ensure both the Tauri command name and the Axum route name match exactly so the generic `api.invoke('get_agents')` works in both environments.
