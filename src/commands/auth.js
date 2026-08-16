import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import apiClient, { getApiBaseUrl } from '../lib/api.js';
import { setApiKey, deleteApiKey, getApiKey, maskApiKey } from '../lib/config.js';

export async function login() {
  console.log(chalk.cyan('👋 Welcome to SnippKit CLI v2!\n'));
  let answers;
  try {
    answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Paste your SnippKit API Key (sk_...):',
        mask: '*',
        validate: input => {
          const trimmed = input.trim();
          if (!trimmed) return 'API key cannot be empty';
          if (!trimmed.startsWith('sk_')) return 'Key must start with sk_';
          return true;
        }
      },
    ]);
  } catch (error) {
    if (error.message?.includes('force closed') || error.isTtyError) {
      console.log(chalk.yellow('\n✖ Login cancelled.'));
      return;
    }
    console.error(chalk.red('\n✖ Input error occurred.'));
    return;
  }

  const apiKey = answers.apiKey.trim();
  const spinner = ora(`Verifying credentials...`).start();

  try {
    const res = await apiClient.get('/api/cli/me', {
      headers: { 
        'Authorization': `Bearer ${apiKey}`
      }
    });
    setApiKey(apiKey);
    const data = res.data || {};
    const displayName = data.username ? `@${data.username}` : (data.email || 'Authenticated User');
    spinner.succeed(chalk.green(`Success! Authenticated as ${chalk.bold(displayName)}`));
  } catch (error) {
    const msg = error.response?.data?.error || error.message || 'Authentication request failed';
    spinner.fail(chalk.red(`Login failed: ${msg}`));
  }
}

export function logout() {
  const currentKey = getApiKey();
  if (!currentKey) {
    console.log(chalk.yellow('Not logged in.'));
    return;
  }
  deleteApiKey();
  console.log(chalk.green('Logged out successfully. Removed API key from local config.'));
}

export async function status() {
  const key = getApiKey();
  if (!key) {
    console.log(chalk.yellow('\nStatus: Not logged in.'));
    console.log(chalk.gray(`Run '${chalk.bold('snix auth login')}' to authenticate.\n`));
    return;
  }

  const spinner = ora('Fetching session status...').start();
  try {
    const { data } = await apiClient.get('/api/cli/me');
    spinner.stop();
    
    const userHandle = data.username ? `@${data.username}` : 'Not set';
    const email = data.email || 'N/A';

    console.log(chalk.bold.cyan('\nSnippKit Session Status\n'));
    console.log(`  ${chalk.bold('Status:')}        ${chalk.green('✓ Authenticated')}`);
    console.log(`  ${chalk.bold('User:')}          ${chalk.cyan(userHandle)}`);
    console.log(`  ${chalk.bold('Email:')}         ${email}`);
    console.log(`  ${chalk.bold('API Endpoint:')}  ${getApiBaseUrl()}`);
    console.log(`  ${chalk.bold('Credential:')}    Stored via Local Config (mode 0600)`);
    console.log(`  ${chalk.bold('Key Prefix:')}    ${maskApiKey(key)}\n`);
  } catch (error) {
    const msg = error.response?.data?.error || error.message || 'Session verification failed';
    spinner.fail(chalk.red(`Error fetching session status (${msg}).`));
    console.log(chalk.yellow(`Run '${chalk.bold('snix auth login')}' to update credentials.\n`));
  }
}

export const whoami = status;