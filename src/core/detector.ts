/**
 * Change detector module - Pure change detection logic
 *
 * All functions are pure - no I/O, no side effects, deterministic.
 * These functions categorize AiFiles based on state comparison.
 */

import { AiFile, DotAiState, ChangeDetectionResult } from '../types';
import { getFileState } from './state';

/**
 * Detect which .ai files have changed since last generation
 *
 * PURE: Deterministic categorization based on hash comparison
 * Cannot fail - always returns valid ChangeDetectionResult
 */
export function detectChanges(aiFiles: AiFile[], state: DotAiState, force: boolean = false): ChangeDetectionResult {
  const changed: AiFile[] = [];
  const newFiles: AiFile[] = [];
  const unchanged: AiFile[] = [];

  for (const aiFile of aiFiles) {
    const fileState = getFileState(state, aiFile.path);

    if (force) {
      // Force flag: treat everything as changed
      if (fileState) {
        changed.push(aiFile);
      } else {
        newFiles.push(aiFile);
      }
    } else if (!fileState) {
      // No previous state: this is a new file
      newFiles.push(aiFile);
    } else if (fileState.lastHash !== aiFile.hash) {
      // Hash changed: file was modified
      changed.push(aiFile);
    } else {
      // Hash matches: file is unchanged
      unchanged.push(aiFile);
    }
  }

  return {
    changed,
    new: newFiles,
    unchanged,
  };
}

/**
 * Check if there are any changes to process
 *
 * PURE: Simple boolean check, cannot fail
 */
export function hasChanges(result: ChangeDetectionResult): boolean {
  return result.changed.length > 0 || result.new.length > 0;
}

/**
 * Get all files that need processing (changed + new)
 *
 * PURE: Array concatenation, cannot fail
 */
export function getFilesToProcess(result: ChangeDetectionResult): AiFile[] {
  return [...result.new, ...result.changed];
}

/**
 * Get a summary of changes for display
 *
 * PURE: String formatting, cannot fail
 */
export function getChangeSummary(result: ChangeDetectionResult): string {
  const lines: string[] = [];

  if (result.new.length > 0) {
    lines.push(`New: ${result.new.length} file(s)`);
  }

  if (result.changed.length > 0) {
    lines.push(`Changed: ${result.changed.length} file(s)`);
  }

  if (result.unchanged.length > 0) {
    lines.push(`Unchanged: ${result.unchanged.length} file(s)`);
  }

  return lines.join(', ');
}
