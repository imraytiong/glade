# Glade IDE User Manual

Welcome to **Glade IDE**, a modern, lightweight, and professional markdown writing environment. Built with Tauri, React, and TypeScript, Glade is designed to offer a seamless knowledge management and note-taking experience with native-feeling ergonomics and powerful text-editing capabilities.

---

## Key Features

### 📝 Markdown & Editing Power
- **Side-by-Side Edit & Preview**: Toggle between raw markdown and beautifully rendered output, or view them side-by-side. 
- **Typewriter / Focus Mode**: Keep your current line perfectly centered on the screen for a distraction-free writing experience.
- **Smart Lists**: Automatic continuation of bullet points, numbered lists, and checkboxes when you press `Enter`.
- **Syntax Highlighting & Mermaid Diagrams**: Code blocks are automatically highlighted using Prism.js. `mermaid` code blocks are rendered into visual diagrams in the preview.
- **Frontmatter Support**: Fully parses and cleanly displays YAML frontmatter at the top of your markdown previews.
- **Robust Find & Replace**: Press `Cmd+F` (or `Ctrl+F`) to use a native, integrated search and replace widget within your documents.

### 🧭 Navigation & Organization
- **Wiki-Links & Backlinks**: Wrap text in `[[brackets]]` to easily link to other notes. A dedicated Backlinks Pane shows you all files linking to the current document.
- **Hover Previews**: Hover over any wiki-link in the editor to see a fully rendered markdown preview popup of the linked file.
- **Dangling Link Indicators**: Missing or broken links are highlighted with a distinct wavy red underline so you can spot orphans quickly.
- **Table of Contents (Outline)**: Automatically extracts `h1` through `h6` headings into a dedicated sidebar. Clicking a heading instantly scrolls the editor to that section.
- **Deep Linking**: Link directly to specific headings within a file using `[[Filename#Heading]]`.

### 📂 File Management
- **Seamless Renaming**: Click-to-edit file names across three different UI boundaries: the File Explorer sidebar, the top Tab Bar, and the Editor Header. Changes propagate instantly.
- **Drag & Drop**: Native drag-and-drop support in the sidebar. Move files between folders effortlessly.
- **Quick Actions**: Hover over files and folders in the sidebar to reveal quick-action buttons for creating new files/folders, renaming, and deleting.
- **Safe Deletion**: A reusable confirmation dialog protects you from accidental deletions, with a "Don't show this again" option for power users.

### ⚙️ Customization & Settings
- **Global Settings Panel**: Click the gear icon in the bottom left to access application-level configurations.
- **Editor Preferences**: Toggle Word Wrap, Line Numbers, Typewriter Mode, and the Backlinks pane on or off. Settings are persisted automatically between sessions.

---

## Using Glade

### 1. Opening a Vault
When you first start Glade, you will be prompted to open a folder (vault). This folder acts as your workspace. All markdown files within this directory and its subdirectories will be indexed by Glade. 

### 2. Editor Modes
In the top right corner of the editor, you can toggle between three views:
- **Edit**: A focused, raw markdown editor powered by CodeMirror.
- **Preview**: A clean, read-only rendered view of your markdown.
- **Split**: Shows the raw editor and the live rendered preview side-by-side.

*Note: Clicking external links in Preview mode will securely open them in your operating system's default browser.*

### 3. Creating and Managing Files
- **New File / Folder**: Hover over the sidebar header or any folder to reveal the `+` icons to create new items.
- **Renaming**: Click on the active tab title, or click the file name at the top of the editor, or use the rename icon in the sidebar to rename files inline.
- **Moving**: Click and drag a file in the sidebar and drop it onto a folder to move it.

---

## Development & Testing Guide

Glade uses a modern web stack embedded in a Rust backend via Tauri.

### Setup
Ensure you have Node.js and Rust installed on your machine.
```bash
# Install dependencies
npm install
```

### Running Locally
To spin up the Vite development server and the Tauri window simultaneously:
```bash
npm run tauri dev
# or
npm run restart
```

### Running Tests
Glade embraces Test-Driven Development (TDD) for maximum stability.

- **Unit/Integration Tests**: Run the Vitest suite for UI and utility testing.
```bash
npx vitest run
```
- **End-to-End Tests**: Run Playwright to execute full browser-level tests against the UI.
```bash
npx playwright test
```

### Building for Production
To compile the TypeScript and build the final executable for your operating system:
```bash
npm run build
```
