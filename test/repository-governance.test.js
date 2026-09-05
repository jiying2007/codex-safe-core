'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assess, normalizedContexts } = require('../scripts/verify-repository-ruleset');

function canonicalDetail(overrides = {}) {
  return {
    name: 'Codex Safe main protection',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    bypass_actors: [{ actor_id: 1, actor_type: 'User', bypass_mode: 'pull_request' }],
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'pull_request', parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
        require_last_push_approval: true
      } },
      { type: 'required_status_checks', parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [{ context: 'CI Gate' }]
      } }
    ],
    ...overrides
  };
}

test('canonical Family Ruleset requires exactly one stable CI Gate context', () => {
  const detail = canonicalDetail();
  assert.deepEqual(normalizedContexts(detail.rules[3].parameters), ['CI Gate']);
  assert.deepEqual(assess(detail, { delete_branch_on_merge: true }), { ok: true, reasons: [] });
});

test('matrix context drift is rejected once CI Gate is canonical', () => {
  const detail = canonicalDetail();
  detail.rules[3].parameters.required_status_checks.push({ context: 'test (ubuntu-latest, 24.19.0)' });
  const result = assess(detail, { delete_branch_on_merge: true });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some(reason => reason.startsWith('required-checks-not-canonical:')));
});

test('always bypass and disabled branch cleanup are rejected', () => {
  const detail = canonicalDetail({ bypass_actors: [{ actor_id: 1, actor_type: 'User', bypass_mode: 'always' }] });
  const result = assess(detail, { delete_branch_on_merge: false });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('disallowed-bypass-mode:always'));
  assert.ok(result.reasons.includes('delete-branch-on-merge-disabled'));
});
