import chalk from 'chalk';
import * as path from 'path';
import * as readline from 'readline';
import pLimit from 'p-limit';
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
import { OutputRenderer } from '../output-renderer';

/**
 * Command options for the gen command
 */
interface GenCommandOptions {
  /** Force regenerate all .ai files regardless of changes */
  force?: boolean;
  /** Enable parallel processing for multiple files (opt-in for performance) */
  parallel?: boolean;
  /** Max number of concurrent files when using --parallel (default: 5, range: 1-20) */
  concurrency?: number;
  /** Coding agent to use (default: claude-code) */
  agent?: string;
  /** Enable iterative mode: re-run agent if it updates the spec (default: false) */
  iterate?: boolean;
  /** Maximum iterations when using --iterate (default: 10, use "∞" for infinite) */
  maxIterations?: number | "∞";
}

// Default maximum iterations to prevent infinite loops
const DEFAULT_MAX_ITERATIONS = 10;

// Default concurrency for parallel processing mode
const DEFAULT_CONCURRENCY = 5;

/**
 * Sanitize error messages by removing ANSI escape codes and control characters
 * Prevents log injection attacks via malicious .ai file content
 */
function sanitizeErrorMessage(message: string): string {
  // Remove ANSI escape codes (\x1b[...m)
  // Remove other control characters except newline and tab
  return message.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

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

/**
 * Metrics collected during iterative processing
 */
interface IterationMetrics {
  /** Total number of iterations executed */
  totalIterations: number;
  /** Total time spent in milliseconds across all iterations */
  totalTimeMs: number;
  /** Reason iteration stopped: 'natural' (agent signaled complete), 'max_iterations' (hit limit), 'error' (failure), 'single' (non-iterative mode) */
  convergenceReason: 'natural' | 'max_iterations' | 'error' | 'single';
  /** Time in milliseconds for each individual iteration */
  iterationTimes: number[];
}

/**
 * Result from processing a single iteration of an .ai file
 */
interface SingleIterationResult {
  /** Whether the iteration completed successfully */
  success: boolean;
  /** Updated state after processing this iteration */
  updatedState: DotAiState;
  /** Re-parsed .ai file after agent potentially modified it (null if re-parse failed) */
  updatedAiFile: AiFile | null;
  /** Whether the agent modified the spec content (triggers another iteration if true) */
  specChanged: boolean;
}

/**
 * Process a single iteration of an .ai file (no recursion)
 */
async function processSingleIteration(
  aiFile: AiFile,
  state: DotAiState,
  parserService: ParserService,
  cwd: string,
  iteration: number,
  renderer: OutputRenderer,
  agentName: string,
  agentConfig?: Record<string, unknown>,
  forwardedFlags?: string[]
): Promise<SingleIterationResult> {
  // Get previous state
  const previousState = getFileState(state, aiFile.path);

  // Build prompt
  const promptResult = buildPrompt(aiFile, previousState);
  if (isErr(promptResult)) {
    renderer.error(`Failed to build prompt: ${promptResult.error.message}`, promptResult.error);
    return { success: false, updatedState: state, updatedAiFile: null, specChanged: false };
  }
  const prompt = promptResult.value;

  // Get agent
  const agentResult = getAgent(agentName);
  if (isErr(agentResult)) {
    renderer.error(`Failed to get agent: ${agentResult.error.message}`, agentResult.error);
    return { success: false, updatedState: state, updatedAiFile: null, specChanged: false };
  }
  const agent = agentResult.value;

  if (iteration > 0) {
    renderer.recursionIteration(iteration);
  }

  // Invoke agent (no spinner, agent outputs tool usage directly)
  const result = await agent.invoke(prompt, {
    cwd,
    agentConfig,
    existingArtifacts: previousState?.artifacts,
    forwardedFlags,
  });

  if (!result.success) {
    // Security: Sanitize error message from agent output
    const errorMessage = result.error || 'Unknown error';
    renderer.error(`Failed: ${sanitizeErrorMessage(errorMessage)}`);
    return { success: false, updatedState: state, updatedAiFile: null, specChanged: false };
  }

  // Combine detected artifacts with previous artifacts from state
  const previousArtifacts = previousState?.artifacts || [];
  let allArtifacts = [
    ...new Set([...previousArtifacts, ...result.artifacts]),
  ];

  // Fallback: Scan file system for new files if no artifacts detected
  if (allArtifacts.length === 0) {
    renderer.startSpinner('No artifacts detected, scanning file system...');
    const filesBefore = previousState?.artifacts || [];

    // Recursively scan all files in project (excluding special directories)
    const filesNow = await scanAllFiles(cwd);

    // Find new files that weren't there before
    const newFiles = filesNow.filter(f => !filesBefore.includes(f));
    if (newFiles.length > 0) {
      allArtifacts = [...new Set([...filesBefore, ...newFiles])];
      renderer.succeedSpinner(`Found ${newFiles.length} new file(s) via filesystem scan`);
    } else {
      renderer.stopSpinner();
    }
  }

  // Display tracked artifacts
  if (allArtifacts.length > 0) {
    renderer.artifactsTracked(allArtifacts.length, allArtifacts);
  } else {
    renderer.warning('No artifacts detected');
  }

  // Update state
  const newState: AiFileState = {
    lastHash: aiFile.hash,
    lastContent: aiFile.content,
    lastGenerated: new Date().toISOString(),
    artifacts: allArtifacts,
  };

  const updatedState = updateFileState(state, aiFile.path, newState);

  // Re-parse the .ai file to check if the agent modified the spec
  const reparseResult = await parserService.parseAiFile(aiFile.path);
  if (isErr(reparseResult)) {
    renderer.warning(`Could not re-parse file to check for spec changes: ${reparseResult.error.message}`);
    return { success: true, updatedState, updatedAiFile: null, specChanged: false };
  }

  const updatedAiFile = reparseResult.value;

  // Check if the spec content changed
  const specChanged = updatedAiFile.content !== aiFile.content;

  return { success: true, updatedState, updatedAiFile, specChanged };
}

/**
 * Process a single file and return its updated state
 * Extracted to eliminate code duplication between sequential/parallel modes
 */
async function processSingleFile(
  aiFile: AiFile,
  state: DotAiState,
  parserService: ParserService,
  cwd: string,
  renderer: OutputRenderer,
  fileNum: number,
  totalFiles: number,
  agentName: string,
  iterate: boolean,
  maxIterations: number | "∞",
  agentConfig?: Record<string, unknown>,
  forwardedFlags?: string[]
): Promise<{
  success: boolean;
  filePath: string;
  fileState: AiFileState | undefined;
  metrics: IterationMetrics | undefined;
}> {
  const fileName = path.basename(aiFile.path);

  renderer.fileHeader(fileNum, totalFiles, fileName);
  renderer.indent();

  try {
    // Process file (potentially iteratively)
    const processResult = await processFileIteratively(
      aiFile,
      state,
      parserService,
      cwd,
      renderer,
      agentName,
      iterate,
      maxIterations,
      agentConfig,
      forwardedFlags
    );

    renderer.unindent();
    renderer.newline();

    if (processResult.success) {
      renderer.success('Success');

      // Display metrics summary
      const metrics = processResult.metrics;
      if (metrics.totalIterations > 1 || iterate) {
        renderer.iterationSummary(metrics);
      }

      return {
        success: true,
        filePath: aiFile.path,
        fileState: processResult.updatedState.files[aiFile.path],
        metrics
      };
    } else {
      return {
        success: false,
        filePath: aiFile.path,
        fileState: undefined,
        metrics: undefined
      };
    }
  } catch (error) {
    // Type safety: Convert non-Error values to Error objects
    const errorObj = error instanceof Error ? error : new Error(String(error));
    // Security: Sanitize error message to prevent ANSI injection
    renderer.error(`Error: ${sanitizeErrorMessage(errorObj.message)}`, errorObj);
    renderer.unindent();
    renderer.newline();
    return {
      success: false,
      filePath: aiFile.path,
      fileState: undefined,
      metrics: undefined
    };
  }
}

/**
 * Process a single .ai file with iterative recursion (no stack growth)
 */
async function processFileIteratively(
  aiFile: AiFile,
  state: DotAiState,
  parserService: ParserService,
  cwd: string,
  renderer: OutputRenderer,
  agentName: string,
  iterate: boolean,
  maxIterations: number | "∞",
  agentConfig?: Record<string, unknown>,
  forwardedFlags?: string[]
): Promise<{
  success: boolean;
  updatedState: DotAiState;
  specChanged: boolean;
  metrics: IterationMetrics;
}> {
  const startTime = Date.now();
  const iterationTimes: number[] = [];
  let currentAiFile = aiFile;
  let currentState = state;
  let iteration = 0;
  let finalSuccess = true;
  let finalSpecChanged = false;
  let convergenceReason: 'natural' | 'max_iterations' | 'error' | 'single' = 'single';

  // Iterative loop - no stack growth!
  while (true) {
    const iterationStartTime = Date.now();

    // Process one iteration
    const iterResult = await processSingleIteration(
      currentAiFile,
      currentState,
      parserService,
      cwd,
      iteration,
      renderer,
      agentName,
      agentConfig,
      forwardedFlags
    );

    // Track iteration time
    const iterationTime = Date.now() - iterationStartTime;
    iterationTimes.push(iterationTime);
    if (iteration > 0) {
      renderer.debug(`Iteration ${iteration} time: ${(iterationTime / 1000).toFixed(1)}s`);
    }

    // Update state for next iteration
    currentState = iterResult.updatedState;

    // Check if iteration failed
    if (!iterResult.success) {
      finalSuccess = false;
      convergenceReason = 'error';
      break;
    }

    // Check if iterative mode is disabled
    if (!iterate) {
      convergenceReason = 'single';
      break;
    }

    // Check if spec changed
    if (!iterResult.specChanged) {
      renderer.success('Spec unchanged, agent indicates work is complete');
      convergenceReason = 'natural';
      break;
    }

    finalSpecChanged = true;

    // Spec changed - check if we can continue
    const isInfinite = maxIterations === "∞";

    if (!isInfinite && typeof maxIterations === 'number' && iteration >= maxIterations - 1) {
      renderer.warning(`Maximum iterations (${maxIterations}) reached`);
      renderer.warning('Agent updated spec but cannot continue');
      convergenceReason = 'max_iterations';
      break;
    }

    // Continue with updated spec
    renderer.info('Agent updated spec with next task, iterating...');
    renderer.newline();

    // Type safety: Verify updatedAiFile exists before continuing
    if (!iterResult.updatedAiFile) {
      renderer.error('Internal error: Agent updated spec but updatedAiFile is missing');
      convergenceReason = 'error';
      break;
    }

    currentAiFile = iterResult.updatedAiFile;
    iteration++;
  }

  return {
    success: finalSuccess,
    updatedState: currentState,
    specChanged: finalSpecChanged,
    metrics: {
      totalIterations: iteration + 1,
      totalTimeMs: Date.now() - startTime,
      convergenceReason,
      iterationTimes,
    },
  };
}

export async function genCommand(targetPath?: string, cmdOptions: GenCommandOptions = {}, cmd?: any): Promise<void> {
  // Create output renderer
  const renderer = new OutputRenderer();

  // Extract known flags
  const knownFlags = new Set([
    'force', 'f',
    'parallel', 'p',
    'concurrency', 'c',
    'agent', 'a',
    'iterate',
    'maxIterations', 'max-iterations', 'i'
  ]);

  // Extract unknown flags to forward to the coding agent
  const forwardedFlags: string[] = [];
  if (cmd?.parent?.rawArgs) {
    const args = cmd.parent.rawArgs.slice(2); // Skip 'node' and script name
    let skipNext = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (skipNext) {
        skipNext = false;
        continue;
      }

      // Skip command name and known positional argument
      if (arg === 'gen' || (!arg.startsWith('-') && i === args.indexOf('gen') + 1)) {
        continue;
      }

      // Check if it's a flag
      if (arg.startsWith('-')) {
        const flagName = arg.replace(/^-+/, '').split('=')[0];

        if (!knownFlags.has(flagName)) {
          // This is an unknown flag - forward it
          if (arg.includes('=')) {
            // Flag with value: --flag=value
            forwardedFlags.push(arg);
          } else {
            // Flag might have separate value
            forwardedFlags.push(arg);
            // Check if next arg is the value (not a flag)
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
              forwardedFlags.push(args[i + 1]);
              skipNext = true;
            }
          }
        } else if (knownFlags.has(flagName) && !arg.includes('=') && i + 1 < args.length && !args[i + 1].startsWith('-')) {
          // Known flag with separate value - skip the value
          skipNext = true;
        }
      }
    }
  }

  // Build options with defaults
  const options = {
    force: cmdOptions.force || false,
    parallel: cmdOptions.parallel || false,
    concurrency: cmdOptions.concurrency,
    agent: cmdOptions.agent || 'claude-code',
    iterate: cmdOptions.iterate || false, // Default to false (opt-in)
    maxIterations: cmdOptions.maxIterations || DEFAULT_MAX_ITERATIONS,
    forwardedFlags
  };

  // Handle Ctrl+C gracefully
  let interrupted = false;
  const handleInterrupt = () => {
    if (!interrupted) {
      interrupted = true;
      renderer.newline();
      renderer.warning('Generation interrupted by user');
      renderer.debug('State has been saved for completed files');
      process.exit(130); // Standard exit code for SIGINT
    }
  };

  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  try {
    const searchPath = targetPath || '.';

    renderer.startSpinner(`Scanning for .ai files in ${searchPath}...`);

    // Create services with DI
    const fs = new NodeFileSystem();
    const hasher = new CryptoHasher();
    const parserService = new ParserService(fs, hasher);
    const stateService = new StateService(fs);

    // Find all .ai files
    const findResult = await parserService.findAiFiles(searchPath);
    if (isErr(findResult)) {
      renderer.stopSpinner();
      renderer.error('Error finding .ai files', findResult.error);
      process.exit(1);
    }
    const aiFilePaths = findResult.value;

    if (aiFilePaths.length === 0) {
      renderer.warnSpinner('No .ai files found');
      renderer.log('Create a .ai file first, or run "dot init" to get started');
      return;
    }

    renderer.succeedSpinner(`Found ${aiFilePaths.length} .ai file(s)`);

    // Parse all .ai files
    renderer.startSpinner('Parsing .ai files...');
    const parseResults = await Promise.all(aiFilePaths.map(p => parserService.parseAiFile(p)));

    // Check for errors and collect successful parses
    const aiFiles = [];
    for (const result of parseResults) {
      if (isErr(result)) {
        renderer.stopSpinner();
        renderer.error(`Error parsing file: ${result.error.message}`, result.error);
        continue;
      }
      aiFiles.push(result.value);
    }
    renderer.succeedSpinner(`Parsed ${aiFiles.length} file(s)`);

    // Initialize .dotai directory if it doesn't exist (auto-initialization)
    const projectRoot = process.cwd();
    const initResult = await stateService.initializeDotAi(projectRoot);
    if (isErr(initResult)) {
      // Only error if it's not "already exists"
      if (!initResult.error.message.includes('already exists')) {
        renderer.error('Error initializing .dotai', initResult.error);
        process.exit(1);
      }
    }

    // Load current state from project root
    const stateResult = await stateService.loadState(projectRoot);
    if (isErr(stateResult)) {
      renderer.error('Error loading state', stateResult.error);
      process.exit(1);
    }
    let state = stateResult.value;

    // Detect changes
    const changes = detectChanges(aiFiles, state, options.force);

    if (!hasChanges(changes)) {
      renderer.info('No changes detected. All .ai files are up to date.');
      renderer.debug('Use --force to regenerate anyway');
      return;
    }

    // Get files to process
    const filesToProcess = getFilesToProcess(changes);

    // Check if infinite recursion is enabled via CLI flags
    if (options.iterate && options.maxIterations === "∞" && filesToProcess.length > 0) {
      renderer.infiniteRecursionWarning(
        filesToProcess.map(f => ({ path: f.path, name: path.basename(f.path) }))
      );

      const confirmed = await promptUser(chalk.white('Continue? (y/n): '));

      if (!confirmed) {
        renderer.warning('Operation cancelled by user');
        process.off('SIGINT', handleInterrupt);
        process.off('SIGTERM', handleInterrupt);
        return;
      }
      renderer.newline();
    }

    renderer.header(`Processing ${filesToProcess.length} file(s)...`);

    let successCount = 0;
    let failCount = 0;

    /**
     * ARCHITECTURE: Dual Processing Modes
     *
     * Sequential Mode (default):
     * - Processes files one-at-a-time in order
     * - Clean, readable console output
     * - State updates applied immediately after each file
     * - No output interleaving or race conditions
     *
     * Parallel Mode (opt-in with --parallel):
     * - Processes up to N files concurrently using p-limit
     * - 5x faster for multi-file scenarios (e.g., 10 files: 5min → 1min)
     * - Console output may interleave (tool usage from different files)
     * - State updates batched and merged after all files complete
     * - Uses updateFileState() to prevent last-writer-wins bug
     *
     * Working Directory Isolation:
     * - Each agent runs in its .ai file's directory (path.dirname(aiFile.path))
     * - Reduces file conflicts in parallel mode (natural separation)
     * - Agents can still access project root files via relative paths (../../package.json)
     * - Example: button/button.ai → agent runs in button/ directory
     *
     * Design Decision: Sequential by default ensures best UX for v0.1.0.
     * Power users can opt-in to parallel mode when speed > readability.
     */
    if (options.parallel && filesToProcess.length > 1) {
      // PARALLEL MODE: Process multiple files concurrently with p-limit
      const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
      renderer.debug(`Parallel processing enabled (max ${concurrency} concurrent files)`);

      const limit = pLimit(concurrency);

      // Create processing tasks using extracted processSingleFile function
      const processingTasks = filesToProcess.map((aiFile, i) =>
        limit(() => {
          // Each agent runs in its .ai file's directory for better isolation
          const aiFileDir = path.dirname(aiFile.path);
          return processSingleFile(
            aiFile,
            state,
            parserService,
            aiFileDir,
            renderer,
            i + 1,
            filesToProcess.length,
            options.agent,
            options.iterate,
            options.maxIterations,
            undefined, // agentConfig - not supported yet
            options.forwardedFlags
          );
        })
      );

      // Wait for all files to process (allows partial success)
      // Use Promise.allSettled instead of Promise.all to prevent one failure from aborting all pending work
      const settledResults = await Promise.allSettled(processingTasks);

      /**
       * STATE MANAGEMENT: Merge file updates atomically
       *
       * Each parallel task returns only its file-specific state update.
       * We merge all updates sequentially using updateFileState() from state-core.
       *
       * This prevents the "last-writer-wins" bug where later results would
       * overwrite earlier results if we did `state = result.updatedState`.
       *
       * Example without proper merging (BUG):
       *   Task A: state = {files: {a, b, c}}  // Updates state
       *   Task B: state = {files: {a, b, d}}  // Overwrites, loses c!
       *
       * Example with proper merging (CORRECT):
       *   Task A: updateFileState(state, 'c.ai', cState)  // Adds c
       *   Task B: updateFileState(state, 'd.ai', dState)  // Adds d
       *   Final state: {files: {a, b, c, d}}  // All preserved ✓
       *
       * Note: Using Promise.allSettled allows partial success - if some files fail,
       * we still process the successful ones instead of aborting the entire batch.
       */
      for (const settledResult of settledResults) {
        if (settledResult.status === 'fulfilled') {
          const result = settledResult.value;
          if (result.success && result.fileState) {
            // Use updateFileState from state-core to properly merge the update
            state = updateFileState(state, result.filePath, result.fileState);
          }

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          // Task threw an exception (shouldn't happen with our error handling, but defensive)
          failCount++;
          renderer.error('Unexpected error in parallel processing', settledResult.reason);
        }
      }
    } else {
      // SEQUENTIAL MODE: Process files one at a time (default)
      for (let i = 0; i < filesToProcess.length; i++) {
        const aiFile = filesToProcess[i];

        // Each agent runs in its .ai file's directory for better isolation
        const aiFileDir = path.dirname(aiFile.path);

        // Use extracted processSingleFile function (eliminates duplication)
        const result = await processSingleFile(
          aiFile,
          state,
          parserService,
          aiFileDir,
          renderer,
          i + 1,
          filesToProcess.length,
          options.agent,
          options.iterate,
          options.maxIterations,
          undefined, // agentConfig - not supported yet
          options.forwardedFlags
        );

        // Update state with result (sequential mode updates immediately)
        if (result.success && result.fileState) {
          state = updateFileState(state, result.filePath, result.fileState);
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    // Save updated state to project root
    const saveResult = await stateService.saveState(state, projectRoot);
    if (isErr(saveResult)) {
      renderer.error('Error saving state', saveResult.error);
      // Don't exit - generation succeeded, just state save failed
    }

    // Summary
    renderer.summary(successCount, failCount);

    // Clean up signal handlers
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  } catch (error) {
    // Clean up signal handlers
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);

    renderer.error('Error during generation', error as Error);
    process.exit(1);
  }
}
