import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import apiClient from '../lib/api.js';

export const EXT_LANG_MAP = {
  '.py': 'Python',
  '.js': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.ts': 'TypeScript',
  '.mts': 'TypeScript',
  '.jsx': 'JavaScript / React',
  '.tsx': 'TypeScript / React',
  '.java': 'Java',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.sh': 'Bash',
  '.bash': 'Bash',
  '.ps1': 'PowerShell',
  '.sql': 'SQL',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.md': 'Markdown',
  '.html': 'HTML',
  '.css': 'CSS'
};

export const EXCLUDED_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^credentials\.json$/i,
  /^secrets?\.json$/i,
  /^service-account\.json$/i,
  /^token\.json$/i,
  /^auth\.json$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /\.(pem|key|p12|pfx|crt|cer|sqlite|sqlite3|db|dump|exe|dll|so|zip|tar|gz|7z|png|jpg|jpeg|gif|ico|pdf)$/i,
  /^node_modules$/i,
  /^\.git$/i,
  /^\.github$/i,
  /^dist$/i,
  /^build$/i,
  /^out$/i,
  /^target$/i,
  /^vendor$/i,
  /^venv$/i,
  /^\.venv$/i
];

export function detectLanguage(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return EXT_LANG_MAP[ext] || (filepath.endsWith('.config.js') ? 'JavaScript' : 'Plain Text');
}

export function isExcludedFile(filepath) {
  const basename = path.basename(filepath);
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(basename));
}

async function collectFiles(paths, recursive = false) {
  const fileList = [];
  const excludedList = [];

  for (const itemPath of paths) {
    const absPath = path.resolve(process.cwd(), itemPath);
    try {
      const stat = await fs.stat(absPath);
      if (stat.isFile()) {
        if (isExcludedFile(absPath)) {
          excludedList.push(itemPath);
        } else {
          fileList.push(absPath);
        }
      } else if (stat.isDirectory()) {
        if (isExcludedFile(absPath)) {
          excludedList.push(itemPath);
          continue;
        }
        const entries = await fs.readdir(absPath, { withFileTypes: true });
        for (const entry of entries) {
          const childPath = path.join(absPath, entry.name);
          if (entry.isDirectory()) {
            if (recursive && !isExcludedFile(entry.name)) {
              const subCollection = await collectFiles([childPath], true);
              fileList.push(...subCollection.fileList);
              excludedList.push(...subCollection.excludedList);
            }
          } else if (entry.isFile()) {
            if (isExcludedFile(childPath)) {
              excludedList.push(childPath);
            } else {
              fileList.push(childPath);
            }
          }
        }
      }
    } catch (e) {
      console.warn(chalk.yellow(`Warning: Could not access '${itemPath}': ${e.message}`));
    }
  }

  return { fileList: [...new Set(fileList)], excludedList };
}

export function parseFilePathModifier(rawPath) {
  let filepath = rawPath;
  let visibilityOverride = null;
  let languageOverride = null;
  let titleOverride = null;
  let slugOverride = null;

  if (rawPath.includes(':')) {
    const parts = rawPath.split(':');
    filepath = parts[0];

    for (let i = 1; i < parts.length; i++) {
      const token = parts[i].trim();
      const tokenLower = token.toLowerCase();
      if (tokenLower === 'public') {
        visibilityOverride = 'public';
      } else if (tokenLower === 'private') {
        visibilityOverride = 'private';
      } else if (tokenLower.startsWith('language=')) {
        languageOverride = token.slice(9).trim();
      } else if (tokenLower.startsWith('lang=')) {
        languageOverride = token.slice(5).trim();
      } else if (tokenLower.startsWith('title=')) {
        titleOverride = token.slice(6).trim();
      } else if (tokenLower.startsWith('t=')) {
        titleOverride = token.slice(2).trim();
      } else if (tokenLower.startsWith('slug=')) {
        slugOverride = token.slice(5).trim();
      } else if (tokenLower.startsWith('s=')) {
        slugOverride = token.slice(2).trim();
      }
    }
  }

  return { filepath, visibilityOverride, languageOverride, titleOverride, slugOverride };
}

