import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import apiClient from '../lib/api.js';

// Language to Runner mapping
export const RUNNERS = {
    javascript: 'node',
    js: 'node',
    typescript: 'npx ts-node',
    ts: 'npx ts-node',
    python: 'python',
    py: 'python',
    ruby: 'ruby',
    rb: 'ruby',
    php: 'php',
    perl: 'perl',
    lua: 'lua',
    r: 'Rscript',
    bash: 'bash',
    sh: 'bash',
    shell: 'bash',
    zsh: 'zsh',
    powershell: 'pwsh',
    go: 'go run',
    java: 'java',
    rust: 'rust-script'
};

export const EXTENSIONS = {
    javascript: 'js', js: 'js',
    typescript: 'ts', ts: 'ts',
    python: 'py', py: 'py',
    ruby: 'rb', rb: 'rb',
    php: 'php', perl: 'pl',
    lua: 'lua', r: 'R',
    bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh',
    powershell: 'ps1',
    go: 'go', java: 'java', rust: 'rs'
};

// Safe Process Execution Helper
const executeRunner = (cmd, args = [], options = {}) => {
    return new Promise((resolve, reject) => {
        const useShell = options.shell !== undefined ? options.shell : false;
        const child = spawn(cmd, args, { shell: useShell, stdio: 'inherit' });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Process exited with exit code ${code}`));
        });
        child.on('error', (err) => reject(err));
    });
};

export async function runSnippets(ids, type = 'smart', options = {}) {
    if (!ids || ids.length === 0) {
        console.log(chalk.yellow('Please provide a snippet or command ID to run.'));
        console.log(chalk.gray('Example: snix run <id>'));
        return;
    }

    // Filter out subcommand keyword prefixes if passed in ids array (e.g., 'snix run snippet <id>')
    let activeIds = [...ids];
    if (activeIds.length > 1) {
        const first = activeIds[0].toLowerCase();
        if (['snippet', 'snippets', 'script', 'scripts'].includes(first)) {
            type = 'script';
            activeIds.shift();
        } else if (['cmd', 'cmds', 'command', 'commands'].includes(first)) {
            type = 'cmd';
            activeIds.shift();
        }
    }

    for (const id of activeIds) {
        let tempDir = null;
        let tempFile = null;

        const cleanupTemp = async () => {
            if (tempFile) try { await fs.unlink(tempFile); } catch(e) {}
            if (tempDir) try { await fs.rm(tempDir, { recursive: true, force: true }); } catch(e) {}
        };

        const signalHandler = async () => {
            await cleanupTemp();
            process.exit(130);
        };

        process.once('SIGINT', signalHandler);
        process.once('SIGTERM', signalHandler);

        try {
            // Determine API type endpoint parameter
            let apiType = 'snippets';
            if (type === 'cmd' || type === 'commands') apiType = 'commands';
            else if (type === 'script' || type === 'scripts') apiType = 'snippets';
            
            console.log(chalk.magenta(`\nFetching: ${id}...`));
            let data;
            try {
                const res = await apiClient.get(`/api/cli/run?id=${id}&type=${apiType}`);
                data = res.data;
            } catch (err1) {
                // Smart fallback attempt: If type is smart and snippet failed, try command playbook (and vice versa)
                const fallbackType = apiType === 'snippets' ? 'commands' : 'snippets';
                try {
                    const fallbackRes = await apiClient.get(`/api/cli/run?id=${id}&type=${fallbackType}`);
                    data = fallbackRes.data;
                    apiType = fallbackType;
                } catch (err2) {
                    throw err1; // Throw original fetch error if fallback also failed
                }
            }

            // Smart type determination if type is 'smart'
            let isScript = false;
            if (type === 'script' || type === 'scripts') {
                isScript = true;
            } else if (type === 'cmd' || type === 'commands') {
                isScript = false;
            } else {
                // Auto-detect based on returned data fields
                if (data.code !== undefined && data.code !== null) {
                    isScript = true;
                } else if (data.commands && Array.isArray(data.commands)) {
                    isScript = false;
                } else {
                    console.log(chalk.yellow(`Could not auto-detect type for '${id}'.`));
                    console.log(chalk.gray(`Specify type explicitly: 'snix run script ${id}' or 'snix run cmd ${id}'`));
                    continue;
                }
            }

            // =====================================================
            // 📜 CASE A: CODE SCRIPT EXECUTION (Direct Executable, shell: false)
            // =====================================================
            if (isScript) {
                const code = data.code;
                let lang = (data.language || 'bash').toLowerCase();

                if (!code || !code.trim()) {
                    console.log(chalk.red('Error: Script content is empty.'));
                    continue;
                }

                const runner = RUNNERS[lang] || 'node';
                console.log(chalk.bold.cyan(`--- Executing Script (${lang}) ---`));

                // Create OS temp directory (isolated out of cwd)
                tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snix-run-'));
                const ext = EXTENSIONS[lang] || 'txt';
                
                // Java identifier requirement: Class and filename cannot start with dot or number
                let filename = `script_${Date.now()}.${ext}`;
                if (lang === 'java') {
                    filename = `SnixScript_${Date.now()}.${ext}`;
                }

                tempFile = path.join(tempDir, filename);

                try {
                    await fs.writeFile(tempFile, code, 'utf8');

                    if (['sh', 'bash', 'zsh'].includes(lang)) {
                        try { await fs.chmod(tempFile, '755'); } catch(e) {}
                    }

                    // Direct executable invocation with argument array (shell: false)
                    const runnerParts = runner.split(' ');
                    const mainCmd = runnerParts[0];
                    const runnerArgs = [...runnerParts.slice(1), tempFile];

                    // Windows Batch/Cmd runner resolution wrapper if mainCmd requires shell resolution on Windows (e.g. npx)
                    const isWin = process.platform === 'win32';
                    const needsShellOnWin = isWin && (mainCmd === 'npx' || mainCmd === 'go run');
                    
                    await executeRunner(mainCmd, runnerArgs, { shell: needsShellOnWin ? true : false });

                } finally {
                    await cleanupTemp();
                }

                continue;
            }

            // =====================================================
            // ⚡ CASE B: COMMAND PLAYBOOK EXECUTION (Interactive Confirmation + shell: true)
            // =====================================================
            let cmds = data.commands;
            if (typeof cmds === 'string') try { cmds = JSON.parse(cmds); } catch (e) { cmds = []; }
            if (!Array.isArray(cmds)) {
                if (cmds && typeof cmds === 'object') cmds = [cmds];
                else cmds = [];
            }

            if (cmds.length === 0) {
                console.log(chalk.yellow("No commands found in playbook."));
                continue;
            }

            // Enforce explicit trust & confirmation prompt before running playbooks interactively
            if (!options.yes && process.stdout.isTTY) {
                console.log(chalk.yellow('\n⚠ You are about to execute a SnippKit command playbook on this computer.'));
                console.log(chalk.gray('These commands can modify files, install software, execute programs,'));
                console.log(chalk.gray('and perform other actions with your current user permissions.\n'));
                console.log(`Playbook: ${chalk.bold(data.title || id)}\n`);

                const confirm = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Continue?',
                    default: false
                }]);

                if (!confirm.proceed) {
                    console.log(chalk.yellow('Execution cancelled.'));
                    continue;
                }
            }

            console.log(chalk.bold.cyan(`\n--- Running Playbook ---`));

            for (const task of cmds) {
                if (!task) continue;
                const cmdStr = typeof task === 'string' ? task : task.cmd;
                if (!cmdStr) continue;

                const cleanCmd = cmdStr.trim();
                console.log(chalk.yellow(`> ${cleanCmd}`));

                if (cleanCmd.startsWith('cd ')) {
                    const targetDir = cleanCmd.substring(3).trim();
                    try {
                        const newPath = path.resolve(process.cwd(), targetDir);
                        process.chdir(newPath);
                        console.log(chalk.gray(`   ✔ Directory changed to: ${newPath}`));
                    } catch (err) {
                        console.error(chalk.red(`   ✖ Failed to change directory: ${err.message}`));
                        break;
                    }
                } else {
                    await executeRunner(cleanCmd, [], { shell: true });
                }
            }
            console.log(chalk.green.bold(`\n--- Completed Playbook Execution ---`));

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error(chalk.red(`Error executing '${id}': ${msg}`));
        } finally {
            await cleanupTemp();
            process.removeListener('SIGINT', signalHandler);
            process.removeListener('SIGTERM', signalHandler);
        }
    }
}