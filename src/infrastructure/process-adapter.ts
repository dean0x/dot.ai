/**
 * Real process execution implementation using child_process
 */

import { spawn } from 'child_process';
import { ProcessRunner, SpawnOptions, ProcessResult, ProcessError } from './interfaces';
import { Result, Ok, Err } from '../utils/result';

export class NodeProcessRunner implements ProcessRunner {
  async spawn(
    command: string,
    args: string[],
    options?: SpawnOptions
  ): Promise<Result<ProcessResult, ProcessError>> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: options?.cwd,
        env: options?.env,
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // Handle timeout
      let timeoutId: NodeJS.Timeout | undefined;
      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          killed = true;
          child.kill();
        }, options.timeout);
      }

      // Collect stdout
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle completion
      child.on('close', (exitCode) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (killed) {
          resolve(
            new Err({
              message: 'Process timeout',
              code: 'ETIMEDOUT',
              stdout,
              stderr,
            })
          );
          return;
        }

        resolve(
          new Ok({
            stdout,
            stderr,
            exitCode: exitCode ?? 1,
          })
        );
      });

      // Handle errors
      child.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve(
          new Err({
            message: error.message,
            code: (error as NodeJS.ErrnoException).code,
            stdout,
            stderr,
          })
        );
      });
    });
  }
}
