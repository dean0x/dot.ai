# Architecture Documentation

## Overview

dot.ai follows **functional programming principles** with a clear separation between pure business logic and side effects. The architecture is built around three core concepts:

1. **Functional Core, Imperative Shell** - Pure functions at the core, I/O at the edges
2. **Result Types** - Explicit, type-safe error handling
3. **Dependency Injection** - Manual DI for testability without framework lock-in

---

## Core Architectural Patterns

### 1. Functional Core, Imperative Shell

**Pattern**: Separate pure business logic from I/O operations

**Structure**:
```
Pure Core (100% testable, no I/O)
    ↓
Service Layer (orchestrates I/O using core)
    ↓
CLI Layer (user interface, calls services)
```

**Example**:

**Pure Core** (`parser-core.ts`):
```typescript
/**
 * PURE: Validates path is within base directory
 * No I/O - just string manipulation and validation
 */
export function validatePathWithinBase(
  filePath: string,
  baseDir: string = process.cwd()
): Result<string, SecurityError> {
  const absolute = path.resolve(baseDir, filePath);
  const normalized = path.normalize(absolute);

  if (!normalized.startsWith(path.normalize(baseDir))) {
    return new Err(
      new SecurityError(
        'Path traversal detected',
        'PATH_TRAVERSAL',
        { filePath, baseDir }
      )
    );
  }

  return new Ok(normalized);
}
```

**Service Layer** (`parser-service.ts`):
```typescript
/**
 * Service: Orchestrates I/O operations using pure functions
 * Uses dependency injection for FileSystem and Hasher
 */
export class ParserService {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher
  ) {}

  async parseAiFile(filePath: string): Promise<Result<AiFile, DotAiError>> {
    // 1. Pure validation
    const pathResult = validatePathWithinBase(filePath);
    if (isErr(pathResult)) return pathResult;

    // 2. I/O operation
    const readResult = await this.fs.readFile(pathResult.value, 'utf-8');
    if (isErr(readResult)) return readResult;

    // 3. Pure parsing
    const parseResult = parseFileContent(readResult.value);
    if (isErr(parseResult)) return parseResult;

    // 4. Pure validation
    const frontmatterResult = validateFrontmatter(parseResult.value.frontmatter);
    if (isErr(frontmatterResult)) return frontmatterResult;

    // 5. Pure hashing
    const hash = this.hasher.hash(parseResult.value.content);

    return new Ok({
      path: pathResult.value,
      frontmatter: frontmatterResult.value,
      content: parseResult.value.content,
      hash,
    });
  }
}
```

**Benefits**:
- Pure functions are trivially testable (no mocks needed)
- Business logic is framework-agnostic
- I/O is isolated and controlled
- Easy to reason about and refactor

---

### 2. Result Types for Explicit Error Handling

**Pattern**: Functions return `Result<T, E>` instead of throwing exceptions

**Why**:
- Errors are visible in type signatures
- Compiler enforces error handling
- No hidden control flow
- Type-safe error context

**Result Type Definition**:
```typescript
// Success case
export class Ok<T> {
  readonly ok = true as const;
  constructor(readonly value: T) {}
}

// Error case
export class Err<E> {
  readonly ok = false as const;
  constructor(readonly error: E) {}
}

export type Result<T, E> = Ok<T> | Err<E>;
```

**Usage Pattern**:
```typescript
import { Result, Ok, Err, isErr } from './utils/result';

// Function returns Result instead of throwing
function divide(a: number, b: number): Result<number, MathError> {
  if (b === 0) {
    return new Err(
      new MathError('Division by zero', 'DIVISION_BY_ZERO', { a, b })
    );
  }
  return new Ok(a / b);
}

// Caller must handle both cases
const result = divide(10, 0);
if (isErr(result)) {
  console.error('Error:', result.error.message);
  console.error('Code:', result.error.code);
  console.error('Context:', result.error.context);
  return;
}
console.log('Result:', result.value);
```

