<p align="center">
  <img src="app-icon.png" width="128" height="128" alt="Glade Logo">
</p>

# Glade
**Version:** 0.0.1-alpha.5

> [!CAUTION]
> **Extreme Alpha Warning**
> Glade is currently in an extreme early alpha state. It is not ready for production use. Anyone is free to try it out, but **using it against a valued vault or folder of markdown is highly discouraged for now**. Please make a copy of your files before opening them in Glade to prevent accidental data loss.

**Glade is an Agentic-Native Knowledge Base.**

Built from the ground up to solve the clumsiness of bolt-on AI tools, Glade is an experimentation in creating a strictly local Personal Knowledge Management (PKM) system that treats a Multi-Agent System (MAS) as a core pillar. It brings together the best features of editors like Obsidian and Notion, but supercharges them with opinionated AI-native UX, the ability to connect your own local inference engines, and first-class support for interconnected cross-vault collections.

### Core Features (Alpha 5)
- **Agent Command Center:** A context-aware chat interface integrated directly into the sidebar with multi-turn conversational memory.
- **Fleet Builder:** A dedicated multi-window workspace to define specialized agent personas and curate their exact system prompts and tool access within your vault.
- **Inline Refactoring:** Highlight text and use AI to rewrite, shorten, or elaborate without leaving your flow.
- **Zero-Friction Prompting:** Type `/agent` to trigger generative AI commands that render beautifully directly into the editor as rich markdown.
- **Pluggable Agentic Core:** Add custom markdown-based skills (`.agents/skills/`) to your vault, and natively execute Model Context Protocol (MCP) servers to extend Glade's capabilities.
- **Headless SDK & CLI:** Run Glade headless via the `glade` Node CLI for automation, or expose your vault agents to external tools via the built-in MCP server proxy (`glade mcp`).
- **Local-First & Secure:** Native Rust execution harness that orchestrates agents with high performance, saving your API keys securely in the OS keychain.

## Documentation

- [User Manual](MANUAL.md) - Learn how to use Glade's features, commands, and shortcuts.
- [Architecture](ARCHITECTURE.md) - Understand the technical design of Glade (Tauri + React + Milkdown).
- [Roadmap](ROADMAP.md) - See our planned features and future direction.
- [Contributing](CONTRIBUTING.md) - Guidelines for developers to set up the project locally.
- [Development](DEVELOPMENT.md) - Instructions for building Glade from source.
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community guidelines.

## Quick Start

### Installation

For early alpha testers, you can download the latest binaries from the [Releases](../../releases) page once they are built via GitHub Actions.

#### Quick Install (macOS Apple Silicon)
To cleanly download the latest release for modern Macs (M1/M2/M3 chips) and automatically bypass macOS "damaged app" Gatekeeper warnings, paste this single command into your terminal:

```bash
curl -s https://api.github.com/repos/imraytiong/glade/releases | grep "browser_download_url.*aarch64\.dmg" | head -n 1 | cut -d '"' -f 4 | xargs curl -L -o Glade.dmg && hdiutil attach Glade.dmg
```

Once the disk image mounts, simply drag **Glade** into your `Applications` folder.

#### Manual Download Troubleshooting
If you prefer to manually download the `.dmg` file from the browser, macOS will quarantine the file because Glade is currently an unsigned open-source alpha. This causes a misleading error stating the **"App is damaged and can't be opened."**

To bypass this:
1. Drag **Glade** from the `.dmg` into your `Applications` folder.
2. Open your terminal and run the following command to remove the quarantine flag:
   ```bash
   xattr -cr /Applications/Glade.app
   ```
3. You can now launch Glade normally from your Applications folder!

### Development Setup

Please refer to our [Development Guide](DEVELOPMENT.md) for instructions on how to build Glade from source.

## License

MIT License. See [LICENSE](LICENSE) for details.
