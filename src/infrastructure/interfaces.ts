/**
 * Infrastructure interfaces for dependency injection
 * 
 * These interfaces define contracts for external dependencies
 * that can be mocked in tests and swapped in production.
 */

import { Result } from '../utils/result';
import { FileSystemError } from '../types/errors';

/**
 * File system operations interface
 * Abstracts fs.promises for testing and flexibility
 */
export interface FileSystem {
  /**
   * Read file contents
   */
  readFile(path: string, encoding: BufferEncoding): Promise<Result<string, FileSystemError>>;

  /**
   * Write file contents
   */
  writeFile(path: string, data: string, encoding: BufferEncoding): Promise<Result<void, FileSystemError>>;

  /**
   * Create directory
   */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<Result<void, FileSystemError>>;

  /**
   * Check if file/directory exists
   */
  exists(path: string): Promise<Result<boolean, FileSystemError>>;

  /**
   * Read directory contents
   */
  readdir(
    path: string,
    options?: { withFileTypes?: boolean }
  ): Promise<Result<Dirent[], FileSystemError>>;

  /**
   * Get file stats
   */
  stat(path: string): Promise<Result<Stats, FileSystemError>>;
}

/**
 * Directory entry (matches fs.Dirent)
 */
export interface Dirent {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

/**
 * File stats (matches fs.Stats subset we need)
 */
export interface Stats {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
}

/**
 * Process execution interface
 * Abstracts child_process for testing and flexibility
 */
export interface ProcessRunner {
  /**
   * Spawn a process and return result
   */
  spawn(
    command: string,
    args: string[],
    options?: SpawnOptions
  ): Promise<Result<ProcessResult, ProcessError>>;
}

/**
 * Options for spawning a process
 */
export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Result from process execution
 */
export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Process execution error
 */
export interface ProcessError {
  message: string;
  code?: string | number;
  stdout?: string;
  stderr?: string;
}

/**
 * Hash computation interface
 * Abstracts crypto for testing
 */
export interface Hasher {
  /**
   * Compute SHA-256 hash of string
   */
  hash(input: string): string;
}
