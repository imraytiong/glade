# Glade IDE Roadmap

This document outlines the planned future features and enhancements for Glade. As we continue to refine our WYSIWYG Milkdown-powered writing experience, these are the core priorities currently in our backlog.

---

## 🚀 Priority Features

### Advanced Writing Ergonomics
These features are dedicated to making Glade a more immersive, distraction-free environment for deep writing.

- [ ] **Typewriter Mode**
  - *Goal:* A toggleable setting that locks the active line to the vertical center of the screen as you type. This prevents your eyes from constantly tracking down to the bottom of the monitor during long, continuous writing sessions.
- [ ] **Focus Mode (Active Block Highlighting)**
  - *Goal:* When enabled, the paragraph or block you are currently editing stays bright and prominent, while the rest of the document gently fades out. This helps maintain absolute concentration on the current sentence.

### Linking & Navigation
Enhancing our internal knowledge-graph capabilities.

- [ ] **Hover Page Previews (Peeks)**
  - *Goal:* When you hover your mouse over an internal `[[wiki-link]]`, a sleek glassmorphic popover appears showing a quick preview of the target file's contents, allowing you to read context without losing your place.
- [ ] **HTTP Link Support for Autocomplete**
  - *Goal:* Extend the `[[` linking system so that typing or pasting standard `http://` links into the autocomplete menu seamlessly inserts standard markdown external links.

---

## 🛠 Advanced Editor Capabilities

### Expanded Content Support
- [ ] **Math & LaTeX Support (`@milkdown/plugin-math`)**
  - *Goal:* Native rendering for inline (`$math$`) and block (`$$math$$`) LaTeX equations visually within the editor. Essential for technical documentation and academic writing.

### Enhanced Block Manipulation
- [ ] **Notion-style Block Handles (`@milkdown/plugin-block`)**
  - *Goal:* Add an interactive drag-handle to the left of every block (paragraphs, lists, headings). This allows for rapid reordering of document sections via native drag-and-drop. *(Currently deferred due to upstream WebKit/Tauri copy-behavior quirks).*
