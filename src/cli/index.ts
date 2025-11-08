#!/usr/bin/env node

import { Command } from 'commander';
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

program
  .command('gen [path]')
  .description('Generate code from .ai files (defaults to current directory)')
  .option('-f, --force', 'Force regenerate all .ai files regardless of changes')
  .option('-p, --parallel', 'Enable parallel processing for multiple files (faster but output may interleave)')
  .option('-c, --concurrency <number>', 'Max number of concurrent files when using --parallel (default: 5, range: 1-20)', (value) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`--concurrency must be a number, got: ${value}`);
    }
    if (num < 1 || num > 20) {
      throw new Error(`--concurrency must be between 1 and 20, got: ${num}`);
    }
    return num;
  })
  .option('-a, --agent <name>', 'Coding agent to use (default: claude-code)', (value) => {
    // Security: Whitelist allowed agents to prevent path traversal and module loading attacks
    const ALLOWED_AGENTS = ['claude-code', 'cursor', 'aider'];
    if (!ALLOWED_AGENTS.includes(value)) {
      throw new Error(
        `Invalid agent: "${value}". Allowed agents: ${ALLOWED_AGENTS.join(', ')}`
      );
    }
    return value;
  }, 'claude-code')
  .option('--iterate', 'Enable iterative mode: re-run agent if it updates the spec (default: disabled)')
  .option('-i, --max-iterations <number>', 'Maximum iterations when using --iterate (default: 10, use "∞" for infinite)', (value) => {
    if (value === '∞' || value === 'Infinity') {
      return '∞';
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`--max-iterations must be a number or "∞", got: ${value}`);
    }
    if (num < 1) {
      throw new Error(`--max-iterations must be >= 1, got: ${num}`);
    }
    return num;
  }, 10)
  .allowUnknownOption() // Allow unknown flags to be forwarded to the coding agent
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
