import chalk from 'chalk';
import { findAiFiles, parseAiFile } from '../../core/parser';

export async function lsCommand(targetPath?: string): Promise<void> {
  try {
    const searchPath = targetPath || '.';

    console.log(chalk.blue(`Listing .ai files in ${searchPath}...`));
    console.log();

    // Find all .ai files
    const aiFilePaths = await findAiFiles(searchPath);

    if (aiFilePaths.length === 0) {
      console.log(chalk.yellow('No .ai files found'));
      return;
    }

    // Parse all .ai files
    const aiFiles = await Promise.all(aiFilePaths.map(parseAiFile));

    // Display each file with its artifacts
    for (const aiFile of aiFiles) {
      console.log(chalk.white.bold(aiFile.path));
      console.log(chalk.gray(`  Agent: ${aiFile.frontmatter.agent}`));

      if (aiFile.frontmatter.artifacts.length > 0) {
        console.log(chalk.gray(`  Artifacts (${aiFile.frontmatter.artifacts.length}):`));
        for (const artifact of aiFile.frontmatter.artifacts) {
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
