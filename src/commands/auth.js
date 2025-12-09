import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import apiClient from '../lib/api.js';
import { setApiKey, deleteApiKey, getApiKey } from '../lib/config.js';

export async function login() {
  console.log(chalk.cyan('👋 Welcome to SnippKit CLI!'));
  let answers;
  try {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Enter your SnippKit Username (without @):',
        validate: input => input.trim().length > 0 ? true : 'Username cannot be empty'
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Paste your API Key:',
        mask: '*',
        validate: input => input.startsWith('sk_') ? true : 'Key must start with sk_'
      },
    ]);
  } catch (error) {
    if (error.message.includes('force closed') || error.isTtyError) {
      console.log(chalk.yellow('\n✖ Login cancelled.'));
      process.exit(0);
    }
    console.error(chalk.red('\n✖ Input error occurred.'));
    process.exit(1);
  }

  const spinner = ora(`Verifying credentials...`).start();
  try {
    const res = await apiClient.get('/me', {
      headers: { 
        'Authorization': `Bearer ${answers.apiKey}`,
        'X-Snipp-Username': answers.username.trim()
      }
    });
    setApiKey(answers.apiKey);
    const displayName = res.data.username ? `@${res.data.username}` : res.data.email;
    spinner.succeed(chalk.green(`Success! Authenticated as ${chalk.bold(displayName)}`));
  } catch (error) {
    const msg = error.response?.data?.error || error.message;
    spinner.fail(chalk.red(`Login failed: ${msg}`));
  }
}

export function logout() {
  deleteApiKey();
  console.log(chalk.green('Logged out successfully.'));
}

export async function whoami() {
  if (!getApiKey()) return console.log(chalk.yellow('Not logged in.'));
  const spinner = ora('Fetching user info...').start();
  try {
    const { data } = await apiClient.get('/me');
    spinner.stop();
    const username = data.username ? `@${data.username}` : 'No username set';
    console.log(chalk.bold('User: ') + chalk.cyan(username));
  } catch (error) {
    spinner.fail(chalk.red('Error fetching user info.'));
  }
}