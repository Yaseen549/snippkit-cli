import { Command } from 'commander';
import { VERSION } from './version.js';
import { login, logout, status, whoami } from './commands/auth.js';
import { listItems, showItem, pullItem, deleteItem, warnDeprecated } from './commands/manage.js';
import { runSnippets } from './commands/run.js';
import { pushFiles } from './commands/push.js';
import { doctor } from './commands/doctor.js';
import { search } from './commands/search.js';
import { showConfig } from './commands/config.js';
import { addSkill, listSkills, removeSkill, viewSkill, searchSkills, initSkill, pushSkill } from './commands/skill.js';

const program = new Command();

program
  .name('snix')
  .description('Official Terminal Companion for SnippKit — Manage, run, pull, push snippets, playbooks & AI agent skills')
  .version(VERSION, '-v, --version', 'Output current CLI version');

// Customizing Main Help Output Layout
program.addHelpText('after', `
EXAMPLES
  $ snix auth login
  $ snix skill add premium-ui-architect
  $ snix skill list
  $ snix snippets list
  $ snix run hello-python
  $ snix script sync-db
  $ snix cmd setup-environment
  $ snix push ./scripts/*.py --folder "Python/Automation"
  $ snix snippets delete format-json
  $ snix doctor

For detailed command information, run:
  $ snix <command> --help
`);

// =========================================================
// 1. AUTHENTICATION (auth login, logout, status)
// =========================================================
const authGroup = program.command('auth').description('Manage authentication session and API key credentials');

authGroup.command('login')
  .description('Authenticate with your SnippKit API Key (sk_...). Stored in AES-256-GCM encrypted local vault.')
  .action(login);

authGroup.command('logout')
  .description('Log out and remove encrypted API key from local config')
  .action(logout);

authGroup.command('status')
  .description('Show current authenticated user handle, email, API base URL, and key prefix')
  .action(status);

authGroup.addHelpText('after', `
EXAMPLES
  $ snix auth login
  $ snix auth status
  $ snix auth logout
`);

// Top-level aliases
program.command('whoami').description('Check current login session (shortcut for snix auth status)').action(whoami);
program.command('login', { hidden: true }).action(() => {
  warnDeprecated('snix login', 'snix auth login');
  login();
});
program.command('logout', { hidden: true }).action(() => {
  warnDeprecated('snix logout', 'snix auth logout');
  logout();
});

// =========================================================
// 2. SNIPPETS MANAGEMENT (snippets list, show, pull, delete)
// =========================================================
const registerSnippetCommands = (cmdGroup) => {
  cmdGroup.command('list')
    .description('List your saved code snippets (shows ID/slug, title, language)')
    .action(() => listItems('snippets'));

  cmdGroup.command('show <id>')
    .description('View snippet source code with syntax highlighting')
    .action((id) => showItem(id, 'snippets'));

  cmdGroup.command('pull <id>')
    .description('Download code snippet source to a local file')
    .option('-f, --file <path>', 'Custom output filepath (defaults to slug.ext)')
    .action((id, options) => pullItem(id, { ...options, type: 'snippets' }));

  cmdGroup.command('delete <ids...>')
    .alias('rm')
    .alias('remove')
    .description('Delete one or more code snippets permanently from SnippKit database')
    .option('-y, --yes', 'Bypass deletion confirmation prompt')
    .action((ids, options) => deleteItem(ids, { ...options, type: 'snippets' }));
};

const snippetsCmd = program.command('snippets').description('Manage code snippets (list, show, pull, delete)');
registerSnippetCommands(snippetsCmd);
snippetsCmd.addHelpText('after', `
EXAMPLES
  $ snix snippets list
  $ snix snippets show format-json
  $ snix snippets pull format-json -f format.py
  $ snix snippets delete format-json clean-db
`);

