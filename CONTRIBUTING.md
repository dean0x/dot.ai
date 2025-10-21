# Contributing to dot.ai

## Branch Naming Convention

All branches should follow this format:

```
<type>/<issue-number>-<short-description>
```

### Types
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation changes
- `chore/` - Maintenance tasks

### Examples
```
feature/15-parallel-generation
fix/23-state-corruption
refactor/2-architecture-principles
docs/8-api-documentation
chore/5-dependency-updates
```

## Linking Branches to Issues

1. **Create branch with issue number:**
   ```bash
   git checkout -b refactor/2-architecture-principles
   ```

2. **Push to remote:**
   ```bash
   git push -u origin refactor/2-architecture-principles
   ```

3. **Link to issue:**
   ```bash
   gh issue comment <issue-number> --body "Working on this in branch \`<branch-name>\`"
   ```

## Commit Message Format

```
<type>: <subject>

<body>

Addresses #<issue-number>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Commit Types
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `chore:` - Maintenance
- `test:` - Testing
- `perf:` - Performance improvements
- `security:` - Security fixes

### Closing Issues
Use keywords in commit messages to auto-close issues:
- `Fixes #<issue-number>` - For bug fixes
- `Closes #<issue-number>` - For feature completion
- `Resolves #<issue-number>` - General resolution
- `Addresses #<issue-number>` - Partial work

## Pull Request Process

1. **Create PR with descriptive title:**
   ```
   Refactor: Implement architecture principles (#2)
   ```

2. **PR description should include:**
   - Summary of changes
   - Related issues (e.g., "Fixes #2")
   - Test plan
   - Breaking changes (if any)

3. **Link PR to issue:**
   - Use "Fixes #2" in PR description
   - Or use GitHub UI to link via "Development" section

## Engineering Principles

Before contributing, review:
- `/home/node/.claude/CLAUDE.md` - Global engineering principles
- `SPECIFICATION.md` - Technical specification
- Existing code reviews in `.docs/audits/` (if available locally)

Key principles:
- Use Result types, not exceptions
- Inject dependencies
- Write pure functions
- Immutable data structures
- Strict TypeScript
- Test behaviors, not implementation
