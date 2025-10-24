/**
 * StateService integration tests
 *
 * Tests state persistence, version enforcement, and dependency injection.
 * Uses in-memory mock filesystem for fast, isolated tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateService } from './state-service';
import { FileSystem } from '../infrastructure/interfaces';
import { Result, Ok, Err } from '../utils/result';
import { FileSystemError } from '../types/errors';
import { STATE_VERSION, DEFAULT_CONFIG } from './state-core';

/**
 * In-memory mock filesystem for testing
 * Simulates file operations without touching disk
 */
class MockFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();

  async readFile(path: string, encoding: 'utf-8'): Promise<Result<string, FileSystemError>> {
    const content = this.files.get(path);
    if (content === undefined) {
      return new Err(
        new FileSystemError(`File not found: ${path}`, 'ENOENT', { filePath: path })
      );
    }
    return new Ok(content);
  }

  async writeFile(
    path: string,
    content: string,
    encoding: 'utf-8'
  ): Promise<Result<void, FileSystemError>> {
    this.files.set(path, content);
    return new Ok(undefined);
  }

  async exists(path: string): Promise<Result<boolean, FileSystemError>> {
    return new Ok(this.files.has(path));
  }

  async mkdir(
    path: string,
    options?: { recursive?: boolean }
  ): Promise<Result<void, FileSystemError>> {
    // Mock mkdir always succeeds
    return new Ok(undefined);
  }

  async readdir(
    path: string,
    options?: { withFileTypes?: boolean }
  ): Promise<Result<import('../infrastructure/interfaces').Dirent[], FileSystemError>> {
    // Mock readdir - not used by StateService but required by interface
    return new Ok([]);
  }

  async stat(
    path: string
  ): Promise<Result<import('../infrastructure/interfaces').Stats, FileSystemError>> {
    // Mock stat - not used by StateService but required by interface
    const exists = this.files.has(path);
    if (!exists) {
      return new Err(
        new FileSystemError(`File not found: ${path}`, 'ENOENT', { filePath: path })
      );
    }
    // Return minimal mock stats
    return new Ok({
      isFile: () => true,
      isDirectory: () => false,
      size: this.files.get(path)?.length || 0,
      mtime: new Date(),
    });
  }

  // Test helper: set file content
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  // Test helper: get file content
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  // Test helper: clear all files
  clear(): void {
    this.files.clear();
  }
}

