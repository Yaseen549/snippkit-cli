import fs from 'fs/promises';
import chalk from 'chalk';
import apiClient from '../lib/api.js';
import { highlight } from 'cli-highlight';

export async function listCommands(type) {
    try {
        const { data } = await apiClient.get(`/list?type=${type}`);

        if (!data || data.length === 0) {
            console.log(chalk.yellow(`No ${type} found.`));
            return;
        }

        console.log(chalk.bold.cyan(`\nFound ${data.length} ${type}:\n`));

        if (type === 'snippets') {
            console.log(`${'Slug/ID'.padEnd(25)} | ${'Title'.padEnd(30)} | ${'Language'}`);
            console.log(''.padEnd(70, '-'));
            data.forEach(item => {
                const id = (item.slug || item.id || "").toString();
                const title = (item.title || "Untitled").toString();
                const lang = (item.language || "text").toString();
                console.log(`${id.padEnd(25)} | ${title.padEnd(30)} | ${lang}`);
            });
        } else {
            console.log(`${'Slug/ID'.padEnd(25)} | ${'Title'.padEnd(30)} | ${'Count'}`);
            console.log(''.padEnd(70, '-'));
            data.forEach(item => {
                const id = (item.slug || item.id || "").toString();
                const title = (item.title || "Untitled").toString();
                const count = (item.command_count || 0).toString();
                console.log(`${id.padEnd(25)} | ${title.padEnd(30)} | ${count}`);
            });
        }
        console.log('');
    } catch (error) {
        const msg = error.response?.data?.error || error.message;
        console.error(chalk.red(`List failed: ${msg}`));
    }
}

export async function getCommand(id, type) {
    try {
        const { data } = await apiClient.get(`/run?id=${id}&type=${type}`);
        
        if (type === 'snippets') {
            const code = data.code || "";
            const lang = data.language || 'txt';

            if (process.stdout.isTTY) {
                console.log(chalk.gray(`ID:       ${data.id}`));
                console.log(chalk.bold.white(`Title:    ${data.title}`));
                console.log(chalk.blue(`Language: ${lang}`));
                console.log(chalk.gray(''.padEnd(50, '-')));
                try {
                    const colored = highlight(code, { language: lang, ignoreIllegals: true });
                    console.log(colored);
                } catch (e) {
                    console.log(code);
                }
                console.log(chalk.gray(''.padEnd(50, '-')));
            } else {
                console.log(code);
            }
        } else {
            if (process.stdout.isTTY) {
                console.log(chalk.gray(`ID:       ${data.id}`));
                console.log(chalk.bold.white(`Title:    ${data.title}`));
                let cmds = data.commands;
                if (typeof cmds === 'string') try { cmds = JSON.parse(cmds); } catch(e) { cmds = [] }
                if (!Array.isArray(cmds)) cmds = [cmds].filter(Boolean);

                console.log(chalk.blue(`Steps:    ${cmds.length}`));
                console.log(chalk.gray(''.padEnd(50, '-')));

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
                console.log(chalk.gray(''.padEnd(50, '-')));
            } else {
                console.log(JSON.stringify(data, null, 2));
            }
        }
    } catch (error) {
        const msg = error.response?.data?.error || error.message;
        console.error(chalk.red(`Error: ${msg}`));
    }
}

export async function pullCommand(id, options) {
    try {
        const type = options.snippet ? 'snippets' : 'commands';
        console.log(chalk.gray(`Fetching ${type}...`));
        const { data } = await apiClient.get(`/run?id=${id}&type=${type}`);

        let content = "";
        let filename = options.file;

        if (data.code) {
            content = data.code;
            if (!filename) {
                const ext = data.language === 'python' ? 'py' : data.language === 'javascript' ? 'js' : 'txt';
                filename = `${data.slug || data.id}.${ext}`;
            }
        } else {
            content = JSON.stringify(data.commands, null, 2);
            if (!filename) filename = `${data.slug || data.id}.json`;
        }

        await fs.writeFile(filename, content);
        console.log(chalk.green(`✅ Saved to `) + chalk.bold(filename));
    } catch (error) {
        console.error(chalk.red('Error pulling: ' + error.message));
    }
}