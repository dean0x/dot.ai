import chalk from 'chalk';
import { findAiFiles, parseAiFile } from '../../core/parser';
import { loadState } from '../../core/state';
import { detectChanges } from '../../core/detector';

export async function statusCommand(targetPath?: string): Promise<void> {
  try {
    const searchPath = targetPath || '.';

    console.log(chalk.blue(`Scanning for .ai files in ${searchPath}...`));

    // Find all .ai files
    const aiFilePaths = await findAiFiles(searchPath);

    if (aiFilePaths.length === 0) {
      console.log(chalk.yellow('No .ai files found'));
      return;
    }

    console.log(chalk.white(`Found ${aiFilePaths.length} .ai file(s)`));
    console.log();

    // Parse all .ai files
    const aiFiles = await Promise.all(aiFilePaths.map(parseAiFile));

    // Load state
    const state = await loadState();

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
