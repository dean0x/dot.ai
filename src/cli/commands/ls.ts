import chalk from 'chalk';
import { ParserService } from '../../core/parser-service';
import { StateService } from '../../core/state-service';
import { NodeFileSystem } from '../../infrastructure/fs-adapter';
import { CryptoHasher } from '../../infrastructure/hasher-adapter';
import { isErr } from '../../utils/result';
import { getFileState } from '../../core/state-core';

export async function lsCommand(targetPath?: string): Promise<void> {
  try {
    const searchPath = targetPath || '.';

    console.log(chalk.blue(`Listing .ai files in ${searchPath}...`));
    console.log();

    // Create services with DI
    const fs = new NodeFileSystem();
    const hasher = new CryptoHasher();
    const parserService = new ParserService(fs, hasher);
    const stateService = new StateService(fs);

    // Load state to get artifacts
    const stateResult = await stateService.loadState(process.cwd());
    const state = isErr(stateResult) ? { version: '0.1.0', files: {} } : stateResult.value;

    // Find all .ai files
    const findResult = await parserService.findAiFiles(searchPath);
    if (isErr(findResult)) {
      console.error(chalk.red('Error finding .ai files:'), findResult.error.message);
      process.exit(1);
    }
    const aiFilePaths = findResult.value;

    if (aiFilePaths.length === 0) {
      console.log(chalk.yellow('No .ai files found'));
      return;
    }

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

    // Display each file with its artifacts
    for (const aiFile of aiFiles) {
      console.log(chalk.white.bold(aiFile.path));

      // Get artifacts from state (no longer in frontmatter)
      const fileState = getFileState(state, aiFile.path);
      const artifacts = fileState?.artifacts || [];

      if (artifacts.length > 0) {
        console.log(chalk.gray(`  Artifacts (${artifacts.length}):`));
        for (const artifact of artifacts) {
          console.log(chalk.gray(`    • ${artifact}`));
        }
      } else {
        console.log(chalk.gray('  Artifacts: (none yet)'));
      }

      console.log();
    }

    console.log(chalk.white(`Total: ${aiFiles.length} .ai file(s)`));
  } catch (error) {
    console.error(chalk.red('Error listing .ai files:'), error);
    process.exit(1);
  }
}
