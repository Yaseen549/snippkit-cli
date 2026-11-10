import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import apiClient from '../lib/api.js';
import { formatBytes, formatDate } from './manage.js';

// =========================================================
// HELPERS
// =========================================================

/**
 * Normalizes user identifier input:
 * - @user/slug -> slug
 * - user/slug -> slug
 * - https://snippkit.com/skills/slug -> slug
 * - slug -> slug
 */
export function parseSkillIdentifier(raw) {
  if (!raw || typeof raw !== 'string') return { slug: '', raw: '' };
  const cleaned = raw.trim();

  // URL parsing
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const url = new URL(cleaned);
      const segments = url.pathname.split('/').filter(Boolean);
      // Supports /skills/:slug, /skill/:slug, /@username/skill/:slug
      const skillIdx = segments.findIndex(s => s === 'skill' || s === 'skills');
      if (skillIdx !== -1 && segments[skillIdx + 1]) {
        const slug = segments[skillIdx + 1].toLowerCase();
        let username = null;
        if (skillIdx > 0 && (segments[skillIdx - 1].startsWith('@') || segments[skillIdx - 2] === 'u')) {
          username = segments[skillIdx - 1].replace(/^@/, '');
        }
        return { slug, username, raw: cleaned };
      }
      return { slug: (segments[segments.length - 1] || '').toLowerCase(), raw: cleaned };
    } catch {
      // fallback
    }
  }

  // @username/slug or username/slug
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const lastPart = parts[parts.length - 1].replace(/^@/, '');
    const userPart = parts[0].replace(/^@/, '');
    return { slug: lastPart.toLowerCase(), username: userPart, raw: cleaned };
  }

  // pure slug (remove potential leading @)
  return { slug: cleaned.replace(/^@/, '').toLowerCase(), raw: cleaned };
}

/**
 * Detects target agent environment:
 * Supported targets: 'antigravity', 'cursor', 'windsurf', 'claude'
 */
export function detectTarget(targetOpt, cwd = process.cwd()) {
  if (targetOpt) {
    const t = targetOpt.toLowerCase().trim();
    if (t === 'cursor' || t === 'cur') return 'cursor';
    if (t === 'windsurf' || t === 'wind' || t === 'cascade') return 'windsurf';
    if (t === 'claude' || t === 'claude-code') return 'claude';
    return 'antigravity';
  }

  // Auto-detect based on workspace folders
  if (existsSync(path.join(cwd, '.cursor'))) return 'cursor';
  if (existsSync(path.join(cwd, '.windsurf'))) return 'windsurf';
  if (existsSync(path.join(cwd, '.claude'))) return 'claude';
  return 'antigravity';
}

/**
 * Resolves destination file path for a skill
 */
export function resolveSkillPath(slug, target, outPath, cwd = process.cwd()) {
  if (outPath) {
    return path.resolve(cwd, outPath);
  }

  switch (target) {
    case 'cursor':
      return path.join(cwd, '.cursor', 'rules', `${slug}.mdc`);
    case 'windsurf':
      return path.join(cwd, '.windsurf', 'rules', `${slug}.md`);
    case 'claude':
      return path.join(cwd, '.claude', 'skills', slug, 'SKILL.md');
    case 'antigravity':
    default:
      return path.join(cwd, '.agents', 'skills', slug, 'SKILL.md');
  }
}

/**
 * Strips existing frontmatter block from markdown if present
 */
export function stripFrontmatter(markdown) {
  if (!markdown) return '';
  const trimmed = markdown.trim();
  if (trimmed.startsWith('---')) {
    const endIdx = trimmed.indexOf('---', 3);
    if (endIdx !== -1) {
      return trimmed.slice(endIdx + 3).trim();
    }
  }
  return trimmed;
}

/**
 * Builds formatted markdown file with tailored frontmatter per target environment
 */
