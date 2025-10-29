import { describe, it, expect } from 'vitest';
import {
  validatePathWithinBase,
  parseFileContent,
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
    it('returns plain markdown content as-is', () => {
      const raw = '# Test Content\n\nThis is the body.';
      const result = parseFileContent(raw);
      expect(result).toBe('# Test Content\n\nThis is the body.');
    });

    it('trims leading and trailing whitespace', () => {
      const raw = '  \n\nContent with leading/trailing whitespace\n  \n';
      const result = parseFileContent(raw);
      expect(result).toBe('Content with leading/trailing whitespace');
    });

    it('handles empty content', () => {
      const raw = '   ';
      const result = parseFileContent(raw);
      expect(result).toBe('');
    });

    it('preserves internal whitespace', () => {
      const raw = 'Line 1\n\nLine 2\n\nLine 3';
      const result = parseFileContent(raw);
      expect(result).toBe('Line 1\n\nLine 2\n\nLine 3');
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
