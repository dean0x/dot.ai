# Self-Reflecting Agent Pattern Guide

## Overview

A **self-reflecting agent** is an AI agent that:
1. Generates code/artifacts
2. Critically analyzes its own output
3. Updates its specification with findings
4. Iterates until quality criteria are met

This leverages dotai's agent self-modification pattern where the agent edits its own `.ai` spec file to create a self-directed quality assurance loop.

## How It Works

### The Reflection Cycle

```
┌─────────────────────────────────────────────────────┐
│  1. GENERATE                                         │
│  Agent creates artifacts based on current spec       │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  2. REFLECT                                          │
│  Agent analyzes output against quality criteria      │
│  - Run tests                                         │
│  - Check completeness                                │
│  - Evaluate code quality                             │
│  - Identify issues                                   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  3. UPDATE SPEC                                      │
│  Agent modifies .ai file with findings:              │
│  - Add reflection results to "Reflection Log"        │
│  - List improvements in "Next Iteration"             │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
         ┌────────┴─────────┐
         │  Quality Met?     │
         └────────┬─────────┘
                  │
         ┌────────┴─────────┐
         │                  │
         NO                YES
         │                  │
         │          ┌───────▼────────┐
         │          │  4. CONVERGE   │
         │          │  Don't modify  │
         │          │  spec → DONE   │
         │          └────────────────┘
         │
         └──► Back to step 1 with updated spec
```

### Convergence Signal

The agent signals completion by **NOT modifying the spec**:
- ✓ **Spec changed** → Continue to next iteration
- ✓ **Spec unchanged** → Work complete, stop

## Key Components

### 1. Recursive Mode Configuration

Enable recursive processing via CLI flags when running generation:

```bash
# Basic recursive mode (default, max 10 iterations)
dot gen --recursive

# Custom iteration limit
dot gen --recursive --max-recursion-depth 20

# Infinite mode (agent controls when to stop)
dot gen --recursive --max-recursion-depth ∞

# Forward Claude Code flags for permission and custom instructions
dot gen --recursive \
  --custom-instructions "You are in SELF-REFLECTION mode. After generating artifacts, you MUST analyze your output and update this spec with findings."
```

Your `.ai` file is now plain Markdown (no frontmatter needed).

### 2. Quality Criteria

Define clear, measurable standards:

```markdown
## Quality Criteria

### Correctness ✓/✗
- [ ] All features work as specified
- [ ] Edge cases handled
- [ ] No runtime errors

### Testing ✓/✗
- [ ] All tests passing
- [ ] Coverage > 80%
- [ ] Edge cases tested

### Code Quality ✓/✗
- [ ] Clean, readable code
- [ ] Proper error handling
- [ ] Good documentation
```

### 3. Reflection Log

Space for agent to document findings:

```markdown
## Reflection Log

### Iteration 1

**Generated:**
- validator.ts
- validator.test.ts

**Working:**
- Basic validation logic correct
- Tests passing

**Issues:**
- Missing null checks
- Test coverage only 65%
- No JSDoc comments

**Quality Status:**
- Correctness: ✗ (null handling)
- Testing: ✗ (coverage low)
- Code Quality: ✗ (no docs)
```

### 4. Next Iteration Tasks

Specific improvements needed:

```markdown
## Next Iteration

**Critical:**
- Add null/undefined validation
- Increase test coverage to >80%

**Important:**
- Add JSDoc documentation
- Improve error messages

**Nice-to-have:**
- Add examples to README
```

### 5. Convergence Criteria

Clear stopping conditions:

```markdown
## Convergence Criteria

Stop when:
1. ✓ All Quality Criteria show ✓
2. ✓ All tests passing
3. ✓ No Critical/Important items in Next Iteration
4. ✓ Code is production-ready
```

## Templates

### Quick Start Template

Use `SelfReflectingRecipe.ai` for simple projects:
- Minimal setup
- Basic reflection structure
- Good for small features/utilities

### Comprehensive Template

Use `ValidationLibrarySelfReflecting.ai` for complex projects:
- Detailed quality criteria
- Structured reflection format
- Priority-based improvement tracking
- Clear convergence rules

### Base Template

Use `SelfReflectingAgent.ai` as starting point:
- Customize quality criteria for your domain
- Adjust reflection format
- Set appropriate max_recursion_depth

## Usage

### 1. Copy and Customize Template

```bash
cp examples/SelfReflectingRecipe.ai MyFeature.ai
```

Edit `MyFeature.ai`:
- Set your goal/requirements
- Define quality criteria
- Adjust recursion depth

### 2. Run Generation

```bash
dot gen MyFeature.ai
```

### 3. Monitor Progress

The agent will:
- Generate artifacts
- Update the spec with reflection
- Iterate automatically
- Stop when quality goals met

### 4. Review Results

Check the final spec:
- Read Reflection Log for quality assessment
- Review generated artifacts
- Verify all quality criteria met

## Best Practices

### ✓ DO

