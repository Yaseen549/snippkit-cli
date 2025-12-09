import fs from 'fs';
import { Command } from 'commander';
import { login, logout, whoami } from './commands/auth.js';
import { listCommands, getCommand, pullCommand } from './commands/manage.js';
import { runSnippets } from './commands/run.js';

// --- VERSION STRATEGY ---
let version = '0.0.0';

// 1. If running as a compiled binary (.exe), use the injected version
if (globalThis.SNIX_VERSION) {
  version = globalThis.SNIX_VERSION;
} 
// 2. If running from NPM source, try to read package.json
else {
  try {
    // This looks up the file relative to the current module
    const packageJsonUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(packageJsonUrl, 'utf8'));
    version = pkg.version;
  } catch (e) {
    // If all else fails (rare), fallback to 0.0.0
    version = '0.0.0-fallback';
  }
}

const program = new Command();

program
  .name('snix')
  .description('Official CLI for SnippKit')
  .version(version);

// --- COMMANDS ---

// Auth
program.command('login').description('Login with API Key').action(login);
program.command('logout').description('Logout').action(logout);
program.command('whoami').description('Check current session').action(whoami);

// Run
program
  .command('run [ids...]')
  .description('Execute a command set or script')
  .option('-s, --script', 'Run as a code script (execute python/js/sh code)')
  .option('-c, --command', 'Run a command set (default)')
  .action((ids, options) => {
    const type = options.script ? 'scripts' : 'commands';
    runSnippets(ids, type);
  });

// List
program
  .command('list')
  .description('List your items')
  .option('-s, --snippets', 'List code snippets')
  .option('-c, --commands', 'List command sets (default)')
  .action((options) => {
    const type = options.snippets ? 'snippets' : 'commands';
    listCommands(type);
  });

// Get
program
  .command('get <id>')
  .description('View details or code')
  .option('-s, --snippet', 'Get snippet')
  .option('-c, --command', 'Get command')
  .action((id, options) => {
    const type = options.snippet ? 'snippets' : 'commands';
    getCommand(id, type);
  });

// Pull
program
  .command('pull <id>')
  .description('Download snippet/command to a local file')
  .option('-f, --file <path>', 'Output file path')
  .option('-s, --snippet', 'Pull as code snippet (raw text)')
  .action((id, options) => {
     pullCommand(id, options);
  });

program.parse(process.argv);