import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import apiClient, { getApiBaseUrl } from '../lib/api.js';
import { getApiKey, maskApiKey } from '../lib/config.js';

function checkCommand(cmd) {
  try {
    const isWin = process.platform === 'win32';
    const nullDevice = isWin ? 'NUL' : '/dev/null';
    execSync(`${cmd} > ${nullDevice} 2>&1`);
    return true;
  } catch (e) {
    return false;
  }
}

export async function doctor() {
  console.log(chalk.bold.cyan('\nSnippKit CLI Environment Doctor\n'));

  // 1. SYSTEM & NODE
  console.log(chalk.bold('System & Environment:'));
  console.log(`  ${chalk.green('✓')} Node.js          ${process.version}`);
  console.log(`  ${chalk.green('✓')} OS Platform      ${os.type()} ${os.arch()} (${os.release()})`);
  console.log(`  ${chalk.green('✓')} Configured API  ${getApiBaseUrl()}`);

  // 2. AUTHENTICATION & CONNECTIVITY
  const apiKey = getApiKey();
  const connSpinner = ora('Checking API connectivity & auth status...').start();
  if (!apiKey) {
    connSpinner.stop();
    console.log(`  ${chalk.yellow('⚠')} Authentication   Not logged in (Run 'snix auth login')`);
  } else {
    try {
      const res = await apiClient.get('/api/cli/me');
      connSpinner.stop();
      const handle = res.data?.username ? `@${res.data.username}` : (res.data?.email || 'OK');
      console.log(`  ${chalk.green('✓')} API Connectivity  200 OK (${getApiBaseUrl()})`);
      console.log(`  ${chalk.green('✓')} Authentication    Authenticated as ${chalk.bold(handle)} (${maskApiKey(apiKey)})`);
    } catch (e) {
      connSpinner.stop();
      console.log(`  ${chalk.red('✕')} API Connectivity  Failed to connect or 401 Unauthorized (${e.message})`);
    }
  }

  // 3. LANGUAGE RUNTIMES
  console.log(chalk.bold('\nLanguage Runtimes:'));

  const runtimes = [
    { name: 'JavaScript (node)', cmd: 'node -v' },
    { name: 'Python (python3)', cmd: 'python3 --version', fallbackCmd: 'python --version' },
    { name: 'TypeScript (ts-node)', cmd: 'npx ts-node -v' },
    { name: 'Go (go)', cmd: 'go version' },
    { name: 'Java (java)', cmd: 'java -version' },
    { name: 'Rust (rust-script)', cmd: 'rust-script --version' },
    { name: 'Ruby (ruby)', cmd: 'ruby -v' },
    { name: 'PHP (php)', cmd: 'php -v' },
    { name: 'PowerShell (pwsh)', cmd: 'pwsh -v', fallbackCmd: 'powershell -Command "$PSVersionTable"' },
    { name: 'Bash (bash)', cmd: 'bash --version' }
  ];

  let readyCount = 0;

  for (const r of runtimes) {
    let ok = checkCommand(r.cmd);
    if (!ok && r.fallbackCmd) {
      ok = checkCommand(r.fallbackCmd);
    }

    if (ok) {
      console.log(`  ${chalk.green('✓')} ${r.name.padEnd(25)} Available`);
      readyCount++;
    } else {
      console.log(`  ${chalk.gray('⚠')} ${r.name.padEnd(25)} Not found (Optional)`);
    }
  }

  console.log(chalk.bold.cyan(`\nDoctor Verdict: ${readyCount} runtime(s) ready.\n`));
}
