import { describe, it, expect } from 'vitest';
import {
  getDotAiDir,
  getStateFilePath,
  getConfigFilePath,
  getGitignorePath,
  createEmptyState,
  validateState,
  validateFileState,
  validateConfig,
  parseJSON,
  serializeJSON,
  getFileState,
  updateFileState,
  removeFileState,
  isVersionCompatible,
  STATE_VERSION,
  DEFAULT_CONFIG,
} from './state-core';
import { isOk, isErr } from '../utils/result';

describe('State Core (Pure Functions)', () => {
  describe('Path functions', () => {
    it('getDotAiDir returns correct path', () => {
      expect(getDotAiDir('/workspace/project')).toBe('/workspace/project/.dotai');
      expect(getDotAiDir('/home/user')).toBe('/home/user/.dotai');
    });

    it('getStateFilePath returns correct path', () => {
      expect(getStateFilePath('/workspace/project')).toBe('/workspace/project/.dotai/state.json');
    });

    it('getConfigFilePath returns correct path', () => {
      expect(getConfigFilePath('/workspace/project')).toBe('/workspace/project/.dotai/config.json');
    });

    it('getGitignorePath returns correct path', () => {
      expect(getGitignorePath('/workspace/project')).toBe('/workspace/project/.dotai/.gitignore');
    });
  });

  describe('createEmptyState', () => {
    it('creates valid empty state', () => {
      const state = createEmptyState();
      expect(state.version).toBe(STATE_VERSION);
      expect(state.files).toEqual({});
    });

    it('creates new object each time', () => {
      const state1 = createEmptyState();
      const state2 = createEmptyState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('validateState', () => {
    it('validates correct state', () => {
      const data = {
        version: '0.1.0',
        files: {
          '/test/file.ai': {
            lastHash: 'hash123',
            lastContent: 'content',
            lastGenerated: '2024-01-01T00:00:00.000Z',
            artifacts: ['file1.ts', 'file2.ts'],
          },
        },
      };

      const result = validateState(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(data);
      }
    });

    it('validates empty state', () => {
      const data = {
        version: '0.1.0',
        files: {},
      };

      const result = validateState(data);
      expect(isOk(result)).toBe(true);
    });

    it('rejects non-object', () => {
      const result = validateState('not an object');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });

    it('rejects null', () => {
      const result = validateState(null);
      expect(isErr(result)).toBe(true);
    });

    it('rejects missing version', () => {
      const data = { files: {} };
      const result = validateState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects non-string version', () => {
      const data = { version: 123, files: {} };
      const result = validateState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects missing files', () => {
      const data = { version: '0.1.0' };
      const result = validateState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects non-object files', () => {
      const data = { version: '0.1.0', files: 'not an object' };
      const result = validateState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects invalid file state', () => {
      const data = {
        version: '0.1.0',
        files: {
          '/test/file.ai': {
            lastHash: 123, // Should be string
          },
        },
      };

      const result = validateState(data);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('validateFileState', () => {
    it('validates correct file state', () => {
      const data = {
        lastHash: 'hash123',
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: ['file1.ts'],
      };

      const result = validateFileState(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(data);
      }
    });

    it('validates empty artifacts', () => {
      const data = {
        lastHash: 'hash123',
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: [],
      };

      const result = validateFileState(data);
      expect(isOk(result)).toBe(true);
    });

    it('rejects non-object', () => {
      const result = validateFileState('not an object');
      expect(isErr(result)).toBe(true);
    });

    it('rejects null', () => {
      const result = validateFileState(null);
      expect(isErr(result)).toBe(true);
    });

    it('rejects missing lastHash', () => {
      const data = {
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: [],
      };
      const result = validateFileState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects non-string lastHash', () => {
      const data = {
        lastHash: 123,
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: [],
      };
      const result = validateFileState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects missing lastContent', () => {
      const data = {
        lastHash: 'hash',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: [],
      };
      const result = validateFileState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects missing lastGenerated', () => {
      const data = {
        lastHash: 'hash',
        lastContent: 'content',
        artifacts: [],
      };
      const result = validateFileState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects non-array artifacts', () => {
      const data = {
        lastHash: 'hash',
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: 'not an array',
      };
      const result = validateFileState(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects artifacts with non-string elements', () => {
      const data = {
        lastHash: 'hash',
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: ['file1.ts', 123, 'file2.ts'],
      };
      const result = validateFileState(data);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('validates correct config', () => {
      const data = {
        defaultAgent: 'claude-code',
        stateFile: 'state.json',
      };

      const result = validateConfig(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(data);
      }
    });

    it('validates default config constant', () => {
      const result = validateConfig(DEFAULT_CONFIG);
      expect(isOk(result)).toBe(true);
    });

    it('rejects non-object', () => {
      const result = validateConfig('not an object');
      expect(isErr(result)).toBe(true);
    });

    it('rejects null', () => {
      const result = validateConfig(null);
      expect(isErr(result)).toBe(true);
    });

    it('rejects missing defaultAgent', () => {
      const data = { stateFile: 'state.json' };
      const result = validateConfig(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects non-string defaultAgent', () => {
      const data = { defaultAgent: 123, stateFile: 'state.json' };
      const result = validateConfig(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects missing stateFile', () => {
      const data = { defaultAgent: 'claude-code' };
      const result = validateConfig(data);
      expect(isErr(result)).toBe(true);
    });

    it('rejects non-string stateFile', () => {
      const data = { defaultAgent: 'claude-code', stateFile: 123 };
      const result = validateConfig(data);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('parseJSON', () => {
    it('parses valid JSON', () => {
      const json = '{"key": "value", "number": 123}';
      const result = parseJSON<{ key: string; number: number }>(json);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.key).toBe('value');
        expect(result.value.number).toBe(123);
      }
    });

    it('parses empty object', () => {
      const result = parseJSON('{}');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({});
      }
    });

    it('parses arrays', () => {
      const result = parseJSON<number[]>('[1, 2, 3]');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });

    it('returns error for invalid JSON', () => {
      const result = parseJSON('{invalid json}');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('parse');
        expect(result.error.code).toBe('INVALID_CONTENT');
      }
    });

    it('returns error for truncated JSON', () => {
      const result = parseJSON('{"key": ');
      expect(isErr(result)).toBe(true);
    });

    it('uses context in error message', () => {
      const result = parseJSON('invalid', 'config file');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('config file');
      }
    });
  });

  describe('serializeJSON', () => {
    it('serializes object', () => {
      const data = { key: 'value', number: 123 };
      const result = serializeJSON(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const parsed = JSON.parse(result.value);
        expect(parsed).toEqual(data);
      }
    });

    it('formats with 2-space indentation', () => {
      const data = { key: 'value' };
      const result = serializeJSON(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('  ');
      }
    });

    it('serializes arrays', () => {
      const data = [1, 2, 3];
      const result = serializeJSON(data);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(JSON.parse(result.value)).toEqual(data);
      }
    });

    it('serializes null', () => {
      const result = serializeJSON(null);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('null');
      }
    });

    it('handles circular references with error', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      const result = serializeJSON(circular);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('getFileState', () => {
    it('returns file state if exists', () => {
      const state = {
        version: '0.1.0',
        files: {
          '/test/file.ai': {
            lastHash: 'hash123',
            lastContent: 'content',
            lastGenerated: '2024-01-01T00:00:00.000Z',
            artifacts: [],
          },
        },
      };

      const fileState = getFileState(state, '/test/file.ai');
      expect(fileState).toBeDefined();
      expect(fileState?.lastHash).toBe('hash123');
    });

    it('returns undefined if file not in state', () => {
      const state = {
        version: '0.1.0',
        files: {},
      };

      const fileState = getFileState(state, '/test/file.ai');
      expect(fileState).toBeUndefined();
    });
  });

  describe('updateFileState', () => {
    it('adds new file state', () => {
      const state = {
        version: '0.1.0',
        files: {},
      };

      const newFileState = {
        lastHash: 'hash123',
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: ['file.ts'],
      };

      const updated = updateFileState(state, '/test/file.ai', newFileState);

      expect(updated.files['/test/file.ai']).toEqual(newFileState);
      expect(updated.version).toBe('0.1.0');
    });

    it('updates existing file state', () => {
      const state = {
        version: '0.1.0',
        files: {
          '/test/file.ai': {
            lastHash: 'oldHash',
            lastContent: 'old',
            lastGenerated: '2024-01-01T00:00:00.000Z',
            artifacts: [],
          },
        },
      };

      const newFileState = {
        lastHash: 'newHash',
        lastContent: 'new',
        lastGenerated: '2024-01-02T00:00:00.000Z',
        artifacts: ['new.ts'],
      };

      const updated = updateFileState(state, '/test/file.ai', newFileState);

      expect(updated.files['/test/file.ai']).toEqual(newFileState);
    });

    it('preserves other file states', () => {
      const state = {
        version: '0.1.0',
        files: {
          '/test/file1.ai': {
            lastHash: 'hash1',
            lastContent: 'content1',
            lastGenerated: '2024-01-01T00:00:00.000Z',
            artifacts: [],
          },
        },
      };

      const newFileState = {
        lastHash: 'hash2',
        lastContent: 'content2',
        lastGenerated: '2024-01-02T00:00:00.000Z',
        artifacts: [],
      };

      const updated = updateFileState(state, '/test/file2.ai', newFileState);

      expect(updated.files['/test/file1.ai']).toEqual(state.files['/test/file1.ai']);
      expect(updated.files['/test/file2.ai']).toEqual(newFileState);
    });

    it('returns new state object (immutable)', () => {
      const state = {
        version: '0.1.0',
        files: {},
      };

      const newFileState = {
        lastHash: 'hash',
        lastContent: 'content',
        lastGenerated: '2024-01-01T00:00:00.000Z',
        artifacts: [],
      };

      const updated = updateFileState(state, '/test/file.ai', newFileState);

      expect(updated).not.toBe(state);
      expect(updated.files).not.toBe(state.files);
      expect(state.files).toEqual({}); // Original unchanged
    });
  });

  describe('removeFileState', () => {
    it('removes existing file state', () => {
      const state = {
        version: '0.1.0',
        files: {
          '/test/file.ai': {
            lastHash: 'hash',
            lastContent: 'content',
            lastGenerated: '2024-01-01T00:00:00.000Z',
            artifacts: [],
          },
        },
      };

      const updated = removeFileState(state, '/test/file.ai');

      expect(updated.files['/test/file.ai']).toBeUndefined();
      expect(Object.keys(updated.files)).toHaveLength(0);
    });

    it('preserves other file states', () => {
      const state = {
        version: '0.1.0',
        files: {
          '/test/file1.ai': {
            lastHash: 'hash1',
            lastContent: 'content1',
            lastGenerated: '2024-01-01T00:00:00.000Z',
            artifacts: [],
          },
          '/test/file2.ai': {
            lastHash: 'hash2',
            lastContent: 'content2',
            lastGenerated: '2024-01-02T00:00:00.000Z',
            artifacts: [],
          },
        },
      };

      const updated = removeFileState(state, '/test/file1.ai');

      expect(updated.files['/test/file1.ai']).toBeUndefined();
      expect(updated.files['/test/file2.ai']).toEqual(state.files['/test/file2.ai']);
    });

    it('handles non-existent file gracefully', () => {
      const state = {
        version: '0.1.0',
        files: {},
      };

      const updated = removeFileState(state, '/test/nonexistent.ai');

      expect(updated.files).toEqual({});
    });

    it('returns new state object (immutable)', () => {
      const state = {
        version: '0.1.0',
        files: {
          '/test/file.ai': {
            lastHash: 'hash',
            lastContent: 'content',
            lastGenerated: '2024-01-01T00:00:00.000Z',
            artifacts: [],
          },
        },
      };

      const updated = removeFileState(state, '/test/file.ai');

      expect(updated).not.toBe(state);
      expect(updated.files).not.toBe(state.files);
      expect(state.files['/test/file.ai']).toBeDefined(); // Original unchanged
    });
  });

  describe('isVersionCompatible', () => {
    it('returns true for matching versions', () => {
      expect(isVersionCompatible('0.1.0', '0.1.0')).toBe(true);
    });

    it('returns false for different versions', () => {
      expect(isVersionCompatible('0.1.0', '0.2.0')).toBe(false);
      expect(isVersionCompatible('0.2.0', '0.1.0')).toBe(false);
    });

    it('uses STATE_VERSION as default', () => {
      expect(isVersionCompatible(STATE_VERSION)).toBe(true);
      expect(isVersionCompatible('0.0.0')).toBe(false);
    });
  });
});