**Composition**:
```typescript
// Chain operations with andThen
const result = parseFile(path)
  .andThen(validateContent)
  .andThen(transformData)
  .map(formatOutput);

if (isErr(result)) {
  // Handle error at the end of the chain
}
```

**Benefits**:
- No try/catch blocks needed
- Error handling is explicit and visible
- Type-safe error information
- Chainable operations
- Compiler catches unhandled errors

---

### 3. Dependency Injection (Manual, No Framework)

**Pattern**: Inject dependencies through constructors, use interfaces for contracts

**Why**:
- 100% testable without real I/O
- No framework magic or lock-in
- Explicit dependency graph
- Simple to understand

**Infrastructure Interfaces** (`infrastructure/interfaces.ts`):
```typescript
/**
 * FileSystem interface - abstracts all file I/O
 */
export interface FileSystem {
  readFile(path: string, encoding: BufferEncoding): Promise<Result<string, FileSystemError>>;
  writeFile(path: string, content: string, encoding: BufferEncoding): Promise<Result<void, FileSystemError>>;
  readdir(path: string): Promise<Result<DirectoryEntry[], FileSystemError>>;
  exists(path: string): Promise<Result<boolean, FileSystemError>>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<Result<void, FileSystemError>>;
}

/**
 * Hasher interface - abstracts hashing logic
 */
export interface Hasher {
  hash(content: string): string;
}
```

**Production Implementation** (`infrastructure/fs-adapter.ts`):
```typescript
export class NodeFileSystem implements FileSystem {
  async readFile(path: string, encoding: BufferEncoding): Promise<Result<string, FileSystemError>> {
    return tryCatchAsync(
      async () => await fs.readFile(path, encoding),
      (error) => new FileSystemError(
        `Failed to read file: ${path}`,
        (error as NodeJS.ErrnoException).code || 'EUNKNOWN',
        { path, error }
      )
    );
  }
  // ... other methods
}
```

**Service Uses Interface** (`core/parser-service.ts`):
```typescript
export class ParserService {
  constructor(
    private readonly fs: FileSystem,    // Interface, not concrete class
    private readonly hasher: Hasher     // Interface, not concrete class
  ) {}
  // ... uses this.fs and this.hasher
}
```

**CLI Wires It Up** (`cli/commands/gen.ts`):
```typescript
// Create concrete implementations
const fs = new NodeFileSystem();
const hasher = new CryptoHasher();

// Inject into services
const parserService = new ParserService(fs, hasher);
const stateService = new StateService(fs);

// Use services
const result = await parserService.parseAiFile(filePath);
```

**Testing with Mocks**:
```typescript
// In tests, inject mock implementations
class MockFileSystem implements FileSystem {
  private files = new Map<string, string>();

  async readFile(path: string): Promise<Result<string, FileSystemError>> {
    const content = this.files.get(path);
    if (!content) {
      return new Err(new FileSystemError('File not found', 'ENOENT', { path }));
    }
    return new Ok(content);
  }

  setFile(path: string, content: string) {
    this.files.set(path, content);
  }
}

// Test becomes trivial
const mockFs = new MockFileSystem();
mockFs.setFile('/test.ai', 'content');

const service = new ParserService(mockFs, new MockHasher());
const result = await service.parseAiFile('/test.ai');

expect(result.ok).toBe(true);
```

**Benefits**:
- Services are 100% testable
- No real file I/O in tests
- Clear dependency boundaries
- Easy to swap implementations

---

## Domain-Specific Error Types

**Pattern**: Create specific error classes for each domain with discriminated unions

**Error Hierarchy**:
```typescript
// Base error interface
interface DotAiErrorBase {
  message: string;
  code: string;
  context?: Record<string, unknown>;
}

// Domain-specific error classes
export class ParseError extends Error implements DotAiErrorBase {
  constructor(
    message: string,
    readonly code: ParseErrorCode,
    readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class ValidationError extends Error implements DotAiErrorBase {
  constructor(
    message: string,
    readonly code: ValidationErrorCode,
    readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends Error implements DotAiErrorBase {
  constructor(
    message: string,
    readonly code: SecurityErrorCode,
    readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

// ... FileSystemError, AgentError, StateError, ConfigError
```

