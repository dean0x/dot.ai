/**
 * Schema validation tests
 *
 * Tests runtime validation for all Zod schemas, with emphasis on
 * security-critical artifact filename validation.
 */

import { describe, it, expect } from 'vitest';
import {
  ArtifactFilenameSchema,
  DotAiStateSchema,
  DotAiConfigSchema,
  AiFileStateSchema,
} from './schemas';

describe('ArtifactFilenameSchema', () => {
  describe('Valid filenames', () => {
    it('should accept simple alphanumeric filenames', () => {
      expect(ArtifactFilenameSchema.safeParse('file.ts').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('component.tsx').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('utils.js').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('config.json').success).toBe(true);
    });

    it('should accept filenames with hyphens', () => {
      expect(ArtifactFilenameSchema.safeParse('my-component.tsx').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('user-profile-card.js').success).toBe(true);
    });

    it('should accept filenames with underscores', () => {
      expect(ArtifactFilenameSchema.safeParse('my_utils.ts').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('user_profile_card.js').success).toBe(true);
    });

    it('should accept filenames with dots', () => {
      expect(ArtifactFilenameSchema.safeParse('utils.v2.js').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('config.test.ts').success).toBe(true);
    });

    it('should accept mixed case filenames', () => {
      expect(ArtifactFilenameSchema.safeParse('MyComponent.tsx').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('UserProfileCard.js').success).toBe(true);
    });

    it('should accept files without extensions', () => {
      expect(ArtifactFilenameSchema.safeParse('Makefile').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('README').success).toBe(true);
    });
  });

  describe('Security: Path traversal attacks', () => {
    it('should block relative path traversal', () => {
      expect(ArtifactFilenameSchema.safeParse('../file.ts').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('../../file.ts').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('../../../etc/passwd').success).toBe(false);
    });

    it('should block directory separators', () => {
      expect(ArtifactFilenameSchema.safeParse('/etc/passwd').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('dir/file.ts').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('path/to/file.ts').success).toBe(false);
    });

    it('should block backslash directory separators (Windows)', () => {
      expect(ArtifactFilenameSchema.safeParse('C:\\Windows\\System32').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('dir\\file.ts').success).toBe(false);
    });
  });

  describe('Security: Command injection attacks', () => {
    it('should block semicolon command separators', () => {
      expect(ArtifactFilenameSchema.safeParse('file.ts;rm -rf /').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('file;cmd').success).toBe(false);
    });

    it('should block pipe operators', () => {
      expect(ArtifactFilenameSchema.safeParse('file.ts|pipe').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('file|curl malicious.com').success).toBe(false);
    });

    it('should block ampersand operators', () => {
      expect(ArtifactFilenameSchema.safeParse('file.ts&background').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('file&&cmd').success).toBe(false);
    });

    it('should block dollar sign command substitution', () => {
      expect(ArtifactFilenameSchema.safeParse('file$(whoami).txt').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('file$VAR.txt').success).toBe(false);
    });

    it('should block backtick command substitution', () => {
      expect(ArtifactFilenameSchema.safeParse('file`cmd`.txt').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('`curl evil.com`').success).toBe(false);
    });

    it('should block angle brackets (redirects)', () => {
      expect(ArtifactFilenameSchema.safeParse('file>output.txt').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('file<input.txt').success).toBe(false);
    });
  });

  describe('Security: Special characters', () => {
    it('should block null bytes', () => {
      expect(ArtifactFilenameSchema.safeParse('file\x00.txt').success).toBe(false);
    });

    it('should block newlines', () => {
      expect(ArtifactFilenameSchema.safeParse('file\n.txt').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('file\r\n.txt').success).toBe(false);
    });

    it('should block tabs', () => {
      expect(ArtifactFilenameSchema.safeParse('file\t.txt').success).toBe(false);
    });

    it('should block spaces', () => {
      expect(ArtifactFilenameSchema.safeParse('my file.txt').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse(' file.txt').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('file.txt ').success).toBe(false);
    });

    it('should block special shell characters', () => {
      expect(ArtifactFilenameSchema.safeParse('file*.txt').success).toBe(false); // glob
      expect(ArtifactFilenameSchema.safeParse('file?.txt').success).toBe(false); // glob
      expect(ArtifactFilenameSchema.safeParse('file[0-9].txt').success).toBe(false); // glob
      expect(ArtifactFilenameSchema.safeParse('file#comment').success).toBe(false); // comment
      expect(ArtifactFilenameSchema.safeParse('file@host').success).toBe(false); // at sign
    });

    it('should block quotes', () => {
      expect(ArtifactFilenameSchema.safeParse('file"name".txt').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse("file'name'.txt").success).toBe(false);
    });

    it('should block parentheses', () => {
      expect(ArtifactFilenameSchema.safeParse('file(copy).txt').success).toBe(false);
    });

    it('should block colons', () => {
      expect(ArtifactFilenameSchema.safeParse('file:metadata.txt').success).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should reject empty strings', () => {
      expect(ArtifactFilenameSchema.safeParse('').success).toBe(false);
    });

    it('should reject whitespace-only strings', () => {
      expect(ArtifactFilenameSchema.safeParse('   ').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('\t\n').success).toBe(false);
    });

    it('should reject path traversal dot patterns', () => {
      // Single dots like ".gitignore" are valid, but ".." and "..." are path traversal
      expect(ArtifactFilenameSchema.safeParse('..').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('...').success).toBe(false);
      expect(ArtifactFilenameSchema.safeParse('....').success).toBe(false);
    });

    it('should accept hidden files (single leading dot)', () => {
      expect(ArtifactFilenameSchema.safeParse('.gitignore').success).toBe(true);
      expect(ArtifactFilenameSchema.safeParse('.env').success).toBe(true);
    });

    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(255) + '.txt';
      expect(ArtifactFilenameSchema.safeParse(longName).success).toBe(true);
    });
  });

  describe('Error messages', () => {
    it('should provide helpful error messages', () => {
      const result = ArtifactFilenameSchema.safeParse('../evil.sh');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('alphanumeric');
      }
    });
  });
});

