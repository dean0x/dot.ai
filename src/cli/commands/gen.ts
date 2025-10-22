import chalk from 'chalk';
import * as path from 'path';
import * as readline from 'readline';
import { ParserService } from '../../core/parser-service';
import { StateService } from '../../core/state-service';
import { NodeFileSystem } from '../../infrastructure/fs-adapter';
import { CryptoHasher } from '../../infrastructure/hasher-adapter';
import { getFileState, updateFileState } from '../../core/state-core';
import { detectChanges, hasChanges, getFilesToProcess } from '../../core/detector';
import { buildPrompt } from '../../core/prompt';
import { getAgent } from '../../agents/interface';
import { AiFile, AiFileState, DotAiState } from '../../types';
import { isErr } from '../../utils/result';

interface GenOptions {
  force?: boolean;
}

// Maximum recursion depth to prevent infinite loops
const MAX_RECURSION_DEPTH = 10;

/**
 * Prompt user for confirmation
 */
async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Recursively scan directory for all files (excluding special directories)
 */
async function scanAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const fs = await import('fs/promises');
  const allFiles: string[] = [];

  async function walk(currentDir: string, depth: number = 0): Promise<void> {
    // Prevent infinite recursion
    if (depth > 50) return;

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip special directories
          const skipDirs = ['.dotai', 'node_modules', '.git', '.hg', '.svn'];
          if (skipDirs.includes(entry.name)) {
            continue;
          }
          // Recursively walk subdirectories
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          // Exclude .ai files and .gitignore
          if (entry.name.endsWith('.ai') || entry.name === '.gitignore') {
            continue;
          }
          // Store relative path from baseDir
          const relativePath = path.relative(baseDir, fullPath);
          allFiles.push(relativePath);
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
      if ((error as NodeJS.ErrnoException).code !== 'EACCES' &&
          (error as NodeJS.ErrnoException).code !== 'EPERM') {
        throw error;
      }
    }
  }

  await walk(dir);
  return allFiles;
}

interface RecursionMetrics {
  totalIterations: number;
  totalTimeMs: number;
  convergenceReason: 'natural' | 'max_depth' | 'error' | 'none';
  iterationTimes: number[];
}

/**
 * Process a single .ai file, potentially recursively
 */