**Error Codes (String Literal Unions)**:
```typescript
export type ParseErrorCode =
  | 'INVALID_YAML'
  | 'INVALID_CONTENT'
  | 'MISSING_FRONTMATTER'
  | 'MISSING_CONTENT_SEPARATOR';

export type ValidationErrorCode =
  | 'INVALID_CONFIG'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_FIELD_VALUE'
  | 'INVALID_MODEL';

export type SecurityErrorCode =
  | 'PATH_TRAVERSAL'
  | 'UNSAFE_PATH'
  | 'COMMAND_INJECTION';
```

**Union Type for All Errors**:
```typescript
export type DotAiError =
  | ParseError
  | ValidationError
  | SecurityError
  | FileSystemError
  | AgentError
  | StateError
  | ConfigError;
```

**Pattern Matching**:
```typescript
const result = await service.parseAiFile(path);
if (isErr(result)) {
  const error = result.error;

  // TypeScript knows all possible error types
  if (error instanceof SecurityError) {
    console.error('Security issue:', error.code);
    console.error('Context:', error.context);
  } else if (error instanceof ParseError) {
    console.error('Parse error:', error.code);
  } else if (error instanceof FileSystemError) {
    console.error('I/O error:', error.code);
  }
}
```

**Benefits**:
- Specific error types for each domain
- Type-safe error codes
- Rich error context
- Pattern matching support
- Clear error categorization

---

## Module Organization

### Layer Structure

```
src/
├── cli/                    # CLI Layer (user interface)
│   └── commands/          # Command implementations
│       ├── gen.ts         # Wires services, handles user interaction
│       ├── status.ts      # Wires services, handles user interaction
│       └── ...
│
├── core/                   # Core Layer (business logic)
│   ├── *-core.ts          # Pure functions (no I/O)
│   │   ├── parser-core.ts     # Pure parsing & validation
│   │   ├── state-core.ts      # Pure state manipulation
│   │   ├── detector.ts        # Pure change detection
│   │   └── differ.ts          # Pure diff generation
│   │
│   ├── *-service.ts       # Services (orchestrate I/O)
│   │   ├── parser-service.ts  # I/O operations for parsing
│   │   └── state-service.ts   # I/O operations for state
│   │
│   └── prompt.ts          # Prompt generation (uses differ)
│
├── infrastructure/         # Infrastructure Layer (adapters)
│   ├── interfaces.ts      # Interface definitions
│   ├── fs-adapter.ts      # Node.js filesystem adapter
│   ├── hasher-adapter.ts  # Crypto hashing adapter
│   └── process-adapter.ts # Child process adapter
│
├── agents/                 # Agent Layer
│   ├── interface.ts       # Agent registry
│   └── claude-code.ts     # Claude Code agent implementation
│
├── types/                  # Type definitions
│   ├── index.ts           # Domain types
│   └── errors.ts          # Error type hierarchy
│
└── utils/                  # Utilities
    └── result.ts          # Result type implementation
```

### Dependency Rules

**Allowed Dependencies**:
```
CLI Layer → Service Layer → Core Layer → Infrastructure Interfaces
                                      → Utils
                                      → Types
```

**Forbidden Dependencies**:
- Core cannot depend on Infrastructure implementations
- Core cannot depend on CLI
- Infrastructure cannot depend on Core or CLI

### Naming Conventions

**Pure modules**: `*-core.ts`
- Only pure functions
- No I/O operations
- Easily testable
- Examples: `parser-core.ts`, `state-core.ts`

**Service modules**: `*-service.ts`
- Orchestrate I/O using pure functions
- Use dependency injection
- Return Result types
- Examples: `parser-service.ts`, `state-service.ts`

