'use strict';

const assert = require('assert');
const crypto = require('crypto');
const core = require('./src');

assert.strictEqual(core.SAFE_CORE_VERSION, 1);
assert.deepStrictEqual(core.missingHelpFlags('x --json y', ['--json','--sandbox']), ['--sandbox']);
const args = core.buildSafeCodexArgs('/tmp/schema.json', 'model-x');
assert(args.includes('--ask-for-approval'));
assert(args.includes('read-only'));
assert(args.includes('--output-schema'));
assert(args.includes('--model'));
assert.strictEqual(core.validateReviewReceipt({}), null);
assert.strictEqual(core.classifyPath('package-lock.json'), 'generated');
assert.strictEqual(core.classifyPath('src/main.js'), 'source');
assert.strictEqual(core.classifyPath('images/a.png'), 'binary');
const context = core.buildSemanticContext({ files: ['src/a.js','package-lock.json','a.png'], diff: 'abc', commits: ['feat: x'], maxBytes: 4096 });
assert(context.text.includes('src/a.js'));
assert(context.generatedFiles.includes('package-lock.json'));
assert(context.binaryFiles.includes('a.png'));
assert(/^[0-9a-f]{64}$/.test(core.fingerprintPolicy({b:2,a:1})));
assert.strictEqual(core.fingerprintPolicy({a:1,b:2}), crypto.createHash('sha256').update(JSON.stringify({a:1,b:2})).digest('hex'));
console.log('Codex Safe Core tests passed.');
