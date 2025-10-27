# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Parallel Processing Mode**: Optional parallel processing for faster multi-file generation
  - `--parallel, -p` flag: Enable concurrent processing of multiple .ai files
  - `--concurrency, -c <number>` flag: Control max concurrent files (default: 5, range: 1-50)
  - ~5x speedup for projects with many .ai files (e.g., 10 files: 5min → 1min)
  - Sequential mode remains default for clean, readable console output
- **Input Validation**: CLI flag validation prevents resource exhaustion attacks
  - `--concurrency` validates numeric input and rejects NaN values
  - Range enforcement (1-50) prevents unbounded process spawning
  - Clear error messages for invalid input

### Changed

- **Architecture Improvements**:
  - Extracted `processSingleFile()` function to eliminate 82% code duplication (57 lines)
  - Parallel and sequential modes now share common processing logic
  - State updates use atomic `updateFileState()` merging to prevent race conditions
  - Comprehensive JSDoc added to `GenOptions` interface
  - Architecture comments documenting dual processing modes and state management
- **State Management**: Improved concurrent state updates
  - Parallel tasks return per-file state updates instead of full state
  - Sequential merging using `updateFileState()` prevents "last-writer-wins" bug
  - Ensures all file updates are preserved when processing concurrently
- **Working Directory Isolation** (Parallel Safety):
  - Each AI agent now runs in its `.ai` file's directory instead of project root
  - Previous behavior: All agents ran in `process.cwd()` → high collision risk
  - New behavior: `button/button.ai` agent runs in `button/` directory
  - Reduces file conflicts in parallel mode through natural directory separation
  - Agents retain full project access via relative paths (e.g., `../../package.json`)
  - Significantly improves parallel processing safety

### Fixed

- **State Race Condition** (CRITICAL): Fixed data loss in parallel mode
  - Previous implementation: Concurrent tasks overwrote each other's state updates
  - Impact: Successfully processed files would show "No changes detected" on next run
  - Fix: Per-file state deltas merged atomically using `updateFileState()`
- **Resource Exhaustion** (CRITICAL): Prevented DoS via unbounded concurrency
  - Previous implementation: `--concurrency` accepted any integer value
  - Impact: User could spawn unlimited processes (e.g., `--concurrency 999999`)
  - Fix: Strict validation enforcing 1-50 range with clear error messages
- **NaN Injection** (TypeScript Safety): Fixed type soundness violation
  - Previous implementation: `parseInt()` could return NaN, treated as valid number
  - Impact: Type system violated, runtime bugs possible
  - Fix: Explicit NaN validation in Commander parser
- **Code Duplication** (Architecture): Eliminated 82% duplication between processing modes
  - Previous implementation: 57 lines duplicated between sequential and parallel paths
  - Impact: Bug fixes required changes in two locations
  - Fix: Extracted shared logic to `processSingleFile()` function

## [0.1.0] - 2025-10-24

### Added

- **Runtime Type Safety**: Replaced manual validation with Zod schemas for compile-time and runtime type safety
  - `ArtifactFilenameSchema`: Validates artifact filenames with security checks
  - `DotAiStateSchema`: Validates state.json structure
  - `AiFileStateSchema`: Validates individual file state entries
  - `DotAiConfigSchema`: Validates config.json structure
- **Security Features**:
  - Artifact filename validation prevents path traversal attacks (`../../../etc/passwd`)
  - Command injection protection blocks shell metacharacters (`;`, `|`, `&`, `$()`, backticks)
  - Regex-based validation restricts filenames to alphanumeric, hyphens, underscores, and dots
  - Explicit blocking of path traversal patterns (`..`, `...`)
- **State Version Enforcement**: Fail-fast validation for incompatible state versions
  - Clear error messages with migration guidance
  - Error metadata includes both current and expected versions
  - Prevents silent data corruption from version mismatches
- **Code Documentation**:
  - Comprehensive JSDoc for `RecursionMetrics` interface
  - Comprehensive JSDoc for `SingleIterationResult` interface
  - Architecture comments explaining design patterns
- **Test Coverage**:
  - 41 comprehensive tests for Zod schemas (security-focused)
  - 24 integration tests for StateService (version enforcement, I/O, edge cases)
  - Mock filesystem for fast, isolated state service testing
  - Tests validate security against 40+ attack patterns

### Changed

- **Type Safety Improvements**:
  - Replaced 163 lines of unsafe manual validation with Zod schemas in `state-core.ts`
  - Eliminated unsafe type assertions (`as unknown as Type`)
  - Fixed Zod API usage: `result.error.issues` instead of incorrect `result.error.errors`
- **Code Quality**:
  - Extracted `buildArguments()` method in claude-code agent (65 lines)
  - Extracted `buildToolDisplayText()` method in claude-code agent (20 lines)
  - Extracted `formatToolResult()` method in claude-code agent (5 lines)
  - Reduced `runClaudeCode()` complexity by 36% (244 → 157 lines)
  - Moved `ToolInfo` interface to class level for better organization
- **Node.js Requirement**: Updated minimum version from 18.0.0 to 20.0.0
  - Aligns with Node.js LTS recommendations
  - Required for modern ECMAScript features and performance improvements

### Fixed

- **TypeScript Errors**:
  - Fixed ValidationError code: used existing `INVALID_CONFIG` instead of undefined `VERSION_MISMATCH`
  - Fixed Zod error access: `error.issues` property instead of non-existent `error.errors`
- **Security Vulnerabilities**:
  - Path traversal prevention through artifact filename validation
  - Command injection prevention through shell metacharacter blocking
  - Null byte injection prevention through character whitelisting

### Dependencies

- Added `zod` ^4.1.12 for runtime schema validation
- No breaking changes to existing dependencies

### Notes

- This is the initial v0.1.0 release
- No users exist yet, so no data migration required
- All changes are initial requirements, not breaking changes
- Full test coverage ensures production readiness

---

## Version History

- **0.1.0** (2025-10-24) - Initial release with type safety and security features
