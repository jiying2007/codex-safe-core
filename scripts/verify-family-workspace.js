'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);
const mode = args.includes('--committed') ? 'committed' : args.includes('--index') ? 'index' : 'workspace';
const rootIndex = args.indexOf('--root');
if (args.some((arg, index) => arg !== '--workspace' && arg !== '--index' && arg !== '--committed' && arg !== '--root' && index !== rootIndex + 1)) {
  throw new Error('Usage: node scripts/verify-family-workspace.js --root <workspace> [--workspace|--index|--committed]');
}
if (rootIndex < 0 || !args[rootIndex + 1]) throw new Error('--root <workspace> is required.');

const workspaceRoot = path.resolve(args[rootIndex + 1]);
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'family-workspace-manifest.json'), 'utf8'));
if (manifest.schemaVersion !== 1) throw new Error(`Unsupported family manifest schema: ${manifest.schemaVersion}`);

function git(cwd, gitArgs) {
  return execFileSync('git', ['-C', cwd, ...gitArgs], { encoding: 'utf8' }).trim();
}

function requireDirectory(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  if (!fs.statSync(absolutePath).isDirectory()) throw new Error(`Missing directory: ${relativePath}`);
  return absolutePath;
}

const canonicalCore = requireDirectory(manifest.safeCore.path);
const canonicalHead = git(canonicalCore, ['rev-parse', 'HEAD']);
if (!/^[0-9a-f]{40}$/.test(canonicalHead)) throw new Error('Canonical Core HEAD must be a full Git SHA.');

for (const consumer of manifest.activeConsumers) {
  const consumerRoot = requireDirectory(consumer.path);
  const submoduleRoot = requireDirectory(path.join(consumer.path, consumer.safeCorePath));
  const actual = git(submoduleRoot, ['rev-parse', 'HEAD']);
  if (actual !== canonicalHead) {
    throw new Error(`${consumer.name} workspace Core drift: expected ${canonicalHead}, got ${actual}`);
  }
  if (mode === 'index' || mode === 'committed') {
    const gitArgs = mode === 'index'
      ? ['ls-files', '--stage', consumer.safeCorePath]
      : ['ls-tree', 'HEAD', consumer.safeCorePath];
    const fields = git(consumerRoot, gitArgs).split(/\s+/);
    const pinned = mode === 'index' ? fields[1] : fields[2];
    if (pinned !== canonicalHead) {
      throw new Error(`${consumer.name} ${mode} Core drift: expected ${canonicalHead}, got ${pinned || 'missing gitlink'}`);
    }
  }
  if (consumer.contractPath) {
    const contract = JSON.parse(fs.readFileSync(path.join(consumerRoot, consumer.contractPath), 'utf8'));
    if (contract.safeCoreCommit !== canonicalHead) {
      throw new Error(`${consumer.name} contract Core drift: expected ${canonicalHead}, got ${contract.safeCoreCommit}`);
    }
  }
}

console.log(`Family ${mode} verification passed: ${manifest.activeConsumers.length} active consumers on Core ${canonicalHead}.`);
