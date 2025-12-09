import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import apiClient from '../lib/api.js';

// ✅ 1. EXPANDED LANGUAGE MAPPER
// Maps "DB Language" -> "Local Executable"
const RUNNERS = {
    // Web / Node
    javascript: 'node',
    typescript: 'npx ts-node',
    
    // Scripting
    python: 'python', // Note: On some systems this might need to be 'python3'
    py: 'python',
    ruby: 'ruby',
    rb: 'ruby',
    php: 'php',
    perl: 'perl',
    lua: 'lua',
    r: 'Rscript',
    
    // Shells
    bash: 'bash',
    sh: 'bash',
    shell: 'bash',
    zsh: 'zsh',
    script: 'bash',  // Generic 'script' defaults to bash
    powershell: 'pwsh', // PowerShell Core
    
    // Compiled / Systems (Single file run)
    go: 'go run',
    java: 'java', // Java 11+ supports running single source files
    rust: 'rust-script' // Requires 'cargo install rust-script'
};

// ✅ 2. EXTENSION MAPPER
// Helpers to create the right temp file type
const EXTENSIONS = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    ruby: 'rb',
    php: 'php',
    perl: 'pl',
    lua: 'lua',
    r: 'R',
    bash: 'sh',
    sh: 'sh',
    shell: 'sh',
    zsh: 'sh',
    script: 'sh',
    powershell: 'ps1',
    go: 'go',
    java: 'java',
    rust: 'rs'
};

const execute = (cmdString) => {
    return new Promise((resolve, reject) => {
        // shell: true is required to resolve commands like 'npx' or 'go run' correctly
        const child = spawn(cmdString, { shell: true, stdio: 'inherit' });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Process exited with code ${code}`));
        });
        child.on('error', (err) => reject(err));
    });
};

export async function runSnippets(ids, type) {
    for (const id of ids) {
        try {
            const apiType = type === 'scripts' ? 'snippets' : 'commands';
            
            console.log(chalk.magenta(`\nFetching ${apiType}: ${id}...`));
            const { data } = await apiClient.get(`/run?id=${id}&type=${apiType}`);

            // =====================================================
            // 📜 CASE A: EXECUTE CODE SCRIPT
            // =====================================================
            if (type === 'scripts') {
                const code = data.code;
                
                // Normalize language key
                let lang = (data.language || 'bash').toLowerCase();
                
                // Fallback for generic names
                if (lang === 'script') lang = 'bash';
                if (lang === 'js') lang = 'javascript';
                if (lang === 'ts') lang = 'typescript';

                if (!code) {
                    console.log(chalk.red('Error: Script content is empty.'));
                    continue;
                }

                const runner = RUNNERS[lang];
                if (!runner) {
                    console.log(chalk.red(`❌ Error: Cannot run '${lang}' code locally.`));
                    console.log(chalk.yellow(`Supported: ${Object.keys(RUNNERS).join(', ')}`));
                    continue;
                }

                console.log(chalk.bold.cyan(`--- Executing ${lang} ---`));

                // 2. Create Temp File
                const ext = EXTENSIONS[lang] || 'txt';
                const tempFile = path.resolve(process.cwd(), `.snix-${Date.now()}.${ext}`);

                try {
                    await fs.writeFile(tempFile, code);
                    
                    // Make executable if it's a shell script (Linux/Mac)
                    if (['sh', 'bash', 'zsh'].includes(lang)) {
                        try { await fs.chmod(tempFile, '755'); } catch(e) {}
                    }

                    // 3. Execute
                    await execute(`${runner} ${tempFile}`);

                } catch (err) {
                    throw err;
                } finally {
                    // 4. Cleanup
                    try { await fs.unlink(tempFile); } catch (e) {}
                }
                
                continue;
            }

            // =====================================================
            // ⚡ CASE B: RUN COMMAND PLAYBOOK (Default)
            // =====================================================
            console.log(chalk.bold.cyan(`--- Running ---`));

            let cmds = data.commands;
            if (typeof cmds === 'string') try { cmds = JSON.parse(cmds); } catch (e) { cmds = []; }
            if (!Array.isArray(cmds)) {
                if (cmds && typeof cmds === 'object') cmds = [cmds];
                else cmds = [];
            }

            if (cmds.length === 0) console.log(chalk.yellow("No commands found."));

            for (const task of cmds) {
                if (!task) continue;
                const cmd = typeof task === 'string' ? task : task.cmd;
                if (!cmd) continue;

                const cleanCmd = cmd.trim();
                console.log(chalk.yellow(`> ${cleanCmd}`));

                if (cleanCmd.startsWith('cd ')) {
                    const targetDir = cleanCmd.substring(3).trim();
                    try {
                        const newPath = path.resolve(process.cwd(), targetDir);
                        process.chdir(newPath);
                        console.log(chalk.gray(`   ✔ Changed directory to: ${newPath}`));
                    } catch (err) {
                        console.error(chalk.red(`   ✖ Failed to change directory: ${err.message}`));
                        process.exit(1);
                    }
                } else {
                    await execute(cleanCmd);
                }
            }
            console.log(chalk.green.bold(`\n--- Completed ---`));

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error(chalk.red(`Error: ${msg}`));
            process.exit(1);
        }
    }
}