export function formatSkillFile(skill, target) {
  const body = stripFrontmatter(skill.content || '');
  const slug = skill.slug;
  const description = (skill.description || '').replace(/"/g, '\\"');
  const version = skill.version || '1.0.0';
  const author = skill.author?.username || skill.username || 'developer';

  let frontmatterLines = ['---'];

  if (target === 'cursor') {
    frontmatterLines.push(`description: "${description}"`);
    frontmatterLines.push('globs: *');
    frontmatterLines.push('alwaysApply: false');
  } else if (target === 'windsurf') {
    frontmatterLines.push(`trigger: ${slug}`);
    frontmatterLines.push(`description: "${description}"`);
  } else if (target === 'claude') {
    frontmatterLines.push(`name: ${slug}`);
    frontmatterLines.push(`description: "${description}"`);
    frontmatterLines.push(`version: ${version}`);
  } else {
    // Default: Antigravity standard
    frontmatterLines.push(`name: ${slug}`);
    frontmatterLines.push(`description: "${description}"`);
    frontmatterLines.push(`version: ${version}`);
    frontmatterLines.push(`author: ${author}`);
    if (Array.isArray(skill.compatibility) && skill.compatibility.length > 0) {
      frontmatterLines.push(`compatibility: [${skill.compatibility.map(c => `"${c}"`).join(', ')}]`);
    }
  }

  frontmatterLines.push('---');
  frontmatterLines.push('');
  frontmatterLines.push(body);
  frontmatterLines.push('');

  return frontmatterLines.join('\n');
}

/**
 * Parses frontmatter metadata from an existing local file
 */
export function parseLocalFrontmatter(rawContent) {
  const result = { name: '', description: '', version: '' };
  if (!rawContent || !rawContent.startsWith('---')) return result;

  const endIdx = rawContent.indexOf('---', 3);
  if (endIdx === -1) return result;

  const fmLines = rawContent.slice(3, endIdx).split('\n');
  for (const line of fmLines) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === 'name') result.name = val;
      if (key === 'description') result.description = val;
      if (key === 'version') result.version = val;
    }
  }
  return result;
}

