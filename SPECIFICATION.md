# .ai File System Specification

**Version:** 1.0.0
**Status:** Implemented
**Last Updated:** 2025-10-19

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Architecture](#architecture)
4. [File Format Specification](#file-format-specification)
5. [State Management](#state-management)
6. [Change Detection](#change-detection)
7. [Agent Interface](#agent-interface)
8. [Prompt Construction](#prompt-construction)
9. [CLI Interface](#cli-interface)
10. [Workflow](#workflow)
11. [Design Decisions](#design-decisions)
12. [Future Enhancements](#future-enhancements)

---

## Overview

The `.ai` file system enables **declarative, AI-powered code generation** where specifications written in Markdown generate and maintain code artifacts through AI coding agents.

### Vision

`.ai` files are **living specification documents** that:
- Serve as the source of truth for features/components
- Generate implementation artifacts via AI agents
- Support iterative refinement through diffs
- Enable collaborative development with clear intent documentation

### Key Principles

1. **Specifications are code** - `.ai` files are first-class development artifacts
2. **Incremental updates** - Changes propagate efficiently through diffs
3. **Agent agnostic** - Support multiple AI coding CLIs
4. **Explicit control** - Manual triggering, no automatic/reactive behavior
5. **Git-friendly** - Works naturally with version control

---

## Core Concepts

### .ai Files

**Definition:** Markdown documents with YAML frontmatter that specify what code should be generated.

**Purpose:**
- Document intent and requirements in human-readable form
- Track which artifacts implement the specification
- Configure which agent should implement the spec

**Lifecycle:**
1. Created with specification (artifacts empty)
2. First generation populates artifacts list
3. Subsequent edits trigger incremental updates via diffs
4. Artifacts can be manually edited (agent merges intelligently)

### Artifacts

**Definition:** Generated code files that implement a `.ai` specification.

**Properties:**
- Tracked in the `.ai` file's frontmatter
- **Fully editable** by developers
- Updated by agent when specification changes
- Can be created, modified, or deleted by agents

**Philosophy:** Artifacts are not "readonly" or "sacred" - they're normal code files that happen to be AI-generated. Developers can edit them freely.

### Agents

**Definition:** Pluggable AI coding CLI tools that implement specifications.

**Supported Agents:**
- `claude-code` (default) - Anthropic's coding agent with headless mode
- `cursor` (future) - Cursor AI editor integration
- `aider` (future) - Aider coding assistant

**Agent Responsibilities:**
- Accept prompts with specifications/diffs
- Generate/modify code artifacts
- Return list of files created/modified

### State

**Definition:** Persistent tracking of `.ai` file hashes and generation metadata.

**Purpose:**
- Detect which `.ai` files changed since last generation
- Store previous specification content for diffing
- Track when files were last generated

**Storage:** `.dotai/state.json` (gitignored, local build state)

---

## Architecture

### Directory Structure

```
project/
├── .dotai/
│   ├── config.json       # Project configuration
│   ├── state.json        # Generation state (gitignored)
│   └── .gitignore        # Ignores state.json
├── src/
│   ├── Button.ai         # Specification file
│   ├── Button.tsx        # Generated artifact
│   └── Button.test.tsx   # Generated artifact
└── package.json
```

### Component Architecture

```
┌─────────────────┐
│   CLI Layer     │  (commander, commands)
└────────┬────────┘
         │
┌────────▼────────┐
│   Core Logic    │  (parser, state, detector, differ, prompt)
└────────┬────────┘
         │
┌────────▼────────┐
│  Agent Layer    │  (interface, claude-code, cursor, aider)
└────────┬────────┘
         │
┌────────▼────────┐
│  External CLIs  │  (claude, cursor, aider)
└─────────────────┘
```

### Data Flow

```
1. User runs `dot gen`
2. Find all .ai files in directory tree
3. Parse frontmatter + markdown content
4. Load state from .dotai/state.json
5. Detect changes via hash comparison
6. For each changed file:
   a. Get previous state (if exists)
   b. Build prompt (first-time or diff-based)
   c. Get configured agent
   d. Invoke agent with prompt
   e. Parse agent output for artifacts
   f. Update .ai file frontmatter with artifacts
   g. Update state with new hash + content
7. Save state back to disk
```

---

## File Format Specification

### .ai File Structure

```markdown
---
agent: string                    # REQUIRED: Agent name
artifacts: string[]              # AUTO-TRACKED: Generated files
agent_config:                    # OPTIONAL: Agent-specific config
  key: value
---

# Specification Content

Markdown content describing what should be implemented.
```

### Frontmatter Fields

#### `agent` (required)

**Type:** `string`
**Purpose:** Specifies which coding agent to use
**Examples:** `"claude-code"`, `"cursor"`, `"aider"`

**Validation:**
- Must be a non-empty string
- Must match a registered agent

#### `artifacts` (auto-tracked)

**Type:** `string[]`
**Purpose:** Lists generated artifact file paths
**Default:** `[]` (empty for new files)

**Behavior:**
- Automatically populated after first generation
- Updated by dotai after each generation
- Relative paths from project root
- Duplicates removed

**Example:**
```yaml
artifacts:
  - src/Button.tsx
  - src/Button.test.tsx
  - src/Button.module.css
```

#### `agent_config` (optional)

**Type:** `object`
**Purpose:** Agent-specific configuration parameters

**claude-code example:**
```yaml
agent_config:
  model: claude-sonnet-4
  allowedTools: "Read,Write,Edit,Bash"
  permission_mode: acceptEdits
```

**cursor example (future):**
```yaml
agent_config:
  model: gpt-4
  temperature: 0.7
```

### Specification Content

**Format:** Markdown
**Purpose:** Human-readable description of what should be implemented

**Best Practices:**
- Use clear, specific requirements
- Break down into bulleted lists
- Include examples where helpful
- Describe behavior, not implementation
- Keep focused on single concern

**Example:**
```markdown
# Button Component Specification

Create a reusable Button component with TypeScript and React.

## Requirements

- Support variants: primary, secondary, danger
- Support sizes: small, medium, large
- Include loading state with spinner
- Include disabled state
- Support icon placement (left, right, none)
- Full accessibility (ARIA labels, keyboard navigation)

## Behavior

- Clicking disabled button should not trigger onClick
- Loading state should disable button and show spinner
- Icons should have proper spacing from text

## Testing

- Unit tests for all variants
- Unit tests for disabled/loading states
- Accessibility tests
```

---

## State Management

### State File Format

**Location:** `.dotai/state.json`
**Versioning:** Semantic versioning for state format
**Gitignored:** Yes (local build state, not committed)

**Structure:**
```typescript
interface DotAiState {
  version: string;  // State format version (e.g., "1.0.0")
  files: Record<string, AiFileState>;
}

interface AiFileState {
  lastHash: string;        // SHA-256 hash of full .ai file content
  lastContent: string;     // Full content from last generation (for diffing)
  lastGenerated: string;   // ISO 8601 timestamp
  artifacts: string[];     // List of generated artifacts
}
```

**Example:**
```json
{
  "version": "1.0.0",
  "files": {
    "/workspace/project/src/Button.ai": {
      "lastHash": "a1b2c3d4e5f6...",
      "lastContent": "---\nagent: claude-code\n...",
      "lastGenerated": "2025-10-19T10:30:00.000Z",
      "artifacts": [
        "src/Button.tsx",
        "src/Button.test.tsx"
      ]
    }
  }
}
```

### State Operations

#### Load State
```typescript
loadState(cwd?: string): Promise<DotAiState>
```
- Returns empty state if file doesn't exist
- Validates version compatibility
- Warns on version mismatch

#### Save State
```typescript
saveState(state: DotAiState, cwd?: string): Promise<void>
```
- Creates `.dotai/` directory if needed
- Writes formatted JSON (2-space indent)
- Atomic write operation

#### Update File State
```typescript
updateFileState(state: DotAiState, filePath: string, fileState: AiFileState): DotAiState
```
- Immutable update
- Returns new state object
- Preserves other files' state

#### Clear State
```typescript
clearState(cwd?: string): Promise<void>
```
- Resets to empty state
- Preserves version
- Used by `dot clean` command

### Configuration File

**Location:** `.dotai/config.json`
**Gitignored:** No (team configuration, should be committed)

**Structure:**
```typescript
interface DotAiConfig {
  defaultAgent: string;    // Default agent if not specified in .ai file
  stateFile: string;       // State file name (relative to .dotai/)
}
```

**Default values:**
```json
{
  "defaultAgent": "claude-code",
  "stateFile": "state.json"
}
```

---

## Change Detection

### Hash-Based Detection

**Algorithm:**
1. Calculate SHA-256 hash of entire `.ai` file content (frontmatter + body)
2. Compare with stored hash in state
3. If hashes differ → file changed
4. If no stored hash → new file

**Why hash instead of timestamp?**
- More reliable (timestamps can be unreliable across filesystems)
- Works everywhere (not dependent on git)
- Detects any content change, no matter how small

### Detection Results

```typescript
interface ChangeDetectionResult {
  changed: AiFile[];    // Existing files that changed
  new: AiFile[];        // Files never generated before
  unchanged: AiFile[];  // Files with no changes
}
```

### Force Flag

**Behavior:** Treat all files as "changed" regardless of hash

**Use cases:**
- Regenerate everything from scratch
- Test agent with same prompt
- Recover from corrupted state

**Command:**
```bash
dot gen --force
```

---

## Agent Interface

### Abstract Interface

```typescript
interface CodingAgent {
  name: string;
  invoke(prompt: string, options: InvokeOptions): Promise<GenerationResult>;
  parseOutput(rawOutput: string): string[];
}

interface InvokeOptions {
  cwd: string;
  agentConfig?: Record<string, unknown>;
  existingArtifacts?: string[];
}

interface GenerationResult {
  success: boolean;
  artifacts: string[];
  error?: string;
  rawOutput?: string;
}
```

### ClaudeCodeAgent Implementation

**Invocation:**
```bash
claude -p "<prompt>" \
  --output-format json \
  --no-interactive \
  [--model <model>] \
  [--allowedTools <tools>] \
  [--permission-mode <mode>]
```

**Output Parsing:**
- Parses JSON from stdout
- Extracts file paths from `result.files`
- Extracts file paths from tool results (Write, Edit)
- Returns empty array if parsing fails

**Error Handling:**
- Non-zero exit code → failure
- Stderr captured in error message
- Spawn errors caught and reported

### Agent Registration

```typescript
// Register agents at startup
registerAgent(new ClaudeCodeAgent());
registerAgent(new CursorAgent());  // Future
registerAgent(new AiderAgent());   // Future

// Get agent by name
const agent = getAgent('claude-code');
```

### Adding New Agents

**Requirements:**
1. Implement `CodingAgent` interface
2. Support headless/programmatic invocation
3. Return structured output (JSON preferred)
4. Support working directory specification

**Example:**
```typescript
class CustomAgent implements CodingAgent {
  name = 'custom-agent';

  async invoke(prompt: string, options: InvokeOptions): Promise<GenerationResult> {
    // 1. Build command with options
    // 2. Execute agent CLI
    // 3. Parse output
    // 4. Return result
  }

  parseOutput(rawOutput: string): string[] {
    // Extract artifact paths from agent output
  }
}
```

---

## Prompt Construction

### First-Time Generation

**Scenario:** New `.ai` file with no previous state

**Prompt Structure:**
```
Implement the following specification from <filename>:

<full specification content>

This is a new specification with no existing artifacts.

INSTRUCTIONS:
- Implement the specification fully
- Create all necessary files
- Follow best practices for the language/framework
- Ensure all code is production-ready
```

**Example:**
```
Implement the following specification from Button.ai:

# Button Component Specification

Create a reusable Button component with TypeScript.
- Support variants: primary, secondary, danger
- Include loading state
- Full test coverage

This is a new specification with no existing artifacts.

INSTRUCTIONS:
- Implement the specification fully
- Create all necessary files
- Follow best practices for the language/framework
- Ensure all code is production-ready
```

### Update Generation

**Scenario:** Existing `.ai` file that changed

**Prompt Structure:**
```
Implement changes to the specification from <filename>

EXISTING ARTIFACTS:
  - <artifact1>
  - <artifact2>

SPECIFICATION CHANGES:
<formatted unified diff with line numbers>

INSTRUCTIONS:
- Implement the changes shown in the diff
- Update existing artifacts as needed
- Preserve any custom code or manual edits where sensible
- Create new files if required by the changes
- Delete files if they're no longer needed
- Ensure all changes are consistent with the updated specification
```

**Diff Format:**
```
    1    # Button Component Specification
    2
    3 -  ## Current Status: v0.2.1
    3 +  ## Current Status: v0.3.0
    4
    5    Create a reusable Button component with TypeScript.
    6 -  - Support variants: primary, secondary
    6 +  - Support variants: primary, secondary, danger
    7 +  - Include disabled state
    8    - Include loading state
```

**Example:**
```
Implement changes to the specification from Button.ai

EXISTING ARTIFACTS:
  - Button.tsx
  - Button.test.tsx

SPECIFICATION CHANGES:
    1    # Button Component Specification
    2
    3    Create a reusable Button component with TypeScript.
    4 -  - Support variants: primary, secondary
    4 +  - Support variants: primary, secondary, danger
    5 +  - Include disabled state
    6    - Include loading state

INSTRUCTIONS:
- Implement the changes shown in the diff
- Update existing artifacts as needed
- Preserve any custom code or manual edits where sensible
- Create new files if required by the changes
- Delete files if they're no longer needed
- Ensure all changes are consistent with the updated specification
```

### Diff Generation

**Algorithm:**
1. Use `diff` library to create unified diff
2. Format with line numbers for clarity
3. Show 3 lines of context around changes
4. Mark additions with `+`, deletions with `-`

**Implementation:**
```typescript
import { createTwoFilesPatch } from 'diff';

const patch = createTwoFilesPatch(
  fileName,
  fileName,
  oldContent,
  newContent,
  'Previous version',
  'Current version',
  { context: 3 }
);
```

---

## CLI Interface

### Commands

#### `dot init`

**Purpose:** Initialize `.dotai` directory structure

**Behavior:**
1. Create `.dotai/` directory
2. Create `.dotai/config.json` with defaults
3. Create `.dotai/state.json` (empty state)
4. Create `.dotai/.gitignore` (ignore state.json)
5. Show next steps message

**Output:**
```
Initializing .dotai directory...
✓ Created .dotai/ directory
✓ Created .dotai/config.json
✓ Created .dotai/state.json
✓ Created .dotai/.gitignore

Next steps:
  1. Create a .ai file with your specification
  2. Run: dot gen
```

#### `dot gen [path]`

**Purpose:** Generate code from `.ai` files

**Arguments:**
- `path` (optional): Directory to scan for `.ai` files. Defaults to `.` (current directory)

**Options:**
- `--force, -f`: Force regenerate all `.ai` files regardless of changes

**Behavior:**
1. Find all `.ai` files in directory tree
2. Parse all `.ai` files
3. Load state
4. Detect changes (or force all if `--force`)
5. For each changed file (sequentially):
   - Build prompt (first-time or update)
   - Get configured agent
   - Invoke agent
   - Parse output for artifacts
   - Update `.ai` file frontmatter
   - Update state
6. Save state
7. Show summary

**Output:**
```
Scanning for .ai files in ./src...
Found 3 .ai file(s)
Processing 2 file(s)...

[1/2] Processing Button.ai...
  Using agent: claude-code
  Updated artifacts (2 file(s))
  ✓ Success

[2/2] Processing Form.ai...
  Using agent: claude-code
  Updated artifacts (4 file(s))
  ✓ Success

Summary:
  ✓ 2 file(s) processed successfully
```

#### `dot status [path]`

**Purpose:** Show which `.ai` files have changed

**Arguments:**
- `path` (optional): Directory to check. Defaults to `.`

**Behavior:**
1. Find all `.ai` files
2. Parse all `.ai` files
3. Load state
4. Detect changes
5. Display categorized results

**Output:**
```
Scanning for .ai files in ./src...
Found 5 .ai file(s)

New (1):
  • src/Header.ai

Changed (2):
  • src/Button.ai
  • src/Form.ai

Unchanged (2):
  • src/Footer.ai
  • src/Nav.ai

Run "ai gen" to process 3 file(s)
```

#### `dot ls [path]`

**Purpose:** List all `.ai` files and their artifacts

**Arguments:**
- `path` (optional): Directory to list. Defaults to `.`

**Behavior:**
1. Find all `.ai` files
2. Parse all `.ai` files
3. Display each file with metadata

**Output:**
```
Listing .ai files in ./src...

/workspace/project/src/Button.ai
  Agent: claude-code
  Artifacts (2):
    • Button.tsx
    • Button.test.tsx

/workspace/project/src/Form.ai
  Agent: claude-code
  Artifacts (4):
    • Form.tsx
    • Form.test.tsx
    • FormField.tsx
    • FormField.test.tsx

Total: 2 .ai file(s)
```

#### `dot clean`

**Purpose:** Clear all generation state

**Behavior:**
1. Reset state to empty
2. Preserve version
3. Confirm action

**Output:**
```
Clearing generation state...
✓ State cleared
Next run of "ai gen" will regenerate all .ai files
```

### Exit Codes

- `0` - Success
- `1` - Error (with error message to stderr)

### Error Handling

**File not found:**
```
Error: No .ai files found
Create a .ai file first, or run "ai init" to get started
```

**Invalid frontmatter:**
```
Error parsing Button.ai:
Invalid frontmatter: "agent" field is required
```

**Agent not found:**
```
Error: Unknown agent: custom-agent
Available agents: claude-code
```

**Generation failure:**
```
[1/2] Processing Button.ai...
  ✗ Failed: Claude Code exited with code 1
  Agent stderr: Error: API key not configured
```

---

## Workflow

### Initial Setup

```bash
# 1. Install dotai
npm install -g dotai

# 2. Initialize project
cd my-project
dot init

# 3. Create first .ai file
cat > src/Button.ai <<EOF
---
agent: claude-code
artifacts: []
---

# Button Component

Create a React Button component with TypeScript.
EOF

# 4. Generate
dot gen

# 5. Artifacts are created and tracked
cat src/Button.ai
# Shows: artifacts: [Button.tsx, Button.test.tsx]
```

### Iterative Development

```bash
# 1. Edit specification
vim src/Button.ai
# Add: "- Include disabled state"

# 2. Check what changed
dot status
# Shows: Changed (1): src/Button.ai

# 3. Generate updates
dot gen
# Sends diff to agent, updates artifacts

# 4. Review changes
git diff src/
```

### Manual Edits to Artifacts

```bash
# 1. Developer edits generated file
vim src/Button.tsx
# Adds custom logic

# 2. Also update specification
vim src/Button.ai
# Adds new requirement

# 3. Generate
dot gen
# Agent sees:
#   - Spec diff (new requirement)
#   - Current artifact state (with manual edits)
#   - Merges intelligently
```

### Force Regeneration

```bash
# Regenerate everything from scratch
dot gen --force

# Useful for:
# - Testing agent with same prompts
# - Recovering from bad state
# - Trying different agent configuration
```

### Multi-File Projects

```bash
# Generate specific directory
dot gen ./src/components

# Check status of specific directory
dot status ./src/components

# List specific directory
dot ls ./src/components
```

---

## Design Decisions

### 1. CLI Command Over File Watching

**Decision:** Use explicit `dot gen` command instead of reactive file watching

**Rationale:**
- **Cost control:** AI API calls are expensive; user controls when to spend
- **Predictable:** No surprise regenerations during active editing
- **Simple:** No complex debouncing or throttling logic needed
- **Git-friendly:** Fits natural workflow (edit → test → generate → commit)
- **Less invasive:** Doesn't require background process

**Alternatives considered:**
- File watching with debouncing (rejected: too magical, expensive)
- Git hook on commit (rejected: too late in workflow)
- Editor plugin (rejected: editor-specific, complex)

### 2. Hash-Based Change Detection

**Decision:** Use SHA-256 content hash instead of timestamps or git diff

**Rationale:**
- **Reliable:** Works on all filesystems, not affected by clock skew
- **Universal:** Works with or without git
- **Precise:** Detects any content change, ignores metadata
- **Simple:** No external dependencies

**Alternatives considered:**
- File timestamps (rejected: unreliable across systems)
- Git diff (rejected: doesn't work outside git repos)
- Manual version numbers (rejected: requires user discipline)

### 3. Artifacts Are Editable

**Decision:** Allow developers to freely edit generated artifacts

**Rationale:**
- **Pragmatic:** Developers will edit anyway, embrace it
- **Trust AI:** Modern LLMs can intelligently merge changes
- **Flexible:** Supports incremental migration from manual to AI-generated code
- **Natural:** Feels like normal development, not a special mode

**Alternatives considered:**
- Readonly artifacts (rejected: too restrictive, annoying)
- Separate generated vs manual layers (rejected: too complex)
- Warning-only (rejected: doesn't prevent overwrites)

### 4. Per-File Agent Configuration

**Decision:** Each `.ai` file specifies its own agent

**Rationale:**
- **Flexibility:** Different agents for different tasks (e.g., claude for TypeScript, specialized for SQL)
- **Gradual adoption:** Can try new agents on specific files
- **Explicit:** Clear which agent generated which artifacts
- **Portable:** `.ai` files are self-contained

**Alternatives considered:**
- Global agent config only (rejected: not flexible enough)
- Auto-detect by file type (rejected: too magical, unpredictable)

### 5. Sequential Processing

**Decision:** Process `.ai` files one at a time, not in parallel

**Rationale:**
- **Simplicity:** Easier to implement and debug
- **Clear progress:** User sees exactly what's happening
- **Rate limits:** Avoids overwhelming AI APIs
- **Predictable costs:** User can stop mid-generation

**Future enhancement:** Add `--parallel N` flag for power users

### 6. Store Full Content in State

**Decision:** Store previous `.ai` file content in state, not just hash

**Rationale:**
- **Enable diffing:** Can't generate diffs with just a hash
- **Self-contained:** Don't need git history to compute diffs
- **Reliable:** Works even if file was deleted and recreated

**Tradeoff:** Larger state file, but acceptable (text compresses well)

### 7. Frontmatter Format

**Decision:** Use YAML frontmatter in Markdown

**Rationale:**
- **Familiar:** Used by Jekyll, Hugo, Gatsby, etc.
- **Readable:** Both YAML and Markdown are human-friendly
- **Tooling:** Excellent library support (gray-matter)
- **Flexible:** Easy to add new fields

**Alternatives considered:**
- Pure YAML (rejected: less readable for long specs)
- JSON frontmatter (rejected: less human-friendly)
- Custom format (rejected: reinventing wheel)

---

## Future Enhancements

### 1. Parallel Processing

**Motivation:** Speed up generation for many `.ai` files

**Design:**
```bash
dot gen --parallel 3  # Process up to 3 files concurrently
```

**Considerations:**
- Rate limiting awareness
- Progress display for multiple concurrent tasks
- Error handling when some succeed, some fail

### 2. Additional Agents

**Cursor Agent:**
```yaml
agent: cursor
agent_config:
  model: gpt-4
  temperature: 0.7
```

**Aider Agent:**
```yaml
agent: aider
agent_config:
  model: gpt-4-turbo
  edit_format: diff
```

**Custom Agent:**
```yaml
agent: custom-agent
agent_config:
  endpoint: http://localhost:8000
  api_key: ${CUSTOM_API_KEY}
```

### 3. Dry Run Mode

**Motivation:** Preview what would be generated without making changes

**Design:**
```bash
dot gen --dry-run
# Shows:
# Would process 3 file(s):
#   - Button.ai (changed)
#   - Form.ai (new)
#   - Header.ai (changed)
# No files will be modified
```

### 4. Interactive Mode

**Motivation:** Review and approve each generation

**Design:**
```bash
dot gen --interactive
# Prompts:
# Process Button.ai? (y/n/diff/skip)
```

### 5. Watch Mode

**Motivation:** Optional reactive mode for rapid iteration

**Design:**
```bash
dot gen --watch
# Watches .ai files for changes
# Debounces 3 seconds after last edit
# Auto-generates on save
```

### 6. Artifact Templates

**Motivation:** Generate common `.ai` file patterns

**Design:**
```bash
dot init --template react-component
# Creates ComponentTemplate.ai with best practices

dot init --template api-endpoint
# Creates EndpointTemplate.ai
```

### 7. Dependency Graph

**Motivation:** Track when one `.ai` file depends on artifacts from another

**Design:**
```yaml
---
agent: claude-code
artifacts: []
depends_on:
  - types/User.ai  # Regenerate if User.ai changes
---
```

**Behavior:** Cascading regeneration with cycle detection

### 8. Artifact Validation

**Motivation:** Ensure generated artifacts meet quality standards

**Design:**
```yaml
---
agent: claude-code
artifacts: []
validation:
  - npm run lint
  - npm run typecheck
  - npm test Button.test.tsx
---
```

**Behavior:** Run validation after generation, fail if validation fails

### 9. Cost Tracking

**Motivation:** Monitor AI API costs

**Design:**
```bash
dot gen --track-cost
# Output:
# Summary:
#   ✓ 2 file(s) processed
#   💰 Estimated cost: $0.15
```

**State:**
```json
{
  "totalCost": 1.23,
  "files": {
    "Button.ai": {
      "lastCost": 0.15,
      "totalCost": 0.45
    }
  }
}
```

### 10. Rollback/History

**Motivation:** Undo bad generations

**Design:**
```bash
dot gen --save-history
# Saves artifacts before regeneration

dot rollback Button.ai
# Restores previous version of Button.ai artifacts
```

### 11. Cloud State Sync

**Motivation:** Share state across team/machines

**Design:**
```json
// .dotai/config.json
{
  "stateBackend": "s3://my-bucket/dotai-state/"
}
```

**Behavior:** Sync state to cloud storage for team collaboration

### 12. IDE Integration

**Motivation:** Generate directly from editor

**Design:**
- VSCode extension
- "Generate" button in editor
- Inline diff preview
- Status bar indicator

---

## Appendices

### A. Example .ai Files

**React Component:**
```markdown
---
agent: claude-code
artifacts: []
agent_config:
  model: claude-sonnet-4
---

# TodoList Component

Create a TodoList component with full CRUD operations.

## Requirements

- Add todos with enter key
- Edit todos with double-click
- Delete todos with delete button
- Mark todos complete with checkbox
- Filter: All / Active / Completed
- Show count of active todos
- "Clear completed" button
- Persist to localStorage

## Testing

- Unit tests for all CRUD operations
- Test filter functionality
- Test localStorage persistence
- Accessibility tests
```

**API Endpoint:**
```markdown
---
agent: claude-code
artifacts: []
---

# User Registration Endpoint

Create a user registration API endpoint.

## Endpoint

POST /api/users/register

## Request Body

```json
{
  "email": "user@example.com",
  "password": "secretpass",
  "name": "John Doe"
}
```

## Validation

- Email must be valid format
- Password minimum 8 characters
- Name required, 2-100 characters
- Email must be unique

## Response

Success (201):
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-10-19T10:30:00Z"
}
```

Error (400):
```json
{
  "error": "Email already exists"
}
```

## Implementation

- Use bcrypt for password hashing
- Generate JWT token
- Store in PostgreSQL users table
- Send welcome email (async)

## Testing

- Test successful registration
- Test duplicate email
- Test validation errors
- Test password hashing
- Test JWT token generation
```

**Database Schema:**
```markdown
---
agent: claude-code
artifacts: []
---

# User Database Schema

Create PostgreSQL migration for users table.

## Table: users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

## Artifacts

- Migration: `migrations/001_create_users_table.sql`
- TypeScript types: `types/User.ts`
- Repository: `repositories/UserRepository.ts`
```

### B. Terminology Glossary

- **.ai file:** Markdown specification file with YAML frontmatter
- **Artifact:** Code file generated from a `.ai` specification
- **Agent:** AI coding CLI tool that implements specifications
- **State:** Persistent tracking of generation metadata
- **Hash:** SHA-256 content hash used for change detection
- **Diff:** Unified diff showing specification changes
- **Frontmatter:** YAML metadata at the start of `.ai` file
- **Generation:** Process of invoking agent to create/update artifacts
- **Force:** Flag to regenerate all files regardless of changes

### C. File Extensions

- `.ai` - Specification file (Markdown with YAML frontmatter)
- `.dotai/` - Directory for state and configuration
- `state.json` - Generation state (gitignored)
- `config.json` - Project configuration (committed)

---

## Version History

**1.0.0** (2025-10-19)
- Initial specification
- Core concepts defined
- Architecture documented
- CLI commands specified
- Agent interface designed
- Prompt construction documented

---

## Contributing

This specification is a living document. Proposed changes should:

1. Update this specification first
2. Discuss design implications
3. Update implementation
4. Update README.md if user-facing

**Specification principles:**
- Explicit over implicit
- Simple over complex
- Documented over assumed
- User control over automation
