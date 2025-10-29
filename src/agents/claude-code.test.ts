import { describe, it, expect } from 'vitest';
import { buildClaudeArguments } from './claude-code';
import type { InvokeOptions } from '../types';

describe('buildClaudeArguments', () => {
  const basePrompt = 'Test prompt';
  const baseCwd = '/tmp/test';

  describe('Base Arguments', () => {
    it('should include base arguments without any options', () => {
      const options: InvokeOptions = { cwd: baseCwd };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('-p');
      expect(args).toContain('Test prompt');
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
      expect(args).toContain('--verbose');
      expect(args).toContain('--dangerously-skip-permissions');
    });

    it('should place prompt as second argument after -p flag', () => {
      const options: InvokeOptions = { cwd: baseCwd };
      const args = buildClaudeArguments('My custom prompt', options);

      expect(args[0]).toBe('-p');
      expect(args[1]).toBe('My custom prompt');
    });
  });

  describe('Agent Configuration - Model', () => {
    it('should add model flag when provided in agentConfig', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { model: 'claude-sonnet-4' }
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--model');
      expect(args).toContain('claude-sonnet-4');
    });

    it('should validate model against whitelist', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { model: 'invalid-model' }
      };

      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/Invalid model/);
    });

    it('should accept short model aliases', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { model: 'sonnet' }
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--model');
      expect(args).toContain('sonnet');
    });

    it('should add fallback-model when provided', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: {
          model: 'claude-sonnet-4',
          fallbackModel: 'claude-haiku-4'
        }
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--model');
      expect(args).toContain('claude-sonnet-4');
      expect(args).toContain('--fallback-model');
      expect(args).toContain('claude-haiku-4');
    });
  });

  describe('Agent Configuration - Tools', () => {
    it('should add allowedTools when provided', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { allowedTools: 'Read,Write,Edit' }
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--allowedTools');
      expect(args).toContain('Read,Write,Edit');
    });

    it('should add disallowedTools when provided', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { disallowedTools: 'Bash,WebSearch' }
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--disallowedTools');
      expect(args).toContain('Bash,WebSearch');
    });

    it('should validate tool list format', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { allowedTools: 'Tool;WithSemicolon' } // Invalid: contains shell metacharacter
      };

      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/Invalid tool list/);
    });

    it('should handle tools with MCP prefix', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { allowedTools: 'mcp__custom_tool,Read' }
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--allowedTools');
      expect(args).toContain('mcp__custom_tool,Read');
    });
  });

  describe('Agent Configuration - System Prompt', () => {
    it('should add append-system-prompt when provided', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { appendSystemPrompt: 'Follow clean code principles' }
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--append-system-prompt');
      expect(args).toContain('Follow clean code principles');
    });

    it('should sanitize system prompt by removing control characters', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { appendSystemPrompt: 'Test\x00with\x1Fnull' }
      };
      const args = buildClaudeArguments(basePrompt, options);

      const promptIndex = args.indexOf('--append-system-prompt') + 1;
      expect(args[promptIndex]).toBe('Testwithnull'); // Control chars removed
    });
  });

  describe('Flag Forwarding', () => {
    it('should forward flags when provided', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        forwardedFlags: ['--debug', '--timeout=30']
      };
      const args = buildClaudeArguments(basePrompt, options);

      expect(args).toContain('--debug');
      expect(args).toContain('--timeout=30');
    });

    it('should handle empty forwardedFlags array', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        forwardedFlags: []
      };
      const args = buildClaudeArguments(basePrompt, options);

      // Should only contain base args
      expect(args.length).toBeLessThan(10);
    });

    it('should validate forwarded flags', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        forwardedFlags: ['--mcp-config', 'malicious.json'] // Blacklisted flag
      };

      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/cannot be forwarded for security reasons/);
    });

    it('should block dangerous flags: --add-dir', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        forwardedFlags: ['--add-dir', '/etc']
      };

      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/cannot be forwarded/);
    });

    it('should block dangerous flags: --settings', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        forwardedFlags: ['--settings', 'evil.json']
      };

      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/cannot be forwarded/);
    });

    it('should block dangerous flags: --plugin-dir', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        forwardedFlags: ['--plugin-dir', '/tmp/plugins']
      };

      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/cannot be forwarded/);
    });

    it('should validate flag structure and reject shell metacharacters', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        forwardedFlags: ['--flag=$(malicious)']
      };

      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/dangerous characters/);
    });

    it('should append forwarded flags after agentConfig flags', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { model: 'sonnet' },
        forwardedFlags: ['--debug']
      };
      const args = buildClaudeArguments(basePrompt, options);

      const modelIndex = args.indexOf('--model');
      const debugIndex = args.indexOf('--debug');

      expect(modelIndex).toBeGreaterThan(-1);
      expect(debugIndex).toBeGreaterThan(-1);
      expect(debugIndex).toBeGreaterThan(modelIndex); // Forwarded flags come after config
    });
  });

  describe('Combined Options', () => {
    it('should handle all options together', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: {
          model: 'claude-sonnet-4',
          allowedTools: 'Read,Write',
          appendSystemPrompt: 'Be concise'
        },
        forwardedFlags: ['--verbose']
      };
      const args = buildClaudeArguments('Complex prompt', options);

      // Base args
      expect(args).toContain('-p');
      expect(args).toContain('Complex prompt');
      expect(args).toContain('--output-format');

      // Agent config
      expect(args).toContain('--model');
      expect(args).toContain('claude-sonnet-4');
      expect(args).toContain('--allowedTools');
      expect(args).toContain('Read,Write');
      expect(args).toContain('--append-system-prompt');
      expect(args).toContain('Be concise');

      // Forwarded flags (note: --verbose is already in base args, but this tests forwarding)
      expect(args.filter(arg => arg === '--verbose').length).toBeGreaterThanOrEqual(1);
    });

    it('should handle undefined agentConfig and forwardedFlags', () => {
      const options: InvokeOptions = {
        cwd: baseCwd
        // No agentConfig or forwardedFlags
      };
      const args = buildClaudeArguments(basePrompt, options);

      // Should only have base args (6 args: -p, prompt, --output-format, stream-json, --verbose, --dangerously-skip-permissions)
      expect(args.length).toBe(6);
    });
  });

  describe('Argument Order', () => {
    it('should maintain consistent order: base, config, forwarded', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { model: 'sonnet' },
        forwardedFlags: ['--custom']
      };
      const args = buildClaudeArguments(basePrompt, options);

      // Base args come first
      expect(args[0]).toBe('-p');
      expect(args[1]).toBe(basePrompt);
      expect(args[2]).toBe('--output-format');

      // Config args come after base
      const modelIndex = args.indexOf('--model');
      expect(modelIndex).toBeGreaterThan(4); // After base args

      // Forwarded flags come last
      const customIndex = args.indexOf('--custom');
      expect(customIndex).toBeGreaterThan(modelIndex);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompt', () => {
      const options: InvokeOptions = { cwd: baseCwd };
      const args = buildClaudeArguments('', options);

      expect(args[1]).toBe('');
    });

    it('should handle prompt with special characters', () => {
      const options: InvokeOptions = { cwd: baseCwd };
      const args = buildClaudeArguments('Prompt with "quotes" and \nnewlines', options);

      expect(args[1]).toBe('Prompt with "quotes" and \nnewlines');
    });

    it('should handle numeric values in agentConfig', () => {
      const options: InvokeOptions = {
        cwd: baseCwd,
        agentConfig: { model: 123 as any } // Testing type coercion
      };

      // Should convert to string and validate
      expect(() => buildClaudeArguments(basePrompt, options))
        .toThrow(/Invalid model/);
    });
  });
});
