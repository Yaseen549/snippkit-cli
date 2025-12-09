import * as esbuild from 'esbuild';
import fs from 'fs';

// 1. Read the version from package.json
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Clean previous build
if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
}

console.log(`⚡ Bundling version ${pkg.version} with esbuild...`);

await esbuild.build({
    entryPoints: ['bin/snix.js'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/snix.cjs',
    format: 'cjs',
    minify: false,
    external: ['fsevents'],
    // ✅ 2. Inject the version as a global constant
    define: {
        'globalThis.SNIX_VERSION': `"${pkg.version}"`
    }
});

console.log('✅ Bundle complete: dist/snix.cjs');