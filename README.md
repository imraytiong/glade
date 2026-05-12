# Glade IDE User Manual

Welcome to **Glade IDE**, a modern, lightweight, and professional markdown writing environment. Built with Tauri, React, and TypeScript, Glade is designed to offer a seamless knowledge management and note-taking experience with native-feeling ergonomics and powerful WYSIWYG text-editing capabilities.

---

## Key Features

### 📝 WYSIWYG Markdown Editing
- **Unified Visual Editor**: Glade is powered by the Milkdown engine, offering a seamless "What You See Is What You Get" writing experience. No need to toggle between raw code and previews—your markdown is beautifully rendered as you type.
- **Slash Commands**: Type `/` anywhere to instantly open a floating command menu to insert Headings, Lists, Blockquotes, and more.
- **Floating Formatting**: Highlight any text to reveal a sleek tooltip for quickly applying Bold, Italic, Strikethrough, or Links.
- **Smart Lists & Indentation**: Automatic continuation of bullet points, numbered lists, and interactive checkboxes that update the underlying file when clicked.
- **Syntax Highlighting & Diagrams**: Code blocks are automatically highlighted, and `mermaid` code blocks are instantly rendered into visual diagrams in place.

### 🧭 Navigation & Organization
- **Wiki-Links & Backlinks**: Wrap text in `[[brackets]]` to easily link to other notes. A dedicated Backlinks Pane shows you all files linking to the current document.
- **Table of Contents (Outline)**: Automatically extracts headings into a dedicated right sidebar. Clicking a heading smoothly scrolls the editor to that section.
- **Interactive Frontmatter Editor**: YAML frontmatter is safely parsed and moved out of your way into an elegant, keyboard-navigable property grid at the top of the Outline panel.
- **Live Statistics**: Real-time word count, character count, and reading time are displayed dynamically in the bottom status bar.

### 📂 File & Media Management
- **Local Asset Resolution**: Drag and drop images directly into the editor. Glade handles local `asset://` paths natively, ensuring your images render instantly.
- **Seamless Renaming**: Click-to-edit file names across three different UI boundaries: the File Explorer sidebar, the top Tab Bar, and the Editor Header. Changes propagate instantly.
- **Quick Actions**: Hover over files and folders in the sidebar to reveal quick-action buttons for creating new files/folders, renaming, and deleting.

### ⚙️ Customization & Settings
- **Global Settings Panel**: Click the gear icon in the bottom left to access application-level configurations.
- **Editor Preferences**: Toggle Word Wrap, Line Numbers, and the Backlinks pane on or off. Settings are persisted automatically between sessions.

---

## Using Glade

### 1. Opening a Vault
When you first start Glade, you will be prompted to open a folder (vault). This folder acts as your workspace. All markdown files within this directory and its subdirectories will be indexed by Glade. 

### 2. Creating and Managing Files
- **New File / Folder**: Hover over the sidebar header or any folder to reveal the `+` icons to create new items.
- **Renaming**: Click on the active tab title, or click the file name at the top of the editor, or use the rename icon in the sidebar to rename files inline.
- **Moving**: Click and drag a file in the sidebar and drop it onto a folder to move it.

---

## Architecture Note: The Move to Milkdown
*Glade recently underwent a major architectural shift, migrating from a split CodeMirror/Markdown-Preview setup to a unified WYSIWYG experience powered by Milkdown (ProseMirror).* 
*As a result, the old "Split View" and "Raw Edit Mode" toggles have been retired in favor of a distraction-free, fully rendered editing canvas. This change unlocked advanced features like Slash Commands, Floating Tooltips, and interactive Task Lists.*

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
