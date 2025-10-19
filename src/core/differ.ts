import { createTwoFilesPatch } from 'diff';

/**
 * Generate a unified diff between two versions of a specification
 */
export function generateDiff(oldContent: string, newContent: string, fileName: string = 'specification'): string {
  // Use diff library to create unified diff format
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
}

/**
 * Format diff for display in prompts
 * Adds line numbers similar to your example
 */
export function formatDiffForPrompt(diff: string): string {
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
        const match = line.match(/@@\s+-(\d+)/);
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
}

/**
 * Check if content has meaningful changes (ignore whitespace-only changes)
 */
export function hasSignificantChanges(oldContent: string, newContent: string): boolean {
  const oldNormalized = oldContent.trim().replace(/\s+/g, ' ');
  const newNormalized = newContent.trim().replace(/\s+/g, ' ');
  return oldNormalized !== newNormalized;
}