async function processFileRecursively(
  aiFile: AiFile,
  state: DotAiState,
  parserService: ParserService,
  cwd: string,
  recursionDepth: number = 0,
  startTime: number = Date.now(),
  iterationTimes: number[] = []
): Promise<{
  success: boolean;
  updatedState: DotAiState;
  specChanged: boolean;
  metrics: RecursionMetrics;
}> {
  const iterationStartTime = Date.now();
  // Get previous state
  const previousState = getFileState(state, aiFile.path);
  const previousArtifacts = previousState?.artifacts || [];

  // Build prompt
  const promptResult = buildPrompt(aiFile, previousState);
  if (isErr(promptResult)) {
    console.log(chalk.red(`  ✗ Failed to build prompt: ${promptResult.error.message}`));
    const iterationTime = Date.now() - iterationStartTime;
    iterationTimes.push(iterationTime);
    return {
      success: false,
      updatedState: state,
      specChanged: false,
      metrics: {
        totalIterations: recursionDepth + 1,
        totalTimeMs: Date.now() - startTime,
        convergenceReason: 'error',
        iterationTimes,
      },
    };
  }
  const prompt = promptResult.value;

  // Get agent
  const agentResult = getAgent(aiFile.frontmatter.agent);
  if (isErr(agentResult)) {
    console.log(chalk.red(`  ✗ Failed to get agent: ${agentResult.error.message}`));
    const iterationTime = Date.now() - iterationStartTime;
    iterationTimes.push(iterationTime);
    return {
      success: false,
      updatedState: state,
      specChanged: false,
      metrics: {
        totalIterations: recursionDepth + 1,
        totalTimeMs: Date.now() - startTime,
        convergenceReason: 'error',
        iterationTimes,
      },
    };
  }
  const agent = agentResult.value;

  if (recursionDepth > 0) {
    console.log(chalk.cyan(`  ↻ Recursive iteration ${recursionDepth}`));
  }
  console.log(chalk.gray(`  Using agent: ${agent.name}`));

  // Invoke agent
  const result = await agent.invoke(prompt, {
    cwd,
    agentConfig: aiFile.frontmatter.agent_config,
    existingArtifacts: previousState?.artifacts,
  });

  // Clear separator after agent output
  console.log();
  console.log(chalk.gray(`  ─────────────────────────────────`));
  console.log(chalk.gray(`  Agent completed`));

  if (!result.success) {
    console.log(chalk.red(`  ✗ Failed: ${result.error}`));
    const iterationTime = Date.now() - iterationStartTime;
    iterationTimes.push(iterationTime);
    console.log(chalk.gray(`  Iteration time: ${(iterationTime / 1000).toFixed(1)}s`));
    return {
      success: false,
      updatedState: state,
      specChanged: false,
      metrics: {
        totalIterations: recursionDepth + 1,
        totalTimeMs: Date.now() - startTime,
        convergenceReason: 'error',
        iterationTimes,
      },
    };
  }

  // Combine detected artifacts with existing frontmatter artifacts
  let allArtifacts = [
    ...new Set([...aiFile.frontmatter.artifacts, ...result.artifacts]),
  ];

  // Fallback: Scan file system for new files if no artifacts detected
  if (allArtifacts.length === 0) {
    console.log(chalk.gray(`  No artifacts detected from output, scanning file system recursively...`));
    const filesBefore = previousState?.artifacts || [];

    // Recursively scan all files in project (excluding special directories)
    const filesNow = await scanAllFiles(cwd);

    // Find new files that weren't there before
    const newFiles = filesNow.filter(f => !filesBefore.includes(f));
    if (newFiles.length > 0) {
      allArtifacts = [...new Set([...filesBefore, ...newFiles])];
      console.log(chalk.gray(`  Found ${newFiles.length} new file(s) via recursive filesystem scan`));
    }
  }

  // Update artifacts in .ai file frontmatter
  if (allArtifacts.length > 0) {
    const updateResult = await parserService.updateArtifacts(aiFile.path, allArtifacts);
    if (isErr(updateResult)) {
      console.log(chalk.yellow(`  ⚠ Could not update artifacts: ${updateResult.error.message}`));
    } else {
      console.log(chalk.green(`  ✓ Tracked ${allArtifacts.length} artifact(s)`));
    }
  } else {
    console.log(chalk.yellow(`  ⚠ No artifacts detected`));
  }

  // Update state
  const newState: AiFileState = {
    lastHash: aiFile.hash,
    lastContent: aiFile.content,
    lastGenerated: new Date().toISOString(),
    artifacts: allArtifacts,
  };

  let updatedState = updateFileState(state, aiFile.path, newState);

  // Log iteration timing
  const iterationTime = Date.now() - iterationStartTime;
  iterationTimes.push(iterationTime);
  if (recursionDepth > 0) {
    console.log(chalk.gray(`  Iteration ${recursionDepth} time: ${(iterationTime / 1000).toFixed(1)}s`));
  }

  // Check if we should recurse (only if recursive mode is enabled)
  if (!aiFile.frontmatter.recursive) {
    return {
      success: true,
      updatedState,
      specChanged: false,
      metrics: {
        totalIterations: recursionDepth + 1,
        totalTimeMs: Date.now() - startTime,
        convergenceReason: 'none',
        iterationTimes,
      },
    };
  }

  // Re-parse the .ai file to check if the agent modified the spec
  const reparseResult = await parserService.parseAiFile(aiFile.path);
  if (isErr(reparseResult)) {
    console.log(chalk.yellow(`  ⚠ Could not re-parse file to check for spec changes: ${reparseResult.error.message}`));
    return {
      success: true,
      updatedState,
      specChanged: false,
      metrics: {
        totalIterations: recursionDepth + 1,
        totalTimeMs: Date.now() - startTime,
        convergenceReason: 'error',
        iterationTimes,
      },
    };
  }

  const updatedAiFile = reparseResult.value;

  // Check if the spec content changed (agent updated the .ai file to describe next task)
  const specChanged = updatedAiFile.content !== aiFile.content;

  if (!specChanged) {
    console.log(chalk.gray(`  ✓ Spec unchanged, agent indicates work is complete`));
    return {
      success: true,
      updatedState,
      specChanged: false,
      metrics: {
        totalIterations: recursionDepth + 1,
        totalTimeMs: Date.now() - startTime,
        convergenceReason: 'natural',
        iterationTimes,
      },
    };
  }

  // Spec changed - check if we can continue recursing
  const maxDepth = aiFile.frontmatter.max_recursion_depth ?? MAX_RECURSION_DEPTH;
  const isInfinite = maxDepth === "∞";

  if (!isInfinite && typeof maxDepth === 'number' && recursionDepth >= maxDepth) {
    console.log(chalk.yellow(`  ⚠ Maximum recursion depth (${maxDepth}) reached`));
    console.log(chalk.yellow(`  ⚠ Agent updated spec but cannot continue`));
    return {
      success: true,
      updatedState,
      specChanged: true,
      metrics: {
        totalIterations: recursionDepth + 1,
        totalTimeMs: Date.now() - startTime,
        convergenceReason: 'max_depth',
        iterationTimes,
      },
    };
  }

  // Continue recursing with updated spec
  console.log(chalk.cyan(`  ↻ Agent updated spec with next task, recursing...`));
  console.log();

  const recursiveResult = await processFileRecursively(
    updatedAiFile,
    updatedState,
    parserService,
    cwd,
    recursionDepth + 1,
    startTime,
    iterationTimes
  );

  return recursiveResult;
}

