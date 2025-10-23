# dot.ai Project-Specific Patterns

**CRITICAL**: These patterns are specific to the dotai codebase and override general assumptions.

## Agent Self-Modification Pattern

**Design**: AI agents can edit their own specification files to create self-directed task queues.

```
.ai spec file → Agent generates artifacts → Agent updates .ai spec → Repeat
```

**Key Characteristics**:
- Agent edits its own input spec file during generation
- If spec content changes, run generation again with updated spec
- Agent controls convergence by NOT updating the spec
- This is an elegant, intentional self-directed task queue

**DO NOT flag as issues**:
- ✅ "Agent modifies its own input" - This is BY DESIGN
- ✅ "Re-parsing the same file" - NECESSARY to detect agent updates
- ✅ "Potential infinite loop" - INTENTIONAL, agent-controlled
- ✅ "No external stop signal" - Agent signals completion by not editing spec

## Content-Based Convergence

**Pattern**: Recursion continues based on **content changes**, not artifact changes.

```typescript
// ✅ CORRECT: Check if spec content changed
const specChanged = updatedSpec.content !== originalSpec.content;
if (!specChanged) {
  // Agent didn't update spec, work is complete
  break;
}

// ❌ WRONG assumption: Check if artifacts changed
// This misses the point - agent updates SPEC, not artifacts list
```

**Rationale**:
- Agents add new tasks by updating the spec/prompt
- Artifacts are outputs, spec is the work queue
- Empty spec changes = agent has no more work to do

## Intentional Infinite Recursion

**Pattern**: Some features are designed to run indefinitely with agent-controlled stopping.

```typescript
max_recursion_depth?: number | "∞"  // ✅ Infinity symbol is intentional
```

**DO NOT flag as issues**:
- ✅ "No time limit for infinite mode" - Agent controls duration
- ✅ "Could run forever" - That's the feature
- ✅ "No resource monitoring" - Agent convergence is the safeguard

**ONLY flag these as issues**:
- ❌ Type safety problems (e.g., using `"∞"` as a number without type guards)
- ❌ Lack of type narrowing before numeric operations

## When Reviewing Recursive/Self-Modifying Features

**Before flagging as "critical issue", ask**:
1. Is this agent editing its own input? (If yes, re-parsing is probably correct)
2. Is infinite recursion the feature? (If yes, "could run forever" is not a bug)
3. Does the agent control when to stop? (If yes, lack of external limits may be intentional)
4. Are we checking content changes or side effects? (Content changes are usually correct)

**Real issues to look for**:
- Type safety violations (union types used incorrectly)
- Missing type guards before type-dependent operations
- Race conditions in concurrent self-modification
- Actual stack overflow from recursion (not iteration)

## Example: Correct Type Handling

```typescript
// ✅ CORRECT: Union type with proper guards
const maxDepth: number | "∞" = config.max_depth ?? 10;
const isInfinite = maxDepth === "∞";

if (!isInfinite && typeof maxDepth === 'number' && iteration >= maxDepth) {
  // Type guard narrows maxDepth to number here
  break;
}

// ❌ WRONG: Using union type without guard
if (iteration >= maxDepth) {  // TypeError if maxDepth is "∞"
  break;
}
```

## Architecture Principles

For general architecture patterns (Result types, DI, pure functions, etc.), see [ARCHITECTURE.md](./ARCHITECTURE.md).

This file focuses on patterns unique to dotai that might be counterintuitive or easily misunderstood.