**Infrastructure modules**: `*-adapter.ts`
- Implement infrastructure interfaces
- Wrap external dependencies
- Convert errors to domain errors
- Examples: `fs-adapter.ts`, `hasher-adapter.ts`

---

## Immutability

**Pattern**: All state updates return new objects

**Example** (state updates):
```typescript
/**
 * Update file state - returns NEW state object
 * PURE: No mutation, creates new object
 */
export function updateFileState(
  state: DotAiState,
  filePath: string,
  fileState: AiFileState
): DotAiState {
  return {
    ...state,
    files: {
      ...state.files,
      [filePath]: fileState,
    },
  };
}
```

**Benefits**:
- No mutation bugs
- Predictable state changes
- Easy to reason about
- Supports undo/redo patterns
- Thread-safe (if needed later)

---

## Testing Strategy

### Pure Functions (No Mocks Needed)

```typescript
// Pure function tests are simple
describe('validatePathWithinBase', () => {
  it('accepts valid paths', () => {
    const result = validatePathWithinBase('file.ai', '/base');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('/base/file.ai');
  });

  it('rejects path traversal', () => {
    const result = validatePathWithinBase('../etc/passwd', '/base');
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('PATH_TRAVERSAL');
  });
});
```

### Services (Mock Infrastructure)

```typescript
// Service tests use mock implementations
describe('ParserService', () => {
  it('parses valid .ai files', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setFile('/test.ai', '---\nagent: claude-code\n---\nContent');

    const service = new ParserService(mockFs, new MockHasher());
    const result = await service.parseAiFile('/test.ai');

    expect(result.ok).toBe(true);
    expect(result.value.frontmatter.agent).toBe('claude-code');
  });
});
```

### Test Coverage Goals

- **Pure core**: 100% coverage (easy to achieve)
- **Services**: 80%+ coverage (mock I/O)
- **CLI**: Integration tests (not unit tests)
- **Infrastructure**: Adapter tests with real I/O

---

## Performance Considerations

### Result Type Overhead

**Trade-off**: 10-25% overhead in hot paths for type safety

**Why It's Acceptable**:
- dot.ai is a CLI tool with human-in-the-loop workflows
- Type safety prevents entire classes of runtime errors
- Testing becomes trivial (huge development speed gain)
- Maintainability far outweighs small performance cost

**Mitigation**:
- Pure functions enable optimization (memoization)
- Immutable structures support structural sharing
- Depth limits prevent stack overflow

### Directory Walking

**Protection**: MAX_DEPTH = 50 prevents stack overflow

```typescript
const MAX_DEPTH = 50;

private async walk(dir: string, results: string[], depth: number) {
  if (depth >= MAX_DEPTH) {
    return new Ok(undefined); // Silently skip deep directories
  }
  // ... recursive walk with depth tracking
}
```

---

## Security

### Input Validation at Boundaries

**Pattern**: Validate all external input immediately

```typescript
// Path traversal prevention
export function validatePathWithinBase(filePath: string): Result<string, SecurityError> {
  const absolute = path.resolve(baseDir, filePath);
  const normalized = path.normalize(absolute);

  if (!normalized.startsWith(path.normalize(baseDir))) {
    return new Err(new SecurityError('Path traversal detected', 'PATH_TRAVERSAL'));
  }

  return new Ok(normalized);
}
```

### Command Injection Prevention

**Pattern**: Whitelist allowed values, validate strictly

```typescript
// Agent validation - strict whitelisting
const ALLOWED_MODELS = ['claude-sonnet-4', 'claude-opus-4', 'claude-sonnet-3-5'] as const;

function validateModel(model: string): Result<string, ValidationError> {
  if (!ALLOWED_MODELS.includes(model)) {
    return new Err(
      new ValidationError(
        `Invalid model: "${model}"`,
        'INVALID_MODEL',
        { model, allowedModels: ALLOWED_MODELS }
      )
    );
  }
  return new Ok(model);
}
```

### Error Message Sanitization

**Pattern**: Don't expose internal paths in production

