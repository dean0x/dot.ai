/**
 * Pure parser validation logic
 *
 * All functions are pure - no I/O, no throws, only Result types.
 * These can be tested without mocks.
 *
 * NOTE: .ai files are now plain markdown without frontmatter.
 * Configuration is passed via CLI flags instead.
 */

import * as path from 'path';
import { Result, Ok, Err } from '../utils/result';
import { SecurityError } from '../types/errors';

/**
 * Validate that a file path is within the allowed base directory
 * Prevents path traversal attacks
 * 
 * PURE: No I/O, only path manipulation and validation
 */
export function validatePathWithinBase(
  filePath: string,
  baseDir: string = process.cwd()
): Result<string, SecurityError> {
  // Resolve both paths to absolute form
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);

  // Get relative path from base to target
  const relativePath = path.relative(resolvedBase, resolvedPath);

  // If the relative path starts with .., it's trying to escape
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return new Err(
      new SecurityError(
        `Path "${filePath}" is outside the allowed directory`,
        'PATH_TRAVERSAL',
        { filePath, baseDir, resolvedPath, resolvedBase }
      )
    );
  }

  return new Ok(resolvedPath);
}

/**
 * Parse raw file content
 * Since .ai files are now plain markdown, this just trims the content
 *
 * PURE: Only string manipulation, no I/O
 */
export function parseFileContent(
  rawContent: string
): string {
  return rawContent.trim();
}

/**
 * Check if a file name matches .ai extension
 * 
 * PURE: Simple string check
 */
export function isAiFile(filename: string): boolean {
  return filename.endsWith('.ai');
}

/**
 * Check if a directory should be skipped during file search
 * 
 * PURE: Simple string check
 */
export function shouldSkipDirectory(dirname: string): boolean {
  return dirname === '.dotai' || dirname === 'node_modules' || dirname === '.git';
}