// Singular alias: snippet
const snippetAliasCmd = program.command('snippet', { hidden: true }).description('Manage code snippets (alias)');
registerSnippetCommands(snippetAliasCmd);

// =========================================================
// 3. COMMAND PLAYBOOKS MANAGEMENT (commands list, show, pull, delete)
// =========================================================
const registerPlaybookCommands = (cmdGroup) => {
  cmdGroup.command('list')
    .description('List saved multi-step command playbooks (shows ID/slug, title, step count)')
    .action(() => listItems('commands'));

  cmdGroup.command('show <id>')
    .description('View command playbook steps and shell directives')
    .action((id) => showItem(id, 'commands'));

  cmdGroup.command('pull <id>')
    .description('Download command playbook definition to a local JSON file')
    .option('-f, --file <path>', 'Custom output filepath (defaults to slug.json)')
    .action((id, options) => pullItem(id, { ...options, type: 'commands' }));

  cmdGroup.command('delete <ids...>')
    .alias('rm')
    .alias('remove')
    .description('Delete one or more command playbooks permanently from SnippKit database')
    .option('-y, --yes', 'Bypass deletion confirmation prompt')
    .action((ids, options) => deleteItem(ids, { ...options, type: 'commands' }));
};

const commandsCmd = program.command('commands').description('Manage command playbooks (list, show, pull, delete)');
registerPlaybookCommands(commandsCmd);
commandsCmd.addHelpText('after', `
EXAMPLES
  $ snix commands list
  $ snix commands show setup-dev-env
  $ snix commands pull setup-dev-env -f playbook.json
  $ snix commands delete setup-dev-env deploy-app
`);

// Singular alias: command
const commandAliasCmd = program.command('command', { hidden: true }).description('Manage command playbooks (alias)');
registerPlaybookCommands(commandAliasCmd);

// Direct top-level shortcuts for delete / rm
program.command('delete <ids...>')
  .alias('rm')
  .alias('remove')
  .description('Delete one or more snippets or command playbooks permanently by ID or slug (safely prompts if ambiguous)')
  .option('--snippet', 'Delete explicitly as code snippet')
  .option('--command', 'Delete explicitly as command playbook')
  .option('-y, --yes', 'Bypass deletion confirmation prompt (refuses to delete if slug is ambiguous across types)')
  .action((ids, options) => {
    deleteItem(ids, options);
  });

// =========================================================
// 4. CENTRALIZED EXECUTION ENGINE (run, script, cmd)
// =========================================================
const runCmd = program
  .command('run [ids...]')
  .description('Execute a code script or command playbook (auto-detects type if un-specified)')
  .option('-s, --script', 'Execute explicitly as code script snippet')
  .option('--snippet', 'Execute explicitly as code script snippet (alias)')
  .option('-c, --cmd', 'Execute explicitly as command playbook')
  .option('--command', 'Execute explicitly as command playbook (alias)')
  .option('-y, --yes', 'Non-interactive mode (bypasses playbook trust confirmation prompt)');

runCmd.command('script <id>')
  .description('Execute a single code script snippet (shell: false)')
  .action((id) => runSnippets([id], 'script'));

runCmd.command('scripts <ids...>')
  .description('Execute multiple code script snippets sequentially (shell: false)')
  .action((ids) => runSnippets(Array.isArray(ids) ? ids : [ids], 'script'));

runCmd.command('command <id>')
  .description('Execute a single command playbook (uses system shell; prompts confirmation unless -y)')
  .option('-y, --yes', 'Bypass playbook execution warning prompt')
  .action((id, options) => runSnippets([id], 'cmd', options));

runCmd.command('commands <ids...>')
  .description('Execute multiple command playbooks sequentially (uses system shell; prompts confirmation unless -y)')
  .option('-y, --yes', 'Bypass playbook execution warning prompt')
  .action((ids, options) => runSnippets(Array.isArray(ids) ? ids : [ids], 'cmd', options));

