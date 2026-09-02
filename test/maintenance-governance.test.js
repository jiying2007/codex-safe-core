'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const contributing = fs.readFileSync(path.join(root, 'CONTRIBUTING.md'), 'utf8');

test('maintenance flow is coordinated across all five active consumers', () => {
  for (const name of ['Codex Change Safe','Codex Review Safe','Codex Commit Safe','Codex Review Service','Codex Diagnose Safe']) {
    assert.match(contributing, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(contributing, /Codex PR Safe remains retired/i);
  assert.match(contributing, /one exact Core commit/i);
  assert.match(contributing, /coordinated repin/i);
  assert.match(contributing, /Policy Schema v4/);
});

test('obsolete copied-runtime and parallel policy instructions cannot return', () => {
  assert.doesNotMatch(contributing, /scripts\/safe-core\.js\s+sync/);
  assert.match(contributing, /Branch tracking and copied-runtime synchronization are forbidden\./);
  assert.match(contributing,/single repository policy is `\.codex-safe\.json`/i);
  assert.match(contributing,/Do not add parallel product policy files/i);
});

test('governance-only Core patches do not force product version churn', () => {
  assert.match(contributing, /does not by itself require consumer product-version bumps/i);
  assert.match(contributing, /product\/runtime semantics change|Policy Schema/i);
});

test('coordinated repin routes Family validation through the freshness decision point', () => {
  const workflow=fs.readFileSync(path.join(root,'.github','workflows','family-upgrade.yml'),'utf8');
  assert.match(workflow,/gh workflow run "Family Freshness"/);
  assert.doesNotMatch(workflow,/gh workflow run "Family Compatibility"/);
  assert.match(workflow,/No compatibility shim or product-version change/);
});

test('dependency automation remains review-only and digest-pinned', () => {
  const renovate=JSON.parse(fs.readFileSync(path.join(root,'renovate.json'),'utf8'));
  assert.ok(renovate.extends.includes('config:best-practices'));
  assert.ok(renovate.extends.includes(':automergeDisabled'));
  assert.equal(renovate.minimumReleaseAge,'3 days');
  assert.equal(renovate.packageRules.every(rule=>rule.automerge===false),true);
});

test('released artifacts document consumer-side attestation verification', () => {
  const verify=fs.readFileSync(path.join(root,'VERIFY_RELEASE.md'),'utf8');
  assert.match(verify,/sha256sum -c SHA256SUMS/);
  assert.match(verify,/gh attestation verify .* -R jiying2007\/codex-safe-core/);
});

test('consumer boundary scan excludes the canonical Core submodule but still rejects consumer reimplementation', () => {
  const family = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-safe-family-boundary-'));
  const repos = ['codex-pr','codex-commit','codex-review','codex-review-service','codex-diagnose'];
  try {
    for (const repo of repos) {
      const repoRoot = path.join(family, repo);
      fs.mkdirSync(path.join(repoRoot, 'src', 'codex-safe-core'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'src', 'codex-safe-core', 'context-builder.js'), 'function buildReviewEvidenceChunks() {}\n');
      fs.writeFileSync(path.join(repoRoot, 'src', 'consumer.js'), 'module.exports = {};\n');
    }
    const verifier = path.join(root, 'scripts', 'verify-consumer-boundaries.js');
    const clean = spawnSync(process.execPath, [verifier, family], { encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    fs.writeFileSync(path.join(family, 'codex-pr', 'src', 'consumer.js'), 'function buildReviewEvidenceChunks() {}\n');
    const violation = spawnSync(process.execPath, [verifier, family], { encoding: 'utf8' });
    assert.notEqual(violation.status, 0);
    assert.match(violation.stderr, /codex-pr reimplements Core-owned symbol buildReviewEvidenceChunks: src[\\/]consumer\.js/);
  } finally {
    fs.rmSync(family, { recursive: true, force: true });
  }
});
