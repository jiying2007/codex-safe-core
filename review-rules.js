'use strict';

function normalizeGitPath(value) {
  const text = String(value || '');
  // Git permits whitespace and backslashes inside a name. Do not alias them
  // to another file or silently omit newline-containing code changes.
  if (!text || text.startsWith('/') || text.includes('\0')) return '';
  return text;
}

function normalizePrefixes(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const normalized = normalizeGitPath(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function startsWithAny(filePath, prefixes) {
  const path = normalizeGitPath(filePath);
  return path ? prefixes.some(prefix => path.startsWith(prefix)) : false;
}

function evaluateReviewRules(changedPaths, rules = {}) {
  const paths = [...new Set((changedPaths || []).map(normalizeGitPath).filter(Boolean))];
  const codePathPrefixes = normalizePrefixes(rules.codePathPrefixes === undefined ? ['src/'] : rules.codePathPrefixes);
  const testPathPrefixes = normalizePrefixes(rules.testPathPrefixes === undefined ? ['test/', 'tests/'] : rules.testPathPrefixes);
  const forbiddenPathPrefixes = normalizePrefixes(rules.forbiddenPathPrefixes === undefined ? [] : rules.forbiddenPathPrefixes);
  const violations = [];

  for (const path of paths) {
    const prefix = forbiddenPathPrefixes.find(item => path.startsWith(item));
    if (prefix) violations.push(Object.freeze({ rule: 'forbiddenPathPrefix', path, prefix }));
  }

  if (rules.requireTestsForCodeChanges === true) {
    const codePaths = paths.filter(path => startsWithAny(path, codePathPrefixes) && !startsWithAny(path, testPathPrefixes));
    const testChanged = paths.some(path => startsWithAny(path, testPathPrefixes));
    if (codePaths.length && !testChanged) {
      violations.push(Object.freeze({ rule: 'requireTestsForCodeChanges', path: codePaths[0], codePaths: Object.freeze(codePaths) }));
    }
  }

  return Object.freeze({
    violations: Object.freeze(violations),
    changedPaths: Object.freeze(paths),
    codePathPrefixes: Object.freeze(codePathPrefixes),
    testPathPrefixes: Object.freeze(testPathPrefixes),
    forbiddenPathPrefixes: Object.freeze(forbiddenPathPrefixes)
  });
}

module.exports = { normalizeGitPath, normalizePrefixes, startsWithAny, evaluateReviewRules };
