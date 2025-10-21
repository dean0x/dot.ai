import chalk from 'chalk';
import { StateService } from '../../core/state-service';
import { NodeFileSystem } from '../../infrastructure/fs-adapter';
import { isErr } from '../../utils/result';

export async function initCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Initializing .dotai directory...'));

    // Create services with DI
    const fs = new NodeFileSystem();
    const stateService = new StateService(fs);

    // Initialize .dotai directory
    const result = await stateService.initializeDotAi(process.cwd());

    if (isErr(result)) {
      console.error(chalk.red('Error initializing .dotai:'), result.error.message);
      process.exit(1);
    }

    console.log(chalk.green('✓ Created .dotai/ directory'));
    console.log(chalk.green('✓ Created .dotai/config.json'));
    console.log(chalk.green('✓ Created .dotai/state.json'));
    console.log(chalk.green('✓ Created .dotai/.gitignore'));
    console.log();
    console.log(chalk.white('Next steps:'));
    console.log(chalk.white('  1. Create a .ai file with your specification'));
    console.log(chalk.white('  2. Run: dot gen'));
  } catch (error) {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  }
}
