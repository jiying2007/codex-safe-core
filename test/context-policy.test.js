'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
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
  const context = core.buildSemanticContext({ files: ['src/a.js', 'package-lock.json', 'images/a.png'], diff: semanticDiff, commits: ['feat: x'], maxBytes: 4096 });
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

test('policy document and sections are canonical, closed and deeply immutable', () => {
  assert.equal(core.POLICY_FILE, '.codex-safe.json');
  const document = core.validatePolicyDocument({
    schemaVersion: 2,
    commit: { language: 'en', scopes: ['core'], scopeHints: { core: ['runtime'] }, extraInstructions: 'concise' },
    review: { confidenceThreshold: 0.8, severityThreshold: 'medium' },
    pr: { baseBranch: 'origin/main', titleMaxLength: 90 }
  });
  assert.equal(document.schemaVersion, 2);
  assert.ok(Object.isFrozen(document));
  assert.ok(Object.isFrozen(document.commit));
  assert.ok(Object.isFrozen(document.commit.scopes));
  assert.ok(Object.isFrozen(document.commit.scopeHints));
  assert.ok(Object.isFrozen(document.commit.scopeHints.core));
  assert.throws(() => { document.commit.scopes.push('other'); }, TypeError);
  assert.throws(() => core.validatePolicyDocument({ schemaVersion: 1 }), /schemaVersion/);
  assert.throws(() => core.validatePolicyDocument({ schemaVersion: 2, legacy: {} }), /unsupported top-level/);
  assert.throws(() => core.validatePolicySection('commit', { unknown: true }), /unsupported fields/);
  assert.throws(() => core.validatePolicySection('commit', { extraInstructions: 'x'.repeat(4001) }), /4000/);
  assert.throws(() => core.validatePolicySection('commit', { scopes: ['core', 'core'] }), /duplicate/);
  assert.throws(() => core.validatePolicySection('review', { confidenceThreshold: 1.1 }), /between 0 and 1/);
  assert.throws(() => core.validatePolicySection('pr', { baseBranch: '-main' }), /must not start/);
  assert.throws(() => core.validatePolicySection('pr', { baseBranch: 'x'.repeat(257) }), /256/);
});

test('JSON Schema property keys and critical limits stay aligned with runtime policy', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'codex-safe.schema.json'), 'utf8'));
  for (const section of core.POLICY_SECTIONS) {
    assert.deepEqual(Object.keys(schema.properties[section].properties).sort(), [...core.POLICY_SECTION_KEYS[section]].sort(), `${section} schema keys drifted from runtime`);
    assert.equal(schema.properties[section].additionalProperties, false);
  }
  assert.equal(schema.properties.commit.properties.extraInstructions.maxLength, 4000);
  assert.equal(schema.properties.review.properties.extraInstructions.maxLength, 5000);
  assert.equal(schema.properties.pr.properties.extraInstructions.maxLength, 4000);
  assert.equal(schema.properties.commit.properties.scopes.maxItems, 64);
  assert.equal(schema.properties.commit.properties.scopeHints.maxProperties, 64);
  assert.match(schema.properties.pr.properties.baseBranch.pattern, /\(\?!-\)/);
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
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.rules));
  assert.equal(result.fingerprint, crypto.createHash('sha256').update(text, 'utf8').digest('hex'));
  assert.deepEqual(calls[0], ['ls-tree', '-z', oid, '--', '.codex-safe.json']);
  assert.deepEqual(calls[1], ['show', `${oid}:.codex-safe.json`]);
});