export async function pushFiles(targetPaths, options = {}) {
  if (!targetPaths || targetPaths.length === 0) {
    console.log(chalk.yellow('\nPlease specify one or more files to push.'));
    console.log(chalk.gray('Example: snix push script.py file2.js:public:language=javascript:title="My Tool"\n'));
    return;
  }

  const rawOverridesMap = {};
  const cleanedPaths = [];

  for (const rawArg of targetPaths) {
    const { filepath, visibilityOverride, languageOverride, titleOverride, slugOverride } = parseFilePathModifier(rawArg);
    cleanedPaths.push(filepath);
    const abs = path.resolve(process.cwd(), filepath);
    rawOverridesMap[abs] = {
      visibility: visibilityOverride,
      language: languageOverride,
      title: titleOverride,
      slug: slugOverride
    };
  }

  const { fileList, excludedList } = await collectFiles(cleanedPaths, options.recursive);

  if (excludedList.length > 0) {
    console.log(chalk.gray(`Skipped ${excludedList.length} protected/unwanted file(s) (e.g. .env, secrets, binaries).`));
  }

  if (fileList.length === 0) {
    console.log(chalk.red('No valid text/code files found to push.'));
    return;
  }

  const defaultBatchVisibility = (options.public || options.publicAll) ? 'public' : 'private';
  const isBulk = fileList.length > 1;

  console.log(chalk.bold.cyan(`\nSnippKit ${isBulk ? 'Bulk Push' : 'Push'}\n`));
  console.log(`Found ${fileList.length} file(s):`);

  const fileSpecs = [];
  for (const fp of fileList) {
    const relName = path.relative(process.cwd(), fp);
    const overrides = rawOverridesMap[fp] || {};
    
    const title = overrides.title || options.title || path.parse(fp).name;
    const slug = overrides.slug || (fileList.length === 1 ? options.slug : null);
    
    // Language Precedence: Per-file modifier -> Global option -> Auto-detected extension
    const lang = overrides.language || options.language || detectLanguage(fp);
    
    // Visibility Precedence: Per-file modifier -> Global option -> Default private
    const visibility = overrides.visibility || defaultBatchVisibility;
    
    fileSpecs.push({ filepath: fp, relName, title, slug, lang, visibility });
    
    const visBadge = visibility === 'public' ? chalk.green('[PUBLIC]') : chalk.gray('[PRIVATE]');
    console.log(`  ✓ ${relName.padEnd(30)} ${chalk.gray(lang).padEnd(20)} ${visBadge}`);
  }

  const hasPublic = fileSpecs.some(spec => spec.visibility === 'public');

  if (hasPublic && !options.yes) {
    const confirmPublic = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: chalk.yellow('⚠ One or more snippets will be uploaded PUBLICLY. Continue?'),
      default: false
    }]);
    if (!confirmPublic.proceed) {
      console.log(chalk.yellow('Push cancelled.'));
      return;
    }
  }

  let folderPathName = null;

  if (options.folder) {
    folderPathName = options.folder.trim();
  } else if (!options.yes && process.stdout.isTTY) {
    let existingFolders = [];
    try {
      const { data } = await apiClient.get('/api/cli/list?type=folders');
      if (Array.isArray(data)) {
        const seen = new Set();
        existingFolders = data.filter(f => {
          if (!f || !f.name) return false;
          const key = f.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch (e) {}

    const choices = [
      { name: chalk.gray('📁 No Folder (Root)'), value: null },
      { name: chalk.green('+ Create a new folder'), value: '__NEW__' }
    ];

    if (existingFolders.length > 0) {
      choices.push(new inquirer.Separator(chalk.gray('── Your Existing Folders ──')));
      existingFolders.forEach(f => {
        choices.push({
          name: `📁 ${f.name} ${f.slug ? chalk.dim(`(${f.slug})`) : ''}`,
          value: f.name
        });
      });
    }

    const folderChoice = await inquirer.prompt([{
      type: 'list',
      name: 'dest',
      message: 'Organize into a folder?',
      choices,
      pageSize: 10,
      loop: false
    }]);

    if (folderChoice.dest === '__NEW__') {
      const newFolderPrompt = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'Folder name (e.g., Python/Automation, DevOps):',
        validate: input => input.trim() ? true : 'Folder name required'
      }]);
      folderPathName = newFolderPrompt.name.trim();
    } else if (folderChoice.dest) {
      folderPathName = folderChoice.dest;
    }
  }

  if (folderPathName) {
    console.log(`Destination Folder: ${chalk.bold.cyan(folderPathName)}`);
  }

  if (!options.yes && process.stdout.isTTY) {
    const confirmPush = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Ready to upload? Continue?',
      default: true
    }]);
    if (!confirmPush.proceed) {
      console.log(chalk.yellow('Push cancelled.'));
      return;
    }
  }

  // Enforce Upstash Rate Limit Protection (max 20 files per bulk upload batch)
  const MAX_BULK_LIMIT = 20;
  let activeSpecs = fileSpecs;
  if (fileSpecs.length > MAX_BULK_LIMIT) {
    console.log(chalk.yellow(`\n⚠ Rate Limit Protection (Upstash): Maximum ${MAX_BULK_LIMIT} files allowed per batch.`));
    console.log(chalk.gray(`Processing first ${MAX_BULK_LIMIT} files to prevent API rate limit throttling.\n`));
    activeSpecs = fileSpecs.slice(0, MAX_BULK_LIMIT);
  }

  console.log(chalk.cyan(`\nUploading ${activeSpecs.length} snippet(s)...`));

  let successCount = 0;
  const failures = [];

  for (const spec of activeSpecs) {
    const spinner = ora(`Uploading ${spec.relName}...`).start();
    try {
      const codeContent = await fs.readFile(spec.filepath, 'utf8');

      let payload = {
        title: spec.title,
        code: codeContent,
        language: spec.lang.toLowerCase(),
        is_public: spec.visibility === 'public',
        ...(folderPathName ? { folder: folderPathName } : {}),
        ...(spec.slug ? { slug: spec.slug.trim() } : {})
      };

      try {
        await apiClient.post('/api/s/create', payload);
        spinner.succeed(chalk.green(`${spec.relName} (${spec.title})`));
        successCount++;
      } catch (uploadErr) {
        const errCode = uploadErr.response?.data?.error;
        if (errCode === 'custom_slug_not_allowed' && payload.slug) {
          spinner.stop();
          let proceedWithoutSlug = options.yes || !process.stdout.isTTY;
          if (!proceedWithoutSlug) {
            const fallbackConfirm = await inquirer.prompt([{
              type: 'confirm',
              name: 'retry',
              message: chalk.yellow(`⚠ Your SnippKit plan does not support custom slug '${payload.slug}'. Continue without custom slug (using auto-generated ID)?`),
              default: true
            }]);
            proceedWithoutSlug = fallbackConfirm.retry;
          }

          if (proceedWithoutSlug) {
            spinner.start(`Uploading ${spec.relName} without custom slug...`);
            delete payload.slug;
            await apiClient.post('/api/s/create', payload);
            spinner.succeed(chalk.green(`${spec.relName} (uploaded with auto-generated ID)`));
            successCount++;
          } else {
            throw uploadErr;
          }
        } else {
          throw uploadErr;
        }
      }
    } catch (error) {
      let msg = error.response?.data?.message || error.response?.data?.error || error.message;
      if (error.response?.status === 429 || msg === 'rate_limited') {
        msg = 'Upstash Rate Limit Exceeded (Max 20 uploads per minute allowed by API)';
      }
      spinner.fail(chalk.red(`${spec.relName} (${msg})`));
      failures.push({ file: spec.relName, error: msg });
    }

    // 100ms throttle delay between individual sequential uploads for Upstash safety
    await new Promise(res => setTimeout(res, 100));
  }

  console.log(chalk.bold.green(`\nSummary: ${successCount} uploaded successfully, ${failures.length} failed.`));

  if (failures.length > 0) {
    console.log(chalk.red('\nFailed Uploads:'));
    failures.forEach(f => console.log(`  - ${f.file}: ${f.error}`));
  }
}
