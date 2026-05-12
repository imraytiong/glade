# Glade Architecture Specification

## Overview
Glade is a desktop application built on top of the **Tauri v2** framework, utilizing **React 19** for the frontend, and **Milkdown** for the core editor experience. The goal of the architecture is to maintain a lightweight, highly responsive local-first knowledge base.

## Core Stack

### Backend (Rust / Tauri)
- **Framework:** Tauri v2
- **Language:** Rust
- **Responsibilities:**
  - Secure File System Access (`tauri-plugin-fs`)
  - Native OS Dialogs (`tauri-plugin-dialog`)
  - OS-Level window management (titlebar, sizing, protocols)
  - Custom protocol handlers (`asset://`) to serve local images securely to the WebView.

### Frontend (React / Vite)
- **Framework:** React 19 bundled with Vite.
- **Language:** TypeScript
- **Responsibilities:**
  - UI layout, sidebar management, tabs.
  - Command palette execution.
  - Communication with the Rust backend via `@tauri-apps/api`.

### Editor (Milkdown)
- **Engine:** Milkdown (built on ProseMirror & remark).
- **Architecture:** We use a plugin-driven approach (`@milkdown/plugin-*`) to add features like slash commands, block formatting, and emoji support.
- **State Management:** The editor maintains its own internal ProseMirror state. React components interact with it via the `@milkdown/react` provider and context actions (e.g., in `src/components/useGladeEditor.tsx`).

## Application State
The global UI state (open tabs, active file, sidebar toggle) is currently managed at the top-level `App.tsx` using standard React hooks. As the application grows, this may be migrated to a dedicated state manager (like Zustand or Jotai) to prevent excessive prop-drilling.

## Markdown Parsing & Frontmatter
- **Frontmatter:** Glade uses standard YAML frontmatter for metadata. This is parsed out before injecting content into Milkdown and is managed by the `FrontmatterEditor` component.
- **Backlinks & References:** Handled lazily by reading files and parsing their content on-demand, though a global indexer is planned for future optimizations.