// =========================================================
// COMMAND 1: ADD / INSTALL SKILL
// =========================================================
export async function addSkill(identifier, options = {}) {
  if (!identifier || !identifier.trim()) {
    console.log(chalk.yellow('\nPlease specify a skill slug, username/slug, or SnippKit URL.'));
    console.log(chalk.gray('Example: snix skill add premium-ui-architect'));
    console.log(chalk.gray('         snix skill add @unhuman/premium-ui-architect\n'));
    return;
  }

  const { slug, username } = parseSkillIdentifier(identifier);
  if (!slug) {
    console.error(chalk.red('\nCould not extract a valid skill slug from the provided input.\n'));
    return;
  }

  if (/\s/.test(slug)) {
    console.error(chalk.red(`\nInvalid skill slug '${slug}': spaces are not allowed in slugs. Use hyphens instead (e.g. 'my-agent-skill').\n`));
    return;
  }

  const displayName = username ? `@${username}/${slug}` : slug;
  const spinner = ora({
    text: `Resolving skill '${chalk.bold(displayName)}' from SnippKit...`,
    color: 'cyan'
  }).start();

  let skillData;
  try {
    const params = { slug, install: 'true' };
    if (username) params.username = username;
    const res = await apiClient.get('/api/skills/read', {
      params,
      headers: { 'x-snix-action': 'install' }
    });
    skillData = res.data;
  } catch (err) {
    spinner.fail(chalk.red(`Failed to resolve skill '${displayName}'`));
    if (err.response?.status === 404) {
      console.log(chalk.yellow(`\nSkill '${displayName}' was not found on SnippKit.`));
      console.log(chalk.gray(`Browse available skills at: ${chalk.underline('https://snippkit.com/skills')}\n`));
    } else if (err.response?.status === 403) {
      console.log(chalk.yellow('\nThis skill is private. Please run:'));
      console.log(chalk.cyan('  $ snix auth login\n'));
    } else {
      console.error(chalk.red(`Error: ${err.response?.data?.error || err.message}\n`));
    }
    return;
  }

  const target = detectTarget(options.target);
  const destPath = resolveSkillPath(slug, target, options.out);
  const relPath = path.relative(process.cwd(), destPath);

  // Check if target file already exists
  if (existsSync(destPath) && !options.force) {
    spinner.stop();
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Skill file '${relPath}' already exists. Overwrite?`,
        default: false
      }
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\nInstallation cancelled.\n'));
      return;
    }
    spinner.start(`Updating '${chalk.bold(slug)}'...`);
  }

  try {
    const formattedContent = formatSkillFile(skillData, target);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, formattedContent, 'utf8');

    // Record installation event asynchronously
    apiClient.post('/api/skills/install', {
      slug,
      targetAgent: target,
      platform: process.platform
    }).catch(() => {});

    spinner.succeed(chalk.green(`Successfully installed skill '${chalk.bold(skillData.title || slug)}' v${skillData.version || '1.0.0'}`));

    const targetLabel = {
      antigravity: 'Google Antigravity (AGY)',
      cursor: 'Cursor AI Rules (.mdc)',
      windsurf: 'Windsurf Cascade (.md)',
      claude: 'Claude Code'
    }[target] || target;

    console.log('');
    console.log(chalk.bold.white('📦 Skill Details:'));
    console.log(chalk.gray('  ├─ ') + chalk.white('Title:        ') + chalk.cyan.bold(skillData.title || slug));
    console.log(chalk.gray('  ├─ ') + chalk.white('Slug:         ') + chalk.yellow(skillData.slug));
    console.log(chalk.gray('  ├─ ') + chalk.white('Author:       ') + chalk.magenta(`@${skillData.author?.username || skillData.username || 'developer'}`));
    console.log(chalk.gray('  ├─ ') + chalk.white('Environment:  ') + chalk.green.bold(targetLabel));
    console.log(chalk.gray('  ├─ ') + chalk.white('Installed to: ') + chalk.underline.cyan(relPath));
    console.log(chalk.gray('  └─ ') + chalk.white('File Size:    ') + chalk.dim(formatBytes(Buffer.byteLength(formattedContent, 'utf8'))));

    if (skillData.description) {
      console.log('\n' + chalk.bold.white('📝 Description:'));
      console.log(chalk.gray(`  ${skillData.description}`));
    }

    console.log('\n' + chalk.bold.green('💡 Activation Guide:'));
    if (target === 'antigravity') {
      console.log(chalk.gray('  Antigravity agents will automatically discover and load this skill when working in this project.'));
    } else if (target === 'cursor') {
      console.log(chalk.gray('  Cursor will automatically reference this rule file during composer and chat sessions.'));
    } else if (target === 'windsurf') {
      console.log(chalk.gray('  Windsurf Cascade will automatically ingest this rule when answering prompts.'));
    } else {
      console.log(chalk.gray('  The AI agent will reference the instructions defined in ') + chalk.cyan(relPath));
    }
    console.log('');

  } catch (err) {
    spinner.fail(chalk.red(`Failed to write skill file to '${destPath}'`));
    console.error(chalk.red(`Error: ${err.message}\n`));
  }
}

// =========================================================
// COMMAND 2: LIST SKILLS (LOCAL & REMOTE)
// =========================================================
export async function listSkills(options = {}) {
  // Remote list mode
  if (options.remote) {
    const spinner = ora({
      text: 'Fetching skills from SnippKit...',
      color: 'cyan'
    }).start();

    try {
      // First attempt authenticated user skills
      let skills = [];
      try {
        const res = await apiClient.get('/api/cli/list?type=skills');
        skills = res.data || [];
      } catch (authErr) {
        // Fallback to public skills search
        const pubRes = await apiClient.get('/api/skills/search');
        skills = pubRes.data || [];
      }

      spinner.stop();

      if (!skills || skills.length === 0) {
        console.log(chalk.yellow('\nNo skills found on your SnippKit account.\n'));
        console.log(chalk.gray('Discover public skills at: https://snippkit.com/skills\n'));
        return;
      }

      console.log(chalk.bold.cyan(`\n🌐 SnippKit Skills (${skills.length}):\n`));
      console.log(
        chalk.bold.white('Slug / ID'.padEnd(28)) + ' | ' +
        chalk.bold.white('Title'.padEnd(30)) + ' | ' +
        chalk.bold.white('Version'.padEnd(10)) + ' | ' +
        chalk.bold.white('Visibility'.padEnd(12)) + ' | ' +
        chalk.bold.white('Author'.padEnd(16)) + ' | ' +
        chalk.bold.white('Views')
      );
      console.log(chalk.gray(''.padEnd(115, '─')));

      skills.forEach(item => {
        const slug = chalk.yellow.bold((item.slug || item.id || '').toString().slice(0, 27).padEnd(28));
        const title = chalk.white((item.title || 'Untitled').toString().slice(0, 29).padEnd(30));
        const ver = chalk.cyan((item.version || '1.0.0').toString().slice(0, 9).padEnd(10));
        const vis = item.is_public ? chalk.green.bold('[PUBLIC]'.padEnd(12)) : chalk.gray('[PRIVATE]'.padEnd(12));
        const author = chalk.magenta((`@${item.author?.username || item.username || 'user'}`).slice(0, 15).padEnd(16));
        const views = chalk.dim((item.views || 0).toString());
        console.log(`${slug} | ${title} | ${ver} | ${vis} | ${author} | ${views}`);
      });

      console.log('\n' + chalk.gray('Tip: Run ') + chalk.cyan('snix skill add <slug>') + chalk.gray(' to install any of these skills locally.\n'));
      return;
    } catch (err) {
      spinner.fail(chalk.red('Failed to fetch remote skills'));
      console.error(chalk.red(`Error: ${err.message}\n`));
      return;
    }
  }

  // Local scan mode (default)
  const cwd = process.cwd();
  const detected = [];

  // 1. Scan .agents/skills/*/SKILL.md
  const agentsDir = path.join(cwd, '.agents', 'skills');
  if (existsSync(agentsDir)) {
    try {
      const subdirs = await fs.readdir(agentsDir, { withFileTypes: true });
      for (const d of subdirs) {
        if (d.isDirectory()) {
          const skillFile = path.join(agentsDir, d.name, 'SKILL.md');
          if (existsSync(skillFile)) {
            const content = await fs.readFile(skillFile, 'utf8');
            const meta = parseLocalFrontmatter(content);
            const stat = await fs.stat(skillFile);
            detected.push({
              slug: d.name,
              name: meta.name || d.name,
              description: meta.description || '',
              version: meta.version || '1.0.0',
              target: 'Antigravity',
              path: path.relative(cwd, skillFile),
              size: stat.size
            });
          }
        }
      }
    } catch {}
  }

  // 2. Scan .cursor/rules/*.mdc
  const cursorDir = path.join(cwd, '.cursor', 'rules');
  if (existsSync(cursorDir)) {
    try {
      const files = await fs.readdir(cursorDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && (f.name.endsWith('.mdc') || f.name.endsWith('.md'))) {
          const ruleFile = path.join(cursorDir, f.name);
          const content = await fs.readFile(ruleFile, 'utf8');
          const meta = parseLocalFrontmatter(content);
          const stat = await fs.stat(ruleFile);
          const slug = f.name.replace(/\.(mdc|md)$/, '');
          detected.push({
            slug,
            name: meta.name || slug,
            description: meta.description || '',
            version: meta.version || '1.0.0',
            target: 'Cursor',
            path: path.relative(cwd, ruleFile),
            size: stat.size
          });
        }
      }
    } catch {}
  }

  // 3. Scan .windsurf/rules/*.md
  const windsurfDir = path.join(cwd, '.windsurf', 'rules');
  if (existsSync(windsurfDir)) {
    try {
      const files = await fs.readdir(windsurfDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && f.name.endsWith('.md')) {
          const ruleFile = path.join(windsurfDir, f.name);
          const content = await fs.readFile(ruleFile, 'utf8');
          const meta = parseLocalFrontmatter(content);
          const stat = await fs.stat(ruleFile);
          const slug = f.name.replace(/\.md$/, '');
          detected.push({
            slug,
            name: meta.name || slug,
            description: meta.description || '',
            version: meta.version || '1.0.0',
            target: 'Windsurf',
            path: path.relative(cwd, ruleFile),
            size: stat.size
          });
        }
      }
    } catch {}
  }

  // 4. Scan .claude/skills/*/SKILL.md
  const claudeDir = path.join(cwd, '.claude', 'skills');
  if (existsSync(claudeDir)) {
    try {
      const subdirs = await fs.readdir(claudeDir, { withFileTypes: true });
      for (const d of subdirs) {
        if (d.isDirectory()) {
          const skillFile = path.join(claudeDir, d.name, 'SKILL.md');
          if (existsSync(skillFile)) {
            const content = await fs.readFile(skillFile, 'utf8');
            const meta = parseLocalFrontmatter(content);
            const stat = await fs.stat(skillFile);
            detected.push({
              slug: d.name,
              name: meta.name || d.name,
              description: meta.description || '',
              version: meta.version || '1.0.0',
              target: 'Claude',
              path: path.relative(cwd, skillFile),
              size: stat.size
            });
          }
        }
      }
    } catch {}
  }

  if (detected.length === 0) {
    console.log(chalk.yellow('\nNo local AI agent skills or rules detected in this workspace.\n'));
    console.log(chalk.white('To install a skill from SnippKit, run:'));
    console.log(chalk.cyan('  $ snix skill add <slug>\n'));
    console.log(chalk.white('Or search available skills with:'));
    console.log(chalk.cyan('  $ snix skill search <keyword>\n'));
    return;
  }

  console.log(chalk.bold.cyan(`\n🤖 Installed Agent Skills (${detected.length}):\n`));
  console.log(
    chalk.bold.white('Slug'.padEnd(28)) + ' | ' +
    chalk.bold.white('Target'.padEnd(14)) + ' | ' +
    chalk.bold.white('Version'.padEnd(10)) + ' | ' +
    chalk.bold.white('Size'.padEnd(10)) + ' | ' +
    chalk.bold.white('Location')
  );
  console.log(chalk.gray(''.padEnd(105, '─')));

  detected.forEach(item => {
    const slug = chalk.yellow.bold(item.slug.slice(0, 27).padEnd(28));
    const target = chalk.green.bold(item.target.slice(0, 13).padEnd(14));
    const ver = chalk.cyan((item.version || '1.0.0').slice(0, 9).padEnd(10));
    const size = chalk.dim(formatBytes(item.size).padEnd(10));
    const location = chalk.gray(item.path);
    console.log(`${slug} | ${target} | ${ver} | ${size} | ${location}`);
  });

  console.log('');
}

// =========================================================
// COMMAND 3: REMOVE / UNINSTALL SKILL
// =========================================================
export async function removeSkill(identifier, options = {}) {
  if (!identifier || !identifier.trim()) {
    console.log(chalk.yellow('\nPlease specify the skill slug to remove.'));
    console.log(chalk.gray('Example: snix skill remove premium-ui-architect\n'));
    return;
  }

  const { slug } = parseSkillIdentifier(identifier);
  const cwd = process.cwd();

  // Find candidate locations
  const candidates = [
    { target: 'Antigravity', path: path.join(cwd, '.agents', 'skills', slug), isDir: true },
    { target: 'Cursor', path: path.join(cwd, '.cursor', 'rules', `${slug}.mdc`), isDir: false },
    { target: 'Cursor', path: path.join(cwd, '.cursor', 'rules', `${slug}.md`), isDir: false },
    { target: 'Windsurf', path: path.join(cwd, '.windsurf', 'rules', `${slug}.md`), isDir: false },
    { target: 'Claude', path: path.join(cwd, '.claude', 'skills', slug), isDir: true }
  ];

  const matched = candidates.filter(c => existsSync(c.path));

  if (matched.length === 0) {
    console.log(chalk.yellow(`\nSkill '${slug}' was not found in any local skill directories (.agents, .cursor, .windsurf).\n`));
    return;
  }

  for (const match of matched) {
    const rel = path.relative(cwd, match.path);

    if (!options.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove skill '${slug}' (${match.target}) from ${rel}?`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow(`Skipped ${rel}`));
        continue;
      }
    }

    try {
      if (match.isDir) {
        await fs.rm(match.path, { recursive: true, force: true });
      } else {
        await fs.unlink(match.path);
      }
      console.log(chalk.green(`\n✔ Removed skill '${chalk.bold(slug)}' from ${chalk.cyan(rel)}`));
    } catch (err) {
      console.error(chalk.red(`Failed to remove ${rel}: ${err.message}`));
    }
  }

  console.log('');
}

