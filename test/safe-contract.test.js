'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('..');

function reviewReceipt(overrides = {}) {
  return {
    schemaVersion: 2,
    kind: 'codex-review-safe',
    headOid: '1'.repeat(40),
    indexFingerprint: '2'.repeat(64),
    diffFingerprint: '3'.repeat(64),
    policyFingerprint: '4'.repeat(64),
    stagedFileCount: 1,
    qualityVerdict: 'no_findings',
    readinessVerdict: 'needs_evidence',
    mechanicalGate: 'not_run',
    model: 'gpt-test',
    codexVersion: 'codex-cli 1.0.0',
    createdAt: '2026-08-22T00:00:00.000Z',
    ...overrides
  };
}

function commitReceipt(overrides = {}) {
  return {
    schemaVersion: 2,
    kind: 'codex-commit-safe',
    headOid: '1'.repeat(40),
    indexFingerprint: '2'.repeat(64),
    diffFingerprint: '3'.repeat(64),
    messageFingerprint: '4'.repeat(64),
    policyFingerprint: '5'.repeat(64),
    reviewReceiptFingerprint: '<none>',
    model: 'gpt-test',
    codexVersion: 'codex-cli 1.0.0',
    createdAt: '2026-08-22T00:00:00.000Z',
    commitOid: '<pending>',
    ...overrides
  };
}

test('contract versions and required Codex arguments stay hard-pinned', () => {
  assert.equal(core.SAFE_CORE_VERSION, 2);
  assert.equal(core.SAFE_CONTRACT_VERSION, 2);
  assert.equal(core.REVIEW_RECEIPT_SCHEMA_VERSION, 2);
  assert.equal(core.COMMIT_RECEIPT_SCHEMA_VERSION, 2);
  const args = core.buildSafeCodexArgs('/tmp/schema.json', 'model-x');
  assert.ok(args.indexOf('--ask-for-approval') < args.indexOf('exec'));
  assert.equal(args[args.indexOf('--ask-for-approval') + 1], 'never');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('--ignore-rules'));
  assert.ok(args.includes('--output-schema'));
});

test('review receipt is a closed v2 contract', () => {
  assert.ok(core.validateReviewReceipt(reviewReceipt()));
  assert.equal(core.validateReviewReceipt(reviewReceipt({ schemaVersion: 1 })), null);
  assert.equal(core.validateReviewReceipt(reviewReceipt({ unknown: true })), null);
  assert.equal(core.validateReviewReceipt(reviewReceipt({ createdAt: '2026-08-22' })), null);
  assert.equal(core.validateReviewReceipt(reviewReceipt({ stagedFileCount: 5001 })), null);
});

test('commit receipt is a closed v2 contract', () => {
  assert.ok(core.validateCommitReceipt(commitReceipt()));
  assert.ok(core.validateCommitReceipt(commitReceipt({ commitOid: 'a'.repeat(40) })));
  assert.equal(core.validateCommitReceipt(commitReceipt({ schemaVersion: 1 })), null);
  assert.equal(core.validateCommitReceipt(commitReceipt({ unknown: true })), null);
  assert.equal(core.validateCommitReceipt(commitReceipt({ commitOid: '-bad' })), null);
});

test('fingerprints are stable across object key order', () => {
  assert.equal(core.fingerprint({ a: 1, b: { c: 2 } }), core.fingerprint({ b: { c: 2 }, a: 1 }));
  assert.match(core.fingerprint({ a: 1 }), /^[0-9a-f]{64}$/);
});

test('capability helper reports missing flags and compatibility failures', () => {
  assert.deepEqual(core.missingHelpFlags('x --json y', ['--json', '--sandbox']), ['--sandbox']);
  assert.equal(core.isCliCompatibilityError({ stderr: 'error: unknown config key foo' }), true);
  assert.equal(core.isCliCompatibilityError({ stderr: 'authentication failed' }), false);
});
