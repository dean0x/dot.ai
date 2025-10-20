# Getting Started with dotai

Quick guide to start using dotai for AI-powered code generation.

## Installation

### From Source (Current)

```bash
cd /workspace/dotai
npm install
npm run build
npm link
```

### From npm (Future)

```bash
npm install -g dotai
```

## Prerequisites

### 1. Install Claude Code

```bash
npm install -g @anthropic/claude-code
```

### 2. Set Up API Key

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from: https://console.anthropic.com/

## Quick Start (5 minutes)

### Step 1: Create a New Project

```bash
mkdir my-project
cd my-project
dot init
```

You'll see:
```
✓ Created .dotai/ directory
✓ Created .dotai/config.json
✓ Created .dotai/state.json
✓ Created .dotai/.gitignore
```

### Step 2: Create Your First .ai File

Create `Button.ai`:

```markdown
---
agent: claude-code
artifacts: []
---

# Button Component Specification

Create a reusable Button component with TypeScript and React.

## Requirements

- Support variants: primary, secondary, danger
- Support sizes: small, medium, large
- Include loading state with spinner
- Include disabled state
- Full accessibility (ARIA labels, keyboard navigation)

## Testing

- Unit tests for all variants
- Accessibility tests
```

### Step 3: Generate Code

```bash
dot gen
```

Watch as dotai:
1. Detects your new .ai file
2. Sends the specification to claude-code
3. Generates Button.tsx, Button.test.tsx, etc.
4. Updates Button.ai with the artifacts list

### Step 4: Check What Was Created

```bash
dot ls
```

You'll see:
```
Button.ai
  Agent: claude-code
  Artifacts (3):
    • Button.tsx
    • Button.test.tsx
    • Button.module.css
```

### Step 5: Make an Update

Edit Button.ai to add a new requirement:
- Add icon support (left/right placement)

Check what changed:
```bash
dot status
```

Generate the update:
```bash
dot gen
```

This time, dotai sends only the **diff** to claude-code, which intelligently updates your files.

## Common Workflows

### Creating a Component

```bash
# 1. Create spec file
vim MyComponent.ai

# 2. Generate
dot gen

# 3. Test the generated code
npm test
```

### Making Changes

```bash
# 1. Edit the .ai file
vim MyComponent.ai

# 2. See what changed
dot status

# 3. Generate updates
dot gen
```

### Multiple Components

```bash
# Process all .ai files in src/
dot gen ./src

# Check status of all
dot status ./src

# List all .ai files and their artifacts
dot ls ./src
```

### Starting Fresh

```bash
# Clear all state
dot clean

# Next gen will regenerate everything
dot gen --force
```

## File Organization

### Recommended Structure

```
my-project/
├── .dotai/                    # dotai state (gitignored)
│   ├── config.json
│   ├── state.json
│   └── .gitignore
├── src/
│   ├── components/
│   │   ├── Button.ai          # Specification
│   │   ├── Button.tsx         # Generated artifact
│   │   └── Button.test.tsx    # Generated artifact
│   ├── hooks/
│   │   ├── useAuth.ai
│   │   └── useAuth.ts
│   └── utils/
│       ├── validation.ai
│       └── validation.ts
└── package.json
```

### What to Commit

**Do commit:**
- `.ai` files (source of truth)
- Generated artifacts (for review)
- `.dotai/config.json` (team settings)

**Don't commit:**
- `.dotai/state.json` (local build state)

Already handled by `.dotai/.gitignore`

## Best Practices

### 1. One Concern Per File

```
Good:
  Button.ai       # Just Button
  Form.ai         # Just Form
  Input.ai        # Just Input

Avoid:
  Components.ai   # Multiple unrelated components
```

### 2. Be Specific in Specs

```markdown
Good:
# Button Component
- Variant prop: "primary" | "secondary" | "danger"
- Size prop: "sm" | "md" | "lg"
- Disabled state grays out button and prevents onClick

Bad:
# Button Component
Make a nice button component
```

### 3. Iterate Incrementally

Start simple, add features one at a time:
1. Basic button with click handler
2. Add variants
3. Add loading state
4. Add icon support

### 4. Review Generated Code

```bash
# After generation
git diff

# Review before committing
git add Button.ai Button.tsx Button.test.tsx
git commit -m "Add Button component"
```

## Troubleshooting

### "Unknown agent: claude-code"

**Problem:** Claude Code not installed

**Solution:**
```bash
npm install -g @anthropic/claude-code
claude --version
```

### "Authentication error"

**Problem:** API key not set

**Solution:**
```bash
export ANTHROPIC_API_KEY=your_key_here
# Or add to ~/.bashrc or ~/.zshrc
```

### Generation hangs

**Problem:** Claude Code waiting for input

**Solution:** Check that you're using headless mode (dotai does this automatically)

### Files not detected

**Problem:** Artifacts list not updating

**Solution:**
```bash
# Check current state
dot ls

# If wrong, force regenerate
dot clean
dot gen --force
```

## Advanced Usage

### Custom Agent Configuration

```yaml
---
agent: claude-code
artifacts: []
agent_config:
  model: claude-sonnet-4
  allowedTools: "Read,Write,Edit"
  permission_mode: acceptEdits
---
```

### Processing Subset of Files

```bash
# Only Button.ai
dot gen Button.ai

# All in components/
dot gen src/components/

# Force regenerate specific file
dot gen Button.ai --force
```

## What's Next?

1. **Read SPECIFICATION.md** for deep technical details
2. **Check README.md** for complete documentation
3. **Try real examples** in your project
4. **Share feedback** via GitHub issues

## Resources

- **Documentation:** README.md, SPECIFICATION.md
- **Examples:** test-project/Button.ai
- **Help:** `ai --help`
- **Source:** https://github.com/yourusername/dotai

Happy generating! 🚀
