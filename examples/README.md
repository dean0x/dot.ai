# Self-Reflecting Agent Examples

This directory contains templates and examples for creating self-reflecting agents with dotai.

## Quick Start

**New to self-reflecting agents?** Start here:

1. Read [SELF_REFLECTING_GUIDE.md](./SELF_REFLECTING_GUIDE.md) - Complete guide to the pattern
2. Copy [SelfReflectingRecipe.ai](./SelfReflectingRecipe.ai) - Minimal template for quick projects
3. Run `dot gen` and watch the magic happen ✨

## Templates

### 1. SelfReflectingRecipe.ai
**Best for:** Quick projects, small features, learning the pattern

Minimal self-reflecting template with:
- Basic reflection structure
- Simple quality checklist
- Easy to customize

```bash
cp examples/SelfReflectingRecipe.ai MyFeature.ai
# Edit MyFeature.ai with your requirements
dot gen MyFeature.ai
```

### 2. ValidationLibrarySelfReflecting.ai
**Best for:** Complex projects, libraries, high-quality code

Comprehensive example showing:
- Detailed quality criteria (6 categories)
- Structured reflection log format
- Priority-based improvement tracking
- Real-world validation library implementation

```bash
cp examples/ValidationLibrarySelfReflecting.ai MyLibrary.ai
# Customize for your project
dot gen MyLibrary.ai
```

### 3. BugFixSelfReflecting.ai
**Best for:** Debugging, bug fixes, issue resolution

Specialized template for systematic bug fixing:
- Hypothesis-driven debugging
- Root cause analysis
- Regression prevention
- Verification steps

```bash
cp examples/BugFixSelfReflecting.ai FixIssue123.ai
# Fill in bug details
dot gen FixIssue123.ai
```

## How to Choose

| If you want to...                    | Use this template                      |
|--------------------------------------|----------------------------------------|
| Build a feature quickly              | SelfReflectingRecipe.ai                |
| Create production-quality library    | ValidationLibrarySelfReflecting.ai     |
| Fix a bug systematically             | BugFixSelfReflecting.ai                |
| Learn the self-reflection pattern    | SelfReflectingRecipe.ai                |
| Customize for specific domain        | Any template - modify quality criteria |

## Pattern Overview

All templates follow the same self-reflecting cycle:

```
Generate → Reflect → Update Spec → Iterate until quality goals met
```

**Key features:**
- Agent analyzes its own work
- Agent updates .ai file with findings
- Agent decides when work is complete
- No human intervention needed (unless quality goals unmet)

## Customization Guide

### 1. Set Requirements

```markdown
## Requirements

- [ ] Your specific requirement 1
- [ ] Your specific requirement 2
- [ ] Your specific requirement 3
```

### 2. Define Quality Criteria

```markdown
## Quality Criteria

### [Your Quality Dimension] ✓/✗
- [ ] Specific measurable criterion
- [ ] Another measurable criterion
```

**Common dimensions:**
- Correctness (does it work?)
- Testing (is it tested?)
- Code Quality (is it clean?)
- Performance (is it fast?)
- Security (is it safe?)
- Documentation (is it documented?)

### 3. Adjust Recursion Depth

```yaml
max_recursion_depth: 5   # For simple tasks
max_recursion_depth: 10  # For complex tasks
max_recursion_depth: ∞   # For open-ended refinement (use carefully!)
```

### 4. Customize Reflection Format

Edit the "Reflection Log" section to match your needs:
- Add domain-specific checks
- Include benchmark results
- Track specific metrics
- Link to external tools

## Best Practices

### ✓ DO

- **Be specific** - "Test coverage >80%" not "good tests"
- **Make it measurable** - Agent needs objective criteria
- **Set realistic limits** - 5-10 iterations is typical
- **Review reflection logs** - Learn from agent's reasoning
- **Iterate on criteria** - Refine quality standards over time

### ✗ DON'T

- **Use vague goals** - "Make it better" won't help
- **Skip convergence criteria** - Agent needs to know when to stop
- **Ignore max_recursion_depth** - Prevent runaway iterations
- **Forget permission_mode: acceptEdits** - Needed for smooth spec updates

## Advanced Usage

### Multi-Phase Reflection

Different quality criteria for each phase:

```markdown
## Phase 1: Core Implementation
[Basic functionality + tests]

## Phase 2: Refinement
[Code quality + documentation]

## Phase 3: Optimization
[Performance + security]
```

### Confidence-Based Convergence

Agent rates confidence and continues if low:

```markdown
## Reflection
Confidence: 8/10
(Continue if <9)
```

### Comparative Analysis

Agent compares iterations:

```markdown
### Iteration 3
**Improvements from Iteration 2:**
- Test coverage: 65% → 87%
- Type errors: 5 → 0
```

## Troubleshooting

### Agent doesn't converge

❌ **Problem:** Iterations continue past max_recursion_depth or don't improve

✓ **Solutions:**
- Make quality criteria more specific
- Add measurable targets
- Review appendSystemPrompt clarity
- Check if goals are achievable

### Agent stops too early

❌ **Problem:** Work incomplete but spec unchanged

✓ **Solutions:**
- Make criteria stricter
- Add more checklist items
- Include specific targets (e.g., coverage %)
- Strengthen reflection instructions

### Low-quality reflections

❌ **Problem:** Agent's self-assessment is superficial

✓ **Solutions:**
- Add detailed reflection format
- Require specific checks (run tests, benchmarks)
- Include examples of good reflection
- Make appendSystemPrompt more directive

## Examples by Use Case

### Test-Driven Development
```markdown
Goal: Build feature with TDD
Process: Tests → Implementation → Refactor → Reflect
Template: SelfReflectingRecipe.ai
```

### Library Development
```markdown
Goal: Production-quality library with full docs/tests
Process: Implement → Test → Document → Reflect
Template: ValidationLibrarySelfReflecting.ai
```

### Bug Fixing
```markdown
Goal: Fix bug and prevent recurrence
Process: Diagnose → Fix → Verify → Reflect
Template: BugFixSelfReflecting.ai
```

### Performance Optimization
```markdown
Goal: Optimize to meet performance targets
Process: Profile → Optimize → Benchmark → Reflect
Template: Custom (add benchmark criteria)
```

### Code Refactoring
```markdown
Goal: Modernize legacy code
Process: Refactor → Test → Quality Check → Reflect
Template: SelfReflectingRecipe.ai (add quality linting)
```

## Files in This Directory

- **SELF_REFLECTING_GUIDE.md** - Complete guide to self-reflecting agents
- **SelfReflectingRecipe.ai** - Quick-start template (minimal)
- **ValidationLibrarySelfReflecting.ai** - Comprehensive example (detailed)
- **BugFixSelfReflecting.ai** - Bug fixing template (specialized)
- **README.md** - This file (you are here)

## Additional Resources

- [dotai main README](../README.md) - Main documentation
- [dotai CLAUDE.md](../CLAUDE.md) - Agent self-modification pattern details
- [Claude Code docs](https://docs.claude.com/en/docs/claude-code) - Agent configuration

## Contributing

Have a useful self-reflecting template? Contributions welcome!

## Support

Questions? Issues? Open an issue on GitHub.

---

**Ready to start?** Copy a template and run `dot gen` - your self-reflecting agent will take it from there! 🚀
