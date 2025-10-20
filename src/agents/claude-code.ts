import { spawn } from 'child_process';
import { CodingAgent, GenerationResult, InvokeOptions } from '../types';

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
        '--permission-mode', 'acceptEdits', // Auto-accept file edits in headless mode
      ];

      // Add agent-specific configuration
      if (options.agentConfig) {
        const config = options.agentConfig as Record<string, unknown>;

        if (config.model) {
          args.push('--model', String(config.model));
        }

        if (config.allowedTools) {
          args.push('--allowedTools', String(config.allowedTools));
        }

        if (config.disallowedTools) {
          args.push('--disallowedTools', String(config.disallowedTools));
        }

        if (config.appendSystemPrompt) {
          args.push('--append-system-prompt', String(config.appendSystemPrompt));
        }

        // Note: --verbose is already added by default for stream-json
        // This is kept for backward compatibility if we change output format

        if (config.fallbackModel) {
          args.push('--fallback-model', String(config.fallbackModel));
        }

        // Override default permission mode if specified
        if (config.permission_mode) {
          // Remove the default we added above
          const permIdx = args.indexOf('--permission-mode');
          if (permIdx !== -1) {
            args.splice(permIdx, 2);
          }
          args.push('--permission-mode', String(config.permission_mode));
        }
      }

      const proc = spawn('claude', args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let lastResult = '';

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
                  // Display text content with proper formatting
                  process.stdout.write(`  ${content.text}\n\n`);
                } else if (content.type === 'tool_use') {
                  // Show tool usage with details
                  const toolName = content.name;
                  const input = content.input || {};

                  if (toolName === 'Read' && input.file_path) {
                    process.stdout.write(`  📖 Reading: ${input.file_path}\n\n`);
                  } else if (toolName === 'Write' && input.file_path) {
                    process.stdout.write(`  ✏️  Writing: ${input.file_path}\n\n`);
                  } else if (toolName === 'Edit' && input.file_path) {
                    process.stdout.write(`  ✏️  Editing: ${input.file_path}\n\n`);
                  } else if (toolName === 'Bash' && input.command) {
                    // Truncate long commands
                    const cmd = input.command.length > 80
                      ? input.command.substring(0, 77) + '...'
                      : input.command;
                    process.stdout.write(`  💻 Running: ${cmd}\n\n`);
                  } else {
                    // Other tools
                    process.stdout.write(`  🔧 Using: ${toolName}\n\n`);
                  }
                }
              }
            } else if (json.type === 'result') {
              // Final result
              lastResult = json.result || '';
              if (json.is_error) {
                process.stderr.write(`\n  Error: ${lastResult}\n`);
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