runCmd.command('cmd <ids...>', { hidden: true })
  .description('Execute command playbook (alias)')
  .option('-y, --yes', 'Bypass playbook execution warning prompt')
  .action((ids, options) => runSnippets(Array.isArray(ids) ? ids : [ids], 'cmd', options));

runCmd.action((ids, options) => {
  if (options.script || options.snippet) {
    runSnippets(ids, 'script', options);
  } else if (options.cmd || options.command) {
    runSnippets(ids, 'cmd', options);
  } else {
    runSnippets(ids, 'smart', options);
  }
});

runCmd.addHelpText('after', `
SECURITY NOTE
  - Scripts execute via direct executable call (shell: false) in OS temp directories.
  - Playbooks run shell commands with current user permissions; interactive execution prompts for confirmation.

EXAMPLES
  $ snix run format-json
  $ snix run script hello-python
  $ snix run cmd setup-workspace --yes
`);

// Fast Shortcuts: script & cmd
program.command('script <ids...>')
  .description('Execute a code script directly (shortcut for snix run script <ids...>)')
  .action((ids) => runSnippets(Array.isArray(ids) ? ids : [ids], 'script'));

program.command('cmd <ids...>')
  .description('Execute a command playbook directly (shortcut for snix run cmd <ids...>)')
  .option('-y, --yes', 'Bypass playbook trust confirmation prompt')
  .action((ids, options) => runSnippets(Array.isArray(ids) ? ids : [ids], 'cmd', options));

// =========================================================
// 5. UPLOAD / PUSH COMMAND (push <files...>)
// =========================================================
program.command('push <files...>')
  .description('Upload local files or directories as SnippKit snippets')
  .option('-r, --recursive', 'Scan subdirectories recursively when uploading folders')
  .option('-p, --public, --public-all', 'Set snippet visibility to Public for all files')
  .option('--private, --private-all', 'Set snippet visibility to Private for all files (default)')
  .option('--folder <path>', 'Specify target folder path (e.g. "Python/Automation")')
  .option('--title <title>', 'Specify custom snippet title')
  .option('-s, --slug <slug>', 'Specify custom unique URL slug')
  .option('--language <lang>', 'Specify language override (Python, JavaScript, Go, etc.)')
  .option('-y, --yes', 'Non-interactive mode (accept all intelligent defaults)')
  .action((files, options) => pushFiles(files, options))
  .addHelpText('after', `
AUTOMATIC DEFAULTS & SAFETY
  - Title: Filename without extension
  - Slug: Auto-generated from title or custom via --slug <slug>
  - Language: Auto-detected from file extension (.py -> Python, .js -> JavaScript)
  - Visibility: PRIVATE by default. Use -p / --public or inline :public / :private modifiers.
  - Rate Limit Protection: Maximum 20 files per batch (Upstash rate limit safety)
  - Safety Exclusions: Automatically filters .env, credentials, SSH keys, .git, node_modules, binaries

EXAMPLES
  $ snix push script.py --public
  $ snix push file1.py:private file2.js:public
  $ snix push ./scripts/ --recursive -p --folder "DevOps/Scripts" --yes
`);

