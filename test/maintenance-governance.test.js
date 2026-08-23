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
  assert.doesNotMatch(contributing, /branch tracking/i);
  assert.match(contributing, /Branch tracking and copied-runtime synchronization are forbidden\./);
});

test('governance-only Core patches do not force product version churn', () => {
  assert.match(contributing, /does not by itself require consumer product-version bumps/i);
  assert.match(contributing, /product\/runtime semantics change/i);
});
