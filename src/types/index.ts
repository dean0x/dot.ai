/**
 * Core type definitions for dotai
 */

/**
 * Frontmatter configuration in .ai files
 */
export interface AiFileFrontmatter {
  /** Coding agent to use (claude-code, cursor, aider, etc.) */
  agent: string;

  /** Agent-specific configuration */
  agent_config?: Record<string, unknown>;

  /** List of generated artifact files */
  artifacts: string[];

  /** Whether to run recursively after changes are detected */
  recursive?: boolean;

  /** Maximum recursion depth (default: 10, use "∞" for infinite) */
  max_recursion_depth?: number | "∞";
}

/**
 * Parsed .ai file structure
 */
export interface AiFile {
  /** Absolute path to the .ai file */
  path: string;

  /** Parsed frontmatter */
  frontmatter: AiFileFrontmatter;

  /** Markdown content (the specification) */
  content: string;

  /** Content hash for change detection */
  hash: string;
}

/**
 * State tracking for a single .ai file
 */
export interface AiFileState {
  /** Content hash from last generation */
  lastHash: string;

  /** Full content from last generation (for diffing) */
  lastContent: string;

  /** Timestamp of last generation */
  lastGenerated: string;

  /** List of artifact files from last generation */
  artifacts: string[];
}

/**
 * Global state file structure (.dotai/state.json)
 */
export interface DotAiState {
  /** Map of .ai file path -> state */
  files: Record<string, AiFileState>;

  /** Version of state file format */
  version: string;
}

/**
 * Global configuration (.dotai/config.json)
 */
export interface DotAiConfig {
  /** Default agent if not specified in .ai file */
  defaultAgent: string;

  /** Path to state file (relative to .dotai/) */
  stateFile: string;
}

/**
 * Result of artifact generation
 */
export interface GenerationResult {
  /** Whether generation succeeded */
  success: boolean;

  /** List of files created/modified */
  artifacts: string[];

  /** Error message if failed */
  error?: string;

  /** Raw output from agent */
  rawOutput?: string;
}

/**
 * Options for agent invocation
 */
export interface InvokeOptions {
  /** Working directory */
  cwd: string;

  /** Agent-specific configuration */
  agentConfig?: Record<string, unknown>;

  /** List of existing artifact paths (for context) */
  existingArtifacts?: string[];
}

/**
 * Abstract coding agent interface
 */
export interface CodingAgent {
  /** Agent name (claude-code, cursor, etc.) */
  name: string;

  /**
   * Invoke the agent with a prompt
   */
  invoke(prompt: string, options: InvokeOptions): Promise<GenerationResult>;

  /**
   * Parse agent output to extract generated artifacts
   */
  parseOutput(rawOutput: string): string[];
}

/**
 * Change detection result
 */
export interface ChangeDetectionResult {
  /** .ai files that changed */
  changed: AiFile[];

  /** .ai files that are new */
  new: AiFile[];

  /** .ai files that are unchanged */
  unchanged: AiFile[];
}

// Export OutputWriter types
export * from './output-writer';
