import chalk from 'chalk';
import apiClient from '../lib/api.js';
import { formatBytes, formatDate } from './manage.js';

export async function search(query) {
  if (!query || !query.trim()) {
    console.log(chalk.yellow('\nPlease provide a search term.'));
    console.log(chalk.gray('Example: snix search python\n'));
    return;
  }

  const term = query.trim();
  console.log(chalk.cyan(`\n🔍 Searching SnippKit library for '${chalk.bold(term)}'...\n`));

  try {
    const [snippetsRes, commandsRes, skillsRes] = await Promise.all([
      apiClient.get(`/api/cli/list?type=snippets&search=${encodeURIComponent(term)}`).catch(() => ({ data: [] })),
      apiClient.get(`/api/cli/list?type=commands&search=${encodeURIComponent(term)}`).catch(() => ({ data: [] })),
      apiClient.get(`/api/skills/search?q=${encodeURIComponent(term)}`).catch(() => ({ data: [] }))
    ]);

    const termLower = term.toLowerCase();

    const snippets = (snippetsRes.data || []).filter(item => {
      const title = (item.title || '').toLowerCase();
      const slug = (item.slug || item.id || '').toLowerCase();
      const lang = (item.language || '').toLowerCase();
      return title.includes(termLower) || slug.includes(termLower) || lang.includes(termLower);
    });

    const commands = (commandsRes.data || []).filter(item => {
      const title = (item.title || '').toLowerCase();
      const slug = (item.slug || item.id || '').toLowerCase();
      return title.includes(termLower) || slug.includes(termLower);
    });

    const skills = (skillsRes.data || []).filter(item => {
      const title = (item.title || '').toLowerCase();
      const slug = (item.slug || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return title.includes(termLower) || slug.includes(termLower) || desc.includes(termLower);
    });

    if (snippets.length === 0 && commands.length === 0 && skills.length === 0) {
      console.log(chalk.yellow(`No matching snippets, playbooks, or agent skills found for '${term}'.\n`));
      return;
    }

    if (snippets.length > 0) {
      console.log(chalk.bold.cyan(`📁 Matching Snippets (${snippets.length}):\n`));
      console.log(
        chalk.bold.white('ID / Slug'.padEnd(38)) + ' | ' +
        chalk.bold.white('Title'.padEnd(28)) + ' | ' +
        chalk.bold.white('Language'.padEnd(16)) + ' | ' +
        chalk.bold.white('Visibility'.padEnd(12)) + ' | ' +
        chalk.bold.white('Size'.padEnd(10)) + ' | ' +
        chalk.bold.white('Created At')
      );
      console.log(chalk.gray(''.padEnd(130, '─')));
      snippets.forEach(item => {
        const idStr = (item.slug || item.id || "").toString();
        const id = chalk.yellow.bold(idStr.padEnd(38));
        const title = chalk.white((item.title || "Untitled").toString().slice(0, 27).padEnd(28));
        const lang = chalk.cyan((item.language || "text").toString().slice(0, 15).padEnd(16));
        const vis = item.is_public ? chalk.green.bold('[PUBLIC]'.padEnd(12)) : chalk.gray('[PRIVATE]'.padEnd(12));
        const size = chalk.dim(formatBytes(item.size_in_bytes).padEnd(10));
        const date = chalk.dim(formatDate(item.created_at));
        console.log(`${id} | ${title} | ${lang} | ${vis} | ${size} | ${date}`);
      });
      console.log('');
    }



    if (commands.length > 0) {
      console.log(chalk.bold.cyan(`⚡ Matching Command Playbooks (${commands.length}):\n`));
      console.log(
        chalk.bold.white('ID / Slug'.padEnd(38)) + ' | ' +
        chalk.bold.white('Title'.padEnd(28)) + ' | ' +
        chalk.bold.white('Steps'.padEnd(16)) + ' | ' +
        chalk.bold.white('Visibility'.padEnd(12)) + ' | ' +
        chalk.bold.white('Size'.padEnd(10)) + ' | ' +
        chalk.bold.white('Created At')
      );
      console.log(chalk.gray(''.padEnd(130, '─')));
      commands.forEach(item => {
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
      console.log('');
    }

    if (skills.length > 0) {
      console.log(chalk.bold.cyan(`🤖 Matching AI Agent Skills (${skills.length}):\n`));
      console.log(
        chalk.bold.white('Slug'.padEnd(28)) + ' | ' +
        chalk.bold.white('Title'.padEnd(30)) + ' | ' +
        chalk.bold.white('Version'.padEnd(10)) + ' | ' +
        chalk.bold.white('Author'.padEnd(16)) + ' | ' +
        chalk.bold.white('Views')
      );
      console.log(chalk.gray(''.padEnd(100, '─')));
      skills.forEach(item => {
        const slug = chalk.yellow.bold((item.slug || "").toString().slice(0, 27).padEnd(28));
        const title = chalk.white((item.title || "Untitled").toString().slice(0, 29).padEnd(30));
        const ver = chalk.cyan((item.version || "1.0.0").toString().slice(0, 9).padEnd(10));
        const author = chalk.magenta((`@${item.author?.username || item.username || 'developer'}`).slice(0, 15).padEnd(16));
        const views = chalk.dim((item.views || 0).toString());
        console.log(`${slug} | ${title} | ${ver} | ${author} | ${views}`);
      });
      console.log('');
    }



  } catch (error) {
    const msg = error.response?.data?.error || error.message;
    console.error(chalk.red(`Search failed: ${msg}`));
  }
}
