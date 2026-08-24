'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contributing = fs.readFileSync(path.join(root, 'CONTRIBUTING.md'), 'utf8');

test('maintenance flow is coordinated across all four consumers', () => {
  for (const name of ['Codex Review Safe', 'Codex Commit Safe', 'Codex PR Safe', 'Codex Review Service']) {
    assert.match(contributing, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(contributing, /one exact Core commit/i);
  assert.match(contributing, /coordinated repin/i);
});

test('obsolete copied-runtime synchronization instructions cannot return', () => {
  assert.doesNotMatch(contributing, /scripts\/safe-core\.js\s+sync/);
  assert.match(contributing, /Branch tracking and copied-runtime synchronization are forbidden\./);
});

test('governance-only Core patches do not force product version churn', () => {
  assert.match(contributing, /does not by itself require consumer product-version bumps/i);
  assert.match(contributing, /product\/runtime semantics change/i);
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
