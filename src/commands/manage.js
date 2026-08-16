import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import apiClient from '../lib/api.js';
import { highlight } from 'cli-highlight';

export function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        const secs = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
    } catch (e) {
        return dateString;
    }
}

export function warnDeprecated(oldCmd, newCmd) {
  console.warn(chalk.yellow(`\n⚠ Deprecated: '${oldCmd}' will be removed in a future release.`));
  console.warn(chalk.gray(`Use '${chalk.bold(newCmd)}' instead.\n`));
}

export async function listItems(type = 'snippets') {
    try {
        const { data } = await apiClient.get(`/api/cli/list?type=${type}`);

        if (!data || data.length === 0) {
            console.log(chalk.yellow(`\nNo ${type} found in your library.\n`));
            return;
        }

        console.log(chalk.bold.cyan(`\nSnippKit Library — ${data.length} ${type}:\n`));

        const pageSize = 15;
        let index = 0;

        const renderPage = (start, count) => {
            const slice = data.slice(start, start + count);
            if (type === 'snippets') {
                console.log(
                    chalk.bold.white('ID / Slug'.padEnd(38)) + ' | ' +
                    chalk.bold.white('Title'.padEnd(28)) + ' | ' +
                    chalk.bold.white('Language'.padEnd(16)) + ' | ' +
                    chalk.bold.white('Visibility'.padEnd(12)) + ' | ' +
                    chalk.bold.white('Size'.padEnd(10)) + ' | ' +
                    chalk.bold.white('Created At')
                );
                console.log(chalk.gray(''.padEnd(130, '─')));
                slice.forEach(item => {
                    const idStr = (item.slug || item.id || "").toString();
                    const id = chalk.yellow.bold(idStr.padEnd(38));
                    const title = chalk.white((item.title || "Untitled").toString().slice(0, 27).padEnd(28));
                    const lang = chalk.cyan((item.language || "text").toString().slice(0, 15).padEnd(16));
                    const vis = item.is_public ? chalk.green.bold('[PUBLIC]'.padEnd(12)) : chalk.gray('[PRIVATE]'.padEnd(12));
                    const size = chalk.dim(formatBytes(item.size_in_bytes).padEnd(10));
                    const date = chalk.dim(formatDate(item.created_at));
                    console.log(`${id} | ${title} | ${lang} | ${vis} | ${size} | ${date}`);
                });
            } else {
                console.log(
                    chalk.bold.white('ID / Slug'.padEnd(38)) + ' | ' +
                    chalk.bold.white('Title'.padEnd(28)) + ' | ' +
                    chalk.bold.white('Steps'.padEnd(16)) + ' | ' +
                    chalk.bold.white('Visibility'.padEnd(12)) + ' | ' +
                    chalk.bold.white('Size'.padEnd(10)) + ' | ' +
                    chalk.bold.white('Created At')
                );
                console.log(chalk.gray(''.padEnd(130, '─')));
                slice.forEach(item => {
                    const idStr = (item.slug || item.id || "").toString();
                    const id = chalk.yellow.bold(idStr.padEnd(38));
                    const title = chalk.white((item.title || "Untitled").toString().slice(0, 27).padEnd(28));
                    let count = item.command_count;
                    if (!count && Array.isArray(item.commands)) count = item.commands.length;
                    const steps = chalk.cyan(`${count || 1} step${count === 1 ? '' : 's'}`.padEnd(16));
                    const vis = item.is_public ? chalk.green.bold('[PUBLIC]'.padEnd(12)) : chalk.gray('[PRIVATE]'.padEnd(12));
                    const size = chalk.dim(formatBytes(item.size_in_bytes).padEnd(10));
                    const date = chalk.dim(formatDate(item.created_at));
                    console.log(`${id} | ${title} | ${steps} | ${vis} | ${size} | ${date}`);
                });
            }
            console.log('');
        };

        if (!process.stdout.isTTY || data.length <= pageSize) {
            renderPage(0, data.length);
            return;
        }

        while (index < data.length) {
            renderPage(index, pageSize);
            index += pageSize;

            if (index < data.length) {
                const answer = await inquirer.prompt([{
                    type: 'input',
                    name: 'next',
                    message: chalk.dim(`-- Showing ${index} of ${data.length} -- [Press Enter for more, q to quit]`),
                }]);

                if (answer.next && answer.next.trim().toLowerCase() === 'q') {
                    console.log(chalk.gray('Listing ended.'));
                    break;
                }
            }
        }
    } catch (error) {
        const msg = error.response?.data?.error || error.message;
        console.error(chalk.red(`List failed: ${msg}`));
    }
}

