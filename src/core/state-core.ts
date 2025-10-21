/**
 * State core module - Pure state management logic
 *
 * All functions are pure - no I/O, no side effects.
 * Path manipulation and state transformations only.
 */

import * as path from 'path';
import { DotAiState, AiFileState, DotAiConfig } from '../types';
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
 * Validate state object structure
 *
 * PURE: Validation logic only
 */
export function validateState(data: unknown): Result<DotAiState, ValidationError> {
  if (typeof data !== 'object' || data === null) {
    return new Err(
      new ValidationError(
        'State must be an object',
        'INVALID_CONFIG',
        { receivedType: typeof data }
      )
    );
  }

  const state = data as Record<string, unknown>;

  // Validate version
  if (typeof state.version !== 'string') {
    return new Err(
      new ValidationError(
        'State version must be a string',
        'INVALID_CONFIG',
        { version: state.version }
      )
    );
  }

  // Validate files
  if (typeof state.files !== 'object' || state.files === null) {
    return new Err(
      new ValidationError(
        'State files must be an object',
        'INVALID_CONFIG',
        { files: state.files }
      )
    );
  }

  // Validate each file state
  const files = state.files as Record<string, unknown>;
  for (const [filePath, fileState] of Object.entries(files)) {
    const validationResult = validateFileState(fileState);
    if (validationResult.ok === false) {
      return new Err(
        new ValidationError(
          `Invalid file state for "${filePath}": ${validationResult.error.message}`,
          'INVALID_CONFIG',
          { filePath, fileState }
        )
      );
    }
  }

  return new Ok(state as unknown as DotAiState);
}

/**
 * Validate file state structure
 *
 * PURE: Validation logic only
 */
export function validateFileState(data: unknown): Result<AiFileState, ValidationError> {
  if (typeof data !== 'object' || data === null) {
    return new Err(
      new ValidationError(
        'File state must be an object',
        'INVALID_CONFIG',
        { receivedType: typeof data }
      )
    );
  }

  const fileState = data as Record<string, unknown>;

  // Validate required fields
  if (typeof fileState.lastHash !== 'string') {
    return new Err(
      new ValidationError(
        'File state lastHash must be a string',
        'INVALID_CONFIG',
        { lastHash: fileState.lastHash }
      )
    );
  }

  if (typeof fileState.lastContent !== 'string') {
    return new Err(
      new ValidationError(
        'File state lastContent must be a string',
        'INVALID_CONFIG',
        { lastContent: fileState.lastContent }
      )
    );
  }

  if (typeof fileState.lastGenerated !== 'string') {
    return new Err(
      new ValidationError(
        'File state lastGenerated must be a string',
        'INVALID_CONFIG',
        { lastGenerated: fileState.lastGenerated }
      )
    );
  }

  if (!Array.isArray(fileState.artifacts)) {
    return new Err(
      new ValidationError(
        'File state artifacts must be an array',
        'INVALID_CONFIG',
        { artifacts: fileState.artifacts }
      )
    );
  }

  if (!fileState.artifacts.every((a) => typeof a === 'string')) {
    return new Err(
      new ValidationError(
        'File state artifacts must be an array of strings',
        'INVALID_CONFIG',
        { artifacts: fileState.artifacts }
      )
    );
  }

  return new Ok(fileState as unknown as AiFileState);
}

/**
 * Validate config object structure
 *
 * PURE: Validation logic only
 */
export function validateConfig(data: unknown): Result<DotAiConfig, ValidationError> {
  if (typeof data !== 'object' || data === null) {
    return new Err(
      new ValidationError(
        'Config must be an object',
        'INVALID_CONFIG',
        { receivedType: typeof data }
      )
    );
  }

  const config = data as Record<string, unknown>;

  if (typeof config.defaultAgent !== 'string') {
    return new Err(
      new ValidationError(
        'Config defaultAgent must be a string',
        'INVALID_CONFIG',
        { defaultAgent: config.defaultAgent }
      )
    );
  }

  if (typeof config.stateFile !== 'string') {
    return new Err(
      new ValidationError(
        'Config stateFile must be a string',
        'INVALID_CONFIG',
        { stateFile: config.stateFile }
      )
    );
  }

  return new Ok(config as unknown as DotAiConfig);
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
