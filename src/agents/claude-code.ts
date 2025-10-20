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

      const artifacts = new Set<string>();

      // Extract file paths from the result text
      // Claude-code mentions file paths in the result string
      if (json.result && typeof json.result === 'string') {
        // Match patterns like: "Created file.ts", "file.ts created", "/path/to/file.ts"
        // Look for common file extensions
        const filePattern = /(?:^|\s|`)([A-Za-z0-9_.-]+\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|h|css|scss|html|json|yaml|yml|md|txt|sh))(?:$|\s|`)/g;
        const matches = json.result.matchAll(filePattern);
        for (const match of matches) {
          artifacts.add(match[1]);
        }
      }

      // Also try to extract absolute paths
      if (json.result && typeof json.result === 'string') {
        const absolutePathPattern = /`([^`]+\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|h|css|scss|html|json|yaml|yml|md|txt|sh))`/g;
        const matches = json.result.matchAll(absolutePathPattern);
        for (const match of matches) {
          // Extract just the filename from absolute paths
          const filename = match[1].split('/').pop();
          if (filename) {
            artifacts.add(filename);
          }
        }
      }

      return Array.from(artifacts);
    } catch {
      // If JSON parsing fails, return empty array
      return [];
    }
  }

  private async runClaudeCode(prompt: string, options: InvokeOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-p', // Print mode (headless, already non-interactive)
        prompt,
        '--output-format', 'json',
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
