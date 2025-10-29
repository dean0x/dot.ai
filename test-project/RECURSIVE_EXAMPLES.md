# Recursive Processing Examples

This directory contains examples of how to use recursive processing in .ai files.

## What is Recursive Processing?

When using the `--recursive` CLI flag, dot.ai will automatically re-run the agent after each generation if it detects changes in the artifacts. This enables iterative refinement workflows where the agent can improve generated code through multiple passes.

## Configuration Options

### Basic Recursive Mode (Default Depth: 10)

```bash
dot gen --recursive
```

The agent will run up to 10 times (default) or until no changes are detected.

### Custom Recursion Depth

```bash
dot gen --recursive --max-recursion-depth 5
```

The agent will run up to 5 times or until no changes are detected.

### Infinite Recursion

```bash
dot gen --recursive --max-recursion-depth ∞
```

The agent will continue running until it reaches a stable state with no more changes.

**⚠️ Warning:** Use infinite recursion carefully. Ensure your specification is clear and achievable to avoid very long processing times.

## Examples in This Directory

1. **RecursiveTest.ai** - Basic recursive processing with max depth of 5
2. **InfiniteRecursion.ai** - Example of infinite recursion mode

## How It Works

1. Agent generates/updates artifacts based on your specification
2. System checks if artifacts changed compared to previous run
3. If using `--recursive` flag and changes detected:
   - Re-parse the .ai file to get updated context
   - Run the agent again with the new artifacts
4. Repeat until:
   - No changes detected (stable state reached), OR
   - Maximum recursion depth reached

## Output Messages

During recursive processing, you'll see:

- `↻ Recursive iteration N` - Shows which iteration is running
- `↻ Recursive mode enabled, changes detected. Running again...` - Another iteration starting
- `✓ No changes detected, recursion complete` - Stable state reached
- `⚠ Maximum recursion depth (N) reached` - Hit the limit before stabilizing

## Tips

- Start with a lower max depth (3-5) and increase if needed
- Use infinite recursion only when you're confident the spec is achievable
- Clear specifications lead to faster convergence
- Monitor the first few iterations to ensure progress is being made
