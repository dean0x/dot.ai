import chalk from 'chalk';
import { StateService } from '../../core/state-service';
import { NodeFileSystem } from '../../infrastructure/fs-adapter';
import { isErr } from '../../utils/result';

export async function cleanCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Clearing generation state...'));

    // Create services with DI
    const fs = new NodeFileSystem();
    const stateService = new StateService(fs);

    // Clear state
    const result = await stateService.clearState(process.cwd());

    if (isErr(result)) {
      console.error(chalk.red('Error clearing state:'), result.error.message);
      process.exit(1);
    }

    console.log(chalk.green('✓ State cleared'));
    console.log(chalk.white('Next run of "dot gen" will regenerate all .ai files'));
  } catch (error) {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  }
}
