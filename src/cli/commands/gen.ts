import chalk from 'chalk';
import * as path from 'path';
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
 * Process a single .ai file, potentially recursively
 */
async function processFileRecursively(
  aiFile: AiFile,
  state: DotAiState,
  parserService: ParserService,
  cwd: string,
  recursionDepth: number = 0
): Promise<{ success: boolean; updatedState: DotAiState; artifactsChanged: boolean }> {
  // Get previous state
  const previousState = getFileState(state, aiFile.path);
  const previousArtifacts = previousState?.artifacts || [];

  // Build prompt
  const promptResult = buildPrompt(aiFile, previousState);
  if (isErr(promptResult)) {
    console.log(chalk.red(`  ✗ Failed to build prompt: ${promptResult.error.message}`));
    return { success: false, updatedState: state, artifactsChanged: false };
  }
  const prompt = promptResult.value;

  // Get agent
  const agentResult = getAgent(aiFile.frontmatter.agent);
  if (isErr(agentResult)) {
    console.log(chalk.red(`  ✗ Failed to get agent: ${agentResult.error.message}`));
    return { success: false, updatedState: state, artifactsChanged: false };
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
    return { success: false, updatedState: state, artifactsChanged: false };
  }

  // Combine detected artifacts with existing frontmatter artifacts
  let allArtifacts = [
    ...new Set([...aiFile.frontmatter.artifacts, ...result.artifacts]),
  ];

  // Fallback: Scan file system for new files if no artifacts detected
  if (allArtifacts.length === 0) {
    console.log(chalk.gray(`  No artifacts detected from output, scanning file system...`));
    const fs = await import('fs/promises');
    const filesBefore = previousState?.artifacts || [];

    // Get all files in current directory (excluding .dotai and .ai files)
    const entries = await fs.readdir(cwd, { withFileTypes: true });
    const filesNow = entries
      .filter(e => e.isFile() && !e.name.endsWith('.ai') && e.name !== '.gitignore')
      .map(e => e.name);

    // Find new files that weren't there before
    const newFiles = filesNow.filter(f => !filesBefore.includes(f));
    if (newFiles.length > 0) {
      allArtifacts = [...new Set([...filesBefore, ...newFiles])];
      console.log(chalk.gray(`  Found ${newFiles.length} new file(s) via filesystem scan`));
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

  // Check if artifacts changed
  const artifactsChanged = JSON.stringify([...allArtifacts].sort()) !== JSON.stringify([...previousArtifacts].sort());

  // Update state
  const newState: AiFileState = {
    lastHash: aiFile.hash,
    lastContent: aiFile.content,
    lastGenerated: new Date().toISOString(),
    artifacts: allArtifacts,
  };

  let updatedState = updateFileState(state, aiFile.path, newState);

  // Check if we should recurse
  if (aiFile.frontmatter.recursive && artifactsChanged && recursionDepth < MAX_RECURSION_DEPTH) {
    console.log(chalk.cyan(`  ↻ Recursive mode enabled, changes detected. Running again...`));
    console.log();

    // Re-parse the file to get updated content/hash
    const reparseResult = await parserService.parseAiFile(aiFile.path);
    if (isErr(reparseResult)) {
      console.log(chalk.yellow(`  ⚠ Could not re-parse file for recursion: ${reparseResult.error.message}`));
      return { success: true, updatedState, artifactsChanged };
    }

    // Recursively process again
    const recursiveResult = await processFileRecursively(
      reparseResult.value,
      updatedState,
      parserService,
      cwd,
      recursionDepth + 1
    );

    return recursiveResult;
  } else if (aiFile.frontmatter.recursive && recursionDepth >= MAX_RECURSION_DEPTH) {
    console.log(chalk.yellow(`  ⚠ Maximum recursion depth (${MAX_RECURSION_DEPTH}) reached`));
  } else if (aiFile.frontmatter.recursive && !artifactsChanged) {
    console.log(chalk.gray(`  ✓ No changes detected, recursion complete`));
  }

  return { success: true, updatedState, artifactsChanged };
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
