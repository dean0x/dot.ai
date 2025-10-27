/**
 * Parser service with I/O operations
 *
 * Uses dependency injection for FileSystem and Hasher.
 * All operations return Result types.
 *
 * NOTE: .ai files are now plain markdown without frontmatter.
 * Configuration is passed via CLI flags instead.
 */

import * as path from 'path';
import { Result, Ok, Err, isErr } from '../utils/result';
import { FileSystem, Hasher } from '../infrastructure/interfaces';
import { AiFile } from '../types';
import { FileSystemError, DotAiError } from '../types/errors';
import {
  validatePathWithinBase,
  parseFileContent,
  isAiFile,
  shouldSkipDirectory,
} from './parser-core';

/**
 * Maximum directory depth to prevent stack overflow
 * Protects against deep directory structures and symlink loops
 */
const MAX_DEPTH = 50;

/**
 * Parser service for .ai files
 */
export class ParserService {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher
  ) {}

  /**
   * Parse a .ai file (plain markdown)
   */
  async parseAiFile(filePath: string): Promise<Result<AiFile, DotAiError>> {
    // Validate path (pure)
    const pathResult = validatePathWithinBase(filePath);
    if (isErr(pathResult)) {
      return pathResult;
    }
    const absolutePath = pathResult.value;

    // Read file (I/O)
    const readResult = await this.fs.readFile(absolutePath, 'utf-8');
    if (isErr(readResult)) {
      return readResult;
    }
    const rawContent = readResult.value;

    // Parse content (pure) - just trim whitespace
    const content = parseFileContent(rawContent);

    // Calculate content hash
    const hash = this.hasher.hash(content);

    return new Ok({
      path: absolutePath,
      content,
      hash,
    });
  }

  /**
   * Find all .ai files in a directory tree
   */
  async findAiFiles(directory: string): Promise<Result<string[], FileSystemError>> {
    const results: string[] = [];

    const walkResult = await this.walk(path.resolve(directory), results, 0);
    if (isErr(walkResult)) {
      return walkResult;
    }

    return new Ok(results);
  }

  /**
   * Recursive directory walker
   * Private helper for findAiFiles
   *
   * @param dir - Directory to walk
   * @param results - Array to collect .ai file paths
   * @param depth - Current recursion depth (prevents stack overflow)
   */
  private async walk(
    dir: string,
    results: string[],
    depth: number
  ): Promise<Result<void, FileSystemError>> {
    // Prevent stack overflow from deep directories or symlink loops
    if (depth >= MAX_DEPTH) {
      return new Ok(undefined); // Silently skip deep directories
    }
    const entriesResult = await this.fs.readdir(dir);
    if (isErr(entriesResult)) {
      return entriesResult;
    }
    const entries = entriesResult.value;

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories (pure check)
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        const walkResult = await this.walk(fullPath, results, depth + 1);
        if (isErr(walkResult)) {
          return walkResult;
        }
      } else if (entry.isFile() && isAiFile(entry.name)) {
        results.push(fullPath);
      }
    }

    return new Ok(undefined);
  }
}
