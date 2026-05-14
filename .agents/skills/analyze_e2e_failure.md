# Analyze E2E Failure Skill

You are currently developing the Glade IDE using Test-Driven Development (TDD) via Playwright tests.

If an E2E test fails, follow these specific guidelines:

## Understanding the Architecture
- **Headless Mode:** E2E tests run against the `vite` dev server (`localhost:1420`), while the Rust backend runs in headless mode on `localhost:1421`.
- **Tauri Mocks:** `window.__TAURI_INTERNALS__` is undefined in Playwright, so the `utils/api.ts` will fall back to using `fetch` calls to the `1421` port.
- **Port Conflicts:** If tests fail to start or complain about ports, check if port 1420 or 1421 are zombies. Recommend using `npm run restart` if so.

## Common Failures
1. **Selector Not Found:** The Glade UI relies heavily on modern CSS components. Always use `.sidebar-content` rather than generic HTML tags (e.g. `header` or `div`) since the structure may change. Check your assertions in `e2e/*.spec.ts`.
2. **WYSIWYG Prosemirror:** Interacting with the Milkdown/Prosemirror editor is tricky. We simulate pastes via `DataTransfer` events instead of typing directly. Refer to `e2e/wysiwyg.spec.ts` for exact logic.
3. **Agent SSE Streams:** The Agent SDK uses Server-Sent Events. If an agent timeout occurs in tests, ensure the local headless backend `axum` SSE route isn't buffering output improperly.

## Remediation Steps
- Read the Playwright terminal output.
- Identify the exact line where the locator failed.
- Update the UI selector or the test to match the reality of the React component DOM tree.
- Ensure any `invokeAgentStream` assertions properly consume the async generator.
