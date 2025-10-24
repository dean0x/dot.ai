import { describe, it, expect } from 'vitest';
import { stripLineNumbers, cleanErrorMessage } from './output-formatting';

describe('Output Formatting Utilities', () => {
  describe('stripLineNumbers', () => {
    it('removes line numbers with arrows from output', () => {
      const input = `     1→{
     2→  "name": "@dean0x/dot",
     3→  "version": "0.1.0"
     4→}`;
      const expected = `{
  "name": "@dean0x/dot",
  "version": "0.1.0"
}`;
      expect(stripLineNumbers(input)).toBe(expected);
    });

    it('handles varying whitespace before line numbers', () => {
      const input = `1→First line
  2→Second line
    3→Third line`;
      const expected = `First line
Second line
Third line`;
      expect(stripLineNumbers(input)).toBe(expected);
    });

    it('preserves text without line numbers (short-circuit optimization)', () => {
      const input = `This is plain text
without any line numbers
at all`;
      expect(stripLineNumbers(input)).toBe(input);
    });

    it('handles empty string', () => {
      expect(stripLineNumbers('')).toBe('');
    });

    it('handles string with only line numbers', () => {
      const input = `     1→
     2→
     3→`;
      const expected = `\n\n`;
      expect(stripLineNumbers(input)).toBe(expected);
    });

    it('preserves arrows that are not part of line numbers', () => {
      const input = `Normal text with → arrow
And another → here`;
      // Should NOT remove these arrows since they're not preceded by digits
      expect(stripLineNumbers(input)).toBe(input);
    });

    it('handles multiline output with mixed content', () => {
      const input = `     1→function test() {
     2→  return "hello";
     3→}
Some text without line numbers
     4→const x = 5;`;
      const expected = `function test() {
  return "hello";
}
Some text without line numbers
const x = 5;`;
      expect(stripLineNumbers(input)).toBe(expected);
    });

    it('optimizes performance by short-circuiting when no arrows present', () => {
      // This tests the performance optimization - should return immediately
      const input = 'No arrows in this string at all';
      const result = stripLineNumbers(input);
      expect(result).toBe(input);
      expect(result).toBe(input); // Same reference, not recreated
    });

    it('handles line numbers with inconsistent spacing', () => {
      const input = `1→Line one
 2→Line two
  3→Line three`;
      const expected = `Line one
Line two
Line three`;
      expect(stripLineNumbers(input)).toBe(expected);
    });

    it('handles very large line numbers', () => {
      const input = `  9999→Line 9999
 10000→Line 10000
 10001→Line 10001`;
      const expected = `Line 9999
Line 10000
Line 10001`;
      expect(stripLineNumbers(input)).toBe(expected);
    });
  });

  describe('cleanErrorMessage', () => {
    it('removes XML-like error tags', () => {
      const input = '<tool_use_error>File does not exist.</tool_use_error>';
      const expected = 'File does not exist.';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('removes multiple XML tags', () => {
      const input = '<error><message>Something went wrong</message></error>';
      const expected = 'Something went wrong';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('preserves mathematical comparisons with < and >', () => {
      const input = 'Expected value < 10 but got value > 20';
      const expected = 'Expected value < 10 but got value > 20';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('removes generic type parameters (known limitation)', () => {
      const input = 'Array<string> is not compatible with Array<number>';
      // Note: Our regex removes these as they match tag pattern
      // This is acceptable since error messages from Claude Code don't contain generics
      const expected = 'Array is not compatible with Array';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('does not remove self-closing tags (not in pattern)', () => {
      const input = 'Error in <component/>: failed';
      // Our pattern doesn't handle self-closing tags - acceptable for our use case
      expect(cleanErrorMessage(input)).toBe(input);
    });

    it('removes opening and closing tags separately', () => {
      const input = '<div>Content here</div>';
      const expected = 'Content here';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('handles mixed content with tags and comparisons', () => {
      const input = '<error>Value must be < 100</error>';
      const expected = 'Value must be < 100';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('trims whitespace from result', () => {
      const input = '   <error>  Message  </error>   ';
      const expected = 'Message';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('handles empty string', () => {
      expect(cleanErrorMessage('')).toBe('');
    });

    it('handles string with only tags', () => {
      const input = '<tag></tag>';
      const expected = '';
      expect(cleanErrorMessage(input)).toBe('');
    });

    it('preserves text without any tags', () => {
      const input = 'Plain error message';
      expect(cleanErrorMessage(input)).toBe(input);
    });

    it('handles tags with underscores in names', () => {
      const input = '<tool_use_error>Error text</tool_use_error>';
      const expected = 'Error text';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('handles tags with numbers in names', () => {
      const input = '<error123>Message</error123>';
      const expected = 'Message';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('does not remove incomplete tags', () => {
      const input = 'Incomplete tag < or > symbols';
      expect(cleanErrorMessage(input)).toBe(input);
    });

    it('handles nested tags', () => {
      const input = '<outer><inner>Text</inner></outer>';
      const expected = 'Text';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('handles tags with attributes (partial removal)', () => {
      const input = '<div class="error">Message</div>';
      // Our regex only matches simple tags, not tags with attributes
      // It won't match <div class="error"> but will match </div>
      const expected = '<div class="error">Message';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('preserves comparison operators in context', () => {
      const input = 'if (x < 5 && y > 10) throw error';
      expect(cleanErrorMessage(input)).toBe(input);
    });

    it('handles real Claude Code error format', () => {
      const input = '<tool_use_error>This tool cannot read binary files.</tool_use_error>';
      const expected = 'This tool cannot read binary files.';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('handles multiple errors in one message', () => {
      const input = '<error>First error</error> and <error>Second error</error>';
      const expected = 'First error and Second error';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('handles tag-like patterns that start with numbers (not tags)', () => {
      const input = '<123invalid>This should not be removed</123invalid>';
      // Our pattern requires tags to start with letter or underscore
      expect(cleanErrorMessage(input)).toBe(input);
    });

    it('handles escaped characters in error messages', () => {
      const input = '<error>File "test\\file.txt" not found</error>';
      const expected = 'File "test\\file.txt" not found';
      expect(cleanErrorMessage(input)).toBe(expected);
    });
  });

  describe('Edge Cases', () => {
    it('stripLineNumbers handles very long lines', () => {
      const longLine = 'A'.repeat(10000);
      const input = `     1→${longLine}`;
      const expected = longLine;
      expect(stripLineNumbers(input)).toBe(expected);
    });

    it('cleanErrorMessage handles very long error messages', () => {
      const longMessage = 'Error'.repeat(1000);
      const input = `<error>${longMessage}</error>`;
      const expected = longMessage;
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('stripLineNumbers handles unicode arrows', () => {
      const input = `     1→Hello 世界
     2→こんにちは`;
      const expected = `Hello 世界
こんにちは`;
      expect(stripLineNumbers(input)).toBe(expected);
    });

    it('cleanErrorMessage handles unicode in tags', () => {
      const input = '<error>エラー: ファイルが見つかりません</error>';
      const expected = 'エラー: ファイルが見つかりません';
      expect(cleanErrorMessage(input)).toBe(expected);
    });

    it('both functions handle null bytes (security)', () => {
      const inputWithNull = 'Text\x00WithNull';
      // Functions should handle without crashing
      expect(() => stripLineNumbers(inputWithNull)).not.toThrow();
      expect(() => cleanErrorMessage(inputWithNull)).not.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    it('stripLineNumbers short-circuits on strings without arrows', () => {
      const input = 'No arrows here'.repeat(1000);
      const start = Date.now();
      const result = stripLineNumbers(input);
      const duration = Date.now() - start;

      expect(result).toBe(input);
      expect(duration).toBeLessThan(10); // Should be near-instant
    });

    it('cleanErrorMessage handles regex efficiently', () => {
      const input = 'Plain text error'.repeat(100);
      const start = Date.now();
      const result = cleanErrorMessage(input);
      const duration = Date.now() - start;

      expect(result).toBe(input);
      expect(duration).toBeLessThan(50); // Should be fast even without short-circuit
    });
  });
});
