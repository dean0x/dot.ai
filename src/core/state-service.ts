/**
 * State service - State persistence with dependency injection
 *
 * Handles I/O operations for state and config management.
 * Uses FileSystem interface for testability.
 */

import { DotAiState, AiFileState, DotAiConfig } from '../types';
import { FileSystem } from '../infrastructure/interfaces';
import { Result, Ok, Err, isErr } from '../utils/result';
import { FileSystemError, ValidationError, ParseError } from '../types/errors';
import {
  getDotAiDir,
  getStateFilePath,
  getConfigFilePath,
  getGitignorePath,
  createEmptyState,
  validateState,
  validateConfig,
  parseJSON,
  serializeJSON,
  isVersionCompatible,
  STATE_VERSION,
  DEFAULT_CONFIG,
} from './state-core';

export type DotAiError = FileSystemError | ValidationError | ParseError;

/**
 * State service with file system dependency injection
 */
export class StateService {
  constructor(private readonly fs: FileSystem) {}

  /**
   * Initialize .dotai directory structure
   */
  async initializeDotAi(cwd: string): Promise<Result<void, DotAiError>> {
    const dotAiDir = getDotAiDir(cwd);

    // Create .dotai directory
    const mkdirResult = await this.fs.mkdir(dotAiDir, { recursive: true });
    if (isErr(mkdirResult)) {
      return mkdirResult;
    }

    // Create default config if doesn't exist
    const configPath = getConfigFilePath(cwd);
    const configExists = await this.fs.exists(configPath);

    if (isErr(configExists)) {
      return configExists;
    }

    if (!configExists.value) {
      const configJson = serializeJSON(DEFAULT_CONFIG);
      if (isErr(configJson)) {
        return configJson;
      }

      const writeResult = await this.fs.writeFile(configPath, configJson.value, 'utf-8');
      if (isErr(writeResult)) {
        return writeResult;
      }
    }

    // Create empty state if doesn't exist
    const statePath = getStateFilePath(cwd);
    const stateExists = await this.fs.exists(statePath);

    if (isErr(stateExists)) {
      return stateExists;
    }

    if (!stateExists.value) {
      const emptyState = createEmptyState();
      const stateJson = serializeJSON(emptyState);
      if (isErr(stateJson)) {
        return stateJson;
      }

      const writeResult = await this.fs.writeFile(statePath, stateJson.value, 'utf-8');
      if (isErr(writeResult)) {
        return writeResult;
      }
    }

    // Create .gitignore in .dotai to ignore state.json
    const gitignorePath = getGitignorePath(cwd);
    const gitignoreExists = await this.fs.exists(gitignorePath);

    if (isErr(gitignoreExists)) {
      return gitignoreExists;
    }

    if (!gitignoreExists.value) {
      const writeResult = await this.fs.writeFile(gitignorePath, 'state.json\n', 'utf-8');
      if (isErr(writeResult)) {
        return writeResult;
      }
    }

    return new Ok(undefined);
  }

  /**
   * Load state from .dotai/state.json
   */
  async loadState(cwd: string): Promise<Result<DotAiState, DotAiError>> {
    const statePath = getStateFilePath(cwd);

    // Read file
    const readResult = await this.fs.readFile(statePath, 'utf-8');

    // If file doesn't exist, return empty state
    if (isErr(readResult)) {
      if (readResult.error.code === 'ENOENT') {
        return new Ok(createEmptyState());
      }
      return readResult;
    }

    // Parse JSON
    const parseResult = parseJSON<unknown>(readResult.value, 'state file');
    if (isErr(parseResult)) {
      return parseResult;
    }

    // Validate state structure
    const validateResult = validateState(parseResult.value);
    if (isErr(validateResult)) {
      return validateResult;
    }

    const state = validateResult.value;

    // Check version compatibility (warn but don't fail)
    if (!isVersionCompatible(state.version)) {
      // Note: In production, you might want to handle version migration here
      // For now, we just continue with potentially incompatible state
    }

    return new Ok(state);
  }

  /**
   * Save state to .dotai/state.json
   */
  async saveState(state: DotAiState, cwd: string): Promise<Result<void, DotAiError>> {
    const statePath = getStateFilePath(cwd);
    const dotAiDir = getDotAiDir(cwd);

    // Ensure .dotai directory exists
    const mkdirResult = await this.fs.mkdir(dotAiDir, { recursive: true });
    if (isErr(mkdirResult)) {
      return mkdirResult;
    }

    // Serialize state
    const jsonResult = serializeJSON(state);
    if (isErr(jsonResult)) {
      return jsonResult;
    }

    // Write file
    const writeResult = await this.fs.writeFile(statePath, jsonResult.value, 'utf-8');
    if (isErr(writeResult)) {
      return writeResult;
    }

    return new Ok(undefined);
  }

  /**
   * Load configuration from .dotai/config.json
   */
  async loadConfig(cwd: string): Promise<Result<DotAiConfig, DotAiError>> {
    const configPath = getConfigFilePath(cwd);

    // Read file
    const readResult = await this.fs.readFile(configPath, 'utf-8');

    // If file doesn't exist, return defaults
    if (isErr(readResult)) {
      if (readResult.error.code === 'ENOENT') {
        return new Ok(DEFAULT_CONFIG);
      }
      return readResult;
    }

    // Parse JSON
    const parseResult = parseJSON<unknown>(readResult.value, 'config file');
    if (isErr(parseResult)) {
      return parseResult;
    }

    // Validate config structure
    const validateResult = validateConfig(parseResult.value);
    if (isErr(validateResult)) {
      return validateResult;
    }

    return new Ok(validateResult.value);
  }

  /**
   * Clear all state (reset to empty)
   */
  async clearState(cwd: string): Promise<Result<void, DotAiError>> {
    const emptyState = createEmptyState();
    return this.saveState(emptyState, cwd);
  }
}
