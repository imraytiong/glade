# Glade User Manual

Welcome to Glade! This manual covers the basic functionality of the Glade IDE.

> [!CAUTION]
> **Extreme Alpha Warning:** Glade is in v0.0.1-alpha.1. Please do not use it on your primary or valued markdown vaults without backing them up first!

## Managing Vaults
- **Opening a Vault:** Click the "Open Vault" button on the Welcome screen or use the Command Palette. Select a local folder containing your markdown files.
- **File Explorer:** The left sidebar displays all `.md` files in your vault. 
  - Click a file to open it.
  - Use the folder/file icons at the bottom of the sidebar to create new entries.
  - Right-click (or use hotkeys) to rename or delete.

## The Editor
Glade uses a WYSIWYG (What You See Is What You Get) markdown editor. You can type standard markdown syntax, and it will format immediately.

### Markdown Features
- **Headings:** Type `# ` for H1, `## ` for H2, etc.
- **Lists:** Type `- ` or `* ` for bulleted lists, `1. ` for numbered lists.
- **Formatting:** Use `**bold**`, `*italic*`, `~~strikethrough~~`, and `` `code` ``.
- **Code Blocks:** Type ` ``` ` followed by the language name (e.g. ` ```typescript `) to create a syntax-highlighted code block.

### Slash Commands
Type `/` anywhere in a document to open the slash menu. This allows you to quickly insert headings, lists, tables, code blocks, and other elements without remembering markdown syntax.

## Agent Command Center (Glade AI)
Glade is built around a native Multi-Agent System. You must configure your Gemini API Key in the Settings (`Cmd/Ctrl + ,`) to use these features.

### Right Sidebar Chat
Click the **Bot Icon** in the top right (or toggle the right sidebar) to open the Agent Chat. 
- You can converse with the Coordinator agent here.
- The chat is **context-aware**, meaning it automatically knows the contents of your active document. You can ask questions like "Summarize this document" and it will read the active file.

### Inline Editor Prompts
For contextual refactoring, you can invoke the AI directly in the editor:
- **Generative Prompt:** Type `/agent` to open a floating prompt. Tell the AI what you want to write (e.g. "Draft an email to my boss about Friday's meeting"), and it will stream the markdown directly into your document.
- **Refactoring:** Highlight a section of text and click the "Sparkle (AI)" icon in the formatting tooltip. Tell the AI how to rewrite the text (e.g. "Make this more professional" or "Translate to Spanish") and it will replace your selection with the result.

## Frontmatter & Properties
The right sidebar contains the **Outline** and **Properties** panes. 
- The Properties pane allows you to edit the YAML frontmatter of your document visually.
- The Outline pane automatically generates a Table of Contents based on your document's headings. Clicking a heading will scroll the editor to that section.

## Command Palette
Press `Cmd/Ctrl + P` to open the Command Palette.
- Search for any file in your vault to quickly open it.
- In the future, this will also allow you to execute application commands (like toggling themes).

## Distraction-Free (Zen) Mode
Press `Cmd/Ctrl + Shift + Z` (or trigger it via the Command Palette) to toggle Zen Mode. This hides the sidebars, tabs, and status bar, leaving you with just your content.

## Fleet Builder & Agent Management
Glade features a dedicated **Fleet Builder** to manage your Multi-Agent System.
- Click the **Fleet Builder** (Bot Icon) in the left sidebar to enter the Agent Workspace.
- Here, you can define specific personas (like an "Editor" or "Research Assistant"), assign them tools, and give them capabilities.
- Agents are stored directly in your vault at `.glade/agents/*.agent.md` so they travel with your data and can be version controlled.
- From the Fleet Builder, you can also access the **Tools**, **Skills**, and **Models** ecosystem panels to configure external connections (like MCP servers).
