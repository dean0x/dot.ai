/**
 * Prompt building module
 *
 * PURE: String manipulation only, uses Result types for error handling
 */

import * as path from 'path';
import { AiFile, AiFileState } from '../types';
import { formatDiffForPrompt, generateDiff } from './differ';
import { Result, Ok, Err, isErr } from '../utils/result';
import { ParseError } from '../types/errors';

/**
 * Build prompt for first-time generation (no previous state)
 *
 * PURE: String templating only
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
 *
 * PURE: String templating with diff generation
 */
export function buildUpdatePrompt(
  aiFile: AiFile,
  previousState: AiFileState
): Result<string, ParseError> {
  const fileName = path.basename(aiFile.path);

  // Generate diff between old and new spec
  const diffResult = generateDiff(previousState.lastContent, aiFile.content, fileName);
  if (isErr(diffResult)) {
    return diffResult;
  }
  const diff = diffResult.value;

  // Format diff for display
  const formattedDiffResult = formatDiffForPrompt(diff);
  if (isErr(formattedDiffResult)) {
    return formattedDiffResult;
  }
  const formattedDiff = formattedDiffResult.value;

  // List existing artifacts
  const artifactsList = previousState.artifacts.length > 0
    ? previousState.artifacts.map(a => `  - ${a}`).join('\n')
    : '  (none)';

  const prompt = `Implement changes to the specification from ${fileName}

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

  return new Ok(prompt);
}

/**
 * Build appropriate prompt based on whether this is first-time or update
 *
 * PURE: Delegates to appropriate builder
 */
export function buildPrompt(
  aiFile: AiFile,
  previousState: AiFileState | undefined
): Result<string, ParseError> {
  if (!previousState) {
    return new Ok(buildFirstTimePrompt(aiFile));
  } else {
    return buildUpdatePrompt(aiFile, previousState);
  }
}
