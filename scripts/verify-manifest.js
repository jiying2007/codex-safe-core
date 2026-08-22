'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
function fail(message) { throw new Error(message); }
if (manifest.schemaVersion !== 1 || manifest.safeCoreVersion !== 1) fail('Unsupported Safe Core manifest version.');
if (manifest.source?.repository !== 'jiying2007/codex-safe-core' || manifest.source?.path !== 'src') fail('Invalid canonical source.');
if (!Array.isArray(manifest.runtimeFiles) || !manifest.runtimeFiles.length) fail('runtimeFiles must not be empty.');
for (const relative of manifest.runtimeFiles) {
  if (!relative.startsWith('src/') || relative.includes('..')) fail(`Unsafe runtime path: ${relative}`);
  const full = path.join(root, relative);
  if (!fs.statSync(full).isFile()) fail(`Missing runtime file: ${relative}`);
}
console.log(`Codex Safe Core v${manifest.safeCoreVersion} manifest verified (${manifest.runtimeFiles.length} files).`);
