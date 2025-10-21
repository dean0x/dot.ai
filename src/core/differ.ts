/**
 * Differ module - Pure diff generation and formatting
 *
 * All functions are pure string manipulation.
 * Uses Result types for consistency with architecture.
 */

import { createTwoFilesPatch } from 'diff';
import { Result, Ok, tryCatch } from '../utils/result';
import { ParseError } from '../types/errors';

/**
 * Generate a unified diff between two versions of a specification
 *
 * PURE: Only string manipulation, no I/O
 */
export function generateDiff(
  oldContent: string,
  newContent: string,
  fileName: string = 'specification'
): Result<string, ParseError> {
  return tryCatch(
    () => {
      const patch = createTwoFilesPatch(
        fileName,
        fileName,
        oldContent,
        newContent,
        'Previous version',
        'Current version',
        { context: 3 }
      );
      return patch;
    },
    (error) =>
      new ParseError(
        `Failed to generate diff: ${(error as Error).message}`,
        'INVALID_CONTENT',
        { error }
      )
  );
}

/**
 * Format diff for display in prompts with line numbers
 *
 * PURE: Only string manipulation
 */
export function formatDiffForPrompt(diff: string): Result<string, ParseError> {
  return tryCatch(
    () => {
      const lines = diff.split('\n');
      const formattedLines: string[] = [];

      let lineNum = 1;
      let inDiff = false;

      for (const line of lines) {
        // Skip diff headers
        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
          if (line.startsWith('@@')) {
            inDiff = true;
            // Extract starting line number from @@ -1,4 +1,5 @@ format
            const match = line.match(/@@\\s+-(\d+)/);
            if (match) {
              lineNum = parseInt(match[1], 10);
            }
          }
          continue;
        }

        if (!inDiff) continue;

        if (line.startsWith('+')) {
          // Added line
          formattedLines.push(`${String(lineNum).padStart(5)} + ${line.slice(1)}`);
          lineNum++;
        } else if (line.startsWith('-')) {
          // Removed line
          formattedLines.push(`${String(lineNum).padStart(5)} - ${line.slice(1)}`);
        } else if (line.startsWith(' ')) {
          // Context line (unchanged)
          formattedLines.push(`${String(lineNum).padStart(5)}   ${line.slice(1)}`);
          lineNum++;
        }
      }

      return formattedLines.join('\n');
    },
    (error) =>
      new ParseError(
        `Failed to format diff: ${(error as Error).message}`,
        'INVALID_CONTENT',
        { error }
      )
  );
}

/**
 * Check if content has meaningful changes (ignore whitespace-only changes)
 *
 * PURE: Simple string comparison
 */
export function hasSignificantChanges(oldContent: string, newContent: string): boolean {
  const oldNormalized = oldContent.trim().replace(/\s+/g, ' ');
  const newNormalized = newContent.trim().replace(/\s+/g, ' ');
  return oldNormalized !== newNormalized;
}
