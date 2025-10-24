import { spawn } from 'child_process';
import chalk from 'chalk';
import { CodingAgent, GenerationResult, InvokeOptions } from '../types';
import { Result, Ok, Err } from '../utils/result';
import { ValidationError } from '../types/errors';

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
 * Security: Whitelisted permission modes
 */
const ALLOWED_PERMISSION_MODES = ['acceptEdits', 'bypassPermissions', 'default', 'plan'];

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
 * Security: Validate permission mode
 */
function validatePermissionMode(mode: string): Result<string, ValidationError> {
  if (!ALLOWED_PERMISSION_MODES.includes(mode)) {
    return new Err(
      new ValidationError(
        `Invalid permission_mode: "${mode}". Allowed modes: ${ALLOWED_PERMISSION_MODES.join(', ')}`,
        'INVALID_PERMISSION_MODE',
        { mode, allowedModes: ALLOWED_PERMISSION_MODES }
      )
    );
  }
  return new Ok(mode);
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

  private async runClaudeCode(prompt: string, options: InvokeOptions): Promise<string> {
    return new Promise((resolve, reject) => {
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
          const prompt = sanitizeSystemPrompt(String(config.appendSystemPrompt));
          args.push('--append-system-prompt', prompt);
        }

        // Note: --verbose is already added by default for stream-json
        // This is kept for backward compatibility if we change output format

        // Security: Validate fallback model name against whitelist
        if (config.fallbackModel) {
          const modelResult = validateModel(String(config.fallbackModel));
          if (modelResult.ok === false) {
            throw new Error(modelResult.error.message);
          }
          args.push('--fallback-model', modelResult.value);
        }

        // Note: permission_mode is deprecated in favor of --dangerously-skip-permissions
        // which provides full unattended execution for headless mode
      }

      const proc = spawn('claude', args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let lastResult = '';
      const toolMap = new Map<string, string>(); // Map tool_use_id to tool name

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
                  // Display text content without indentation
                  process.stdout.write(`${content.text}\n\n`);
                } else if (content.type === 'tool_use') {
                  // Show tool name in bold with details
                  const toolName = content.name;
                  const toolId = content.id;
                  const input = content.input || {};

                  // Track tool ID for matching with results
                  if (toolId) {
                    toolMap.set(toolId, toolName);
                  }

                  if (toolName === 'Read' && input.file_path) {
                    process.stdout.write(chalk.bold('Read') + ` ${input.file_path}\n`);
                  } else if (toolName === 'Write' && input.file_path) {
                    process.stdout.write(chalk.bold('Write') + ` ${input.file_path}\n`);
                  } else if (toolName === 'Edit' && input.file_path) {
                    process.stdout.write(chalk.bold('Edit') + ` ${input.file_path}\n`);
                  } else if (toolName === 'Bash' && input.command) {
                    process.stdout.write(chalk.bold('Bash') + ` ${input.command}\n`);
                  } else if (toolName === 'Glob' && input.pattern) {
                    process.stdout.write(chalk.bold('Glob') + ` ${input.pattern}\n`);
                  } else if (toolName === 'Grep' && input.pattern) {
                    process.stdout.write(chalk.bold('Grep') + ` ${input.pattern}\n`);
                  } else {
                    // Other tools - just show name
                    process.stdout.write(chalk.bold(toolName) + '\n');
                  }
                } else if (content.type === 'tool_result') {
                  // Show tool results with label from tool map
                  const toolResult = content.content;
                  const toolUseId = content.tool_use_id;

                  if (toolResult && typeof toolResult === 'string' && toolResult.trim()) {
                    // Show first 5 lines of tool output
                    const lines = toolResult.split('\n');
                    const firstFiveLines = lines.slice(0, 5).join('\n');
                    const truncated = lines.length > 5
                      ? firstFiveLines + '\n...'
                      : firstFiveLines;

                    // Look up tool name from map
                    const toolName = toolUseId ? toolMap.get(toolUseId) : null;
                    if (toolName) {
                      process.stdout.write(chalk.gray(`↳ ${toolName}: `) + chalk.gray(truncated) + '\n\n');
                    } else {
                      process.stdout.write(chalk.gray(truncated) + '\n\n');
                    }
                  }
                }
              }
            } else if (json.type === 'user' && json.message?.content) {
              // User messages (if any)
              for (const content of json.message.content) {
                if (content.type === 'text' && content.text) {
                  process.stdout.write(chalk.cyan('User: ') + content.text + '\n\n');
                } else if (content.type === 'tool_result') {
                  // Tool result from user side
                  if (content.content) {
                    const result = String(content.content);
                    const lines = result.split('\n');
                    const firstFiveLines = lines.slice(0, 5).join('\n');
                    const truncated = lines.length > 5
                      ? firstFiveLines + '\n...'
                      : firstFiveLines;
                    process.stdout.write(chalk.gray(truncated) + '\n\n');
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
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude Code exited with code ${code}\n${stderr}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to spawn claude: ${error.message}`));
      });
    });
  }
}
