import { describe, it, expect } from 'vitest';
import { generateDiff, formatDiffForPrompt, hasSignificantChanges } from './differ';
import { isOk, isErr } from '../utils/result';

describe('Differ Module (Pure Functions)', () => {
  describe('generateDiff', () => {
    it('generates unified diff for simple changes', () => {
      const oldContent = `Line 1
Line 2
Line 3`;
      const newContent = `Line 1
Line 2 modified
Line 3`;

      const result = generateDiff(oldContent, newContent, 'test.ai');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('test.ai');
        expect(result.value).toContain('-Line 2');
        expect(result.value).toContain('+Line 2 modified');
      }
    });

    it('generates diff for additions', () => {
      const oldContent = `Line 1
Line 2`;
      const newContent = `Line 1
Line 2
Line 3
Line 4`;

      const result = generateDiff(oldContent, newContent);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('+Line 3');
        expect(result.value).toContain('+Line 4');
      }
    });

    it('generates diff for deletions', () => {
      const oldContent = `Line 1
Line 2
Line 3
Line 4`;
      const newContent = `Line 1
Line 4`;

      const result = generateDiff(oldContent, newContent);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('-Line 2');
        expect(result.value).toContain('-Line 3');
      }
    });

    it('generates empty diff for identical content', () => {
      const content = `Line 1
Line 2
Line 3`;

      const result = generateDiff(content, content);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Unified diff with no changes will only have headers, no hunks
        expect(result.value).toBeTruthy();
      }
    });

    it('uses custom file name in diff header', () => {
      const oldContent = 'old';
      const newContent = 'new';

      const result = generateDiff(oldContent, newContent, 'custom.ai');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('custom.ai');
      }
    });

    it('uses default file name when not provided', () => {
      const oldContent = 'old';
      const newContent = 'new';

      const result = generateDiff(oldContent, newContent);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('specification');
      }
    });

    it('handles multi-line changes with context', () => {
      const oldContent = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7`;
      const newContent = `Line 1
Line 2
Line 3 modified
Line 4
Line 5
Line 6
Line 7`;

      const result = generateDiff(oldContent, newContent);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should include context lines
        expect(result.value).toContain(' Line 2');
        expect(result.value).toContain('-Line 3');
        expect(result.value).toContain('+Line 3 modified');
        expect(result.value).toContain(' Line 4');
      }
    });
  });

  describe('formatDiffForPrompt', () => {
    it('formats diff with line numbers', () => {
      const diff = `--- test.ai	Previous version
+++ test.ai	Current version
@@ -1,3 +1,3 @@
 Line 1
-Line 2
+Line 2 modified
 Line 3`;

      const result = formatDiffForPrompt(diff);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = result.value;
        expect(formatted).toContain('1   Line 1');
        expect(formatted).toContain('2 - Line 2');
        expect(formatted).toContain('2 + Line 2 modified');
        expect(formatted).toContain('3   Line 3');
      }
    });

    it('skips diff headers', () => {
      const diff = `--- test.ai	Previous version
+++ test.ai	Current version
@@ -1,2 +1,2 @@
 Line 1
+Line 2`;

      const result = formatDiffForPrompt(diff);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = result.value;
        expect(formatted).not.toContain('---');
        expect(formatted).not.toContain('+++');
        expect(formatted).not.toContain('@@');
      }
    });

    it('handles multiple hunks', () => {
      const diff = `--- test.ai	Previous version
+++ test.ai	Current version
@@ -1,2 +1,2 @@
 Line 1
-Line 2
+Line 2 modified
@@ -5,2 +5,2 @@
 Line 5
-Line 6
+Line 6 modified`;

      const result = formatDiffForPrompt(diff);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = result.value;
        expect(formatted).toContain('Line 2 modified');
        expect(formatted).toContain('Line 6 modified');
      }
    });

    it('pads line numbers consistently', () => {
      const diff = `--- test.ai	Previous version
+++ test.ai	Current version
@@ -1,3 +1,3 @@
 Line 1
 Line 2
+Line 3`;

      const result = formatDiffForPrompt(diff);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = result.value;
        const lines = formatted.split('\n');
        // All line numbers should be right-padded to same width
        for (const line of lines) {
          if (line.trim()) {
            // Should start with spaces and number (5 char width)
            expect(line.match(/^\s*\d+\s+[+ -]/)).toBeTruthy();
          }
        }
      }
    });

    it('handles empty diff', () => {
      const diff = `--- test.ai	Previous version
+++ test.ai	Current version`;

      const result = formatDiffForPrompt(diff);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('');
      }
    });

    it('correctly increments line numbers for context and additions', () => {
      const diff = `--- test.ai	Previous version
+++ test.ai	Current version
@@ -1,4 +1,5 @@
 Line 1
 Line 2
+Line 2.5
 Line 3
 Line 4`;

      const result = formatDiffForPrompt(diff);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = result.value;
        expect(formatted).toContain('1   Line 1');
        expect(formatted).toContain('2   Line 2');
        expect(formatted).toContain('3 + Line 2.5');
        expect(formatted).toContain('4   Line 3');
        expect(formatted).toContain('5   Line 4');
      }
    });

    it('does not increment line number for deletions', () => {
      const diff = `--- test.ai	Previous version
+++ test.ai	Current version
@@ -1,4 +1,3 @@
 Line 1
-Line 2
 Line 3
 Line 4`;

      const result = formatDiffForPrompt(diff);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = result.value;
        expect(formatted).toContain('1   Line 1');
        expect(formatted).toContain('2 - Line 2');  // Deletion at line 2
        expect(formatted).toContain('2   Line 3');  // Next context stays at 2 (line was deleted)
        expect(formatted).toContain('3   Line 4');
      }
    });
  });

  describe('hasSignificantChanges', () => {
    it('detects meaningful content changes', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nLine 2 modified\nLine 3';

      expect(hasSignificantChanges(oldContent, newContent)).toBe(true);
    });

    it('ignores whitespace-only changes', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1  \n  Line 2  \n  Line 3  ';

      expect(hasSignificantChanges(oldContent, newContent)).toBe(false);
    });

    it('ignores leading/trailing whitespace', () => {
      const oldContent = 'Content here';
      const newContent = '  Content here  ';

      expect(hasSignificantChanges(oldContent, newContent)).toBe(false);
    });

    it('ignores multiple spaces vs single space', () => {
      const oldContent = 'Word1 Word2 Word3';
      const newContent = 'Word1    Word2     Word3';

      expect(hasSignificantChanges(oldContent, newContent)).toBe(false);
    });

    it('detects addition of content', () => {
      const oldContent = 'Line 1';
      const newContent = 'Line 1\nLine 2';

      expect(hasSignificantChanges(oldContent, newContent)).toBe(true);
    });

    it('detects removal of content', () => {
      const oldContent = 'Line 1\nLine 2';
      const newContent = 'Line 1';

      expect(hasSignificantChanges(oldContent, newContent)).toBe(true);
    });

    it('returns false for identical content', () => {
      const content = 'Line 1\nLine 2\nLine 3';

      expect(hasSignificantChanges(content, content)).toBe(false);
    });

    it('ignores newline type differences', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1 Line 2 Line 3';

      // After whitespace normalization, these should be the same
      expect(hasSignificantChanges(oldContent, newContent)).toBe(false);
    });

    it('detects single character changes', () => {
      const oldContent = 'Hello world';
      const newContent = 'Hello World';

      expect(hasSignificantChanges(oldContent, newContent)).toBe(true);
    });

    it('handles empty strings', () => {
      expect(hasSignificantChanges('', '')).toBe(false);
      expect(hasSignificantChanges('Content', '')).toBe(true);
      expect(hasSignificantChanges('', 'Content')).toBe(true);
    });
  });
});
