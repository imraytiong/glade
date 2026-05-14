# Development Setup

Glade was proudly developed using **Google AntiGravity**.

If you want to build Glade from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/imraytiong/glade.git
   cd glade
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

5. Run Playwright E2E Tests:
   ```bash
   npm run test:e2e
   ```

6. Run Headless Backend Tests:
   ```bash
   cd src-tauri
   cargo test
   ```