// =========================================================
// COMMAND 4: VIEW / SHOW SKILL
// =========================================================
export async function viewSkill(identifier) {
  if (!identifier || !identifier.trim()) {
    console.log(chalk.yellow('\nPlease specify the skill slug to view.'));
    console.log(chalk.gray('Example: snix skill view premium-ui-architect\n'));
    return;
  }

  const { slug, username } = parseSkillIdentifier(identifier);
  const displayName = username ? `@${username}/${slug}` : slug;
  const spinner = ora({
    text: `Fetching skill '${chalk.bold(displayName)}' from SnippKit...`,
    color: 'cyan'
  }).start();

  try {
    const params = { slug };
    if (username) params.username = username;
    const res = await apiClient.get('/api/skills/read', { params });
    const skill = res.data;
    spinner.stop();

    console.log('\n' + chalk.bold.cyan('━'.repeat(80)));
    console.log(
      chalk.bold.white(`⚡ ${skill.title || slug}`) +
      chalk.dim(` (v${skill.version || '1.0.0'})`) +
      ' ' +
      (skill.is_public ? chalk.green.bold('[PUBLIC]') : chalk.gray('[PRIVATE]'))
    );
    console.log(chalk.bold.cyan('━'.repeat(80)));

    console.log(chalk.white('Slug:           ') + chalk.yellow(skill.slug));
    console.log(chalk.white('Author:         ') + chalk.magenta(`@${skill.author?.username || skill.username || 'developer'}`));
    if (skill.compatibility && skill.compatibility.length > 0) {
      console.log(chalk.white('Compatibility:  ') + chalk.green(skill.compatibility.join(', ')));
    }
    if (skill.tags && skill.tags.length > 0) {
      console.log(chalk.white('Tags:           ') + chalk.dim(skill.tags.join(', ')));
    }
    console.log(chalk.white('Views:          ') + chalk.dim(skill.views || 0));

    if (skill.description) {
      console.log('\n' + chalk.bold.white('Description:'));
      console.log(chalk.gray(`  ${skill.description}`));
    }

    if (skill.content) {
      console.log('\n' + chalk.bold.white('Instruction Preview:'));
      console.log(chalk.gray('─'.repeat(80)));
      const lines = skill.content.split('\n');
      const preview = lines.slice(0, 30).join('\n');
      console.log(chalk.white(preview));
      if (lines.length > 30) {
        console.log(chalk.dim(`\n  ... and ${lines.length - 30} more lines.`));
      }
      console.log(chalk.gray('─'.repeat(80)));
    }

    console.log('\n' + chalk.bold.white('To install this skill:'));
    console.log(chalk.cyan(`  $ snix skill add ${skill.slug}\n`));

  } catch (err) {
    spinner.fail(chalk.red(`Failed to fetch skill '${slug}'`));
    if (err.response?.status === 404) {
      console.log(chalk.yellow(`\nSkill '${slug}' was not found on SnippKit.\n`));
    } else {
      console.error(chalk.red(`Error: ${err.response?.data?.error || err.message}\n`));
    }
  }
}