export async function showItem(id, type = 'snippets') {
    try {
        const { data } = await apiClient.get(`/api/cli/run?id=${id}&type=${type}`);
        
        if (type === 'snippets') {
            const code = data.code || "";
            const lang = data.language || 'txt';

            if (process.stdout.isTTY) {
                console.log(chalk.gray(`ID:         ${data.id || id}`));
                console.log(chalk.bold.white(`Title:      ${data.title || 'Untitled'}`));
                console.log(chalk.blue(`Language:   ${lang}`));
                console.log(chalk.gray(`Visibility: ${data.is_public ? chalk.green('[PUBLIC]') : chalk.gray('[PRIVATE]')}`));
                console.log(chalk.gray(''.padEnd(60, '─')));
                try {
                    const colored = highlight(code, { language: lang, ignoreIllegals: true });
                    console.log(colored);
                } catch (e) {
                    console.log(code);
                }
                console.log(chalk.gray(''.padEnd(60, '─')));
            } else {
                console.log(code);
            }
        } else {
            if (process.stdout.isTTY) {
                console.log(chalk.gray(`ID:         ${data.id || id}`));
                console.log(chalk.bold.white(`Title:      ${data.title || 'Untitled'}`));
                let cmds = data.commands;
                if (typeof cmds === 'string') try { cmds = JSON.parse(cmds); } catch(e) { cmds = [] }
                if (!Array.isArray(cmds)) cmds = [cmds].filter(Boolean);

                console.log(chalk.blue(`Steps:      ${cmds.length}`));
                console.log(chalk.gray(`Visibility: ${data.is_public ? chalk.green('[PUBLIC]') : chalk.gray('[PRIVATE]')}`));
                console.log(chalk.gray(''.padEnd(60, '─')));

                if (cmds.length === 0) {
                    console.log(chalk.yellow('   (No commands)'));
                } else {
                    cmds.forEach((task, index) => {
                        const cmdStr = typeof task === 'string' ? task : task.cmd;
                        const num = chalk.gray(`${(index + 1).toString().padEnd(2)}.`);
                        if (cmdStr.trim().startsWith('cd ')) {
                             console.log(`   ${num} ${chalk.magenta(cmdStr)}`);
                        } else {
                             console.log(`   ${num} ${chalk.green(cmdStr)}`);
                        }
                    });
                }
                console.log(chalk.gray(''.padEnd(60, '─')));
            } else {
                console.log(JSON.stringify(data, null, 2));
            }
        }
    } catch (error) {
        const msg = error.response?.data?.error || error.message;
        console.error(chalk.red(`Error fetching item: ${msg}`));
    }
}

export async function pullItem(id, options = {}) {
    try {
        const type = options.snippet ? 'snippets' : (options.type || 'snippets');
        console.log(chalk.gray(`Fetching ${type}: ${id}...`));
        const { data } = await apiClient.get(`/api/cli/run?id=${id}&type=${type}`);

        let content = "";
        let filename = options.file;

        const cleanTitle = (data.title || (type === 'snippets' ? 'snippet' : 'command'))
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const baseId = data.slug || data.id || id;

        if (data.code !== undefined) {
            content = data.code;
            if (!filename) {
                const extMap = {
                    python: 'py', javascript: 'js', typescript: 'ts',
                    go: 'go', rust: 'rs', java: 'java', bash: 'sh', powershell: 'ps1',
                    json: 'json', markdown: 'md', html: 'html', css: 'css', sql: 'sql'
                };
                const langKey = (data.language || '').toLowerCase();
                const ext = extMap[langKey] || 'txt';
                filename = `${cleanTitle}_${baseId}.${ext}`;
            }
        } else {
            content = JSON.stringify(data.commands || [], null, 2);
            if (!filename) {
                filename = `${cleanTitle}_${baseId}.json`;
            }
        }

        const targetPath = path.resolve(process.cwd(), filename);
        await fs.writeFile(targetPath, content);
        console.log(chalk.green(`\n✅ Saved to `) + chalk.bold(targetPath));
    } catch (error) {
        const msg = error.response?.data?.error || error.message;
        console.error(chalk.red(`Error pulling ${id}: ${msg}`));
    }
}

