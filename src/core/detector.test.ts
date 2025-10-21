import { describe, it, expect } from 'vitest';
import {
  detectChanges,
  hasChanges,
  getFilesToProcess,
  getChangeSummary,
} from './detector';
import { AiFile, DotAiState, AiFileState } from '../types';

describe('Detector Module (Pure Functions)', () => {
  // Helper to create mock AiFile
  const createAiFile = (path: string, hash: string, content: string = 'test'): AiFile => ({
    path,
    hash,
    content,
    frontmatter: {
      agent: 'test-agent',
      artifacts: [],
    },
  });

  // Helper to create mock state
  const createState = (files: Record<string, Partial<AiFileState>> = {}): DotAiState => {
    const fileStates: Record<string, AiFileState> = {};
    for (const [path, partial] of Object.entries(files)) {
      fileStates[path] = {
        lastHash: partial.lastHash || 'hash123',
        lastContent: partial.lastContent || 'content',
        lastGenerated: partial.lastGenerated || new Date().toISOString(),
        artifacts: partial.artifacts || [],
      };
    }
    return {
      files: fileStates,
      version: '1.0',
    };
  };

  describe('detectChanges', () => {
    it('detects new files with no previous state', () => {
      const aiFiles = [
        createAiFile('/workspace/file1.ai', 'hash1'),
        createAiFile('/workspace/file2.ai', 'hash2'),
      ];
      const state = createState({});

      const result = detectChanges(aiFiles, state);

      expect(result.new).toHaveLength(2);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
      expect(result.new).toEqual(aiFiles);
    });

    it('detects changed files when hash differs', () => {
      const aiFiles = [
        createAiFile('/workspace/file1.ai', 'newHash'),
      ];
      const state = createState({
        '/workspace/file1.ai': { lastHash: 'oldHash' },
      });

      const result = detectChanges(aiFiles, state);

      expect(result.new).toHaveLength(0);
      expect(result.changed).toHaveLength(1);
      expect(result.unchanged).toHaveLength(0);
      expect(result.changed[0]).toEqual(aiFiles[0]);
    });

    it('detects unchanged files when hash matches', () => {
      const aiFiles = [
        createAiFile('/workspace/file1.ai', 'sameHash'),
      ];
      const state = createState({
        '/workspace/file1.ai': { lastHash: 'sameHash' },
      });

      const result = detectChanges(aiFiles, state);

      expect(result.new).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0]).toEqual(aiFiles[0]);
    });

    it('categorizes mixed file states correctly', () => {
      const aiFiles = [
        createAiFile('/workspace/new.ai', 'hash1'),
        createAiFile('/workspace/changed.ai', 'newHash'),
        createAiFile('/workspace/unchanged.ai', 'sameHash'),
      ];
      const state = createState({
        '/workspace/changed.ai': { lastHash: 'oldHash' },
        '/workspace/unchanged.ai': { lastHash: 'sameHash' },
      });

      const result = detectChanges(aiFiles, state);

      expect(result.new).toHaveLength(1);
      expect(result.changed).toHaveLength(1);
      expect(result.unchanged).toHaveLength(1);
      expect(result.new[0].path).toBe('/workspace/new.ai');
      expect(result.changed[0].path).toBe('/workspace/changed.ai');
      expect(result.unchanged[0].path).toBe('/workspace/unchanged.ai');
    });

    it('treats all existing files as changed when force=true', () => {
      const aiFiles = [
        createAiFile('/workspace/unchanged.ai', 'sameHash'),
        createAiFile('/workspace/changed.ai', 'newHash'),
      ];
      const state = createState({
        '/workspace/unchanged.ai': { lastHash: 'sameHash' },
        '/workspace/changed.ai': { lastHash: 'oldHash' },
      });

      const result = detectChanges(aiFiles, state, true);

      expect(result.new).toHaveLength(0);
      expect(result.changed).toHaveLength(2);
      expect(result.unchanged).toHaveLength(0);
    });

    it('treats new files as new even with force=true', () => {
      const aiFiles = [
        createAiFile('/workspace/new.ai', 'hash1'),
      ];
      const state = createState({});

      const result = detectChanges(aiFiles, state, true);

      expect(result.new).toHaveLength(1);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('handles empty file list', () => {
      const aiFiles: AiFile[] = [];
      const state = createState({
        '/workspace/old.ai': { lastHash: 'hash' },
      });

      const result = detectChanges(aiFiles, state);

      expect(result.new).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('handles empty state', () => {
      const aiFiles = [
        createAiFile('/workspace/file1.ai', 'hash1'),
      ];
      const state = createState({});

      const result = detectChanges(aiFiles, state);

      expect(result.new).toHaveLength(1);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('preserves file order in categorization', () => {
      const aiFiles = [
        createAiFile('/workspace/a.ai', 'hash1'),
        createAiFile('/workspace/b.ai', 'hash2'),
        createAiFile('/workspace/c.ai', 'hash3'),
      ];
      const state = createState({});

      const result = detectChanges(aiFiles, state);

      expect(result.new[0].path).toBe('/workspace/a.ai');
      expect(result.new[1].path).toBe('/workspace/b.ai');
      expect(result.new[2].path).toBe('/workspace/c.ai');
    });
  });

  describe('hasChanges', () => {
    it('returns true when there are new files', () => {
      const result = {
        new: [createAiFile('/workspace/new.ai', 'hash')],
        changed: [],
        unchanged: [],
      };

      expect(hasChanges(result)).toBe(true);
    });

    it('returns true when there are changed files', () => {
      const result = {
        new: [],
        changed: [createAiFile('/workspace/changed.ai', 'hash')],
        unchanged: [],
      };

      expect(hasChanges(result)).toBe(true);
    });

    it('returns true when there are both new and changed files', () => {
      const result = {
        new: [createAiFile('/workspace/new.ai', 'hash1')],
        changed: [createAiFile('/workspace/changed.ai', 'hash2')],
        unchanged: [],
      };

      expect(hasChanges(result)).toBe(true);
    });

    it('returns false when there are only unchanged files', () => {
      const result = {
        new: [],
        changed: [],
        unchanged: [createAiFile('/workspace/unchanged.ai', 'hash')],
      };

      expect(hasChanges(result)).toBe(false);
    });

    it('returns false when all arrays are empty', () => {
      const result = {
        new: [],
        changed: [],
        unchanged: [],
      };

      expect(hasChanges(result)).toBe(false);
    });
  });

  describe('getFilesToProcess', () => {
    it('returns only new files when no changes', () => {
      const newFile = createAiFile('/workspace/new.ai', 'hash');
      const result = {
        new: [newFile],
        changed: [],
        unchanged: [],
      };

      const files = getFilesToProcess(result);

      expect(files).toHaveLength(1);
      expect(files[0]).toBe(newFile);
    });

    it('returns only changed files when no new files', () => {
      const changedFile = createAiFile('/workspace/changed.ai', 'hash');
      const result = {
        new: [],
        changed: [changedFile],
        unchanged: [],
      };

      const files = getFilesToProcess(result);

      expect(files).toHaveLength(1);
      expect(files[0]).toBe(changedFile);
    });

    it('returns both new and changed files in correct order', () => {
      const newFile = createAiFile('/workspace/new.ai', 'hash1');
      const changedFile = createAiFile('/workspace/changed.ai', 'hash2');
      const result = {
        new: [newFile],
        changed: [changedFile],
        unchanged: [],
      };

      const files = getFilesToProcess(result);

      expect(files).toHaveLength(2);
      expect(files[0]).toBe(newFile);
      expect(files[1]).toBe(changedFile);
    });

    it('excludes unchanged files', () => {
      const unchangedFile = createAiFile('/workspace/unchanged.ai', 'hash');
      const result = {
        new: [],
        changed: [],
        unchanged: [unchangedFile],
      };

      const files = getFilesToProcess(result);

      expect(files).toHaveLength(0);
    });

    it('returns empty array when no files to process', () => {
      const result = {
        new: [],
        changed: [],
        unchanged: [],
      };

      const files = getFilesToProcess(result);

      expect(files).toHaveLength(0);
    });

    it('preserves order: new files first, then changed', () => {
      const new1 = createAiFile('/workspace/new1.ai', 'hash1');
      const new2 = createAiFile('/workspace/new2.ai', 'hash2');
      const changed1 = createAiFile('/workspace/changed1.ai', 'hash3');
      const changed2 = createAiFile('/workspace/changed2.ai', 'hash4');

      const result = {
        new: [new1, new2],
        changed: [changed1, changed2],
        unchanged: [],
      };

      const files = getFilesToProcess(result);

      expect(files).toEqual([new1, new2, changed1, changed2]);
    });
  });

  describe('getChangeSummary', () => {
    it('returns summary for only new files', () => {
      const result = {
        new: [createAiFile('/workspace/new.ai', 'hash')],
        changed: [],
        unchanged: [],
      };

      const summary = getChangeSummary(result);

      expect(summary).toBe('New: 1 file(s)');
    });

    it('returns summary for only changed files', () => {
      const result = {
        new: [],
        changed: [createAiFile('/workspace/changed.ai', 'hash')],
        unchanged: [],
      };

      const summary = getChangeSummary(result);

      expect(summary).toBe('Changed: 1 file(s)');
    });

    it('returns summary for only unchanged files', () => {
      const result = {
        new: [],
        changed: [],
        unchanged: [createAiFile('/workspace/unchanged.ai', 'hash')],
      };

      const summary = getChangeSummary(result);

      expect(summary).toBe('Unchanged: 1 file(s)');
    });

    it('returns combined summary for all file types', () => {
      const result = {
        new: [createAiFile('/workspace/new.ai', 'hash1')],
        changed: [createAiFile('/workspace/changed.ai', 'hash2')],
        unchanged: [createAiFile('/workspace/unchanged.ai', 'hash3')],
      };

      const summary = getChangeSummary(result);

      expect(summary).toBe('New: 1 file(s), Changed: 1 file(s), Unchanged: 1 file(s)');
    });

    it('returns empty string when no files', () => {
      const result = {
        new: [],
        changed: [],
        unchanged: [],
      };

      const summary = getChangeSummary(result);

      expect(summary).toBe('');
    });

    it('handles multiple files in each category', () => {
      const result = {
        new: [
          createAiFile('/workspace/new1.ai', 'hash1'),
          createAiFile('/workspace/new2.ai', 'hash2'),
          createAiFile('/workspace/new3.ai', 'hash3'),
        ],
        changed: [
          createAiFile('/workspace/changed1.ai', 'hash4'),
          createAiFile('/workspace/changed2.ai', 'hash5'),
        ],
        unchanged: [
          createAiFile('/workspace/unchanged1.ai', 'hash6'),
        ],
      };

      const summary = getChangeSummary(result);

      expect(summary).toBe('New: 3 file(s), Changed: 2 file(s), Unchanged: 1 file(s)');
    });

    it('formats partial results correctly', () => {
      const result1 = {
        new: [createAiFile('/workspace/new.ai', 'hash')],
        changed: [],
        unchanged: [createAiFile('/workspace/unchanged.ai', 'hash')],
      };

      const summary1 = getChangeSummary(result1);
      expect(summary1).toBe('New: 1 file(s), Unchanged: 1 file(s)');

      const result2 = {
        new: [],
        changed: [createAiFile('/workspace/changed.ai', 'hash')],
        unchanged: [createAiFile('/workspace/unchanged.ai', 'hash')],
      };

      const summary2 = getChangeSummary(result2);
      expect(summary2).toBe('Changed: 1 file(s), Unchanged: 1 file(s)');
    });
  });
});