// =========================================================
// COMMAND 5: SEARCH SKILLS
// =========================================================
export async function searchSkills(query) {
  if (!query || !query.trim()) {
    console.log(chalk.yellow('\nPlease provide a search term.'));
    console.log(chalk.gray('Example: snix skill search nextjs\n'));
    return;
  }

  const term = query.trim();
  const spinner = ora({
    text: `Searching SnippKit skills for '${chalk.bold(term)}'...`,
    color: 'cyan'
  }).start();

  try {
    const res = await apiClient.get(`/api/skills/search?q=${encodeURIComponent(term)}`);
    const skills = res.data || [];
    spinner.stop();

    if (skills.length === 0) {
      console.log(chalk.yellow(`\nNo skills found matching '${term}'.\n`));
      return;
    }

    console.log(chalk.bold.cyan(`\n🔍 Matching Skills (${skills.length}):\n`));
    console.log(
      chalk.bold.white('Slug'.padEnd(28)) + ' | ' +
      chalk.bold.white('Title'.padEnd(30)) + ' | ' +
      chalk.bold.white('Author'.padEnd(16)) + ' | ' +
      chalk.bold.white('Version'.padEnd(10)) + ' | ' +
      chalk.bold.white('Views')
    );
    console.log(chalk.gray(''.padEnd(100, '─')));

    skills.forEach(item => {
      const slug = chalk.yellow.bold((item.slug || '').slice(0, 27).padEnd(28));
      const title = chalk.white((item.title || 'Untitled').slice(0, 29).padEnd(30));
      const author = chalk.magenta((`@${item.author?.username || item.username || 'developer'}`).slice(0, 15).padEnd(16));
      const ver = chalk.cyan((item.version || '1.0.0').slice(0, 9).padEnd(10));
      const views = chalk.dim((item.views || 0).toString());
      console.log(`${slug} | ${title} | ${author} | ${ver} | ${views}`);
    });

    console.log('\n' + chalk.gray('Tip: Run ') + chalk.cyan('snix skill add <slug>') + chalk.gray(' to install a skill.\n'));

  } catch (err) {
    spinner.fail(chalk.red('Search failed'));
    console.error(chalk.red(`Error: ${err.response?.data?.error || err.message}\n`));
  }
}

