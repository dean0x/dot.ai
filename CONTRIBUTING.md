# Contributing to dotai

Thank you for your interest in contributing to dotai! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/dotai.git
cd dotai

# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link

# Now you can use `ai` command globally
dot --version
```

### Development Workflow

```bash
# Watch mode for development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Test (when tests are added)
npm test
```

## Project Structure

```
dotai/
├── src/
│   ├── cli/           # CLI commands and entry point
│   ├── core/          # Core business logic
│   ├── agents/        # Agent implementations
│   └── types/         # TypeScript type definitions
├── dist/              # Compiled JavaScript (gitignored)
├── test-project/      # Example project for testing
├── README.md          # User documentation
├── SPECIFICATION.md   # Technical specification
└── CONTRIBUTING.md    # This file
```

## Architecture Principles

### 1. Separation of Concerns

- **CLI Layer** (`src/cli/`): User interaction, argument parsing, output formatting
- **Core Layer** (`src/core/`): Business logic, pure functions where possible
- **Agent Layer** (`src/agents/`): External integrations, subprocess management
- **Types Layer** (`src/types/`): Shared type definitions

### 2. Functional Style

Prefer:
- Pure functions over stateful classes
- Immutable data structures
- Explicit error handling (Result types would be ideal)
- Composition over inheritance

### 3. Type Safety

- All code must be fully typed (no `any`)
- Use strict TypeScript settings
- Export comprehensive type definitions

## Code Style

### TypeScript

```typescript
// Use explicit return types
export function parseAiFile(filePath: string): Promise<AiFile> {
  // ...
}

// Use const for immutability
const state = await loadState();

// Use destructuring
const { changed, new: newFiles, unchanged } = detectChanges(aiFiles, state);

// Prefer async/await over promises
async function processFile(file: AiFile): Promise<GenerationResult> {
  const result = await agent.invoke(prompt, options);
  return result;
}
```

### Naming Conventions

- **Files**: kebab-case (`parser.ts`, `claude-code.ts`)
- **Functions**: camelCase (`parseAiFile`, `detectChanges`)
- **Types/Interfaces**: PascalCase (`AiFile`, `GenerationResult`)
- **Constants**: SCREAMING_SNAKE_CASE (`STATE_VERSION`)

### Comments

```typescript
/**
 * Parse a .ai file and extract frontmatter + content
 *
 * @param filePath - Absolute path to the .ai file
 * @returns Parsed AiFile object with frontmatter, content, and hash
 * @throws Error if file doesn't exist or frontmatter is invalid
 */
export async function parseAiFile(filePath: string): Promise<AiFile> {
  // Implementation
}
```

## Adding New Features

### Adding a New Agent

1. **Create agent implementation** in `src/agents/`:

```typescript
// src/agents/custom-agent.ts
import { CodingAgent, GenerationResult, InvokeOptions } from '../types';

export class CustomAgent implements CodingAgent {
  name = 'custom-agent';

  async invoke(prompt: string, options: InvokeOptions): Promise<GenerationResult> {
    // Implement agent invocation
  }

  parseOutput(rawOutput: string): string[] {
    // Parse agent output to extract artifacts
  }
}
```

2. **Register in CLI** (`src/cli/index.ts`):

```typescript
import { CustomAgent } from '../agents/custom-agent';

registerAgent(new CustomAgent());
```

3. **Update documentation**:
   - Add to README.md (supported agents section)
   - Add to SPECIFICATION.md (agent examples)

4. **Test manually**:

```bash
npm run build
cat > test.ai <<EOF
---
agent: custom-agent
artifacts: []
---
Test specification
EOF
dot gen
```

### Adding a New CLI Command

1. **Create command file** in `src/cli/commands/`:

```typescript
// src/cli/commands/new-command.ts
import chalk from 'chalk';

