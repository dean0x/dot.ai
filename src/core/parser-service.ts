/**
 * Parser service with I/O operations
 * 
 * Uses dependency injection for FileSystem and Hasher.
 * All operations return Result types.
 */

import * as path from 'path';
import { Result, Ok, Err, isErr } from '../utils/result';
import { FileSystem, Hasher } from '../infrastructure/interfaces';
import { AiFile, AiFileFrontmatter } from '../types';
import { FileSystemError, DotAiError } from '../types/errors';
import {
  validatePathWithinBase,
  parseFileContent,
  validateFrontmatter,
  serializeFileContent,
  isAiFile,
  shouldSkipDirectory,
} from './parser-core';

/**
 * Parser service for .ai files
 */
export class ParserService {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher
  ) {}

  /**
   * Parse a .ai file and extract frontmatter + content
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

    // Parse content (pure)
    const parseResult = parseFileContent(rawContent);
    if (isErr(parseResult)) {
      return parseResult;
    }
    const { frontmatter: rawFrontmatter, content } = parseResult.value;

    // Validate frontmatter (pure)
    const frontmatterResult = validateFrontmatter(rawFrontmatter);
    if (isErr(frontmatterResult)) {
      return frontmatterResult;
    }
    const frontmatter = frontmatterResult.value;

    // Calculate content hash (pure, via hasher)
    // IMPORTANT: Hash only the content portion (not frontmatter)
    const hash = this.hasher.hash(content);

    return new Ok({
      path: absolutePath,
      frontmatter,
      content,
      hash,
    });
  }

  /**
   * Update the artifacts list in a .ai file's frontmatter
   */
  async updateArtifacts(
    filePath: string,
    artifacts: string[]
  ): Promise<Result<void, DotAiError>> {
    // Validate path (pure)
    const pathResult = validatePathWithinBase(filePath);
    if (isErr(pathResult)) {
      return pathResult;
    }
    const validatedPath = pathResult.value;

    // Read file (I/O)
    const readResult = await this.fs.readFile(validatedPath, 'utf-8');
    if (isErr(readResult)) {
      return readResult;
    }
    const rawContent = readResult.value;

    // Parse content (pure)
    const parseResult = parseFileContent(rawContent);
    if (isErr(parseResult)) {
      return parseResult;
    }
    const { frontmatter: rawFrontmatter, content } = parseResult.value;

    // Validate frontmatter (pure)
    const frontmatterResult = validateFrontmatter(rawFrontmatter);
    if (isErr(frontmatterResult)) {
      return frontmatterResult;
    }
    const frontmatter = frontmatterResult.value;

    // Update artifacts (pure)
    // Filter out undefined values for YAML serialization
    const updatedFrontmatter: AiFileFrontmatter = {
      agent: frontmatter.agent,
      artifacts,
      ...(frontmatter.agent_config !== undefined && { agent_config: frontmatter.agent_config }),
    };

    // Serialize (pure)
    const updated = serializeFileContent(updatedFrontmatter, content);

    // Write file (I/O)
    return await this.fs.writeFile(validatedPath, updated, 'utf-8');
  }

  /**
   * Find all .ai files in a directory tree
   */
  async findAiFiles(directory: string): Promise<Result<string[], FileSystemError>> {
    const results: string[] = [];

    const walkResult = await this.walk(path.resolve(directory), results);
    if (isErr(walkResult)) {
      return walkResult;
    }

    return new Ok(results);
  }

  /**
   * Recursive directory walker
   * Private helper for findAiFiles
   */
  private async walk(
    dir: string,
    results: string[]
  ): Promise<Result<void, FileSystemError>> {
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
        const walkResult = await this.walk(fullPath, results);
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
