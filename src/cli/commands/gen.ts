import chalk from 'chalk';
import * as path from 'path';
import { findAiFiles, parseAiFile, updateArtifacts } from '../../core/parser';
import { loadState, saveState, updateFileState, getFileState } from '../../core/state';
import { detectChanges, hasChanges, getFilesToProcess } from '../../core/detector';
import { buildPrompt } from '../../core/prompt';
import { getAgent } from '../../agents/interface';
import { AiFile, AiFileState, DotAiState } from '../../types';
import { isErr } from '../../utils/result';

interface GenOptions {
  force?: boolean;
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

    // Find all .ai files
    const aiFilePaths = await findAiFiles(searchPath);

    if (aiFilePaths.length === 0) {
      console.log(chalk.yellow('No .ai files found'));
      console.log(chalk.white('Create a .ai file first, or run "dot init" to get started'));
      return;
    }

    console.log(chalk.white(`Found ${aiFilePaths.length} .ai file(s)`));

    // Parse all .ai files
    const aiFiles = await Promise.all(aiFilePaths.map(parseAiFile));

    // Load current state
    let state = await loadState();

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
        // Get previous state
        const previousState = getFileState(state, aiFile.path);

        // Build prompt
        const promptResult = buildPrompt(aiFile, previousState);
        if (isErr(promptResult)) {
          console.log(chalk.red(`  ✗ Failed to build prompt: ${promptResult.error.message}`));
          failCount++;
          continue;
        }
        const prompt = promptResult.value;

        // Get agent
        const agentResult = getAgent(aiFile.frontmatter.agent);
        if (isErr(agentResult)) {
          console.log(chalk.red(`  ✗ Failed to get agent: ${agentResult.error.message}`));
          failCount++;
          continue;
        }
        const agent = agentResult.value;

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
          failCount++;
          continue;
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
          await updateArtifacts(aiFile.path, allArtifacts);
          console.log(chalk.green(`  ✓ Tracked ${allArtifacts.length} artifact(s)`));
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

        state = updateFileState(state, aiFile.path, newState);

        console.log(chalk.green(`  ✓ Success`));
        successCount++;
      } catch (error) {
        console.log(chalk.red(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`));
        failCount++;
      }

      console.log();
    }

    // Save updated state
    await saveState(state);

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