export async function newCommand(options: NewCommandOptions): Promise<void> {
  try {
    // Implement command logic
    console.log(chalk.green('Success!'));
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}
```

2. **Register in CLI** (`src/cli/index.ts`):

```typescript
import { newCommand } from './commands/new-command';

program
  .command('new-cmd [args]')
  .description('Description of new command')
  .option('-f, --flag', 'Description of flag')
  .action(newCommand);
```

3. **Update help text** in README.md

### Adding Core Functionality

1. **Add to appropriate core module** (`src/core/`)
2. **Export types** if needed (`src/types/index.ts`)
3. **Write pure functions** where possible
4. **Handle errors explicitly**
5. **Update SPECIFICATION.md** with design decisions

## Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] `dot init` - Creates .dotai structure correctly
- [ ] `dot gen` - Processes .ai files (with test agent)
- [ ] `dot status` - Shows correct change detection
- [ ] `dot ls` - Lists files accurately
- [ ] `dot clean` - Clears state
- [ ] `dot --help` - Shows help
- [ ] `dot --version` - Shows version

### Future: Automated Tests

When adding tests (using Jest):

```typescript
// src/core/__tests__/parser.test.ts
import { parseAiFile } from '../parser';

describe('parseAiFile', () => {
  it('should parse valid .ai file', async () => {
    const result = await parseAiFile('/path/to/test.ai');
    expect(result.frontmatter.agent).toBe('claude-code');
  });

  it('should throw on invalid frontmatter', async () => {
    await expect(parseAiFile('/path/to/invalid.ai')).rejects.toThrow();
  });
});
```

## Pull Request Process

### Before Submitting

1. **Update SPECIFICATION.md** if you changed architecture
2. **Update README.md** if you changed user-facing behavior
3. **Build successfully**: `npm run build`
4. **Lint clean**: `npm run lint`
5. **Test manually** using checklist above

### PR Description Template

```markdown
## What This PR Does

Brief description of the change.

## Why This Change

Explanation of motivation and context.

## What Changed

- File 1: Description
- File 2: Description

## Testing Done

- [ ] Manual testing completed
- [ ] Tested on Linux/macOS/Windows (as applicable)
- [ ] Documentation updated

## Breaking Changes

Yes/No - if yes, explain what breaks and migration path
```

### Review Process

1. PR is submitted
2. Maintainer reviews code
3. Feedback addressed
4. PR approved and merged
5. Version bumped (if needed)
6. Published to npm (if needed)

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

### Release Checklist

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** (when created)
3. **Build**: `npm run build`
4. **Test**: Manual testing
5. **Commit**: `git commit -m "Release v1.2.3"`
6. **Tag**: `git tag v1.2.3`
7. **Push**: `git push && git push --tags`
8. **Publish**: `npm publish`

## Documentation

### What to Document

- **README.md**: User-facing features, installation, usage
- **SPECIFICATION.md**: Architecture, design decisions, technical details
- **Code comments**: Complex logic, non-obvious decisions
- **JSDoc**: All public functions

### Documentation Style

- **Be concise but complete**
- **Include examples** where helpful
- **Explain *why*, not just *what***
- **Keep it up to date** (doc changes in same PR as code)

## Getting Help

### Questions

- Open a GitHub issue with "Question:" prefix
- Check existing issues first
- Provide context and what you've tried

### Bug Reports

```markdown
**Bug Description**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Run `dot gen`
2. See error

**Expected Behavior**
What should have happened

**Environment**
- dotai version: 0.1.0
- Node version: 18.0.0
- OS: macOS 14.0
```

### Feature Requests

```markdown
**Feature Description**
What feature you'd like to see

**Use Case**
Why this would be useful

**Proposed Solution**
Your ideas on how to implement (optional)
```

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Focus on what's best for the project
- Show empathy towards others

### Not Acceptable

- Harassment of any kind
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information

## Areas Needing Help

### High Priority

- [ ] Add automated tests (Jest)
- [ ] Implement cursor agent
- [ ] Implement aider agent
- [ ] Add --parallel flag
- [ ] Improve error messages

### Medium Priority

- [ ] Add --dry-run mode
- [ ] Add interactive mode
- [ ] Improve prompt construction
- [ ] Add validation hooks
- [ ] Better progress indicators

### Nice to Have

- [ ] VSCode extension
- [ ] Watch mode
- [ ] Cost tracking
- [ ] Rollback functionality
- [ ] Cloud state sync

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md (when created)
- Mentioned in release notes
- Credited in documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to dotai! 🚀
