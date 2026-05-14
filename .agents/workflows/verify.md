The user mentioned the (verify) workflow. Here are its contents:

1. **Run Verification Commands**
   // turbo-all
   Run `npm run test:e2e` to verify the frontend and E2E pipeline.
   Run `cargo test` in `src-tauri/` to verify backend integrity.

2. **Analyze Output**
   - If tests fail, automatically review the Playwright or Cargo test logs.
   - For Playwright UI failures, use the `analyze_e2e_failure` skill to correctly interpret headless DOM structure issues.
   - For Rust backend failures, review the `rust_tauri_bridge` skill to ensure the Tauri/Axum hybrid boundaries were respected.

3. **Resolve**
   - Propose an immediate fix to any failing tests.
   - Ask for user approval to apply the fix, and then automatically verify the fix using this same workflow.
