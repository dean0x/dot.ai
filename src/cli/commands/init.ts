import chalk from 'chalk';
import { initializeDotAi } from '../../core/state';

export async function initCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Initializing .dotai directory...'));

    await initializeDotAi();

    console.log(chalk.green('✓ Created .dotai/ directory'));
    console.log(chalk.green('✓ Created .dotai/config.json'));
    console.log(chalk.green('✓ Created .dotai/state.json'));
    console.log(chalk.green('✓ Created .dotai/.gitignore'));
    console.log();
    console.log(chalk.white('Next steps:'));
    console.log(chalk.white('  1. Create a .ai file with your specification'));
    console.log(chalk.white('  2. Run: dot gen'));
  } catch (error) {
    console.error(chalk.red('Error initializing .dotai:'), error);
    process.exit(1);
  }
}
