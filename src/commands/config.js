import chalk from 'chalk';
import { getApiBaseUrl } from '../lib/api.js';
import { getApiKey, maskApiKey } from '../lib/config.js';

export function showConfig() {
  const key = getApiKey();
  console.log(chalk.bold.cyan('\nSnippKit CLI Configuration\n'));
  console.log(`  ${chalk.bold('API Base URL:')}   ${getApiBaseUrl()}`);
  console.log(`  ${chalk.bold('Auth Token:')}     ${key ? maskApiKey(key) : chalk.yellow('Not set')}`);
  console.log(`  ${chalk.bold('Config File Mode:')} 0600 (User Restricted)\n`);
}