async function deleteSingleItem(id, options = {}) {
    try {
        let isExplicit = false;
        let resolvedType = null;
        let resolvedItem = null;

        if (options.snippet) {
            resolvedType = 'snippets';
            isExplicit = true;
        } else if (options.command) {
            resolvedType = 'commands';
            isExplicit = true;
        } else if (options.type === 'snippets' || options.type === 'commands') {
            resolvedType = options.type;
            isExplicit = true;
        }

        if (isExplicit) {
            // Explicit type provided (e.g. snix snippets delete hello or snix commands delete hello)
            try {
                const res = await apiClient.get(`/api/cli/run?id=${id}&type=${resolvedType}`);
                resolvedItem = res.data;
            } catch (err) {
                console.error(chalk.red(`Error: ${resolvedType === 'commands' ? 'Command playbook' : 'Snippet'} '${id}' not found.`));
                return false;
            }
        } else {
            // Ambiguous top-level call (snix delete hello or snix rm hello)
            let snippetData = null;
            let commandData = null;

            try {
                const snipRes = await apiClient.get(`/api/cli/run?id=${id}&type=snippets`);
                snippetData = snipRes.data;
            } catch (e) {}

            try {
                const cmdRes = await apiClient.get(`/api/cli/run?id=${id}&type=commands`);
                commandData = cmdRes.data;
            } catch (e) {}

            if (snippetData && commandData) {
                // Ambiguity detected: matches BOTH snippet and command playbook!
                if (options.yes || !process.stdout.isTTY) {
                    console.error(chalk.yellow(`\n⚠ "${id}" matches both a snippet and a command playbook.`));
                    console.error(chalk.red(`Deletion was NOT performed to prevent accidental data loss.\n`));
                    console.error(chalk.gray(`Please specify the resource explicitly:`));
                    console.error(`  ${chalk.cyan(`snix snippets delete ${id} --yes`)}`);
                    console.error(`  ${chalk.cyan(`snix commands delete ${id} --yes`)}\n`);
                    return false;
                }

                console.log(chalk.yellow(`\n⚠ Multiple SnippKit resources found matching "${id}":`));
                console.log(`  1. Snippet:          ${chalk.bold(snippetData.title || id)} (${snippetData.language || 'Code'})`);
                console.log(`  2. Command Playbook: ${chalk.bold(commandData.title || id)} (${Array.isArray(commandData.commands) ? commandData.commands.length : 0} steps)\n`);

                const choice = await inquirer.prompt([{
                    type: 'list',
                    name: 'resourceType',
                    message: `What would you like to delete for "${id}"?`,
                    choices: [
                        { name: `Snippet (${snippetData.title || id})`, value: 'snippets' },
                        { name: `Command Playbook (${commandData.title || id})`, value: 'commands' },
                        { name: 'Cancel Deletion', value: 'cancel' }
                    ]
                }]);

                if (choice.resourceType === 'cancel') {
                    console.log(chalk.yellow('Deletion cancelled.'));
                    return false;
                }

                resolvedType = choice.resourceType;
                resolvedItem = resolvedType === 'snippets' ? snippetData : commandData;
            } else if (snippetData) {
                resolvedType = 'snippets';
                resolvedItem = snippetData;
            } else if (commandData) {
                resolvedType = 'commands';
                resolvedItem = commandData;
            } else {
                console.error(chalk.red(`Error: No snippet or command playbook found matching '${id}'.`));
                return false;
            }
        }

        // Confirmation Prompt & Display Card
        if (!options.yes && process.stdout.isTTY) {
            console.log(chalk.yellow(`\nDelete this ${resolvedType === 'commands' ? 'command playbook' : 'snippet'}?`));
            console.log(`  Title:      ${chalk.bold(resolvedItem.title || id)}`);
            console.log(`  ID / Slug:  ${chalk.gray(resolvedItem.slug || resolvedItem.id || id)}`);
            if (resolvedType === 'snippets') {
                console.log(`  Language:   ${chalk.cyan(resolvedItem.language || 'Plain Text')}`);
                console.log(`  Visibility: ${resolvedItem.is_public ? chalk.green('PUBLIC') : chalk.gray('PRIVATE')}`);
            } else {
                let stepCount = 0;
                let cmds = resolvedItem.commands;
                if (typeof cmds === 'string') try { cmds = JSON.parse(cmds); } catch(e) {}
                if (Array.isArray(cmds)) stepCount = cmds.length;
                console.log(`  Steps:      ${chalk.cyan(stepCount)}`);
                console.log(`  Visibility: ${resolvedItem.is_public ? chalk.green('PUBLIC') : chalk.gray('PRIVATE')}`);
            }
            console.log();

            const confirm = await inquirer.prompt([{
                type: 'confirm',
                name: 'proceed',
                message: 'Continue?',
                default: false
            }]);

            if (!confirm.proceed) {
                console.log(chalk.yellow('Deletion cancelled.'));
                return false;
            }
        }

        const deleteTargetId = resolvedItem.id || id;
        await apiClient.post('/api/cli/delete', { id: deleteTargetId, type: resolvedType });

        console.log(chalk.green(`\n✅ Successfully deleted ${resolvedType === 'commands' ? 'command playbook' : 'snippet'} `) + chalk.bold(id) + chalk.green(' from database.\n'));
        return true;
    } catch (error) {
        const msg = error.response?.data?.error || error.message;
        console.error(chalk.red(`Error deleting '${id}': ${msg}`));
        return false;
    }
}

export async function deleteItem(targetIds, options = {}) {
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    if (ids.length === 0) {
        console.log(chalk.yellow('Please specify one or more IDs or slugs to delete.'));
        return;
    }

    for (const id of ids) {
        await deleteSingleItem(id, options);
    }
}

// Aliases for backward compatibility
export const listCommands = listItems;
export const getCommand = showItem;
export const pullCommand = pullItem;
export const deleteCommand = deleteItem;