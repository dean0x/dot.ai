# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
