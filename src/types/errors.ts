/**
 * Domain-specific error types for dot.ai
 * 
 * All errors extend BaseError for consistent structure
 * and type discrimination.
 */

/**
 * Base error class with consistent structure
 */
export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly type: ErrorType;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

export type ErrorType = 
  | 'parse'
  | 'validation'
  | 'filesystem'
  | 'security'
  | 'agent'
  | 'state'
  | 'config';

/**
 * File parsing errors (malformed .ai files)
 */
export class ParseError extends BaseError {
  readonly type = 'parse' as const;
  
  constructor(
    message: string,
    public readonly code: ParseErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

export type ParseErrorCode =
  | 'INVALID_FRONTMATTER'
  | 'MISSING_FIELD'
  | 'MALFORMED_YAML'
  | 'INVALID_CONTENT';

/**
 * Validation errors (invalid data)
 */
export class ValidationError extends BaseError {
  readonly type = 'validation' as const;
  
  constructor(
    message: string,
    public readonly code: ValidationErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

export type ValidationErrorCode =
  | 'INVALID_AGENT'
  | 'INVALID_ARTIFACTS'
  | 'INVALID_CONFIG'
  | 'INVALID_PATH'
  | 'INVALID_MODEL'
  | 'INVALID_PERMISSION_MODE';

/**
 * Filesystem operation errors
 */
export class FileSystemError extends BaseError {
  readonly type = 'filesystem' as const;
  
  constructor(
    message: string,
    public readonly code: FileSystemErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }

  /**
   * Create from Node.js fs error
   */
  static fromNodeError(error: NodeJS.ErrnoException, filePath?: string): FileSystemError {
    const code = error.code as FileSystemErrorCode;
    return new FileSystemError(
      error.message,
      code || 'UNKNOWN',
      { filePath, originalCode: error.code }
    );
  }
}

export type FileSystemErrorCode =
  | 'ENOENT'    // File not found
  | 'EACCES'    // Permission denied
  | 'EEXIST'    // File exists
  | 'EISDIR'    // Is a directory
  | 'ENOTDIR'   // Not a directory
  | 'ENOSPC'    // No space left
  | 'UNKNOWN';

/**
 * Security errors (path traversal, command injection, etc.)
 */
export class SecurityError extends BaseError {
  readonly type = 'security' as const;
  
  constructor(
    message: string,
    public readonly code: SecurityErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

export type SecurityErrorCode =
  | 'PATH_TRAVERSAL'
  | 'INVALID_INPUT'
  | 'UNSAFE_OPERATION';

/**
 * Agent execution errors
 */
export class AgentError extends BaseError {
  readonly type = 'agent' as const;
  
  constructor(
    message: string,
    public readonly code: AgentErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

export type AgentErrorCode =
  | 'EXECUTION_FAILED'
  | 'INVALID_OUTPUT'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'PARSE_ERROR';

/**
 * State management errors
 */
export class StateError extends BaseError {
  readonly type = 'state' as const;
  
  constructor(
    message: string,
    public readonly code: StateErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

export type StateErrorCode =
  | 'VERSION_MISMATCH'
  | 'CORRUPTED'
  | 'WRITE_FAILED';

/**
 * Configuration errors
 */
export class ConfigError extends BaseError {
  readonly type = 'config' as const;
  
  constructor(
    message: string,
    public readonly code: ConfigErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

export type ConfigErrorCode =
  | 'INVALID_FORMAT'
  | 'MISSING_REQUIRED';

/**
 * Union of all error types for exhaustive matching
 */
export type DotAiError =
  | ParseError
  | ValidationError
  | FileSystemError
  | SecurityError
  | AgentError
  | StateError
  | ConfigError;

/**
 * Type guard to check if error is a DotAiError
 */
export function isDotAiError(error: unknown): error is DotAiError {
  return error instanceof BaseError;
}
