/**
 * OutputWriter interface for dependency injection
 * Separates rendering concerns from business logic (Functional Core/Imperative Shell pattern)
 */

/**
 * Tool display event - represents a tool being used
 */
export interface ToolDisplayEvent {
  toolId: string;
  toolName: string;
  displayText: string;
}

/**
 * Tool result event - represents a tool's completion
 */
export interface ToolResultEvent {
  toolId: string;
  toolName: string;
  result: string;
  isError: boolean;
}

/**
 * Text output event - represents assistant or user text
 */
export interface TextOutputEvent {
  text: string;
  source: 'assistant' | 'user';
}

/**
 * OutputWriter abstracts console output operations
 * Allows testing without mocking global console
 * Enables alternative rendering strategies (file, network, UI)
 */
export interface OutputWriter {
  /**
   * Start spinner for long-running operation
   */
  startSpinner(): void;

  /**
   * Stop spinner
   */
  stopSpinner(): void;

  /**
   * Display a tool being used (buffered until result arrives)
   */
  displayTool(event: ToolDisplayEvent): void;

  /**
   * Display tool result (pairs with tool use, may be out of order)
   */
  displayToolResult(event: ToolResultEvent): void;

  /**
   * Display text output from assistant or user
   */
  displayText(event: TextOutputEvent): void;

  /**
   * Flush any buffered output and ensure correct ordering
   */
  flush(): void;
}

/**
 * Console-based implementation of OutputWriter
 * Uses process.stdout for real-time console output with buffering
 */
export class ConsoleOutputWriter implements OutputWriter {
  private spinner: any | null = null;
  private toolQueue: string[] = [];
  private toolBuffer = new Map<string, {
    name: string;
    displayText: string;
    result?: string;
    isError?: boolean;
    completed: boolean;
  }>();

  constructor(private chalk: any, private ora: any) {}

  startSpinner(): void {
    this.spinner = this.ora({
      text: '',
      color: 'cyan',
      indent: 0,
    }).start();
  }

  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  displayTool(event: ToolDisplayEvent): void {
    // Buffer tool until result arrives
    this.toolQueue.push(event.toolId);
    this.toolBuffer.set(event.toolId, {
      name: event.toolName,
      displayText: event.displayText,
      completed: false,
    });
  }

  displayToolResult(event: ToolResultEvent): void {
    // Mark tool as completed with result
    const toolInfo = this.toolBuffer.get(event.toolId);
    if (toolInfo) {
      toolInfo.result = event.result;
      toolInfo.isError = event.isError;
      toolInfo.completed = true;
      this.flush(); // Try to display completed tools
    }
  }

  displayText(event: TextOutputEvent): void {
    const color = event.source === 'user' ? this.chalk.cyan : this.chalk.white;
    process.stdout.write(color(event.text) + '\n\n');
  }

  flush(): void {
    // Display all completed tools in order
    while (this.toolQueue.length > 0) {
      const nextToolId = this.toolQueue[0];
      const toolInfo = this.toolBuffer.get(nextToolId);

      if (toolInfo && toolInfo.completed) {
        // Display tool and result together
        process.stdout.write(toolInfo.displayText);
        if (toolInfo.result) {
          if (toolInfo.isError) {
            process.stdout.write(this.chalk.red(`✗ ${toolInfo.result}`) + '\n\n');
          } else {
            process.stdout.write(this.chalk.gray(`  `) + this.chalk.gray(toolInfo.result) + '\n\n');
          }
        } else {
          process.stdout.write('\n');
        }

        // Remove from queue and buffer
        this.toolQueue.shift();
        this.toolBuffer.delete(nextToolId);
      } else {
        // Next tool not ready yet, stop
        break;
      }
    }
  }
}
