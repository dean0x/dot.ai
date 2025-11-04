# dot.ai

> AI-powered code generation from plain Markdown specifications

[![npm version](https://badge.fury.io/js/%40dean0x%2Fdot.svg)](https://www.npmjs.com/package/@dean0x/dot)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## What is dot.ai?

Write your requirements in `.ai` files (plain Markdown), run `dot gen`, and let AI coding agents implement them. Perfect for rapid prototyping, maintaining consistency, and automating repetitive coding tasks.

### Key Features

- **Plain Markdown** - No frontmatter, just write specifications
- **CLI-First** - All configuration via command-line flags
- **Multiple Agents** - Support for claude-code, cursor, aider
- **Smart Updates** - Hash-based change detection for incremental generation
- **Parallel Processing** - ~5x faster for multiple files
- **Type Safe** - Built with TypeScript, comprehensive test coverage

## Quick Start

### Installation

```bash
npm install -g @dean0x/dot
```

### Authentication

dot.ai uses [Claude Code](https://github.com/anthropics/claude-code) under the hood. You can authenticate two ways:

**Option 1: Claude Max/Pro Plan** (Recommended)
- Claude Code automatically uses your browser authentication
- No API key needed

**Option 2: API Key**
```bash
export ANTHROPIC_API_KEY=your_api_key_here
```
Get your key from: https://console.anthropic.com/

### Usage

1. **Create a `.ai` file** (plain Markdown):

```markdown
# Button Component

Create a reusable React Button component with TypeScript.

## Requirements
- Support variants: primary, secondary, danger
- Include loading and disabled states
- Full test coverage
```

2. **Generate code**:

```bash
dot gen
```

That's it! The `.dotai/` directory is created automatically, artifacts are generated, and state is tracked.

3. **Make changes** - Edit your `.ai` file and run `dot gen` again. Only changed files are processed.

## CLI Commands

```bash
dot gen [path]           # Generate code from .ai files
dot status [path]        # Show which files have changed
dot ls [path]            # List all .ai files and artifacts
dot clean                # Clear all generation state
```

## Configuration

All configuration via command-line flags:

```bash
# Select agent
dot gen --agent claude-code

# Enable iterative mode (agent can update spec and re-run)
dot gen --iterate

# Set iteration limit when using --iterate
dot gen --iterate --max-iterations 5

# Enable parallel processing
dot gen --parallel --concurrency 10

# Force regenerate all files
dot gen --force
```

Run `dot gen --help` for all options.

## How it Works

1. **Write Specifications** - Create `.ai` files with your requirements in Markdown
2. **Smart Detection** - dot.ai uses hash-based change detection to find what changed
3. **Agent Invocation** - Your chosen coding agent implements the specification
4. **Artifact Tracking** - Generated files are tracked for future incremental updates
5. **Iterate** - Edit specs, run `dot gen`, repeat

### Iterative Processing

dot.ai supports iterative mode with the `--iterate` flag - after generating artifacts, it re-reads the `.ai` file to see if the agent updated it with new tasks. This enables self-directed refinement workflows where the agent can add new tasks for itself.

Enable with `--iterate` and control iterations with `--max-iterations`.

## Examples

See the [`examples/`](./examples/) directory for:
- Self-reflecting agents
- Recursive processing patterns
- Multi-file project generation

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System design and patterns
- [Contributing](./docs/CONTRIBUTING.md) - Development guide
- [Specification](./docs/SPECIFICATION.md) - Full technical specification
- [Changelog](./CHANGELOG.md) - Version history

## Requirements

- Node.js >=20.0.0
- Claude Code CLI (installed automatically as peer dependency)

## Security

- Agent whitelist prevents arbitrary code execution
- Path traversal protection
- Input validation and range enforcement
- Dangerous flags blacklisted

See [Security Policy](./docs/SPECIFICATION.md#security) for details.

## License

MIT © [dean0x](https://github.com/dean0x)

## Support

- [Issues](https://github.com/dean0x/dot.ai/issues) - Bug reports and feature requests
- [Discussions](https://github.com/dean0x/dot.ai/discussions) - Questions and community

---

**Built with** [Claude Code](https://github.com/anthropics/claude-code) 🤖
