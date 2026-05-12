# Glade

**Version:** 0.0.1-alpha.1

> [!CAUTION]
> **Extreme Alpha Warning**
> Glade is currently in an extreme early alpha state. It is not ready for production use. Anyone is free to try it out, but **using it against a valued vault or folder of markdown is highly discouraged for now**. Please make a copy of your files before opening them in Glade to prevent accidental data loss.

Glade is a modern, sleek, and highly extensible Markdown knowledge base and IDE. Built with Tauri, React, and Milkdown, it provides a seamless WYSIWYG editing experience with distraction-free features and hotkey-driven commands.

## Documentation

- [User Manual](MANUAL.md) - Learn how to use Glade's features, commands, and shortcuts.
- [Architecture](ARCHITECTURE.md) - Understand the technical design of Glade (Tauri + React + Milkdown).
- [Roadmap](ROADMAP.md) - See our planned features and future direction.
- [Contributing](CONTRIBUTING.md) - Guidelines for developers to set up the project locally.
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community guidelines.

## Quick Start

### Installation

For early alpha testers, you can download the latest binaries from the [Releases](../../releases) page once they are built via GitHub Actions.

### Development Setup

If you want to build Glade from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/rayintheloop/glade.git
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

## License

MIT License. See [LICENSE](LICENSE) for details.
