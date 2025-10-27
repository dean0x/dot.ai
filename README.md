# dot.ai

AI-powered code generation from `.ai` specification files.

## Overview

`dot.ai` enables you to create **reactive specifications** that generate code artifacts. Write your requirements in `.ai` files (Markdown with YAML frontmatter), and let AI coding agents implement them.

### Key Concepts

- **`.ai` files**: Living specification documents (Markdown + YAML frontmatter)
- **Artifacts**: Generated code files tracked and managed by dot.ai
- **Agents**: Pluggable coding agents (claude-code, cursor, aider, etc.)
- **State tracking**: Hash-based change detection for efficient regeneration

## Installation

```bash
npm install -g @dean0x/dot
```

## Authentication

dot.ai uses Claude Code under the hood. You can authenticate in two ways:

### Option 1: Claude Max/Pro Plan (Recommended)

If you have a Claude.ai Max or Pro subscription, Claude Code will automatically use your browser authentication:

```bash
# No API key needed - uses your Claude.ai subscription
dot gen
```

### Option 2: API Key

Set your Anthropic API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from: https://console.anthropic.com/

Add to your shell profile to make it permanent:
```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'export ANTHROPIC_API_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc
```

## Quick Start

### 1. Initialize a project

```bash
dot init
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
dot gen
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

Run `dot gen` again - it will send the **diff** to claude-code to implement just the changes.

## CLI Commands

### `dot init`
Initialize `.dotai` directory structure in current project.

### `dot gen [path]`
Generate code from `.ai` files.

**Options:**
- `--force, -f`: Force regenerate all .ai files regardless of changes
- `--parallel, -p`: Enable parallel processing for multiple files (faster but output may interleave)
- `--concurrency, -c <number>`: Max number of concurrent files when using --parallel (default: 5, range: 1-50)

**Examples:**
```bash
dot gen              # Process changed .ai files in current directory
dot gen ./src        # Process changed .ai files in ./src
dot gen --force      # Regenerate everything

# Parallel processing (5x faster for multiple files)
dot gen --parallel                    # Process up to 5 files concurrently
dot gen --parallel --concurrency 10   # Process up to 10 files concurrently
dot gen ./src --parallel              # Parallel mode for specific directory
```

**Performance Mode Trade-offs:**

By default, `dot gen` processes files **sequentially** for clean, readable console output. For faster processing of multiple files, use `--parallel`:

- **Sequential mode** (default):
  - Clean console output, easy to follow
  - Processes one file at a time in order
  - Best for 1-5 files or when debugging

- **Parallel mode** (`--parallel`):
  - ~5x faster for multiple files (e.g., 10 files: 5min → 1min)
  - Console output may interleave (tool usage from different files)
  - Best for 10+ files when speed > readability

**When to use parallel mode:**
- Large projects with many changed .ai files
- CI/CD pipelines where speed matters
- Batch regeneration scenarios

**When to use sequential mode (default):**
- Debugging issues with .ai files
- Want to follow agent's thought process
- Working with 1-5 files where speed difference is minimal

### `dot status [path]`
Show which `.ai` files have changed.

```bash
dot status           # Check current directory
dot status ./src     # Check specific directory
```

### `dot ls [path]`
List all `.ai` files and their artifacts.

```bash
dot ls               # List all .ai files
dot ls ./src         # List .ai files in ./src
```

### `dot clean`
Clear all generation state. Next `dot gen` will regenerate everything.

```bash
dot clean
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
recursive: false                 # Optional: enable recursive processing
max_recursion_depth: 10          # Optional: iteration limit (default: 10, or ∞)
---

# Your Specification Title

Write your specification in Markdown.

The agent will implement this spec and generate artifacts.
```

### Frontmatter Fields

- **`agent`** (required): Which coding agent to use (`claude-code`, `cursor`, `aider`)
- **`artifacts`** (auto-tracked): List of generated files - updated automatically
- **`agent_config`** (optional): Agent-specific configuration
- **`recursive`** (optional): Enable recursive processing (default: `false`)
- **`max_recursion_depth`** (optional): Maximum iterations (default: `10`, or `"∞"` for infinite)

### Agent Configuration

Each agent supports different configuration options:

**claude-code:**
```yaml
agent_config:
  # Model selection
  model: claude-sonnet-4                    # Model to use (default: from config)
  fallbackModel: claude-opus-4              # Fallback if primary overloaded

  # Tool permissions
  allowedTools: "Read,Write,Edit,Bash"      # Comma-separated allowed tools
  disallowedTools: "WebSearch"              # Comma-separated denied tools

  # Permission handling
  permission_mode: acceptEdits              # acceptEdits | bypassPermissions | default | plan

  # System prompts
  appendSystemPrompt: "Follow clean code principles"  # Additional context

  # Debugging
  verbose: true                             # Enable verbose logging
