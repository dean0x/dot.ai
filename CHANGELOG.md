# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-01

Initial release of dot.ai - AI-powered code generation from .ai specification files.

### Features

**Core Functionality:**
- Plain Markdown .ai files (no frontmatter required)
- Hash-based change detection for efficient incremental updates
- Auto-initialization (`dot gen` creates `.dotai/` automatically)
- State tracking for artifact management
- Multiple coding agent support (claude-code, cursor, aider)

**CLI Commands:**
- `dot gen [path]` - Generate code from .ai files
- `dot status [path]` - Show which files have changed
- `dot ls [path]` - List all .ai files and their artifacts
- `dot clean` - Clear all generation state

**Configuration Flags:**
- `--agent <name>` - Select coding agent (default: claude-code)
- `--iterate` - Enable iterative mode (opt-in: agent can update spec and re-run)
- `--max-iterations <number>` - Set iteration limit when using --iterate (default: 10, supports "∞")
- `--parallel` - Enable parallel processing
- `--concurrency <number>` - Control concurrent files (1-20, default: 5)
- `--force` - Force regenerate all files

**Performance:**
- Parallel processing mode (~5x faster for multiple files)
- Working directory isolation prevents file conflicts
- Efficient state management with atomic updates

**Security:**
- Agent whitelist (claude-code, cursor, aider)
- Dangerous flag blacklist (--mcp-config, --add-dir, --settings, --plugin-dir)
- Input validation and range enforcement
- Path traversal protection

### Technical Details

- Node.js >=20.0.0 required
- TypeScript with strict mode
- Comprehensive test suite (358 tests)
- Zod schema validation for runtime type safety
- Functional architecture with Result types

---

## Version History

- **0.1.0** (2025-01-01) - Initial release
