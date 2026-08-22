'use strict';

const assert = require('assert');
const core = require('./');

assert.strictEqual(core.SAFE_CORE_VERSION, 2);
assert.strictEqual(core.SAFE_CONTRACT_VERSION, 2);
assert.strictEqual(core.REVIEW_RECEIPT_SCHEMA_VERSION, 2);
assert.strictEqual(core.COMMIT_RECEIPT_SCHEMA_VERSION, 2);
assert.deepStrictEqual(core.missingHelpFlags('x --json y', ['--json', '--sandbox']), ['--sandbox']);
const args = core.buildSafeCodexArgs('/tmp/schema.json', 'model-x');
assert(args.includes('--ask-for-approval'));
assert(args.includes('read-only'));
assert(args.includes('--output-schema'));
assert(args.includes('--model'));
assert.strictEqual(core.validateReviewReceipt({}), null);
assert.strictEqual(core.validateCommitReceipt({}), null);
assert.strictEqual(core.classifyPath('package-lock.json'), 'generated');
assert.strictEqual(core.classifyPath('src/main.js'), 'source');
assert.strictEqual(core.classifyPath('images/a.png'), 'binary');

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
const context = core.buildSemanticContext({
  files: ['src/a.js', 'package-lock.json', 'images/a.png'],
  diff: semanticDiff,
  commits: ['feat: x'],
  maxBytes: 4096
});
assert(context.text.includes('src/a.js'));
assert(context.text.includes('+new'));
assert(!context.text.includes('+new-lock'));
assert(context.generatedFiles.includes('package-lock.json'));
assert(context.binaryFiles.includes('images/a.png'));

const split = core.splitUnifiedDiff(semanticDiff);
assert.strictEqual(split.length, 3);
assert.strictEqual(split[0].kind, 'source');
assert.strictEqual(split[1].kind, 'generated');
assert.strictEqual(split[2].kind, 'binary');

assert(/^[0-9a-f]{64}$/.test(core.fingerprint({ b: 2, a: 1 })));
assert.strictEqual(core.POLICY_FILE, '.codex-safe.json');
assert.strictEqual(core.validatePolicyDocument({ schemaVersion: 2, commit: {}, review: {}, pr: {} }).schemaVersion, 2);
assert.throws(() => core.validatePolicyDocument({ schemaVersion: 1 }), /schemaVersion/);
console.log('Codex Safe Core v2 tests passed.');