// =========================================================
// COMMAND 6: INIT SKILL (LOCAL SCAFFOLDING)
// =========================================================
export async function initSkill(rawName, options = {}) {
  if (!rawName || !rawName.trim()) {
    console.log(chalk.yellow('\nPlease provide a name or slug for your new skill.'));
    console.log(chalk.gray('Example: snix skill init my-awesome-agent-skill\n'));
    return;
  }

  const slug = rawName.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-');
  const target = detectTarget(options.target);
  const destPath = resolveSkillPath(slug, target, options.out);
  const relPath = path.relative(process.cwd(), destPath);

  if (existsSync(destPath) && !options.force) {
    console.log(chalk.yellow(`\nSkill file already exists at '${relPath}'. Use -f to overwrite.\n`));
    return;
  }

  const templateContent = [
    '---',
    `name: ${slug}`,
    `description: Describe what this AI agent skill does and when the agent should activate it`,
    `version: 1.0.0`,
    `author: developer`,
    `compatibility: ["antigravity", "cursor", "claude-code", "windsurf"]`,
    '---',
    '',
    `# ${slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
    '',
    '## Overview & Purpose',
    'Provide a concise overview of the domain knowledge or behavior this skill provides.',
    '',
    '## Guidelines & Instructions',
    '1. First rule or guideline for the AI model.',
    '2. Second rule or workflow step.',
    '3. Code styling, structural patterns, or forbidden patterns.',
    '',
    '## Examples',
    '```',
    '// Provide concrete reference examples here',
    '```',
    ''
  ].join('\n');

  try {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, templateContent, 'utf8');

    console.log(chalk.green(`\n✔ Created skill template at ${chalk.bold.cyan(relPath)}`));
    console.log(chalk.gray('Edit this file to teach your AI agent new guidelines and workflows!\n'));
  } catch (err) {
    console.error(chalk.red(`Failed to scaffold skill: ${err.message}\n`));
  }
}

