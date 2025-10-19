import * as fs from 'fs/promises';
import * as path from 'path';
import { DotAiState, AiFileState, DotAiConfig } from '../types';

const STATE_VERSION = '1.0.0';
const DEFAULT_CONFIG: DotAiConfig = {
  defaultAgent: 'claude-code',
  stateFile: 'state.json',
};

/**
 * Get the .dotai directory path for the current project
 */
export function getDotAiDir(cwd: string = process.cwd()): string {
  return path.join(cwd, '.dotai');
}

/**
 * Get the state file path
 */
export function getStateFilePath(cwd: string = process.cwd()): string {
  return path.join(getDotAiDir(cwd), 'state.json');
}

/**
 * Get the config file path
 */
export function getConfigFilePath(cwd: string = process.cwd()): string {
  return path.join(getDotAiDir(cwd), 'config.json');
}

/**
 * Initialize .dotai directory structure
 */
export async function initializeDotAi(cwd: string = process.cwd()): Promise<void> {
  const dotAiDir = getDotAiDir(cwd);

  // Create .dotai directory
  await fs.mkdir(dotAiDir, { recursive: true });

  // Create default config if doesn't exist
  const configPath = getConfigFilePath(cwd);
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }

  // Create empty state if doesn't exist
  const statePath = getStateFilePath(cwd);
  try {
    await fs.access(statePath);
  } catch {
    const emptyState: DotAiState = {
      version: STATE_VERSION,
      files: {},
    };
    await fs.writeFile(statePath, JSON.stringify(emptyState, null, 2), 'utf-8');
  }

  // Create .gitignore in .dotai to ignore state.json
  const gitignorePath = path.join(dotAiDir, '.gitignore');
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, 'state.json\n', 'utf-8');
  }
}

/**
 * Load state from .dotai/state.json
 */
export async function loadState(cwd: string = process.cwd()): Promise<DotAiState> {
  const statePath = getStateFilePath(cwd);

  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(content) as DotAiState;

    // Validate version
    if (state.version !== STATE_VERSION) {
      console.warn(`State file version mismatch. Expected ${STATE_VERSION}, got ${state.version}`);
    }

    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // State file doesn't exist, return empty state
      return {
        version: STATE_VERSION,
        files: {},
      };
    }
    throw error;
  }
}

/**
 * Save state to .dotai/state.json
 */
export async function saveState(state: DotAiState, cwd: string = process.cwd()): Promise<void> {
  const statePath = getStateFilePath(cwd);
  const dotAiDir = getDotAiDir(cwd);

  // Ensure .dotai directory exists
  await fs.mkdir(dotAiDir, { recursive: true });

  // Write state
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Load configuration from .dotai/config.json
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<DotAiConfig> {
  const configPath = getConfigFilePath(cwd);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as DotAiConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Config doesn't exist, return defaults
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

/**
 * Get state for a specific .ai file
 */
export function getFileState(state: DotAiState, filePath: string): AiFileState | undefined {
  return state.files[filePath];
}

/**
 * Update state for a specific .ai file
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
 * Remove state for a specific .ai file
 */
export function removeFileState(state: DotAiState, filePath: string): DotAiState {
  const { [filePath]: _, ...remainingFiles } = state.files;
  return {
    ...state,
    files: remainingFiles,
  };
}

/**
 * Clear all state
 */
export async function clearState(cwd: string = process.cwd()): Promise<void> {
  const emptyState: DotAiState = {
    version: STATE_VERSION,
    files: {},
  };
  await saveState(emptyState, cwd);
}
