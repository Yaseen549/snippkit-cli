import fs from 'fs';

let cachedVersion = '3.0.2';

if (globalThis.SNIX_VERSION) {
  cachedVersion = globalThis.SNIX_VERSION;
} else {
  try {
    const packageJsonUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(packageJsonUrl, 'utf8'));
    cachedVersion = pkg.version || '3.0.1';
  } catch {
    cachedVersion = '3.0.1';
  }
}

export const VERSION = cachedVersion;
export default VERSION;

