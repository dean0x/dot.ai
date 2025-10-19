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
      // Parse JSON output from claude-code
      const json = JSON.parse(rawOutput);

      // Extract file paths from the response
      // The exact structure may vary, but typically includes file operations
      const artifacts = new Set<string>();

      // Try different possible locations in the JSON structure
      if (json.result?.files) {
        for (const file of json.result.files) {
          if (typeof file === 'string') {
            artifacts.add(file);
          } else if (file.path) {
            artifacts.add(file.path);
          }
        }
      }

      // Also check for tool results that wrote/edited files
      if (json.result?.toolResults) {
        for (const toolResult of json.result.toolResults) {
          if (toolResult.tool === 'Write' || toolResult.tool === 'Edit') {
            if (toolResult.parameters?.file_path) {
              artifacts.add(toolResult.parameters.file_path);
            }
          }
        }
      }

      return Array.from(artifacts);
    } catch {
      // If JSON parsing fails, return empty array
      // We'll rely on file system scanning as fallback
      return [];
    }
  }

  private async runClaudeCode(prompt: string, options: InvokeOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-p', // Print mode (headless)
        prompt,
        '--output-format', 'json',
        '--no-interactive',
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

        if (config.permission_mode) {
          args.push('--permission-mode', String(config.permission_mode));
        }
      }

      const proc = spawn('claude', args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
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
