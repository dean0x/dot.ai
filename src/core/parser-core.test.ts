import { describe, it, expect } from 'vitest';
import {
  validatePathWithinBase,
  parseFileContent,
  validateFrontmatter,
  serializeFileContent,
  isAiFile,
  shouldSkipDirectory,
} from './parser-core';
import { isOk, isErr } from '../utils/result';

describe('Parser Core (Pure Functions)', () => {
  describe('validatePathWithinBase', () => {
    const baseDir = '/workspace/project';

    it('accepts valid path within base', () => {
      const result = validatePathWithinBase(`${baseDir}/file.ai`, baseDir);
      expect(isOk(result)).toBe(true);
    });

    it('accepts subdirectory path', () => {
      const result = validatePathWithinBase(`${baseDir}/src/components/Button.ai`, baseDir);
      expect(isOk(result)).toBe(true);
    });

    it('rejects path traversal with ..', () => {
      const result = validatePathWithinBase(`${baseDir}/../../../etc/passwd`, baseDir);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('security');
        expect(result.error.code).toBe('PATH_TRAVERSAL');
      }
    });

    it('rejects absolute path outside base', () => {
      const result = validatePathWithinBase('/etc/passwd', baseDir);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PATH_TRAVERSAL');
      }
    });
  });

  describe('parseFileContent', () => {
    it('parses valid frontmatter and content', () => {
      const raw = `---
agent: claude-code
artifacts: []
---

# Test Content

This is the body.`;

      const result = parseFileContent(raw);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.frontmatter).toEqual({
          agent: 'claude-code',
          artifacts: [],
        });
        expect(result.value.content).toBe('# Test Content\n\nThis is the body.');
      }
    });

    it('handles content without frontmatter', () => {
      const raw = '# Just content\n\nNo frontmatter here.';
      const result = parseFileContent(raw);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.frontmatter).toEqual({});
        expect(result.value.content).toBe(raw);
      }
    });

    it('returns error for malformed YAML', () => {
      const raw = `---
agent: claude-code
invalid yaml: [broken
---

Content`;

      const result = parseFileContent(raw);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('parse');
        expect(result.error.code).toBe('MALFORMED_YAML');
      }
    });

    it('trims content whitespace', () => {
      const raw = `---
agent: test
---

  
Content with leading/trailing whitespace
  
`;

      const result = parseFileContent(raw);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.content).toBe('Content with leading/trailing whitespace');
      }
    });
  });

  describe('validateFrontmatter', () => {
    it('validates correct frontmatter', () => {
      const data = {
        agent: 'claude-code',
        artifacts: ['file1.ts', 'file2.ts'],
        agent_config: { model: 'sonnet' },
      };

      const result = validateFrontmatter(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(data);
      }
    });

    it('validates minimal frontmatter (only agent)', () => {
      const data = { agent: 'claude-code' };
      const result = validateFrontmatter(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.agent).toBe('claude-code');
        expect(result.value.artifacts).toEqual([]);
        expect(result.value.agent_config).toBeUndefined();
      }
    });

    it('defaults artifacts to empty array', () => {
      const data = { agent: 'test' };
      const result = validateFrontmatter(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.artifacts).toEqual([]);
      }
    });

    it('rejects non-object frontmatter', () => {
      const result = validateFrontmatter('not an object');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('validation');
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });

    it('rejects null frontmatter', () => {
      const result = validateFrontmatter(null);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });

    it('rejects missing agent field', () => {
      const result = validateFrontmatter({ artifacts: [] });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('validation');
        expect(result.error.code).toBe('INVALID_AGENT');
      }
    });

    it('rejects empty string agent', () => {
      const result = validateFrontmatter({ agent: '' });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_AGENT');
      }
    });

    it('rejects non-string agent', () => {
      const result = validateFrontmatter({ agent: 123 });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_AGENT');
      }
    });

    it('rejects non-array artifacts', () => {
      const result = validateFrontmatter({
        agent: 'test',
        artifacts: 'not-an-array',
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_ARTIFACTS');
      }
    });

    it('rejects artifacts with non-string elements', () => {
      const result = validateFrontmatter({
        agent: 'test',
        artifacts: ['file1.ts', 123, 'file2.ts'],
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_ARTIFACTS');
      }
    });

    it('rejects non-object agent_config', () => {
      const result = validateFrontmatter({
        agent: 'test',
        agent_config: 'not-an-object',
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });

    it('rejects null agent_config', () => {
      const result = validateFrontmatter({
        agent: 'test',
        agent_config: null,
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });
  });

  describe('serializeFileContent', () => {
    it('serializes frontmatter and content', () => {
      const frontmatter = {
        agent: 'claude-code',
        artifacts: ['file.ts'],
        agent_config: { model: 'sonnet' },
      };
      const content = '# Test\n\nContent here.';

      const result = serializeFileContent(frontmatter, content);

      expect(result).toContain('---');
      expect(result).toContain('agent: claude-code');
      expect(result).toContain('# Test');
      expect(result).toContain('Content here.');
    });

    it('handles empty artifacts', () => {
      const frontmatter = {
        agent: 'test',
        artifacts: [],
      };
      const content = 'Content';

      const result = serializeFileContent(frontmatter, content);

      expect(result).toContain('agent: test');
      expect(result).toContain('artifacts: []');
    });
  });

  describe('isAiFile', () => {
    it('returns true for .ai files', () => {
      expect(isAiFile('test.ai')).toBe(true);
      expect(isAiFile('path/to/file.ai')).toBe(true);
      expect(isAiFile('Button.ai')).toBe(true);
    });

    it('returns false for non-.ai files', () => {
      expect(isAiFile('test.ts')).toBe(false);
      expect(isAiFile('file.txt')).toBe(false);
      expect(isAiFile('README.md')).toBe(false);
      expect(isAiFile('ai')).toBe(false);
      expect(isAiFile('.ai')).toBe(true); // technically valid
    });
  });

  describe('shouldSkipDirectory', () => {
    it('skips .dotai directory', () => {
      expect(shouldSkipDirectory('.dotai')).toBe(true);
    });

    it('skips node_modules directory', () => {
      expect(shouldSkipDirectory('node_modules')).toBe(true);
    });

    it('skips .git directory', () => {
      expect(shouldSkipDirectory('.git')).toBe(true);
    });

    it('does not skip normal directories', () => {
      expect(shouldSkipDirectory('src')).toBe(false);
      expect(shouldSkipDirectory('components')).toBe(false);
      expect(shouldSkipDirectory('test')).toBe(false);
    });
  });
});
