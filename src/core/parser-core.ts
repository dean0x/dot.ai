/**
 * Pure parser validation logic
 * 
 * All functions are pure - no I/O, no throws, only Result types.
 * These can be tested without mocks.
 */

import * as path from 'path';
import matter from 'gray-matter';
import { Result, Ok, Err } from '../utils/result';
import { SecurityError, ParseError, ValidationError } from '../types/errors';
import { AiFileFrontmatter } from '../types';

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
 * Parse raw file content into frontmatter and content
 * 
 * PURE: Only string manipulation, no I/O
 */
export function parseFileContent(
  rawContent: string
): Result<{ frontmatter: unknown; content: string }, ParseError> {
  try {
    const parsed = matter(rawContent);
    return new Ok({
      frontmatter: parsed.data,
      content: parsed.content.trim(),
    });
  } catch (error) {
    return new Err(
      new ParseError(
        `Failed to parse frontmatter: ${(error as Error).message}`,
        'MALFORMED_YAML',
        { error }
      )
    );
  }
}

/**
 * Validate frontmatter structure
 * 
 * PURE: Only data validation, no I/O
 */
export function validateFrontmatter(
  data: unknown
): Result<AiFileFrontmatter, ValidationError> {
  if (typeof data !== 'object' || data === null) {
    return new Err(
      new ValidationError(
        'Frontmatter must be an object',
        'INVALID_CONFIG',
        { receivedType: typeof data }
      )
    );
  }

  const fm = data as Record<string, unknown>;

  // Validate agent field (required)
  if (typeof fm.agent !== 'string' || !fm.agent) {
    return new Err(
      new ValidationError(
        'Field "agent" is required and must be a non-empty string',
        'INVALID_AGENT',
        { agent: fm.agent }
      )
    );
  }

  // Validate artifacts field (optional, defaults to empty array if missing)
  let artifacts: unknown[];
  if (fm.artifacts === undefined) {
    artifacts = [];
  } else if (!Array.isArray(fm.artifacts)) {
    return new Err(
      new ValidationError(
        'Field "artifacts" must be an array of strings',
        'INVALID_ARTIFACTS',
        { artifacts: fm.artifacts }
      )
    );
  } else {
    artifacts = fm.artifacts;
  }

  // Validate all elements are strings
  if (!artifacts.every((a) => typeof a === 'string')) {
    return new Err(
      new ValidationError(
        'Field "artifacts" must be an array of strings',
        'INVALID_ARTIFACTS',
        { artifacts }
      )
    );
  }

  // Validate agent_config field (optional)
  const agentConfig = fm.agent_config;
  if (agentConfig !== undefined && (typeof agentConfig !== 'object' || agentConfig === null)) {
    return new Err(
      new ValidationError(
        'Field "agent_config" must be an object',
        'INVALID_CONFIG',
        { agentConfig }
      )
    );
  }

  // Validate recursive field (optional)
  const recursive = fm.recursive;
  if (recursive !== undefined && typeof recursive !== 'boolean') {
    return new Err(
      new ValidationError(
        'Field "recursive" must be a boolean',
        'INVALID_CONFIG',
        { recursive }
      )
    );
  }

  // Validate max_recursion_depth field (optional)
  let maxRecursionDepth: number | "∞" | undefined;
  if (fm.max_recursion_depth !== undefined) {
    const value = fm.max_recursion_depth;

    // Accept "∞", "Infinity", or a positive number
    if (value === "∞" || value === "Infinity") {
      maxRecursionDepth = "∞";
    } else if (typeof value === 'number') {
      if (value <= 0 || !Number.isInteger(value)) {
        return new Err(
          new ValidationError(
            'Field "max_recursion_depth" must be a positive integer or "∞"',
            'INVALID_CONFIG',
            { max_recursion_depth: value }
          )
        );
      }
      maxRecursionDepth = value;
    } else {
      return new Err(
        new ValidationError(
          'Field "max_recursion_depth" must be a positive integer or "∞"',
          'INVALID_CONFIG',
          { max_recursion_depth: value }
        )
      );
    }
  }

  return new Ok({
    agent: fm.agent,
    artifacts: artifacts as string[],
    agent_config: agentConfig as Record<string, unknown> | undefined,
    recursive: recursive as boolean | undefined,
    max_recursion_depth: maxRecursionDepth,
  });
}

/**
 * Serialize frontmatter and content back to file format
 * 
 * PURE: Only string manipulation
 */
export function serializeFileContent(
  frontmatter: AiFileFrontmatter,
  content: string
): string {
  return matter.stringify(content, frontmatter);
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
