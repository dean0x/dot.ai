import chalk from 'chalk';
import { clearState } from '../../core/state';

export async function cleanCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Clearing generation state...'));

    await clearState();

    console.log(chalk.green('✓ State cleared'));
    console.log(chalk.white('Next run of "ai gen" will regenerate all .ai files'));
  } catch (error) {
    console.error(chalk.red('Error clearing state:'), error);
    process.exit(1);
  }
}
