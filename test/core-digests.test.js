'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { computeCoreDigests } = require('../scripts/core-digests');

function run(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }); }
function tempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-core-digests-'));
  run(root, ['init', '-q']);
  run(root, ['config', 'user.name', 'test']);
  run(root, ['config', 'user.email', 'test@example.invalid']);
  fs.writeFileSync(path.join(root, 'core-surface-manifest.json'), JSON.stringify({ schemaVersion: 1, runtimeFiles: [], runtimeTopLevelExtensions: ['.js'], runtimeExcludeFiles: ['promotion-corpus.js'], runtimeContractKeys: ['runtimeVersion'] }, null, 2));
  fs.writeFileSync(path.join(root, 'core-contract.json'), JSON.stringify({ coreVersion: '1.0.0', runtimeVersion: 1, governanceVersion: 1 }, null, 2));
  fs.writeFileSync(path.join(root, 'runtime.js'), "module.exports = 1;\n");
  fs.writeFileSync(path.join(root, 'promotion-corpus.js'), "module.exports = [];\n");
  fs.writeFileSync(path.join(root, 'README.md'), '# docs\n');
  run(root, ['add', '-A']);
  run(root, ['commit', '-qm', 'fixture']);
  return root;
}

test('governance-only contract and quality changes do not change runtime digest', () => {
  const root = tempRepo();
  try {
    const before = computeCoreDigests(root);
    fs.writeFileSync(path.join(root, 'core-contract.json'), JSON.stringify({ coreVersion: '1.0.1', runtimeVersion: 1, governanceVersion: 2 }, null, 2));
    fs.writeFileSync(path.join(root, 'promotion-corpus.js'), "module.exports = ['governance-only'];\n");
    const after = computeCoreDigests(root);
    assert.equal(after.runtimeDigest, before.runtimeDigest);
    assert.notEqual(after.governanceDigest, before.governanceDigest);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('runtime source or runtime contract changes alter runtime digest', () => {
  const root = tempRepo();
  try {
    const before = computeCoreDigests(root);
    fs.writeFileSync(path.join(root, 'runtime.js'), "module.exports = 2;\n");
    const sourceChanged = computeCoreDigests(root);
    assert.notEqual(sourceChanged.runtimeDigest, before.runtimeDigest);
    fs.writeFileSync(path.join(root, 'runtime.js'), "module.exports = 1;\n");
    fs.writeFileSync(path.join(root, 'core-contract.json'), JSON.stringify({ coreVersion: '1.0.1', runtimeVersion: 2, governanceVersion: 1 }, null, 2));
    const contractChanged = computeCoreDigests(root);
    assert.notEqual(contractChanged.runtimeDigest, before.runtimeDigest);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
