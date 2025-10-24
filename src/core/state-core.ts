/**
 * State core module - Pure state management logic
 *
 * All functions are pure - no I/O, no side effects.
 * Path manipulation and state transformations only.
 */

import * as path from 'path';
import { DotAiState, AiFileState, DotAiConfig } from '../types';
import { DotAiStateSchema, DotAiConfigSchema, AiFileStateSchema } from '../types/schemas';
import { Result, Ok, Err, tryCatch } from '../utils/result';
import { ParseError, ValidationError } from '../types/errors';

export const STATE_VERSION = '0.1.0';

export const DEFAULT_CONFIG: DotAiConfig = {
  defaultAgent: 'claude-code',
  stateFile: 'state.json',
};

/**
 * Get the .dotai directory path for a project
 *
 * PURE: Path manipulation only
 */
export function getDotAiDir(cwd: string): string {
  return path.join(cwd, '.dotai');
}

/**
 * Get the state file path
 *
 * PURE: Path manipulation only
 */
export function getStateFilePath(cwd: string): string {
  return path.join(getDotAiDir(cwd), 'state.json');
}

/**
 * Get the config file path
 *
 * PURE: Path manipulation only
 */
export function getConfigFilePath(cwd: string): string {
  return path.join(getDotAiDir(cwd), 'config.json');
}

/**
 * Get the .gitignore file path for .dotai directory
 *
 * PURE: Path manipulation only
 */
export function getGitignorePath(cwd: string): string {
  return path.join(getDotAiDir(cwd), '.gitignore');
}

/**
 * Create an empty state object
 *
 * PURE: Object creation only
 */
export function createEmptyState(): DotAiState {
  return {
    version: STATE_VERSION,
    files: {},
  };
}

/**
 * Validate state object structure using Zod schema
 *
 * PURE: Validation logic only, no unsafe type assertions
 */
export function validateState(data: unknown): Result<DotAiState, ValidationError> {
  const result = DotAiStateSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error?.issues || [];
    const firstError = errors[0];
    const message = firstError
      ? `Invalid state structure: ${firstError.message} at ${firstError.path.join('.')}`
      : 'Invalid state structure';

    return new Err(
      new ValidationError(
        message,
        'INVALID_CONFIG',
        { zodError: errors, receivedData: data }
      )
    );
  }

  return new Ok(result.data);
}

/**
 * Validate file state structure using Zod schema
 *
 * PURE: Validation logic only, no unsafe type assertions
 */
export function validateFileState(data: unknown): Result<AiFileState, ValidationError> {
  const result = AiFileStateSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error?.issues || [];
    const firstError = errors[0];
    const message = firstError
      ? `Invalid file state: ${firstError.message} at ${firstError.path.join('.')}`
      : 'Invalid file state';

    return new Err(
      new ValidationError(
        message,
        'INVALID_CONFIG',
        { zodError: errors, receivedData: data }
      )
    );
  }

  return new Ok(result.data);
}

/**
 * Validate config object structure using Zod schema
 *
 * PURE: Validation logic only, no unsafe type assertions
 */
export function validateConfig(data: unknown): Result<DotAiConfig, ValidationError> {
  const result = DotAiConfigSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error?.issues || [];
    const firstError = errors[0];
    const message = firstError
      ? `Invalid config structure: ${firstError.message} at ${firstError.path.join('.')}`
      : 'Invalid config structure';

    return new Err(
      new ValidationError(
        message,
        'INVALID_CONFIG',
        { zodError: errors, receivedData: data }
      )
    );
  }

  return new Ok(result.data);
}

/**
 * Parse JSON string into typed object
 *
 * PURE: String parsing only
 */
export function parseJSON<T>(
  jsonString: string,
  context: string = 'data'
): Result<T, ParseError> {
  return tryCatch(
    () => JSON.parse(jsonString) as T,
    (error) =>
      new ParseError(
        `Failed to parse ${context}: ${(error as Error).message}`,
        'INVALID_CONTENT',
        { error, jsonString: jsonString.substring(0, 100) }
      )
  );
}

/**
 * Serialize object to JSON string
 *
 * PURE: String serialization only
 */
export function serializeJSON(data: unknown): Result<string, ParseError> {
  return tryCatch(
    () => JSON.stringify(data, null, 2),
    (error) =>
      new ParseError(
        `Failed to serialize to JSON: ${(error as Error).message}`,
        'INVALID_CONTENT',
        { error }
      )
  );
}

/**
 * Get state for a specific .ai file
 *
 * PURE: Object lookup
 */
export function getFileState(state: DotAiState, filePath: string): AiFileState | undefined {
  return state.files[filePath];
}

/**
 * Update state for a specific .ai file (immutable)
 *
 * PURE: Returns new state object
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

/**
 * Remove state for a specific .ai file (immutable)
 *
 * PURE: Returns new state object
 */
export function removeFileState(state: DotAiState, filePath: string): DotAiState {
  const { [filePath]: _, ...remainingFiles } = state.files;
  return {
    ...state,
    files: remainingFiles,
  };
}

/**
 * Check if state version matches expected version
 *
 * PURE: String comparison
 */
export function isVersionCompatible(stateVersion: string, expectedVersion: string = STATE_VERSION): boolean {
  return stateVersion === expectedVersion;
}
