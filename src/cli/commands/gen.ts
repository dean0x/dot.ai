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
import { OutputRenderer } from '../output-renderer';

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

interface SingleIterationResult {
  success: boolean;
  updatedState: DotAiState;
  updatedAiFile: AiFile | null;
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
  renderer: OutputRenderer
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
  const agentResult = getAgent(aiFile.frontmatter.agent);
  if (isErr(agentResult)) {
    renderer.error(`Failed to get agent: ${agentResult.error.message}`, agentResult.error);
    return { success: false, updatedState: state, updatedAiFile: null, specChanged: false };
  }
  const agent = agentResult.value;

  if (iteration > 0) {
    renderer.recursionIteration(iteration);
  }
  renderer.debug(`Using agent: ${agent.name}`);

  // Invoke agent
  renderer.startSpinner('Generating with ' + agent.name + '...');
  const result = await agent.invoke(prompt, {
    cwd,
    agentConfig: aiFile.frontmatter.agent_config,
    existingArtifacts: previousState?.artifacts,
  });
  renderer.stopSpinner();

  // Agent completed
  renderer.divider();
  renderer.debug('Agent completed');

  if (!result.success) {
    renderer.error(`Failed: ${result.error}`);
    return { success: false, updatedState: state, updatedAiFile: null, specChanged: false };
  }

  // Combine detected artifacts with existing frontmatter artifacts
  let allArtifacts = [
    ...new Set([...aiFile.frontmatter.artifacts, ...result.artifacts]),
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

  // Update artifacts in .ai file frontmatter
  if (allArtifacts.length > 0) {
    const updateResult = await parserService.updateArtifacts(aiFile.path, allArtifacts);
    if (isErr(updateResult)) {
      renderer.warning(`Could not update artifacts: ${updateResult.error.message}`);
    } else {
      renderer.artifactsTracked(allArtifacts.length, allArtifacts);
    }
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
 * Process a single .ai file with iterative recursion (no stack growth)
 */
async function processFileRecursively(
  aiFile: AiFile,
  state: DotAiState,
  parserService: ParserService,
  cwd: string,
  renderer: OutputRenderer
): Promise<{
  success: boolean;
  updatedState: DotAiState;
  specChanged: boolean;
  metrics: RecursionMetrics;
}> {
  const startTime = Date.now();
  const iterationTimes: number[] = [];
  let currentAiFile = aiFile;
  let currentState = state;
  let iteration = 0;
  let finalSuccess = true;
  let finalSpecChanged = false;
  let convergenceReason: 'natural' | 'max_depth' | 'error' | 'none' = 'none';

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
      renderer
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

    // Check if this is a non-recursive file
    if (!currentAiFile.frontmatter.recursive) {
      convergenceReason = 'none';
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
    const maxDepth = currentAiFile.frontmatter.max_recursion_depth ?? MAX_RECURSION_DEPTH;
    const isInfinite = maxDepth === "∞";

    if (!isInfinite && typeof maxDepth === 'number' && iteration >= maxDepth - 1) {
      renderer.warning(`Maximum recursion depth (${maxDepth}) reached`);
      renderer.warning('Agent updated spec but cannot continue');
      convergenceReason = 'max_depth';
      break;
    }

    // Continue with updated spec
    renderer.info('Agent updated spec with next task, recursing...');
    renderer.newline();

    currentAiFile = iterResult.updatedAiFile!;
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

export async function genCommand(targetPath?: string, options: GenOptions = {}): Promise<void> {
  // Create output renderer
  const renderer = new OutputRenderer();

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
    const cwd = process.cwd();

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

    // Load current state
    const stateResult = await stateService.loadState(cwd);
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

    // Check if any files have infinite recursion enabled
    const infiniteRecursionFiles = filesToProcess.filter(
      file => file.frontmatter.recursive && file.frontmatter.max_recursion_depth === "∞"
    );

    if (infiniteRecursionFiles.length > 0) {
      renderer.infiniteRecursionWarning(
        infiniteRecursionFiles.map(f => ({ path: f.path, name: path.basename(f.path) }))
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

    // Process each file sequentially
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const aiFile = filesToProcess[i];
      const fileNum = i + 1;
      const fileName = path.basename(aiFile.path);

      renderer.fileHeader(fileNum, filesToProcess.length, fileName);
      renderer.indent();

      try {
        // Process file (potentially recursively)
        const processResult = await processFileRecursively(
          aiFile,
          state,
          parserService,
          cwd,
          renderer
        );

        // Update state with result
        state = processResult.updatedState;

        if (processResult.success) {
          renderer.success('Success');

          // Display metrics summary
          const metrics = processResult.metrics;
          if (metrics.totalIterations > 1 || aiFile.frontmatter.recursive) {
            renderer.recursionSummary(metrics);
          }

          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        renderer.error(`Error: ${error instanceof Error ? error.message : String(error)}`, error as Error);
        failCount++;
      }

      renderer.unindent();
      renderer.newline();
    }

    // Save updated state
    const saveResult = await stateService.saveState(state, cwd);
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