// =========================================================
// COMMAND 7: PUSH / PUBLISH SKILL (UPLOAD TO SNIPPKIT)
// =========================================================
export async function pushSkill(targetPath, options = {}) {
  if (!targetPath || !targetPath.trim()) {
    console.log(chalk.yellow('\nPlease specify the path to a skill markdown file to publish.'));
    console.log(chalk.gray('Example: snix skill push .agents/skills/my-skill/SKILL.md --public\n'));
    return;
  }

  const absPath = path.resolve(process.cwd(), targetPath.trim());
  if (!existsSync(absPath)) {
    console.error(chalk.red(`\nFile '${targetPath}' does not exist.\n`));
    return;
  }

  let rawContent;
  try {
    rawContent = await fs.readFile(absPath, 'utf8');
  } catch (err) {
    console.error(chalk.red(`\nFailed to read file '${targetPath}': ${err.message}\n`));
    return;
  }

  const meta = parseLocalFrontmatter(rawContent);
  const body = stripFrontmatter(rawContent);

  // Derive title
  let title = options.title || meta.name;
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      title = path.basename(path.dirname(absPath));
      if (title === 'skills' || title === 'rules' || title === '.') {
        title = path.basename(absPath, path.extname(absPath));
      }
    }
  }

  const slug = options.slug || meta.name || title.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const description = options.description || meta.description || '';
  const version = meta.version || '1.0.0';
  const isPublic = options.private ? false : true; // Default public unless --private

  const tags = options.tags ? options.tags.split(',').map(t => t.trim()).filter(Boolean) : ['agent-skills'];

  const spinner = ora({
    text: `Publishing skill '${chalk.bold(slug)}' to SnippKit...`,
    color: 'cyan'
  }).start();

  try {
    const payload = {
      title,
      slug,
      description,
      content: body || rawContent,
      version,
      is_public: isPublic,
      tags,
      compatibility: ['antigravity', 'cursor', 'claude-code', 'windsurf']
    };

    const res = await apiClient.post('/api/skills/create', payload);
    const result = res.data;

    spinner.succeed(chalk.green(`Successfully published skill '${chalk.bold(result.title || slug)}' v${result.version || version}!`));

    const visibilityBadge = isPublic ? chalk.green.bold('[PUBLIC]') : chalk.gray('[PRIVATE]');
    console.log('');
    console.log(chalk.bold.white('🚀 Published Skill:'));
    console.log(chalk.gray('  ├─ ') + chalk.white('Title:      ') + chalk.cyan.bold(result.title || slug));
    console.log(chalk.gray('  ├─ ') + chalk.white('Slug:       ') + chalk.yellow(result.slug || slug));
    console.log(chalk.gray('  ├─ ') + chalk.white('Visibility: ') + visibilityBadge);
    console.log(chalk.gray('  └─ ') + chalk.white('Web URL:    ') + chalk.underline.cyan(`https://snippkit.com/skills/${result.slug || slug}`));
    console.log('\n' + chalk.gray('Anyone can now install it with:'));
    console.log(chalk.cyan(`  $ snix skill add ${result.slug || slug}\n`));

  } catch (err) {
    spinner.fail(chalk.red(`Failed to publish skill '${slug}'`));
    if (err.response?.status === 401) {
      console.log(chalk.yellow('\nYou must be logged in to publish skills to SnippKit.'));
      console.log(chalk.cyan('Run: snix auth login\n'));
    } else {
      console.error(chalk.red(`Error: ${err.response?.data?.error || err.message}\n`));
    }
  }
}


