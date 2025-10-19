# Dot.ai File System

AI-powered code generation from `.ai` specification files.

## Overview

`Dot.ai` enables you to create **reactive specifications** that generate code artifacts. Write your requirements in `.ai` files (Markdown with YAML frontmatter), and let AI coding agents implement them.

### Key Concepts

- **`.ai` files**: Living specification documents (Markdown + YAML frontmatter)
- **Artifacts**: Generated code files tracked and managed by dotai
- **Agents**: Pluggable coding agents (claude-code, cursor, aider, etc.)
- **State tracking**: Hash-based change detection for efficient regeneration

## Installation

```bash
npm install -g dotai
```

## Quick Start

### 1. Initialize a project

```bash
ai init
```

This creates:
- `.dotai/` directory
- `.dotai/config.json` - global configuration
- `.dotai/state.json` - generation state (gitignored)
- `.dotai/.gitignore` - ignores state.json

### 2. Create a `.ai` specification file

Create `Button.ai`:

```markdown
---
agent: claude-code
artifacts: []
---

# Button Component Specification

Create a reusable React Button component with TypeScript.

Requirements:
- Support variants: primary, secondary, danger
- Include loading state
- Include disabled state
- Full test coverage
```

### 3. Generate code

```bash
ai gen
```

This will:
1. Detect changed `.ai` files
2. Invoke the specified agent (claude-code)
3. Generate artifacts
4. Update the `.ai` file's `artifacts:` list
5. Track state for future incremental updates

### 4. Make changes

Edit `Button.ai` to add a new requirement:

```markdown
---
agent: claude-code
artifacts:
  - Button.tsx
  - Button.test.tsx
---

# Button Component Specification

Create a reusable React Button component with TypeScript.

Requirements:
- Support variants: primary, secondary, danger
- Include loading state
- Include disabled state
+ Include icon support
- Full test coverage
```

Run `ai gen` again - it will send the **diff** to claude-code to implement just the changes.

## CLI Commands

### `ai init`
Initialize `.dotai` directory structure in current project.

### `ai gen [path]`
Generate code from `.ai` files.

**Options:**
- `--force, -f`: Force regenerate all .ai files regardless of changes

**Examples:**
```bash
ai gen              # Process changed .ai files in current directory
ai gen ./src        # Process changed .ai files in ./src
ai gen --force      # Regenerate everything
```

### `ai status [path]`
Show which `.ai` files have changed.

```bash
ai status           # Check current directory
ai status ./src     # Check specific directory
```

### `ai ls [path]`
List all `.ai` files and their artifacts.

```bash
ai ls               # List all .ai files
ai ls ./src         # List .ai files in ./src
```

### `ai clean`
Clear all generation state. Next `ai gen` will regenerate everything.

```bash
ai clean
```

## `.ai` File Format

`.ai` files use Markdown with YAML frontmatter:

```markdown
---
agent: claude-code              # Required: coding agent to use
artifacts: []                    # Auto-tracked: generated files
agent_config:                    # Optional: agent-specific config
  model: claude-sonnet-4
  allowedTools: "Read,Write,Edit"
---

# Your Specification Title

Write your specification in Markdown.

The agent will implement this spec and generate artifacts.
```

### Frontmatter Fields

- **`agent`** (required): Which coding agent to use (`claude-code`, `cursor`, `aider`)
- **`artifacts`** (auto-tracked): List of generated files - updated automatically
- **`agent_config`** (optional): Agent-specific configuration

### Agent Configuration

Each agent supports different configuration options:

**claude-code:**
```yaml
agent_config:
  model: claude-sonnet-4
  allowedTools: "Read,Write,Edit,Bash"
  permission_mode: acceptEdits
```

## How It Works

### First Generation

1. You create `Component.ai` with `artifacts: []`
2. Run `ai gen`
3. dotai sends the spec to the agent
4. Agent generates files (e.g., `Component.tsx`, `Component.test.tsx`)
5. dotai updates `artifacts:` list in `Component.ai`
6. State is saved in `.dotai/state.json`

### Subsequent Updates

1. You edit `Component.ai` specification
2. Run `ai gen`
3. dotai detects changes (hash-based)
4. dotai generates **diff** of spec changes
5. dotai sends diff + existing artifacts to agent
6. Agent implements changes (preserving manual edits where sensible)
7. dotai updates artifacts list and state

### Manual Edits to Artifacts

Artifacts are **editable**! When you run `ai gen` after editing both the spec and artifacts:
- The agent receives the current artifact state
- The agent sees the spec diff
- The agent intelligently merges changes

## Configuration

### Global Config (`.dotai/config.json`)

```json
{
  "defaultAgent": "claude-code",
  "stateFile": "state.json"
}
```

### State File (`.dotai/state.json`)

**This file is gitignored** - it's local build state.

```json
{
  "version": "1.0.0",
  "files": {
    "/path/to/Button.ai": {
      "lastHash": "a1b2c3...",
      "lastContent": "...",
      "lastGenerated": "2025-10-19T10:30:00Z",
      "artifacts": ["Button.tsx", "Button.test.tsx"]
    }
  }
}
```

## Architecture

### Pluggable Agents

dotai uses an agent abstraction to support multiple coding CLIs:

```typescript
interface CodingAgent {
  name: string;
  invoke(prompt: string, options: InvokeOptions): Promise<GenerationResult>;
  parseOutput(rawOutput: string): string[];
}
```

Currently supported:
- **claude-code** (default)

Coming soon:
- cursor
- aider
- Custom agents

### Change Detection

Uses SHA-256 hashing of `.ai` file content:
- Only changed files are processed
- `--force` flag regenerates everything
- Efficient for large projects

### Prompt Strategy

**First-time generation:**
```
Implement the following specification:
[full spec content]
```

**Updates:**
```
EXISTING ARTIFACTS:
  - Button.tsx
  - Button.test.tsx

SPECIFICATION CHANGES:
[unified diff with line numbers]

Implement the changes shown in the diff...
```

## Best Practices

### 1. One Concern Per .ai File

```
✓ Button.ai       - Just the Button component
✓ Form.ai         - Just the Form component
✗ Components.ai   - Multiple unrelated components
```

### 2. Descriptive Specifications

Be specific about requirements:

```markdown
✓ "Support dark/light themes using CSS variables"
✗ "Make it look nice"

✓ "Validate email format using regex, show error below field"
✗ "Add validation"
```

### 3. Incremental Changes

Make small, focused changes to specs:

```markdown
# First iteration
- Basic button with click handler

# Next iteration
+ Add loading state

# Next iteration
+ Add icon support
```

### 4. Version Control

**Commit:**
- `.ai` files (source of truth)
- Generated artifacts (for review)
- `.dotai/config.json` (team settings)

**Gitignore:**
- `.dotai/state.json` (local build state)

## Troubleshooting

### "Unknown agent: claude-code"

Make sure claude-code is installed:
```bash
npm install -g @anthropic/claude-code
```

### Generation fails silently

Check that your `ANTHROPIC_API_KEY` is set:
```bash
export ANTHROPIC_API_KEY=your_key_here
```

### Artifacts not detected

The agent may have failed to output valid JSON. Check:
1. Agent is installed and working
2. API keys are configured
3. Run with verbose output (coming soon)

## Development

### Build from source

```bash
git clone https://github.com/yourusername/dotai.git
cd dotai
npm install
npm run build
npm link
```

### Run tests

```bash
npm test
```

## License

MIT
