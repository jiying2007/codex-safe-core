'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateReviewRules, normalizeGitPath } = require('..');

test('normalizes Git paths without accepting absolute/control-character paths', () => {
  assert.equal(normalizeGitPath('./src\\a.js'), 'src/a.js');
  assert.equal(normalizeGitPath('/etc/passwd'), '');
  assert.equal(normalizeGitPath('bad\npath'), '');
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
