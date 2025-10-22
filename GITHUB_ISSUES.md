# GitHub Issues to Create

Copy and paste these into GitHub Issues manually:

---

## Issue #1: Error handling returns success:true incorrectly in edge cases

**Labels:** enhancement, low-priority

### Issue Description

In some error paths during recursive processing, we return `success: true` even though the operation didn't fully complete as intended.

### Example

When re-parsing fails during recursion check (after a successful iteration):
```typescript
const reparseResult = await parserService.parseAiFile(aiFile.path);
if (isErr(reparseResult)) {
  console.log(chalk.yellow(`  ⚠ Could not re-parse file to check for spec changes: ${reparseResult.error.message}`));
  return { success: true, updatedState, updatedAiFile: null, specChanged: false };
  // ↑ Returns success:true even though we couldn't complete the recursion check
}
```

**Location:** `src/cli/commands/gen.ts:196-200` in `processSingleIteration()`

### Impact

**Severity:** Low

The work was actually done successfully (agent ran, artifacts generated), we just couldn't check if we should recurse. So `success: true` might be defensible, but it's semantically confusing.

### Proposed Solutions

**Option 1:** Change to `success: false` for any error
**Option 2:** Add a separate `completed` or `fullyCompleted` flag
**Option 3:** Document that `success` means "iteration succeeded" not "everything succeeded"

### Related

From code review Issue #10 in REVIEW_FINDINGS.md

---

## Issue #2: Add rate limiting between recursive iterations

**Labels:** enhancement, nice-to-have

### Issue Description

Recursive iterations currently run immediately back-to-back with no delay between them. This could potentially:
- Hammer API endpoints
- Not give external processes time to settle
- Consume resources aggressively

### Example

Current behavior:
```
Iteration 1 completes → Iteration 2 starts immediately (0ms delay)
Iteration 2 completes → Iteration 3 starts immediately (0ms delay)
```

### Impact

**Severity:** Low

Most agents (like Claude) have their own rate limiting built in. This is more of a quality-of-life improvement.

### Proposed Solution

Add configurable delay between iterations:

```typescript
interface AiFileFrontmatter {
  recursive?: boolean;
  max_recursion_depth?: number | "∞";
  iteration_delay_ms?: number; // NEW: delay between iterations (default: 0)
}
```

Or add a global config:
```yaml
# .dotai/config.json
{
  "recursion": {
    "iteration_delay_ms": 2000  // 2 second delay between iterations
  }
}
```

**Implementation:**
```typescript
// In the while loop after processing iteration
if (currentAiFile.frontmatter.recursive && shouldContinue) {
  const delay = currentAiFile.frontmatter.iteration_delay_ms ?? 0;
  if (delay > 0) {
    console.log(chalk.gray(`  Waiting ${delay}ms before next iteration...`));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### Benefits
- Prevents API rate limit issues
- Gives user breathing room to observe/interrupt
- Allows external processes to settle between runs

### Related

From code review Issue #11 in REVIEW_FINDINGS.md

---

## Issue #3: Standardize infinity symbol handling (∞ vs Infinity)

**Labels:** enhancement, documentation

### Issue Description

The `max_recursion_depth` field currently accepts both `"∞"` and `"Infinity"` as inputs, but we:
- Only document `∞`
- Internally normalize to `∞`
- Might confuse users about which to use

### Current Code

```typescript
// src/core/parser-core.ts:158-159
if (value === "∞" || value === "Infinity") {
  maxRecursionDepth = "∞";
}
```

Both work, both get normalized to `∞`, but inconsistency could be confusing.

### Impact

**Severity:** Very Low

Both values work correctly. This is purely a documentation/consistency concern.

### Proposed Solutions

**Option 1: Pick one canonical form**
- Choose `∞` as canonical (already used in types)
- Document that `"Infinity"` is accepted as an alias
- Examples always show `∞`

**Option 2: Support both equally**
- Document both as equally valid
- Don't normalize - preserve user's choice
- Update type: `max_recursion_depth?: number | "∞" | "Infinity"`

**Option 3: Remove alias**
- Only accept `∞`
- Reject `"Infinity"` in validation
- Simpler, but might break existing files

### Recommendation

**Option 1** - Keep `∞` as canonical, accept `"Infinity"` as convenience alias.

Update documentation to be clear:
```yaml
---
max_recursion_depth: ∞      # Recommended
max_recursion_depth: Infinity # Also works (alias)
---
```

### Related

From code review Issue #12 in REVIEW_FINDINGS.md

---

## Issue #4: Add granular interrupt handling for recursive context (SKIPPED - Optional)

**Labels:** enhancement, nice-to-have, skipped

### Issue Description

Currently, the SIGINT/SIGTERM handler is at the command level. During deep recursive processing, pressing Ctrl+C exits the entire process, but we could provide more granular control.

### Current Behavior

```
User presses Ctrl+C → Process exits immediately → State saved for completed files
```

This works fine, but could be improved for better UX during long recursive runs.

### Proposed Enhancement

Add an interrupt flag that's checked before each recursive iteration:

```typescript
let interruptRequested = false;
const handleInterrupt = () => {
  interruptRequested = true;
  console.log(chalk.yellow('\n⚠ Interrupt requested, will stop after current iteration...'));
};

// In the while loop
while (true) {
  // Check interrupt before processing
  if (interruptRequested) {
    console.log(chalk.yellow('  Recursion interrupted by user'));
    convergenceReason = 'interrupted';
    break;
  }

  // Process iteration...
}
```

### Benefits
- Graceful shutdown (completes current iteration)
- Better state consistency
- User sees completion message
- Could add "Press Ctrl+C again to force quit" behavior

### Risks
- Could interfere with readline prompt (infinity confirmation)
- Adds complexity to signal handling
- Current implementation already works adequately

### Decision

**SKIPPED** during initial implementation because:
1. Current Ctrl+C behavior works fine
2. Low risk/benefit ratio
3. Could interfere with user prompts
4. State is already saved properly

Can be revisited if users report issues with interrupting long recursive runs.

### Related

From code review Issue #7 in REVIEW_FINDINGS.md

---

## Summary

All four issues are **low priority** polish items. The core recursive functionality is solid. These can be addressed over time as nice-to-have improvements.

### Priority
1. **Issue #2** (Rate limiting) - Most valuable if users report API rate limit issues
2. **Issue #3** (Standardize ∞) - Quick documentation fix
3. **Issue #1** (Error handling) - Semantic clarity, minimal functional impact
4. **Issue #4** (Interrupt handling) - Already skipped, truly optional
