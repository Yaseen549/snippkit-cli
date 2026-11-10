import fs from "fs";
import path from "path";
import zlib from "zlib";
import { execSync } from "child_process";

// 1. Read version from package.json
const pkgPath = path.resolve("./package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg.version || "2.0.3";

console.log(`📦 Building Debian (.deb) package for snix v${version}...`);

const executablesDir = path.resolve("./executables");
const linuxBinaryPath = path.join(executablesDir, "snix-linux");

if (!fs.existsSync(linuxBinaryPath)) {
  console.error("❌ 'executables/snix-linux' not found. Run 'npm run package' first.");
  process.exit(1);
}

const buildDir = path.resolve("./dist/deb-staging");
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true, force: true });
}

// 2. Prepare Directory Structure
const debianDir = path.join(buildDir, "DEBIAN");
const binDir = path.join(buildDir, "usr", "local", "bin");
fs.mkdirSync(debianDir, { recursive: true });
fs.mkdirSync(binDir, { recursive: true });

// 3. Write DEBIAN/control file
const controlContent = `Package: snix
Version: ${version}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: SnippKit <support@snippkit.com>
Homepage: https://github.com/Yaseen549/snippkit-cli
Description: Official Terminal CLI for SnippKit & AI Agent Skills
 Save Once. Run Anywhere. Access code snippets, procedural knowledge,
 and reusable capabilities directly from your terminal.
`;

fs.writeFileSync(path.join(debianDir, "control"), controlContent.trim() + "\n", { mode: 0o644 });

// 4. Copy snix binary
const targetBin = path.join(binDir, "snix");
fs.copyFileSync(linuxBinaryPath, targetBin);
fs.chmodSync(targetBin, 0o755);

// 5. Build .deb package using dpkg-deb if available, or ar archive
const outputDeb = path.join(executablesDir, "snix.deb");

let built = false;
try {
  execSync(`dpkg-deb --build --root-owner-group "${buildDir}" "${outputDeb}"`, { stdio: "inherit" });
  built = true;
} catch (e) {
  // dpkg-deb might not be present on non-Debian (e.g. Windows)
  console.log("ℹ️  'dpkg-deb' not natively installed in current shell. Prepared debian directory structure.");
}

if (!built) {
  // Save control and staging info so Linux CI can finalize with 1 command
  fs.writeFileSync(
    path.join(executablesDir, "README_DEB.md"),
    `# Debian Package Staging\nTo build on Linux/Ubuntu/Debian:\n\`\`\`bash\ndpkg-deb --build dist/deb-staging executables/snix.deb\n\`\`\`\n`
  );
  console.log(`✅ Staging directory created at: dist/deb-staging`);
  console.log(`ℹ️  On Ubuntu/Debian/CI run: dpkg-deb --build dist/deb-staging executables/snix.deb`);
} else {
  console.log(`✅ Debian package created successfully at: executables/snix.deb`);
}

