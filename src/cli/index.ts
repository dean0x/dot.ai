#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { genCommand } from './commands/gen';
import { statusCommand } from './commands/status';
import { cleanCommand } from './commands/clean';
import { lsCommand } from './commands/ls';
import { registerAgent } from '../agents/interface';
import { ClaudeCodeAgent } from '../agents/claude-code';

// Register available agents
registerAgent(new ClaudeCodeAgent());

const program = new Command();

program
  .name('dot')
  .description('dot.ai - AI-powered code generation from .ai specification files')
  .version('0.1.0');

// Register commands
program
  .command('init')
  .description('Initialize .dotai directory structure')
  .action(initCommand);

program
  .command('gen [path]')
  .description('Generate code from .ai files (defaults to current directory)')
  .option('-f, --force', 'Force regenerate all .ai files regardless of changes')
  .option('-p, --parallel', 'Enable parallel processing for multiple files (faster but output may interleave)')
  .option('-c, --concurrency <number>', 'Max number of concurrent files when using --parallel (default: 5, range: 1-50)', (value) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`--concurrency must be a number, got: ${value}`);
    }
    if (num < 1 || num > 50) {
      throw new Error(`--concurrency must be between 1 and 50, got: ${num}`);
    }
    return num;
  })
  .action(genCommand);

program
  .command('status [path]')
  .description('Show which .ai files have changed (defaults to current directory)')
  .action(statusCommand);

program
  .command('clean')
  .description('Clear all generation state')
  .action(cleanCommand);

program
  .command('ls [path]')
  .description('List all .ai files and their artifacts (defaults to current directory)')
  .action(lsCommand);

program.parse();
