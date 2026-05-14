The user mentioned the (tdd) workflow. Here are its contents:

1. **Elicit Requirements**
   - Ask the user to describe the new feature or fix.

2. **Write Failing Test**
   - Create or update the relevant Playwright E2E test (`e2e/*.spec.ts`) or Cargo test (`src-tauri/src/`).
   - Run the test to verify it fails as expected.

3. **Implement Feature**
   - Write the necessary code to implement the feature or fix the bug.

4. **Verify Implementation**
   - Run the test suite again.
   - If tests pass, notify the user.
   - If tests fail, iterate on the code until the tests pass.