export async function genCommand(targetPath?: string, options: GenOptions = {}): Promise<void> {
  // Handle Ctrl+C gracefully
  let interrupted = false;
  const handleInterrupt = () => {
    if (!interrupted) {
      interrupted = true;
      console.log();
      console.log(chalk.yellow('\n⚠ Generation interrupted by user'));
      console.log(chalk.gray('State has been saved for completed files'));
      process.exit(130); // Standard exit code for SIGINT
    }
  };

  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  try {
    const searchPath = targetPath || '.';
    const cwd = process.cwd();

    console.log(chalk.blue(`Scanning for .ai files in ${searchPath}...`));

    // Create services with DI
    const fs = new NodeFileSystem();
    const hasher = new CryptoHasher();
    const parserService = new ParserService(fs, hasher);
    const stateService = new StateService(fs);

    // Find all .ai files
    const findResult = await parserService.findAiFiles(searchPath);
    if (isErr(findResult)) {
      console.error(chalk.red('Error finding .ai files:'), findResult.error.message);
      process.exit(1);
    }
    const aiFilePaths = findResult.value;

    if (aiFilePaths.length === 0) {
      console.log(chalk.yellow('No .ai files found'));
      console.log(chalk.white('Create a .ai file first, or run "dot init" to get started'));
      return;
    }

    console.log(chalk.white(`Found ${aiFilePaths.length} .ai file(s)`));

    // Parse all .ai files
    const parseResults = await Promise.all(aiFilePaths.map(p => parserService.parseAiFile(p)));

    // Check for errors and collect successful parses
    const aiFiles = [];
    for (const result of parseResults) {
      if (isErr(result)) {
        console.error(chalk.red(`Error parsing file: ${result.error.message}`));
        continue;
      }
      aiFiles.push(result.value);
    }

    // Load current state
    const stateResult = await stateService.loadState(cwd);
    if (isErr(stateResult)) {
      console.error(chalk.red('Error loading state:'), stateResult.error.message);
      process.exit(1);
    }
    let state = stateResult.value;

    // Detect changes
    const changes = detectChanges(aiFiles, state, options.force);

    if (!hasChanges(changes)) {
      console.log(chalk.white('No changes detected. All .ai files are up to date.'));
      console.log(chalk.gray('Use --force to regenerate anyway'));
      return;
    }

    // Get files to process
    const filesToProcess = getFilesToProcess(changes);

    // Check if any files have infinite recursion enabled
    const infiniteRecursionFiles = filesToProcess.filter(
      file => file.frontmatter.recursive && file.frontmatter.max_recursion_depth === "∞"
    );

    if (infiniteRecursionFiles.length > 0) {
      console.log();
      console.log(chalk.yellow('⚠ WARNING: Infinite recursion mode detected'));
      console.log(chalk.white(`  ${infiniteRecursionFiles.length} file(s) have recursive: true with max_recursion_depth: ∞`));
      console.log(chalk.gray('  Files:'));
      infiniteRecursionFiles.forEach(file => {
        console.log(chalk.gray(`    - ${path.basename(file.path)}`));
      });
      console.log();
      console.log(chalk.white('  These files will continue processing until the agent stops updating the spec.'));
      console.log(chalk.white('  This could potentially run for a very long time.'));
      console.log(chalk.gray('  (You can interrupt anytime with Ctrl+C)'));
      console.log();

      const confirmed = await promptUser(chalk.white('Continue? (y/n): '));

      if (!confirmed) {
        console.log(chalk.yellow('Operation cancelled by user'));
        process.off('SIGINT', handleInterrupt);
        process.off('SIGTERM', handleInterrupt);
        return;
      }
      console.log();
    }

    console.log(chalk.white(`Processing ${filesToProcess.length} file(s)...`));
    console.log();

    // Process each file sequentially
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const aiFile = filesToProcess[i];
      const fileNum = i + 1;
      const fileName = path.basename(aiFile.path);

      console.log(chalk.blue(`[${fileNum}/${filesToProcess.length}] Processing ${fileName}...`));

      try {
        // Process file (potentially recursively)
        const processResult = await processFileRecursively(
          aiFile,
          state,
          parserService,
          cwd
        );

        // Update state with result
        state = processResult.updatedState;

        if (processResult.success) {
          console.log(chalk.green(`  ✓ Success`));

          // Display metrics summary
          const metrics = processResult.metrics;
          if (metrics.totalIterations > 1 || aiFile.frontmatter.recursive) {
            console.log();
            console.log(chalk.white.bold(`  Recursion Summary:`));
            console.log(chalk.white(`    Total iterations: ${metrics.totalIterations}`));
            console.log(chalk.white(`    Total time: ${(metrics.totalTimeMs / 1000).toFixed(1)}s`));
            console.log(chalk.white(`    Average time per iteration: ${(metrics.totalTimeMs / metrics.totalIterations / 1000).toFixed(1)}s`));

            // Show convergence reason
            const convergenceMessages = {
              natural: chalk.green('    Convergence: Natural (spec stabilized)'),
              max_depth: chalk.yellow('    Convergence: Max depth reached'),
              error: chalk.red('    Convergence: Stopped due to error'),
              none: chalk.gray('    Convergence: Single iteration (non-recursive)'),
            };
            console.log(convergenceMessages[metrics.convergenceReason]);
          }

          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.log(chalk.red(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`));
        failCount++;
      }

      console.log();
    }

    // Save updated state
    const saveResult = await stateService.saveState(state, cwd);
    if (isErr(saveResult)) {
      console.error(chalk.red('Error saving state:'), saveResult.error.message);
      // Don't exit - generation succeeded, just state save failed
    }

    // Summary
    console.log(chalk.white.bold('Summary:'));
    if (successCount > 0) {
      console.log(chalk.green(`  ✓ ${successCount} file(s) processed successfully`));
    }
    if (failCount > 0) {
      console.log(chalk.red(`  ✗ ${failCount} file(s) failed`));
    }

    // Clean up signal handlers
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  } catch (error) {
    // Clean up signal handlers
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);

    console.error(chalk.red('Error during generation:'), error);
    process.exit(1);
  }
}
