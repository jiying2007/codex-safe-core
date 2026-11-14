'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {evaluate, safePath, digest} = require('../scripts/trusted-autonomy-shadow');

const H = '1'.repeat(40), B = '2'.repeat(40), OTHER = '3'.repeat(40);
function fixture(fileEntries = [{filename: 'docs/guide.md', status: 'modified', additions: 6, deletions: 2}], changes = {}) {
  const files = structuredClone(fileEntries);
  const additions = files.reduce((n, f) => n + f.additions, 0);
  const deletions = files.reduce((n, f) => n + f.deletions, 0);
  const pr = {
    number: 9, state: 'open', draft: false,
    head: {sha: H, repo: {full_name: 'jiying2007/codex-safe-core'}},
    base: {sha: B, ref: 'main', repo: {full_name: 'jiying2007/codex-safe-core'}},
    additions, deletions, changed_files: files.length, ...changes
  };
  return {
    pr, before: structuredClone(pr), files,
    context: {
      repository: 'jiying2007/codex-safe-core', prNumber: 9,
      eventHead: H, trustedBase: B, trustedWorkflowSha: OTHER, runId: '42', runAttempt: '1'
    }
  };
}
test('low-risk documentation remains SHADOW ONLY and records explicit verification gaps', () => {
  const result = evaluate(fixture());
  assert.equal(result.risk.level, 'low');
  assert.equal(result.autonomy.candidate, true);
  assert.equal(result.autonomy.autoMerge, false);
  assert.equal(result.autonomy.mergeAuthorized, false);
  assert.equal(result.autonomy.requiresHuman, true);
  assert.equal(result.verification.ci, 'not-evaluated');
  assert.match(result.contentDigest, /^[0-9a-f]{64}$/);
  const {contentDigest, ...payload} = result;
  assert.equal(contentDigest, digest(payload));
});
test('changing a CI workflow is high risk even when the PR says all checks passed', () => {
  const input = fixture([{filename: '.github/workflows/ci.yml', status: 'modified', additions: 1, deletions: 1}]);
  input.pr.checks = [{name: 'CI Gate', conclusion: 'success'}];
  input.before = structuredClone(input.pr);
  const result = evaluate(input);
  assert.equal(result.risk.level, 'high');
  assert.equal(result.autonomy.candidate, false);
  assert.equal(result.autonomy.autoMerge, false);
  assert.ok(result.risk.reasons.includes('protected-surface'));
});
test('renaming protected policy into documentation remains high risk', () => {
  const result = evaluate(fixture([{
    filename: 'docs/gate.md', previous_filename: 'repository-governance-contract.json',
    status: 'renamed', additions: 2, deletions: 2
  }]));
  assert.equal(result.risk.level, 'high');
  assert.ok(result.change.paths.includes('repository-governance-contract.json'));
});
test('source-code modification, test removal and dependency changes are never low-risk', () => {
  for (const [name, status, expected] of [
    ['quality-platform.js', 'modified', 'medium'],
    ['test/safe-contract.test.js', 'removed', 'medium'],
    ['package.json', 'modified', 'medium'],
    ['scripts/verify-repository-ruleset.js', 'modified', 'high']
  ]) {
    const result = evaluate(fixture([{filename: name, status, additions: 2, deletions: 3}]));
    assert.equal(result.risk.level, expected, name);
    assert.equal(result.autonomy.autoMerge, false);
  }
});
test('unknown or suspicious changed paths fail closed', () => {
  for (const path of ['/etc/passwd', '../escape.md', 'docs//bad.md', 'docs\\bad.md', 'docs/a\nbad.md']) {
    assert.throws(() => safePath(path), /Malformed/);
  }
  const input = fixture([{filename: '../escape.md', status: 'added', additions: 1, deletions: 0}]);
  assert.throws(() => evaluate(input), /Malformed/);
});
test('mixed metadata snapshots, stale event and spoofed base fail closed', () => {
  const a = fixture();
  a.before.head.sha = OTHER;
  assert.throws(() => evaluate(a), /head changed/);
  const b = fixture();
  b.context.eventHead = OTHER;
  assert.throws(() => evaluate(b), /head changed/);
  const c = fixture();
  c.pr.base.ref = 'feature';
  assert.throws(() => evaluate(c), /trusted main/);
  const d = fixture();
  d.pr.base.sha = OTHER;
  assert.throws(() => evaluate(d), /base changed/);
  const e = fixture();
  e.context.trustedBase = OTHER;
  assert.throws(() => evaluate(e), /base changed/);
});
test('incomplete, truncated or false-green file data never produces an observation', () => {
  const a = fixture();
  a.files = [];
  assert.throws(() => evaluate(a), /Incomplete/);
  const b = fixture();
  b.pr.changed_files = 3;
  b.before.changed_files = 3;
  assert.throws(() => evaluate(b), /Incomplete/);
  const c = fixture();
  c.files[0].additions = 0;
  assert.throws(() => evaluate(c), /accounting/);
  const d = fixture();
  d.files[0].status = 'undefined';
  assert.throws(() => evaluate(d), /Unrecognized/);
  const e = fixture();
  e.before.additions = 0;
  assert.throws(() => evaluate(e), /size changed/);
});
test('draft, fork and large changes are conservatively withheld from shadow candidacy', () => {
  const a = fixture(undefined, {draft: true});
  assert.equal(evaluate(a).autonomy.candidate, false);
  const b = fixture();
  b.pr.head.repo.full_name = 'fork/project';
  b.before = structuredClone(b.pr);
  assert.equal(evaluate(b).risk.level, 'medium');
  const c = fixture([{filename: 'docs/large.md', status: 'modified', additions: 210, deletions: 0}]);
  assert.equal(evaluate(c).risk.level, 'medium');
  const d = fixture([{filename: 'docs/huge.md', status: 'modified', additions: 1200, deletions: 0}]);
  assert.equal(evaluate(d).risk.level, 'high');
});
test('digest is canonical irrespective of object key order', () => {
  assert.equal(digest({a: 1, b: {x: 2, y: 3}}), digest({b: {y: 3, x: 2}, a: 1}));
});

test('post-CI observer may record a merged PR but never authorize a retroactive merge', () => {
  const input = fixture();
  input.pr.state = 'closed';
  input.pr.merged = true;
  input.pr.merged_at = '2026-11-13T14:28:54Z';
  input.before = structuredClone(input.pr);
  const report = evaluate(input);
  assert.equal(report.identity.prLifecycle, 'merged');
  assert.equal(report.identity.trustedWorkflowSha, OTHER);
  assert.equal(report.autonomy.candidate, false);
  assert.equal(report.autonomy.autoMerge, false);
  assert.equal(report.autonomy.mergeAuthorized, false);
});
test('closed but not merged, stale merge receipt, and workflow SHA drift fail closed', () => {
  const closed = fixture();
  closed.pr.state = 'closed';
  closed.before.state = 'closed';
  assert.throws(() => evaluate(closed), /neither open nor consistently merged/);
  const stale = fixture();
  stale.pr.state = 'closed';
  stale.pr.merged = true;
  stale.pr.merged_at = '2026-11-13T14:28:54Z';
  stale.before = structuredClone(stale.pr);
  stale.before.merged_at = '2026-11-13T14:28:55Z';
  assert.throws(() => evaluate(stale), /neither open nor consistently merged/);
  const invalid = fixture();
  invalid.context.trustedWorkflowSha = 'not-a-commit';
  assert.throws(() => evaluate(invalid), /Trusted workflow checkout must be an exact SHA/);
});
