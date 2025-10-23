import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { DotAiError } from '../types/errors';

/**
 * OutputRenderer provides structured, user-friendly console output
 * with spinners, progress indicators, and consistent formatting.
 */
export class OutputRenderer {
  private spinner: Ora | null = null;
  private currentIndent = 0;

  /**
   * Start a spinner with a message
   */
  startSpinner(message: string): void {
    this.stopSpinner(); // Stop any existing spinner
    this.spinner = ora({
      text: message,
      color: 'cyan',
      indent: this.currentIndent * 2,
    }).start();
  }

  /**
   * Update spinner text
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop spinner with success
   */
  succeedSpinner(message?: string): void {
    if (this.spinner) {
      if (message) {
        this.spinner.succeed(message);
      } else {
        this.spinner.succeed();
      }
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with failure
   */
  failSpinner(message?: string): void {
    if (this.spinner) {
      if (message) {
        this.spinner.fail(message);
      } else {
        this.spinner.fail();
      }
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with warning
   */
  warnSpinner(message?: string): void {
    if (this.spinner) {
      if (message) {
        this.spinner.warn(message);
      } else {
        this.spinner.warn();
      }
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without status
   */
  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Increase indentation level
   */
  indent(): void {
    this.currentIndent++;
  }

  /**
   * Decrease indentation level
   */
  unindent(): void {
    if (this.currentIndent > 0) {
      this.currentIndent--;
    }
  }

  /**
   * Reset indentation to zero
   */
  resetIndent(): void {
    this.currentIndent = 0;
  }

  /**
   * Get indentation prefix
   */
  private getIndent(): string {
    return '  '.repeat(this.currentIndent);
  }

  /**
   * Print a section header
   */
  header(message: string): void {
    this.stopSpinner();
    console.log();
    console.log(chalk.bold.white(this.getIndent() + message));
  }

  /**
   * Print a subheader
   */
  subheader(message: string): void {
    this.stopSpinner();
    console.log(chalk.white(this.getIndent() + message));
  }

  /**
   * Print an info message
   */
  info(message: string): void {
    this.stopSpinner();
    console.log(chalk.blue(this.getIndent() + message));
  }

  /**
   * Print a success message
   */
  success(message: string): void {
    this.stopSpinner();
    console.log(chalk.green(this.getIndent() + '✓ ' + message));
  }

  /**
   * Print an error message
   */
  error(message: string, error?: Error | DotAiError): void {
    this.stopSpinner();
    console.log(chalk.red(this.getIndent() + '✗ ' + message));

    if (error) {
      this.indent();
      if ('code' in error && 'details' in error) {
        // DotAiError with code
        console.log(chalk.gray(this.getIndent() + `Error: ${error.message}`));
        console.log(chalk.gray(this.getIndent() + `Code: ${error.code}`));
        if (error.details && Object.keys(error.details).length > 0) {
          console.log(chalk.gray(this.getIndent() + `Details: ${JSON.stringify(error.details, null, 2)}`));
        }
      } else {
        // Regular Error
        console.log(chalk.gray(this.getIndent() + error.message));
        if (error.stack) {
          console.log(chalk.gray(this.getIndent() + error.stack));
        }
      }
      this.unindent();
    }
  }

  /**
   * Print a warning message
   */
  warning(message: string): void {
    this.stopSpinner();
    console.log(chalk.yellow(this.getIndent() + '⚠ ' + message));
  }

  /**
   * Print a debug/gray message
   */
  debug(message: string): void {
    this.stopSpinner();
    console.log(chalk.gray(this.getIndent() + message));
  }

  /**
   * Print a plain message
   */
  log(message: string): void {
    this.stopSpinner();
    console.log(this.getIndent() + message);
  }

  /**
   * Print a blank line
   */
  newline(): void {
    this.stopSpinner();
    console.log();
  }

  /**
   * Print a divider line
   */
  divider(): void {
    this.stopSpinner();
    console.log(chalk.gray(this.getIndent() + '─'.repeat(40)));
  }

  /**
   * Print a file processing header
   */
  fileHeader(fileNum: number, totalFiles: number, fileName: string): void {
    this.stopSpinner();
    this.newline();
    console.log(
      chalk.blue(`${this.getIndent()}[${fileNum}/${totalFiles}] `) +
      chalk.white.bold(fileName)
    );
  }

  /**
   * Print artifact tracking info
   */
  artifactsTracked(count: number, artifacts: string[]): void {
    this.stopSpinner();
    console.log(chalk.green(this.getIndent() + `✓ Tracked ${count} artifact(s)`));

    if (artifacts.length > 0 && artifacts.length <= 10) {
      this.indent();
      artifacts.forEach(artifact => {
        console.log(chalk.gray(this.getIndent() + `• ${artifact}`));
      });
      this.unindent();
    } else if (artifacts.length > 10) {
      this.indent();
      artifacts.slice(0, 10).forEach(artifact => {
        console.log(chalk.gray(this.getIndent() + `• ${artifact}`));
      });
      console.log(chalk.gray(this.getIndent() + `... and ${artifacts.length - 10} more`));
      this.unindent();
    }
  }

  /**
   * Print recursion iteration header
   */
  recursionIteration(iteration: number): void {
    this.stopSpinner();
    console.log(chalk.cyan(this.getIndent() + `↻ Iteration ${iteration}`));
  }

  /**
   * Print recursion summary
   */
  recursionSummary(metrics: {
    totalIterations: number;
    totalTimeMs: number;
    convergenceReason: 'natural' | 'max_depth' | 'error' | 'none';
  }): void {
    this.stopSpinner();
    this.newline();
    console.log(chalk.white.bold(this.getIndent() + 'Recursion Summary:'));
    this.indent();
    console.log(chalk.white(this.getIndent() + `Total iterations: ${metrics.totalIterations}`));
    console.log(chalk.white(this.getIndent() + `Total time: ${(metrics.totalTimeMs / 1000).toFixed(1)}s`));
    console.log(chalk.white(this.getIndent() + `Average: ${(metrics.totalTimeMs / metrics.totalIterations / 1000).toFixed(1)}s per iteration`));

    const convergenceMessages = {
      natural: chalk.green(this.getIndent() + 'Convergence: Natural (spec stabilized)'),
      max_depth: chalk.yellow(this.getIndent() + 'Convergence: Max depth reached'),
      error: chalk.red(this.getIndent() + 'Convergence: Stopped due to error'),
      none: chalk.gray(this.getIndent() + 'Convergence: Single iteration (non-recursive)'),
    };
    console.log(convergenceMessages[metrics.convergenceReason]);
    this.unindent();
  }

  /**
   * Print final summary
   */
  summary(successCount: number, failCount: number): void {
    this.stopSpinner();
    this.newline();
    console.log(chalk.white.bold('Summary:'));
    if (successCount > 0) {
      console.log(chalk.green(`  ✓ ${successCount} file(s) processed successfully`));
    }
    if (failCount > 0) {
      console.log(chalk.red(`  ✗ ${failCount} file(s) failed`));
    }
  }

  /**
   * Print warning box for infinite recursion
   */
  infiniteRecursionWarning(files: Array<{path: string; name: string}>): void {
    this.stopSpinner();
    this.newline();
    console.log(chalk.yellow.bold('⚠ WARNING: Infinite recursion mode detected'));
    this.newline();
    console.log(chalk.white(`  ${files.length} file(s) configured with recursive: true and max_recursion_depth: ∞`));
    this.newline();
    console.log(chalk.gray('  Files:'));
    files.forEach(file => {
      console.log(chalk.gray(`    • ${file.name}`));
    });
    this.newline();
    console.log(chalk.white('  These files will continue until the agent stops updating the spec.'));
    console.log(chalk.white('  This could run for a very long time.'));
    console.log(chalk.gray('  (Interrupt anytime with Ctrl+C)'));
    this.newline();
  }
}