```

All fields are optional. See [Claude Code headless docs](https://docs.claude.com/en/docs/claude-code/headless) for details.

## How It Works

### First Generation

1. You create `Component.ai` with `artifacts: []`
2. Run `dot gen`
3. dot.ai sends the spec to the agent
4. Agent generates files (e.g., `Component.tsx`, `Component.test.tsx`)
5. dot.ai updates `artifacts:` list in `Component.ai`
6. State is saved in `.dotai/state.json`

### Subsequent Updates

1. You edit `Component.ai` specification
2. Run `dot gen`
3. dot.ai detects changes (hash-based)
4. dot.ai generates **diff** of spec changes
5. dot.ai sends diff + existing artifacts to agent
6. Agent implements changes (preserving manual edits where sensible)
7. dot.ai updates artifacts list and state

### Manual Edits to Artifacts

Artifacts are **editable**! When you run `dot gen` after editing both the spec and artifacts:
- The agent receives the current artifact state
- The agent sees the spec diff
- The agent intelligently merges changes

### Recursive Processing (Agent Self-Modification)

dot.ai supports **agent self-modification** - agents can edit their own `.ai` spec file to create self-directed task queues.

#### How It Works

When `recursive: true` is set:

1. Agent generates artifacts based on current spec
2. Agent **updates the `.ai` spec** with next task/requirements
3. If spec content changed, dot.ai runs generation again with updated spec
4. Agent controls convergence by **not modifying** the spec when work is complete

```markdown
---
agent: claude-code
artifacts: []
recursive: true
max_recursion_depth: 5
---

# Multi-Stage Feature

Build a complete authentication system:
1. User model and database schema
2. Registration endpoint
3. Login endpoint with JWT
4. Password reset flow

(Agent will update this spec after each stage to queue the next task)
```

#### Convergence

The agent signals completion by not updating the spec:
- **Spec changed** → Continue to next iteration
- **Spec unchanged** → Work complete, stop
- **Max depth reached** → Stop with warning

#### Iteration Limits

```yaml
# Stop after 10 iterations (default)
recursive: true
max_recursion_depth: 10

# Stop after 5 iterations
recursive: true
max_recursion_depth: 5

# Run until agent decides to stop (∞ symbol)
recursive: true
max_recursion_depth: ∞
```

**Warning**: Infinite mode (`∞`) requires careful spec design. The agent must have clear completion criteria.

#### Example Use Cases

- **Multi-stage implementations**: Agent breaks down large features into sequential steps
- **Iterative refinement**: Agent generates, reviews, and improves its own output
- **Test-driven development**: Agent writes tests, implements code, refines until tests pass
- **Documentation generation**: Agent generates docs, reviews for completeness, adds missing sections

#### Pattern Details

For implementation details about the agent self-modification pattern, see [CLAUDE.md](./CLAUDE.md).

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
  "version": "0.1.0",
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

### Core Principles

dotai follows functional programming principles:

**Result Types for Explicit Error Handling:**
```typescript
import { Result, Ok, Err, isErr } from './utils/result';

// Functions return Result<T, E> instead of throwing
const result = await parserService.parseAiFile(filePath);
if (isErr(result)) {
  console.error('Parse error:', result.error.message);
  return;
}
const aiFile = result.value; // Type-safe access
```

**Dependency Injection for Testability:**
```typescript
// Services accept interfaces, not concrete implementations
const fs = new NodeFileSystem();
const hasher = new CryptoHasher();
const parserService = new ParserService(fs, hasher);
```

**Pure Functions Separated from I/O:**
```typescript
// parser-core.ts - Pure, no I/O
export function validatePathWithinBase(filePath: string): Result<string, SecurityError>

// parser-service.ts - Orchestrates I/O
export class ParserService {
  async parseAiFile(filePath: string): Promise<Result<AiFile, DotAiError>>
}
```

### Pluggable Agents

dotai uses an agent abstraction to support multiple coding CLIs:

```typescript
interface CodingAgent {
  name: string;
  invoke(prompt: string, options: InvokeOptions): Promise<GenerationResult>;
  parseOutput(rawOutput: string): string[];
}

// Usage with Result types
import { getAgent } from './agents/interface';

const agentResult = getAgent('claude-code');
if (isErr(agentResult)) {
  console.error('Agent not found:', agentResult.error.message);
  return;
}
const agent = agentResult.value;
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
git clone https://github.com/dean0x/dot.ai.git
cd dot.ai
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
