import chalk from 'chalk';
import * as path from 'path';
import { findAiFiles, parseAiFile, updateArtifacts } from '../../core/parser';
import { loadState, saveState, updateFileState, getFileState } from '../../core/state';
import { detectChanges, hasChanges, getFilesToProcess } from '../../core/detector';
import { buildPrompt } from '../../core/prompt';
import { getAgent } from '../../agents/interface';
import { AiFile, AiFileState, DotAiState } from '../../types';

interface GenOptions {
  force?: boolean;
}

export async function genCommand(targetPath?: string, options: GenOptions = {}): Promise<void> {
  try {
    const searchPath = targetPath || '.';
    const cwd = process.cwd();

    console.log(chalk.blue(`Scanning for .ai files in ${searchPath}...`));

    // Find all .ai files
    const aiFilePaths = await findAiFiles(searchPath);

    if (aiFilePaths.length === 0) {
      console.log(chalk.yellow('No .ai files found'));
      console.log(chalk.white('Create a .ai file first, or run "ai init" to get started'));
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
        const prompt = buildPrompt(aiFile, previousState);

        // Get agent
        const agent = getAgent(aiFile.frontmatter.agent);

        console.log(chalk.gray(`  Using agent: ${agent.name}`));

        // Invoke agent
        const result = await agent.invoke(prompt, {
          cwd,
          agentConfig: aiFile.frontmatter.agent_config,
          existingArtifacts: previousState?.artifacts,
        });

        if (!result.success) {
          console.log(chalk.red(`  ✗ Failed: ${result.error}`));
          failCount++;
          continue;
        }

        // Combine detected artifacts with existing frontmatter artifacts
        const allArtifacts = [
          ...new Set([...aiFile.frontmatter.artifacts, ...result.artifacts]),
        ];

        // Update artifacts in .ai file frontmatter
        if (allArtifacts.length > 0) {
          await updateArtifacts(aiFile.path, allArtifacts);
          console.log(chalk.gray(`  Updated artifacts (${allArtifacts.length} file(s))`));
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
  } catch (error) {
    console.error(chalk.red('Error during generation:'), error);
    process.exit(1);
  }
}
