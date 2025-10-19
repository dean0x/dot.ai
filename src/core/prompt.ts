import * as path from 'path';
import { AiFile, AiFileState } from '../types';
import { formatDiffForPrompt, generateDiff } from './differ';

/**
 * Build prompt for first-time generation (no previous state)
 */
export function buildFirstTimePrompt(aiFile: AiFile): string {
  const fileName = path.basename(aiFile.path);

  return `Implement the following specification from ${fileName}:

${aiFile.content}

This is a new specification with no existing artifacts.

INSTRUCTIONS:
- Implement the specification fully
- Create all necessary files
- Follow best practices for the language/framework
- Ensure all code is production-ready`;
}

/**
 * Build prompt for updating existing specification
 */
export function buildUpdatePrompt(aiFile: AiFile, previousState: AiFileState): string {
  const fileName = path.basename(aiFile.path);

  // Generate diff between old and new spec
  const diff = generateDiff(previousState.lastContent, aiFile.content, fileName);
  const formattedDiff = formatDiffForPrompt(diff);

  // List existing artifacts
  const artifactsList = previousState.artifacts.length > 0
    ? previousState.artifacts.map(a => `  - ${a}`).join('\n')
    : '  (none)';

  return `Implement changes to the specification from ${fileName}

EXISTING ARTIFACTS:
${artifactsList}

SPECIFICATION CHANGES:
${formattedDiff}

INSTRUCTIONS:
- Implement the changes shown in the diff
- Update existing artifacts as needed
- Preserve any custom code or manual edits where sensible
- Create new files if required by the changes
- Delete files if they're no longer needed
- Ensure all changes are consistent with the updated specification`;
}

/**
 * Build appropriate prompt based on whether this is first-time or update
 */
export function buildPrompt(aiFile: AiFile, previousState: AiFileState | undefined): string {
  if (!previousState) {
    return buildFirstTimePrompt(aiFile);
  } else {
    return buildUpdatePrompt(aiFile, previousState);
  }
}
