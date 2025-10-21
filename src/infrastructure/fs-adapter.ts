/**
 * Real file system implementation using fs.promises
 */

import * as fs from 'fs/promises';
import { FileSystem, Dirent, Stats } from './interfaces';
import { Result, Ok, Err, tryCatchAsync } from '../utils/result';
import { FileSystemError } from '../types/errors';

export class NodeFileSystem implements FileSystem {
  async readFile(path: string, encoding: BufferEncoding): Promise<Result<string, FileSystemError>> {
    return tryCatchAsync(
      () => fs.readFile(path, encoding),
      (error) => FileSystemError.fromNodeError(error as NodeJS.ErrnoException, path)
    );
  }

  async writeFile(path: string, data: string, encoding: BufferEncoding): Promise<Result<void, FileSystemError>> {
    return tryCatchAsync(
      () => fs.writeFile(path, data, encoding),
      (error) => FileSystemError.fromNodeError(error as NodeJS.ErrnoException, path)
    );
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<Result<void, FileSystemError>> {
    return tryCatchAsync(
      async () => {
        await fs.mkdir(path, options);
      },
      (error) => FileSystemError.fromNodeError(error as NodeJS.ErrnoException, path)
    );
  }

  async exists(path: string): Promise<Result<boolean, FileSystemError>> {
    const result = await tryCatchAsync(
      () => fs.access(path),
      (error) => FileSystemError.fromNodeError(error as NodeJS.ErrnoException, path)
    );

    if (result.ok) {
      return new Ok(true);
    }

    // If error is ENOENT, file doesn't exist (not an error)
    if (result.error.code === 'ENOENT') {
      return new Ok(false);
    }

    // Other errors are real errors
    return result as Result<boolean, FileSystemError>;
  }

  async readdir(
    path: string,
    options?: { withFileTypes?: boolean }
  ): Promise<Result<Dirent[], FileSystemError>> {
    return tryCatchAsync(
      async () => {
        // Always use withFileTypes: true since we return Dirent[]
        const entries = await fs.readdir(path, { withFileTypes: true });
        return entries as unknown as Dirent[];
      },
      (error) => FileSystemError.fromNodeError(error as NodeJS.ErrnoException, path)
    );
  }

  async stat(path: string): Promise<Result<Stats, FileSystemError>> {
    return tryCatchAsync(
      async () => {
        const stats = await fs.stat(path);
        return stats as unknown as Stats;
      },
      (error) => FileSystemError.fromNodeError(error as NodeJS.ErrnoException, path)
    );
  }
}
