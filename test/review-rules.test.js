'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateReviewRules, normalizeGitPath } = require('..');

test('preserves Git names without accepting absolute or NUL-containing paths', () => {
  assert.equal(normalizeGitPath('./src\\a.js'), './src\\a.js');
  assert.equal(normalizeGitPath(' padded.js '), ' padded.js ');
  assert.equal(normalizeGitPath('/etc/passwd'), '');
  assert.equal(normalizeGitPath('bad\npath'), 'bad\npath');
  assert.equal(normalizeGitPath('bad\0path'), '');
});

test('forbidden path prefix violations are deterministic and deduplicated', () => {
  const result = evaluateReviewRules(['src/a.js', './secrets/a.txt', 'secrets/a.txt'], {
    forbiddenPathPrefixes: ['secrets/']
  });
  assert.deepEqual(result.violations, [
    { rule: 'forbiddenPathPrefix', path: 'secrets/a.txt', prefix: 'secrets/' }
  ]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.violations));
});

test('code changes require test-path changes only when rule is enabled', () => {
  const missing = evaluateReviewRules(['src/a.js', 'README.md'], {
    requireTestsForCodeChanges: true,
    codePathPrefixes: ['src/'],
    testPathPrefixes: ['test/', 'tests/']
  });
  assert.equal(missing.violations.length, 1);
  assert.equal(missing.violations[0].rule, 'requireTestsForCodeChanges');
  assert.deepEqual(missing.violations[0].codePaths, ['src/a.js']);

  const satisfied = evaluateReviewRules(['src/a.js', 'test/a.test.js'], {
    requireTestsForCodeChanges: true,
    codePathPrefixes: ['src/'],
    testPathPrefixes: ['test/']
  });
  assert.deepEqual(satisfied.violations, []);

  const disabled = evaluateReviewRules(['src/a.js'], {
    requireTestsForCodeChanges: false,
    codePathPrefixes: ['src/'],
    testPathPrefixes: ['test/']
  });
  assert.deepEqual(disabled.violations, []);
});

test('default code/test prefixes match product-family convention', () => {
  const result = evaluateReviewRules(['src/a.js'], { requireTestsForCodeChanges: true });
  assert.equal(result.violations[0].rule, 'requireTestsForCodeChanges');
  const withTest = evaluateReviewRules(['src/a.js', 'tests/a.test.js'], { requireTestsForCodeChanges: true });
  assert.deepEqual(withTest.violations, []);
});

test('explicit empty prefix arrays remain empty instead of restoring defaults', () => {
  const result = evaluateReviewRules(['src/a.js'], {
    requireTestsForCodeChanges: true,
    codePathPrefixes: [],
    testPathPrefixes: []
  });
  assert.deepEqual(result.codePathPrefixes, []);
  assert.deepEqual(result.testPathPrefixes, []);
  assert.deepEqual(result.violations, []);
});

test('review rules match exact raw prefixes and retain newline code paths', () => {
  const { validateReviewRules } = require('../policy');
  const prefixes = ['secret\\', 'secret/', ' padded/'];
  const rules = validateReviewRules({ forbiddenPathPrefixes: prefixes });
  assert.deepEqual(rules.forbiddenPathPrefixes, prefixes);
  const result = evaluateReviewRules(['secret\\key', 'secret/key', ' padded/key', 'padded/key'], rules);
  assert.deepEqual(result.violations.map(item => [item.path, item.prefix]), [
    ['secret\\key', 'secret\\'], ['secret/key', 'secret/'], [' padded/key', ' padded/']
  ]);
  const missing = evaluateReviewRules(['src/line\nbreak.c', 'test\\a.test.c'], { requireTestsForCodeChanges: true });
  assert.deepEqual(missing.violations[0].codePaths, ['src/line\nbreak.c']);
  assert.equal(evaluateReviewRules(['src\\a.c'], { requireTestsForCodeChanges: true }).violations.length, 0);
});