describe('DotAiStateSchema', () => {
  it('should accept valid state', () => {
    const validState = {
      version: '0.1.0',
      files: {
        'test.ai': {
          lastHash: 'abc123',
          lastContent: 'test content',
          lastGenerated: '2025-10-24T12:00:00.000Z',
          artifacts: ['file.ts', 'utils.js'],
        },
      },
    };
    expect(DotAiStateSchema.safeParse(validState).success).toBe(true);
  });

  it('should reject state without version', () => {
    const invalidState = {
      files: {},
    };
    expect(DotAiStateSchema.safeParse(invalidState).success).toBe(false);
  });

  it('should reject state with invalid files', () => {
    const invalidState = {
      version: '0.1.0',
      files: 'not-an-object',
    };
    expect(DotAiStateSchema.safeParse(invalidState).success).toBe(false);
  });

  it('should accept empty files object', () => {
    const validState = {
      version: '0.1.0',
      files: {},
    };
    expect(DotAiStateSchema.safeParse(validState).success).toBe(true);
  });
});

describe('AiFileStateSchema', () => {
  it('should accept valid file state', () => {
    const validFileState = {
      lastHash: 'abc123',
      lastContent: 'test content',
      lastGenerated: '2025-10-24T12:00:00.000Z',
      artifacts: ['file.ts'],
    };
    expect(AiFileStateSchema.safeParse(validFileState).success).toBe(true);
  });

  it('should reject file state without required fields', () => {
    const invalidFileState = {
      lastHash: 'abc123',
      // Missing other required fields
    };
    expect(AiFileStateSchema.safeParse(invalidFileState).success).toBe(false);
  });

  it('should accept empty artifacts array', () => {
    const validFileState = {
      lastHash: 'abc123',
      lastContent: 'test content',
      lastGenerated: '2025-10-24T12:00:00.000Z',
      artifacts: [],
    };
    expect(AiFileStateSchema.safeParse(validFileState).success).toBe(true);
  });

  it('should reject non-string artifacts', () => {
    const invalidFileState = {
      lastHash: 'abc123',
      lastContent: 'test content',
      lastGenerated: '2025-10-24T12:00:00.000Z',
      artifacts: [123, 'file.ts'], // Number in array
    };
    expect(AiFileStateSchema.safeParse(invalidFileState).success).toBe(false);
  });
});

describe('DotAiConfigSchema', () => {
  it('should accept valid config', () => {
    const validConfig = {
      defaultAgent: 'claude-code',
      stateFile: 'state.json',
    };
    expect(DotAiConfigSchema.safeParse(validConfig).success).toBe(true);
  });

  it('should reject config with empty defaultAgent', () => {
    const invalidConfig = {
      defaultAgent: '',
      stateFile: 'state.json',
    };
    expect(DotAiConfigSchema.safeParse(invalidConfig).success).toBe(false);
  });

  it('should reject config with empty stateFile', () => {
    const invalidConfig = {
      defaultAgent: 'claude-code',
      stateFile: '',
    };
    expect(DotAiConfigSchema.safeParse(invalidConfig).success).toBe(false);
  });

  it('should reject config without required fields', () => {
    const invalidConfig = {
      defaultAgent: 'claude-code',
      // Missing stateFile
    };
    expect(DotAiConfigSchema.safeParse(invalidConfig).success).toBe(false);
  });
});
