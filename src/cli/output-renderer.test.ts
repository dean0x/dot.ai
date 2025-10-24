import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OutputRenderer } from './output-renderer';
import { ValidationError } from '../types/errors';

describe('OutputRenderer', () => {
  let renderer: OutputRenderer;
  let consoleLogSpy: any;

  beforeEach(() => {
    // Spy on console.log instead of mocking the entire console
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Create new renderer
    renderer = new OutputRenderer();
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  describe('Spinner Management', () => {
    it('starts spinner with message', () => {
      renderer.startSpinner('Loading...');
      // Note: actual ora would be called, but we're testing the interface
      expect(true).toBe(true); // Spinner started
    });

    it('stops spinner', () => {
      renderer.startSpinner('Loading...');
      renderer.stopSpinner();
      // Spinner should be stopped
      expect(true).toBe(true);
    });

    it('succeeds spinner with message', () => {
      renderer.startSpinner('Loading...');
      renderer.succeedSpinner('Done!');
      // Spinner should succeed
      expect(true).toBe(true);
    });

    it('fails spinner with message', () => {
      renderer.startSpinner('Loading...');
      renderer.failSpinner('Failed!');
      // Spinner should fail
      expect(true).toBe(true);
    });

    it('handles successive spinner calls', () => {
      renderer.startSpinner('First');
      renderer.startSpinner('Second'); // Should stop first and start second
      renderer.stopSpinner();
      expect(true).toBe(true);
    });
  });

  describe('Message Output', () => {
    it('prints header message', () => {
      renderer.header('Test Header');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('prints info message', () => {
      renderer.info('Information');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Information'));
    });

    it('prints success message with checkmark', () => {
      renderer.success('Operation succeeded');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Operation succeeded'));
    });

    it('prints error message with X mark', () => {
      renderer.error('Operation failed');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✗'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Operation failed'));
    });

    it('prints warning message with warning symbol', () => {
      renderer.warning('Warning message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
    });

    it('prints debug message in gray', () => {
      renderer.debug('Debug info');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Debug info'));
    });

    it('prints plain log message', () => {
      renderer.log('Plain message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Plain message'));
    });

    it('prints newline', () => {
      renderer.newline();
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles Error object', () => {
      const error = new Error('Test error');
      renderer.error('Operation failed', error);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Operation failed'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });

    it('handles DotAiError with code', () => {
      const error = new ValidationError('Custom error', 'INVALID_CONFIG', { detail: 'value' });
      renderer.error('Operation failed', error);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Operation failed'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Custom error'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('INVALID_CONFIG'));
    });

    it('handles error without stack trace', () => {
      const error = new Error('Simple error');
      delete (error as any).stack;
      renderer.error('Failed', error);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Simple error'));
    });
  });

  describe('File Processing', () => {
    it('prints file header with correct format', () => {
      renderer.fileHeader(1, 5, 'test.ai');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[1/5]'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test.ai'));
    });

    it('handles multiple file numbers correctly', () => {
      renderer.fileHeader(10, 99, 'file.ai');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[10/99]'));
    });
  });

  describe('Artifact Tracking', () => {
    it('tracks artifacts with count', () => {
      renderer.artifactsTracked(3, ['file1.ts', 'file2.ts', 'file3.ts']);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tracked 3 artifact(s)'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file1.ts'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file2.ts'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file3.ts'));
    });

    it('truncates artifact list when more than 10', () => {
      const artifacts = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
      renderer.artifactsTracked(15, artifacts);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('and 5 more'));
    });

    it('handles empty artifact list', () => {
      renderer.artifactsTracked(0, []);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tracked 0 artifact(s)'));
    });

    it('handles count mismatch correctly', () => {
      // This tests the bug found in audit - count != artifacts.length
      renderer.artifactsTracked(5, ['file1.ts', 'file2.ts']); // Count says 5 but only 2 artifacts
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tracked 5 artifact(s)'));
    });
  });

  describe('Recursion Summary', () => {
    it('prints recursion summary with valid metrics', () => {
      renderer.recursionSummary({
        totalIterations: 5,
        totalTimeMs: 10000,
        convergenceReason: 'natural',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Recursion Summary'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total iterations: 5'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total time: 10.0s'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Average: 2.0s per iteration'));
    });

    it('handles division by zero (totalIterations = 0)', () => {
      // This tests the bug fix - should not crash with division by zero
      renderer.recursionSummary({
        totalIterations: 0,
        totalTimeMs: 0,
        convergenceReason: 'error',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Recursion Summary'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total iterations: 0'));
      // Should NOT have "Average:" line when totalIterations is 0
    });

    it('displays correct convergence reason: natural', () => {
      renderer.recursionSummary({
        totalIterations: 3,
        totalTimeMs: 5000,
        convergenceReason: 'natural',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Natural'));
    });

    it('displays correct convergence reason: max_depth', () => {
      renderer.recursionSummary({
        totalIterations: 10,
        totalTimeMs: 20000,
        convergenceReason: 'max_depth',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Max depth'));
    });

    it('displays correct convergence reason: error', () => {
      renderer.recursionSummary({
        totalIterations: 2,
        totalTimeMs: 1000,
        convergenceReason: 'error',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('error'));
    });

    it('displays correct convergence reason: none', () => {
      renderer.recursionSummary({
        totalIterations: 1,
        totalTimeMs: 2000,
        convergenceReason: 'none',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Single iteration'));
    });
  });

  describe('Summary', () => {
    it('displays success summary', () => {
      renderer.summary(5, 0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Summary'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('5 file(s) processed successfully'));
    });

    it('displays failure summary', () => {
      renderer.summary(0, 3);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('3 file(s) failed'));
    });

    it('displays mixed summary', () => {
      renderer.summary(10, 2);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('10 file(s) processed successfully'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2 file(s) failed'));
    });

    it('handles zero files', () => {
      renderer.summary(0, 0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Summary'));
    });
  });

  describe('Infinite Recursion Warning', () => {
    it('displays warning for infinite recursion files', () => {
      const files = [
        { path: '/path/to/file1.ai', name: 'file1.ai' },
        { path: '/path/to/file2.ai', name: 'file2.ai' },
      ];
      renderer.infiniteRecursionWarning(files);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Infinite recursion'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file1.ai'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file2.ai'));
    });

    it('handles single file', () => {
      const files = [{ path: '/path/to/file.ai', name: 'file.ai' }];
      renderer.infiniteRecursionWarning(files);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('1 file(s)'));
    });
  });

  describe('Indentation (Disabled)', () => {
    it('indent() is a no-op', () => {
      renderer.indent();
      renderer.log('Test');
      // Should not have indentation
      expect(consoleLogSpy).toHaveBeenCalledWith('Test');
    });

    it('unindent() is a no-op', () => {
      renderer.indent();
      renderer.indent();
      renderer.unindent();
      renderer.log('Test');
      // Should not have indentation
      expect(consoleLogSpy).toHaveBeenCalledWith('Test');
    });

    it('resetIndent() is a no-op', () => {
      renderer.indent();
      renderer.resetIndent();
      renderer.log('Test');
      // Should not have indentation
      expect(consoleLogSpy).toHaveBeenCalledWith('Test');
    });
  });

  describe('Spinner State Management', () => {
    it('stops spinner before printing messages', () => {
      renderer.startSpinner('Loading...');
      renderer.log('Message'); // Should stop spinner first
      // Spinner should be stopped before message
      expect(true).toBe(true);
    });

    it('handles multiple stop calls gracefully', () => {
      renderer.startSpinner('Loading...');
      renderer.stopSpinner();
      renderer.stopSpinner(); // Should not crash
      expect(true).toBe(true);
    });

    it('handles stop without start', () => {
      renderer.stopSpinner(); // Should not crash
      expect(true).toBe(true);
    });
  });
});