- **Be specific** - Clear requirements and quality criteria
- **Set realistic limits** - Use max_recursion_depth (5-10 is typical)
- **Define measurable goals** - "Test coverage >80%" not "good tests"
- **Use appendSystemPrompt** - Guide agent's reflection process
- **Review iterations** - Check reflection log for insights

### ✗ DON'T

- **Vague criteria** - "Make it good" won't help agent converge
- **Infinite depth without reason** - Use `∞` carefully
- **Skip convergence criteria** - Agent needs to know when to stop
- **Ignore reflection log** - It shows agent's reasoning
- **Forget permission_mode** - Use `acceptEdits` for smooth flow

## Example Use Cases

### 1. Test-Driven Development

```markdown
## Goal
Build feature X with TDD approach

## Process
1. Agent writes failing tests
2. Agent implements code to pass tests
3. Agent refactors for quality
4. Agent reflects on coverage/quality
5. Iterate until all tests pass + quality met
```

### 2. Performance Optimization

```markdown
## Goal
Optimize slow function

## Quality Criteria
- [ ] Execution time < 100ms
- [ ] Memory usage < 10MB
- [ ] Benchmark tests included

## Process
1. Agent profiles current code
2. Agent optimizes bottlenecks
3. Agent benchmarks results
4. Agent reflects on metrics
5. Iterate until performance targets met
```

### 3. Documentation Generation

```markdown
## Goal
Complete API documentation

## Quality Criteria
- [ ] All public APIs documented
- [ ] Usage examples included
- [ ] No broken links

## Process
1. Agent generates initial docs
2. Agent checks for completeness
3. Agent identifies gaps
4. Agent adds missing sections
5. Iterate until criteria met
```

### 4. Code Quality Refactoring

```markdown
## Goal
Refactor legacy code to modern standards

## Quality Criteria
- [ ] No code smells
- [ ] Full type safety
- [ ] Test coverage >90%
- [ ] Follows best practices

## Process
1. Agent refactors code
2. Agent runs linters/tests
3. Agent identifies issues
4. Agent fixes problems
5. Iterate until clean
```

## Advanced Patterns

### Multi-Phase Reflection

Different criteria per phase:

```markdown
## Phase 1: Core Implementation
Quality: Correctness + Tests passing

## Phase 2: Refinement
Quality: Code quality + Documentation

## Phase 3: Optimization
Quality: Performance + Security
```

### Confidence Scoring

Agent rates confidence in each area:

```markdown
## Reflection

**Confidence Scores (1-10):**
- Correctness: 9/10 (edge cases handled)
- Testing: 7/10 (coverage could improve)
- Performance: 8/10 (optimized critical paths)

**Continue if any score < 8**
```

### Comparative Reflection

Agent compares iterations:

```markdown
### Iteration 3

**Improvements from Iteration 2:**
- ✓ Test coverage: 65% → 87%
- ✓ Type errors: 5 → 0
- ⬜ Performance: No change

**Remaining gaps:**
- Documentation still incomplete
- Error handling needs work
```

## Troubleshooting

### Agent not converging

**Problem**: Iterations continue indefinitely

**Solutions**:
- Make quality criteria more specific
- Add clearer convergence rules
- Lower max_recursion_depth
- Check if criteria are achievable

### Agent stops too early

**Problem**: Work incomplete but agent stops

**Solutions**:
- Make quality criteria stricter
- Add more detailed checklist items
- Include specific test coverage targets
- Review appendSystemPrompt instructions

### Low-quality reflections

**Problem**: Agent's self-assessment is superficial

**Solutions**:
- Strengthen appendSystemPrompt with detailed instructions
- Add specific analysis requirements
- Include examples of good reflection
- Require test execution in reflection

## Tips for Effective Self-Reflection

### 1. Specific Over General

```markdown
❌ "Code quality is good"
✓ "Code follows single responsibility principle, has clear naming,
   and includes error handling for all edge cases"
```

### 2. Actionable Findings

```markdown
❌ "Tests need improvement"
✓ "Add tests for null inputs, increase coverage from 65% to >80%,
   verify error messages are clear"
```

### 3. Measurable Goals

```markdown
❌ "Fast enough"
✓ "Execution time: 45ms (target: <100ms) ✓"
```

### 4. Honest Assessment

```markdown
✓ "While tests pass, edge cases for concurrent access are untested.
   Error handling exists but messages are unclear. Code works but
   needs improvement before production."
```

## Conclusion

Self-reflecting agents combine:
- **Agent self-modification** (dotai's recursive mode)
- **Quality-driven iteration** (clear criteria)
- **Honest self-assessment** (critical reflection)
- **Autonomous convergence** (agent decides when done)

This creates a powerful pattern for autonomous, quality-driven code generation.

## Next Steps

1. Choose a template from `examples/`
2. Customize for your needs
3. Run `dot gen` and watch it work
4. Review reflection log for insights
5. Iterate on your quality criteria

Happy reflecting! 🤖✨
