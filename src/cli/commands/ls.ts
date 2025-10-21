import chalk from 'chalk';
import { ParserService } from '../../core/parser-service';
import { NodeFileSystem } from '../../infrastructure/fs-adapter';
import { CryptoHasher } from '../../infrastructure/hasher-adapter';
import { isErr } from '../../utils/result';

export async function lsCommand(targetPath?: string): Promise<void> {
  try {
    const searchPath = targetPath || '.';

    console.log(chalk.blue(`Listing .ai files in ${searchPath}...`));
    console.log();

    // Create services with DI
    const fs = new NodeFileSystem();
    const hasher = new CryptoHasher();
    const parserService = new ParserService(fs, hasher);

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