```typescript
// Development: Full error details
if (process.env.NODE_ENV === 'development') {
  console.error('Error reading file:', error.message);
  console.error('Path:', error.context?.path);
}

// Production: Sanitized errors
console.error('Error reading file');
```

---

## Migration Guide

### Adding a New Feature

**1. Start with Pure Core**
```typescript
// my-feature-core.ts
export function validateInput(input: unknown): Result<MyInput, ValidationError> {
  // Pure validation logic
}

export function processData(input: MyInput): Result<MyOutput, MyError> {
  // Pure business logic
}
```

**2. Create Service for I/O**
```typescript
// my-feature-service.ts
export class MyFeatureService {
  constructor(private readonly fs: FileSystem) {}

  async execute(path: string): Promise<Result<MyOutput, DotAiError>> {
    const readResult = await this.fs.readFile(path);
    if (isErr(readResult)) return readResult;

    const validateResult = validateInput(readResult.value);
    if (isErr(validateResult)) return validateResult;

    return processData(validateResult.value);
  }
}
```

**3. Wire Up in CLI**
```typescript
// cli/commands/my-feature.ts
const fs = new NodeFileSystem();
const service = new MyFeatureService(fs);

const result = await service.execute(userInput);
if (isErr(result)) {
  console.error('Error:', result.error.message);
  process.exit(1);
}
console.log('Success:', result.value);
```

**4. Write Tests**
```typescript
// my-feature-core.test.ts - No mocks needed
describe('validateInput', () => {
  it('validates correct input', () => {
    const result = validateInput({ valid: 'data' });
    expect(result.ok).toBe(true);
  });
});

// my-feature-service.test.ts - Mock FileSystem
describe('MyFeatureService', () => {
  it('processes files correctly', async () => {
    const mockFs = new MockFileSystem();
    const service = new MyFeatureService(mockFs);
    // ... test with mock
  });
});
```

---

## Key Architectural Decisions

### ADR-001: Why Result Types Instead of Exceptions?

**Context**: Need explicit, type-safe error handling

**Decision**: Use Result<T, E> pattern

**Rationale**:
- Errors visible in function signatures
- Compiler enforces handling
- Type-safe error information
- No hidden control flow

**Consequences**:
- ✅ Type safety, explicit errors
- ✅ Composable error handling
- ❌ Slightly more verbose code
- ❌ 10-25% performance overhead (acceptable for CLI)

### ADR-002: Why Manual DI Instead of Framework?

**Context**: Need testability without framework lock-in

**Decision**: Manual constructor injection

**Rationale**:
- No magic, explicit dependencies
- No framework to learn
- Crystal clear dependency graph
- Easy to understand and debug

**Consequences**:
- ✅ Simple, no framework magic
- ✅ No lock-in
- ✅ Easy to understand
- ❌ Manual wiring in CLI commands
- ❌ No automatic lifecycle management

### ADR-003: Why Separate Pure Core from Services?

**Context**: Need highly testable, maintainable code

**Decision**: Functional Core, Imperative Shell pattern

**Rationale**:
- Pure functions trivially testable (no mocks)
- Business logic framework-agnostic
- I/O isolated and controlled
- Easy to reason about

**Consequences**:
- ✅ 100% pure core test coverage
- ✅ No mocks needed for business logic
- ✅ Clear separation of concerns
- ❌ More files (-core.ts, -service.ts)
- ❌ Learning curve for pattern

---

## Further Reading

- [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) by Gary Bernhardt
- [Parse, Don't Validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) by Alexis King
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) by Scott Wlaschin
- [Domain Modeling Made Functional](https://pragprog.com/titles/swdddf/domain-modeling-made-functional/) by Scott Wlaschin

---

## Questions?

For questions about architectural decisions or patterns, see:
- `CONTRIBUTING.md` - Contribution guidelines
- `README.md` - User-facing documentation
- `SPECIFICATION.md` - Technical specification
- `.docs/audits/` - Code review reports