// =========================================================
// 6. AI AGENT SKILLS MANAGEMENT (skill add, list, remove, view, search, init)
// =========================================================
const registerSkillCommands = (cmdGroup) => {
  cmdGroup.command('add <identifier>')
    .alias('install')
    .alias('get')
    .description('Download and install an AI agent skill into the local project (.agents, .cursor, .windsurf)')
    .option('-t, --target <env>', 'Target agent environment (antigravity, cursor, windsurf, claude)')
    .option('-f, --force', 'Overwrite existing skill file without prompting')
    .option('-o, --out <path>', 'Custom destination output path')
    .action(addSkill);

  cmdGroup.command('list')
    .alias('ls')
    .description('List installed AI agent skills in current workspace (or remote skills with --remote)')
    .option('-r, --remote', 'Fetch skills from SnippKit library instead of local files')
    .action(listSkills);

  cmdGroup.command('remove <identifier>')
    .alias('rm')
    .alias('delete')
    .alias('uninstall')
    .description('Remove an AI agent skill from local workspace')
    .option('-y, --yes', 'Bypass confirmation prompt')
    .action(removeSkill);

  cmdGroup.command('view <identifier>')
    .alias('show')
    .alias('info')
    .description('Display skill metadata and instruction preview without installing')
    .action(viewSkill);

  cmdGroup.command('search <query>')
    .description('Search public agent skills on SnippKit directory')
    .action(searchSkills);

  cmdGroup.command('init <name>')
    .description('Scaffold a new AI agent skill template in the local project')
    .option('-t, --target <env>', 'Target agent environment (antigravity, cursor, windsurf, claude)')
    .option('-f, --force', 'Overwrite existing file')
    .action(initSkill);

  cmdGroup.command('push <path>')
    .alias('publish')
    .description('Publish a local skill markdown file (.agents, .cursor) to SnippKit')
    .option('-p, --public', 'Publish as public skill visible to community (default)')
    .option('--private', 'Publish as private encrypted skill')
    .option('-s, --slug <slug>', 'Custom skill slug')
    .option('--title <title>', 'Custom skill title')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(pushSkill);
};

const skillCmd = program.command('skill').description('Manage, install, and discover AI agent skills (Antigravity, Cursor, Windsurf)');
registerSkillCommands(skillCmd);
skillCmd.addHelpText('after', `
EXAMPLES
  $ snix skill add premium-ui-architect
  $ snix skill add @unhuman/premium-ui-architect --target cursor
  $ snix skill list
  $ snix skill list --remote
  $ snix skill view premium-ui-architect
  $ snix skill search ui
  $ snix skill remove premium-ui-architect
  $ snix skill init my-custom-agent-skill
`);

// Plural alias: skills
const skillsAliasCmd = program.command('skills', { hidden: true }).description('Manage AI agent skills (alias)');
registerSkillCommands(skillsAliasCmd);

// =========================================================
// 7. UTILITIES (search, doctor, config)
// =========================================================
program.command('search <query>')
  .description('Search your saved snippets and command playbooks by title, slug, or language')
  .action(search);

program.command('doctor')
  .description('Diagnose Node.js environment, OS details, API connectivity, and language runtimes')
  .action(doctor);

program.command('config')
  .description('Display safe CLI configuration settings (masked key, API base URL)')
  .action(showConfig);

// =========================================================
// 8. LEGACY BACKWARD COMPATIBILITY COMMANDS
// =========================================================
program
  .command('list')
  .description('List items (legacy command)')
  .option('-s, --snippets', 'List code snippets')
  .option('-c, --commands', 'List command sets')
  .action((options) => {
    const type = options.snippets ? 'snippets' : 'commands';
    warnDeprecated('snix list', `snix ${type} list`);
    listItems(type);
  });

program
  .command('get <id>')
  .description('View details or code (legacy command)')
  .option('-s, --snippet', 'Get snippet')
  .option('-c, --command', 'Get command')
  .action((id, options) => {
    const type = options.snippet ? 'snippets' : (options.command ? 'commands' : 'snippets');
    warnDeprecated('snix get', `snix ${type === 'snippets' ? 'snippets' : 'commands'} show ${id}`);
    showItem(id, type);
  });

program
  .command('pull <id>')
  .description('Download snippet/command to local file (legacy command)')
  .option('-f, --file <path>', 'Output file path')
  .option('-s, --snippet', 'Pull as code snippet')
  .action((id, options) => {
    const type = options.snippet ? 'snippets' : 'commands';
    warnDeprecated('snix pull', `snix ${type} pull ${id}`);
    pullItem(id, { ...options, type });
  });

program.parse(process.argv);