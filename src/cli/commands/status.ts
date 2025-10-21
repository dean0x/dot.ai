import chalk from 'chalk';
import { ParserService } from '../../core/parser-service';
import { StateService } from '../../core/state-service';
import { NodeFileSystem } from '../../infrastructure/fs-adapter';
import { CryptoHasher } from '../../infrastructure/hasher-adapter';
import { detectChanges } from '../../core/detector';
import { isErr } from '../../utils/result';

export async function statusCommand(targetPath?: string): Promise<void> {
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
      return;
    }

    console.log(chalk.white(`Found ${aiFilePaths.length} .ai file(s)`));
    console.log();

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

    // Load state
    const stateResult = await stateService.loadState(cwd);
    if (isErr(stateResult)) {
      console.error(chalk.red('Error loading state:'), stateResult.error.message);
      process.exit(1);
    }
    const state = stateResult.value;

    // Detect changes
    const changes = detectChanges(aiFiles, state);

    // Display results
    if (changes.new.length > 0) {
      console.log(chalk.green(`New (${changes.new.length}):`));
      for (const file of changes.new) {
        console.log(chalk.green(`  • ${file.path}`));
      }
      console.log();
    }

    if (changes.changed.length > 0) {
      console.log(chalk.yellow(`Changed (${changes.changed.length}):`));
      for (const file of changes.changed) {
        console.log(chalk.yellow(`  • ${file.path}`));
      }
      console.log();
    }

    if (changes.unchanged.length > 0) {
      console.log(chalk.gray(`Unchanged (${changes.unchanged.length}):`));
      for (const file of changes.unchanged) {
        console.log(chalk.gray(`  • ${file.path}`));
      }
      console.log();
    }

    // Summary
    const totalToProcess = changes.new.length + changes.changed.length;
    if (totalToProcess > 0) {
      console.log(chalk.blue(`Run "dot gen" to process ${totalToProcess} file(s)`));
    } else {
      console.log(chalk.white('No changes detected. All .ai files are up to date.'));
    }
  } catch (error) {
    console.error(chalk.red('Error checking status:'), error);
    process.exit(1);
  }
}
