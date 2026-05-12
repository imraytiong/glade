# Contributing to Glade

Thank you for your interest in contributing to Glade! Since we are currently in Alpha, there are many opportunities to shape the core architecture and feature set.

## Development Setup

1. **Prerequisites:**
   - [Node.js](https://nodejs.org/) (v18+)
   - [Rust](https://www.rust-lang.org/)
   - OS-specific Tauri dependencies (Xcode/Command Line Tools on macOS, MSVC on Windows, WebKit2GTK on Linux). See [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites/).

2. **Clone & Install:**
   ```bash
   git clone https://github.com/rayintheloop/glade.git
   cd glade
   npm install
   ```

3. **Run Dev Server:**
   ```bash
   npm run dev
   ```

## Code Standards
- We use **Test-Driven Development (TDD)**. All new features and regressions must be covered by unit tests (Vitest) or E2E tests (Playwright).
- Keep React components functional and use hooks.
- For backend changes, ensure `cargo clippy` and `cargo fmt` pass without warnings.

## Submitting a Pull Request
1. Fork the repository and create your feature branch (`git checkout -b feature/amazing-feature`).
2. Write tests for your feature!
3. Ensure all tests pass (`npx vitest run` and `npx playwright test`).
4. Commit your changes.
5. Push to the branch and open a Pull Request against the `main` branch.

We look forward to reviewing your contributions!