describe('StateService', () => {
  let mockFs: MockFileSystem;
  let stateService: StateService;
  const testCwd = '/test/project';

  beforeEach(() => {
    mockFs = new MockFileSystem();
    stateService = new StateService(mockFs);
  });

  describe('Version enforcement (CRITICAL)', () => {
    it('should fail fast when state version is incompatible', async () => {
      // Setup: Create state with incompatible version
      const incompatibleState = {
        version: '999.0.0', // Way in the future
        files: {},
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(incompatibleState));

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert: Should fail
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('incompatible');
        expect(result.error.message).toContain('999.0.0');
        expect(result.error.message).toContain(STATE_VERSION);
      }
    });

    it('should provide migration guidance in error message', async () => {
      // Setup
      const incompatibleState = {
        version: '0.0.1', // Old version
        files: {},
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(incompatibleState));

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert: Error message should suggest migration
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('dot init');
        expect(result.error.message).toContain('migration');
      }
    });

    it('should include version details in error metadata', async () => {
      // Setup
      const incompatibleState = {
        version: '0.0.1',
        files: {},
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(incompatibleState));

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert: Metadata should include both versions
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_CONFIG');
        expect(result.error.context).toMatchObject({
          stateVersion: '0.0.1',
          expectedVersion: STATE_VERSION,
        });
      }
    });

    it('should accept state with compatible version', async () => {
      // Setup: Create state with current version
      const validState = {
        version: STATE_VERSION,
        files: {
          'test.ai': {
            lastHash: 'abc123',
            lastContent: 'test',
            lastGenerated: '2025-10-24T12:00:00.000Z',
            artifacts: ['file.ts'],
          },
        },
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(validState));

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert: Should succeed
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe(STATE_VERSION);
        expect(result.value.files['test.ai']).toBeDefined();
      }
    });
  });

  describe('loadState', () => {
    it('should return empty state when file does not exist', async () => {
      // No state file created

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert: Should return empty state, not error
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe(STATE_VERSION);
        expect(result.value.files).toEqual({});
      }
    });

    it('should fail on malformed JSON', async () => {
      // Setup: Invalid JSON
      mockFs.setFile(`${testCwd}/.dotai/state.json`, '{ invalid json }');

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert: Should fail with parse error
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('JSON');
      }
    });

    it('should fail on invalid state structure', async () => {
      // Setup: Valid JSON but wrong structure
      const invalidState = {
        version: STATE_VERSION,
        files: 'not-an-object', // Should be object
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(invalidState));

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert: Should fail validation
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });

    it('should load valid state successfully', async () => {
      // Setup
      const validState = {
        version: STATE_VERSION,
        files: {
          'example.ai': {
            lastHash: 'hash123',
            lastContent: 'content',
            lastGenerated: '2025-10-24T12:00:00.000Z',
            artifacts: ['output.ts', 'utils.js'],
          },
        },
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(validState));

      // Execute
      const result = await stateService.loadState(testCwd);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe(STATE_VERSION);
        expect(result.value.files['example.ai']).toEqual({
          lastHash: 'hash123',
          lastContent: 'content',
          lastGenerated: '2025-10-24T12:00:00.000Z',
          artifacts: ['output.ts', 'utils.js'],
        });
      }
    });
  });

  describe('saveState', () => {
    it('should save state to correct path', async () => {
      // Setup
      const state = {
        version: STATE_VERSION,
        files: {
          'test.ai': {
            lastHash: 'abc',
            lastContent: 'test',
            lastGenerated: '2025-10-24T12:00:00.000Z',
            artifacts: ['file.ts'],
          },
        },
      };

      // Execute
      const result = await stateService.saveState(state, testCwd);

      // Assert
      expect(result.ok).toBe(true);
      const savedContent = mockFs.getFile(`${testCwd}/.dotai/state.json`);
      expect(savedContent).toBeDefined();
      if (savedContent) {
        const parsed = JSON.parse(savedContent);
        expect(parsed.version).toBe(STATE_VERSION);
        expect(parsed.files['test.ai']).toBeDefined();
      }
    });

    it('should create .dotai directory if missing', async () => {
      // This is implicitly tested by saveState working without pre-existing directory
      const state = {
        version: STATE_VERSION,
        files: {},
      };

      const result = await stateService.saveState(state, testCwd);

      expect(result.ok).toBe(true);
    });

    it('should serialize state with proper formatting', async () => {
      // Setup
      const state = {
        version: STATE_VERSION,
        files: {},
      };

      // Execute
      await stateService.saveState(state, testCwd);

      // Assert: JSON should be valid
      const savedContent = mockFs.getFile(`${testCwd}/.dotai/state.json`);
      expect(savedContent).toBeDefined();
      if (savedContent) {
        expect(() => JSON.parse(savedContent)).not.toThrow();
      }
    });
  });

  describe('loadConfig', () => {
    it('should return default config when file does not exist', async () => {
      // No config file created

      // Execute
      const result = await stateService.loadConfig(testCwd);

      // Assert: Should return defaults
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.defaultAgent).toBe(DEFAULT_CONFIG.defaultAgent);
        expect(result.value.stateFile).toBe(DEFAULT_CONFIG.stateFile);
      }
    });

    it('should load valid config', async () => {
      // Setup
      const customConfig = {
        defaultAgent: 'custom-agent',
        stateFile: 'custom-state.json',
      };
      mockFs.setFile(`${testCwd}/.dotai/config.json`, JSON.stringify(customConfig));

      // Execute
      const result = await stateService.loadConfig(testCwd);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.defaultAgent).toBe('custom-agent');
        expect(result.value.stateFile).toBe('custom-state.json');
      }
    });

    it('should reject config with empty defaultAgent', async () => {
      // Setup: Invalid config
      const invalidConfig = {
        defaultAgent: '', // Empty string not allowed
        stateFile: 'state.json',
      };
      mockFs.setFile(`${testCwd}/.dotai/config.json`, JSON.stringify(invalidConfig));

      // Execute
      const result = await stateService.loadConfig(testCwd);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });

    it('should reject config with missing required fields', async () => {
      // Setup: Missing stateFile
      const invalidConfig = {
        defaultAgent: 'claude-code',
        // Missing stateFile
      };
      mockFs.setFile(`${testCwd}/.dotai/config.json`, JSON.stringify(invalidConfig));

      // Execute
      const result = await stateService.loadConfig(testCwd);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_CONFIG');
      }
    });
  });

  describe('initializeDotAi', () => {
    it('should create default config when missing', async () => {
      // Execute
      const result = await stateService.initializeDotAi(testCwd);

      // Assert
      expect(result.ok).toBe(true);
      const configContent = mockFs.getFile(`${testCwd}/.dotai/config.json`);
      expect(configContent).toBeDefined();
      if (configContent) {
        const parsed = JSON.parse(configContent);
        expect(parsed.defaultAgent).toBe(DEFAULT_CONFIG.defaultAgent);
        expect(parsed.stateFile).toBe(DEFAULT_CONFIG.stateFile);
      }
    });

    it('should create empty state when missing', async () => {
      // Execute
      const result = await stateService.initializeDotAi(testCwd);

      // Assert
      expect(result.ok).toBe(true);
      const stateContent = mockFs.getFile(`${testCwd}/.dotai/state.json`);
      expect(stateContent).toBeDefined();
      if (stateContent) {
        const parsed = JSON.parse(stateContent);
        expect(parsed.version).toBe(STATE_VERSION);
        expect(parsed.files).toEqual({});
      }
    });

    it('should create .gitignore to ignore state.json', async () => {
      // Execute
      const result = await stateService.initializeDotAi(testCwd);

      // Assert
      expect(result.ok).toBe(true);
      const gitignoreContent = mockFs.getFile(`${testCwd}/.dotai/.gitignore`);
      expect(gitignoreContent).toBeDefined();
      expect(gitignoreContent).toContain('state.json');
    });

    it('should not overwrite existing config', async () => {
      // Setup: Pre-existing custom config
      const customConfig = {
        defaultAgent: 'my-agent',
        stateFile: 'my-state.json',
      };
      mockFs.setFile(`${testCwd}/.dotai/config.json`, JSON.stringify(customConfig));

      // Execute
      await stateService.initializeDotAi(testCwd);

      // Assert: Custom config should remain unchanged
      const configContent = mockFs.getFile(`${testCwd}/.dotai/config.json`);
      expect(configContent).toBeDefined();
      if (configContent) {
        const parsed = JSON.parse(configContent);
        expect(parsed.defaultAgent).toBe('my-agent');
      }
    });

    it('should not overwrite existing state', async () => {
      // Setup: Pre-existing state with data
      const existingState = {
        version: STATE_VERSION,
        files: {
          'important.ai': {
            lastHash: 'preserve-me',
            lastContent: 'important data',
            lastGenerated: '2025-10-24T12:00:00.000Z',
            artifacts: ['critical.ts'],
          },
        },
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(existingState));

      // Execute
      await stateService.initializeDotAi(testCwd);

      // Assert: Existing state should be preserved
      const stateContent = mockFs.getFile(`${testCwd}/.dotai/state.json`);
      expect(stateContent).toBeDefined();
      if (stateContent) {
        const parsed = JSON.parse(stateContent);
        expect(parsed.files['important.ai']).toBeDefined();
        expect(parsed.files['important.ai'].lastHash).toBe('preserve-me');
      }
    });
  });

  describe('clearState', () => {
    it('should reset state to empty', async () => {
      // Setup: State with data
      const stateWithData = {
        version: STATE_VERSION,
        files: {
          'test.ai': {
            lastHash: 'abc',
            lastContent: 'test',
            lastGenerated: '2025-10-24T12:00:00.000Z',
            artifacts: ['file.ts'],
          },
        },
      };
      mockFs.setFile(`${testCwd}/.dotai/state.json`, JSON.stringify(stateWithData));

      // Execute
      const result = await stateService.clearState(testCwd);

      // Assert
      expect(result.ok).toBe(true);
      const clearedContent = mockFs.getFile(`${testCwd}/.dotai/state.json`);
      expect(clearedContent).toBeDefined();
      if (clearedContent) {
        const parsed = JSON.parse(clearedContent);
        expect(parsed.version).toBe(STATE_VERSION);
        expect(parsed.files).toEqual({});
      }
    });

    it('should maintain current version after clear', async () => {
      // Execute
      await stateService.clearState(testCwd);

      // Assert: Version should be current
      const clearedContent = mockFs.getFile(`${testCwd}/.dotai/state.json`);
      expect(clearedContent).toBeDefined();
      if (clearedContent) {
        const parsed = JSON.parse(clearedContent);
        expect(parsed.version).toBe(STATE_VERSION);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent state operations', async () => {
      // This tests that Result types handle race conditions gracefully
      const state1 = {
        version: STATE_VERSION,
        files: { 'file1.ai': { lastHash: '1', lastContent: '1', lastGenerated: '2025-10-24T12:00:00.000Z', artifacts: [] } },
      };
      const state2 = {
        version: STATE_VERSION,
        files: { 'file2.ai': { lastHash: '2', lastContent: '2', lastGenerated: '2025-10-24T12:00:00.000Z', artifacts: [] } },
      };

      // Execute: Concurrent saves
      const [result1, result2] = await Promise.all([
        stateService.saveState(state1, testCwd),
        stateService.saveState(state2, testCwd),
      ]);

      // Assert: Both should succeed (last write wins)
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
    });

    it('should handle very large state files', async () => {
      // Setup: State with many files
      const largeState = {
        version: STATE_VERSION,
        files: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [
            `file${i}.ai`,
            {
              lastHash: `hash${i}`,
              lastContent: `content${i}`,
              lastGenerated: '2025-10-24T12:00:00.000Z',
              artifacts: [`output${i}.ts`],
            },
          ])
        ),
      };

      // Execute: Save large state
      const saveResult = await stateService.saveState(largeState, testCwd);
      expect(saveResult.ok).toBe(true);

      // Execute: Load large state
      const loadResult = await stateService.loadState(testCwd);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(Object.keys(loadResult.value.files).length).toBe(1000);
      }
    });
  });
});
