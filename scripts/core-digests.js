#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function trackedFiles(root) {
  return git(root, ['ls-files', '-z']).split('\0').filter(Boolean).sort();
}
function blobDigest(root, relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return null;
  return git(root, ['hash-object', '--', relative]);
}
function isRuntimeFile(relative, manifest) {
  if (manifest.runtimeFiles.includes(relative)) return true;
  if (relative.includes('/')) return false;
  return manifest.runtimeTopLevelExtensions.some(ext => relative.endsWith(ext));
}
function contractProjection(contract, keys) {
  const value = {};
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(contract, key)) value[key] = contract[key];
  return canonical(value);
}
function computeCoreDigests(rootArg = process.cwd()) {
  const root = path.resolve(rootArg);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'core-surface-manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'core-contract.json'), 'utf8'));
  if (Number(manifest.schemaVersion) !== 1) throw new Error('Unsupported core surface manifest schema.');
  const files = trackedFiles(root);
  const runtimeEntries = [];
  const governanceEntries = [];
  for (const relative of files) {
    if (relative === 'core-contract.json') continue;
    const digest = blobDigest(root, relative);
    if (!digest) continue;
    const entry = [relative, digest];
    if (isRuntimeFile(relative, manifest)) runtimeEntries.push(entry);
    else governanceEntries.push(entry);
  }
  runtimeEntries.push(['core-contract.runtime', sha(JSON.stringify(contractProjection(contract, manifest.runtimeContractKeys)))]);
  governanceEntries.push(['core-contract.governance', sha(JSON.stringify(canonical(Object.fromEntries(Object.entries(contract).filter(([key]) => !manifest.runtimeContractKeys.includes(key))))))]);
  const runtimeDigest = sha(JSON.stringify(runtimeEntries));
  const governanceDigest = sha(JSON.stringify(governanceEntries));
  return Object.freeze({
    schemaVersion: 1,
    coreVersion: String(contract.coreVersion || ''),
    runtimeDigest,
    governanceDigest,
    runtimeEntries: runtimeEntries.length,
    governanceEntries: governanceEntries.length,
    surfaceManifestDigest: sha(JSON.stringify(canonical(manifest)))
  });
}

function main() {
  const root = process.argv[2] || process.cwd();
  const output = computeCoreDigests(root);
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0) {
    const target = process.argv[outputIndex + 1];
    if (!target) throw new Error('--output requires a path.');
    fs.writeFileSync(path.resolve(target), `${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message || String(error)); process.exitCode = 2; }
}
module.exports = { canonical, computeCoreDigests, contractProjection, isRuntimeFile };
