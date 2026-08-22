'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const core = require('..');

const semanticDiff = [
  'diff --git a/src/a.js b/src/a.js',
  '--- a/src/a.js',
  '+++ b/src/a.js',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/package-lock.json b/package-lock.json',
  '--- a/package-lock.json',
  '+++ b/package-lock.json',
  '@@ -1 +1 @@',
  '-old-lock',
  '+new-lock',
  'diff --git a/images/a.png b/images/a.png',
  'Binary files a/images/a.png and b/images/a.png differ'
].join('\n');

test('semantic context keeps source and demotes generated/binary payloads', () => {
  const context = core.buildSemanticContext({
    files: ['src/a.js', 'package-lock.json', 'images/a.png'],
    diff: semanticDiff,
    commits: ['feat: x'],
    maxBytes: 4096
  });
  assert.match(context.text, /src\/a\.js/);
  assert.match(context.text, /\+new/);
  assert.doesNotMatch(context.text, /\+new-lock/);
  assert.deepEqual(context.generatedFiles, ['package-lock.json']);
  assert.deepEqual(context.binaryFiles, ['images/a.png']);
  assert.equal(core.splitUnifiedDiff(semanticDiff).length, 3);
});

test('semantic context truncates per source file instead of global prefix slicing', () => {
  const large = [
    'diff --git a/src/a.js b/src/a.js', '--- a/src/a.js', '+++ b/src/a.js', '@@ -1 +1 @@', `+${'a'.repeat(6000)}`,
    'diff --git a/src/b.js b/src/b.js', '--- a/src/b.js', '+++ b/src/b.js', '@@ -1 +1 @@', `+${'b'.repeat(6000)}`
  ].join('\n');
  const context = core.buildSemanticContext({ diff: large, maxBytes: 4096 });
  assert.equal(context.truncated, true);
  assert.deepEqual(context.includedSourceFiles.sort(), ['src/a.js', 'src/b.js']);
  assert.ok(context.truncatedSourceFiles.length >= 1);
  assert.match(context.text, /src\/a\.js/);
  assert.match(context.text, /src\/b\.js/);
});

test('policy document is closed at the top level and requires schema v2', () => {
  assert.equal(core.POLICY_FILE, '.codex-safe.json');
  assert.equal(core.validatePolicyDocument({ schemaVersion: 2, commit: {}, review: {}, pr: {} }).schemaVersion, 2);
  assert.throws(() => core.validatePolicyDocument({ schemaVersion: 1 }), /schemaVersion/);
  assert.throws(() => core.validatePolicyDocument({ schemaVersion: 2, legacy: {} }), /unsupported top-level/);
});

test('HEAD policy reader ignores working tree by consuming Git objects only', async () => {
  const text = JSON.stringify({ schemaVersion: 2, review: { confidenceThreshold: 0.8 } });
  const oid = 'a'.repeat(40);
  const calls = [];
  const git = async args => {
    calls.push(args);
    if (args[0] === 'ls-tree') return { stdout: `100644 blob ${'b'.repeat(40)}\t.codex-safe.json\0`, stderr: '' };
    if (args[0] === 'show') return { stdout: text, stderr: '' };
    throw new Error(`unexpected git call: ${args.join(' ')}`);
  };
  const result = await core.readPolicySectionAtHead({ git, repoRoot: '/repo', headOid: oid, section: 'review' });
  assert.deepEqual(result.rules, { confidenceThreshold: 0.8 });
  assert.equal(result.fingerprint, crypto.createHash('sha256').update(text, 'utf8').digest('hex'));
  assert.deepEqual(calls[0], ['ls-tree', '-z', oid, '--', '.codex-safe.json']);
  assert.deepEqual(calls[1], ['show', `${oid}:.codex-safe.json`]);
});
