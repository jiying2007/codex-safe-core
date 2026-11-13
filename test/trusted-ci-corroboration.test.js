'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {corroborate, EXPECTED, digest} = require('../scripts/trusted-ci-corroboration');

const HEAD = 'a'.repeat(40), BASE = 'b'.repeat(40), TRUSTED = 'c'.repeat(40), OTHER = 'd'.repeat(40);
function fixture() {
  const run = {
    id: 43431447700, run_attempt: 1, workflow_id: 339782167,
    name: 'CI', event: 'pull_request', path: '.github/workflows/ci.yml',
    repository: {full_name: 'jiying2007/codex-safe-core'},
    head_sha: HEAD, status: 'completed', conclusion: 'success',
    pull_requests: [] // GitHub's actual CI run may have this empty.
  };
  const jobs = EXPECTED.map((name, n) => ({
    id: 10000 + n, name, run_id: run.id, head_sha: HEAD, status: 'completed',
    conclusion: name.startsWith('codex-canary-') ? 'skipped' : 'success'
  }));
  return {
    eventRun: structuredClone(run), before: structuredClone(run), after: structuredClone(run),
    prs: [{number: 98, head: {sha: HEAD}, base: {sha: BASE, ref: 'main', repo: {full_name: 'jiying2007/codex-safe-core'}}}],
    jobs,
    context: {
      eventHead: HEAD, repository: 'jiying2007/codex-safe-core',
      runId: run.id, runAttempt: 1, trustedWorkflowSha: TRUSTED
    }
  };
}
test('exact CI and job census associates to PR without relying on workflow_run.pull_requests', () => {
  const report = corroborate(fixture());
  assert.equal(report.identity.prNumber, 98);
  assert.equal(report.identity.headSha, HEAD);
  assert.equal(report.identity.workflowId, 339782167);
  assert.equal(report.verification.ci, 'observed-success');
  assert.deepEqual(report.verification.skippedJobs.sort(), ['codex-canary-behavioral','codex-canary-capability']);
  assert.equal(report.autonomy.autoMerge, false);
  assert.equal(report.autonomy.mergeAuthorized, false);
  assert.equal(report.verification.postMergeQuality, 'not-evaluated');
  const {contentDigest, ...payload} = report;
  assert.equal(contentDigest, digest(payload));
});
test('CI failure is recorded as non-success, not as green evidence', () => {
  const input = fixture();
  for (const part of [input.after, input.before, input.eventRun]) part.conclusion = 'failure';
  input.jobs.find(job => job.name === 'Node 22.22.2 / ubuntu-latest').conclusion = 'failure';
  input.jobs.find(job => job.name === 'CI Gate').conclusion = 'failure';
  assert.equal(corroborate(input).verification.ci, 'observed-non-success');
});
test('no fake CI trust through missing, skipped, duplicate or renamed jobs', () => {
  const a = fixture();
  a.jobs = a.jobs.filter(job => job.name !== 'security / codeql');
  assert.throws(() => corroborate(a), /incomplete/);
  const b = fixture();
  b.jobs.find(job => job.name === 'security / codeql').conclusion = 'skipped';
  assert.equal(corroborate(b).verification.ci, 'observed-non-success');
  const c = fixture();
  c.jobs[0].name = 'CI Gate';
  assert.throws(() => corroborate(c), /duplicated/);
  const d = fixture();
  d.jobs[0].name = 'fake-PR-controlled-job';
  assert.throws(() => corroborate(d), /unknown/);
  const e = fixture();
  e.jobs.find(job => job.name === 'CI Gate').conclusion = 'failure';
  assert.equal(corroborate(e).verification.ci, 'observed-non-success');
});
test('rejects job result from different run or SHA, even with successful conclusion', () => {
  const a = fixture();
  a.jobs[0].run_id++;
  assert.throws(() => corroborate(a), /not bound/);
  const b = fixture();
  b.jobs[0].head_sha = OTHER;
  assert.throws(() => corroborate(b), /not bound/);
  const c = fixture();
  c.jobs[0].status = 'in_progress';
  assert.throws(() => corroborate(c), /not bound/);
});
test('run identity cannot drift between event and two live metadata reads', () => {
  for (const [field, value] of [
    ['head_sha', OTHER], ['id', 1], ['run_attempt', 2], ['workflow_id', 2],
    ['path', '.github/workflows/fake.yml'], ['event','push'], ['name','pretend CI']
  ]) {
    const input = fixture();
    input.before[field] = value;
    assert.throws(() => corroborate(input), /drift|provenance/, field);
  }
  const input = fixture();
  input.context.eventHead = OTHER;
  assert.throws(() => corroborate(input), /disagree/);
});
test('fork, stale or ambiguous PR mapping cannot be promoted to same-head evidence', () => {
  const a = fixture();
  a.prs = [];
  assert.throws(() => corroborate(a), /exactly one/);
  const b = fixture();
  b.prs.push(structuredClone(b.prs[0]));
  assert.throws(() => corroborate(b), /exactly one/);
  const c = fixture();
  c.prs[0].head.sha = OTHER;
  assert.throws(() => corroborate(c), /stale|ambiguous/);
  const d = fixture();
  d.prs[0].base.ref = 'release';
  assert.throws(() => corroborate(d), /ambiguous/);
});
test('future or malformed run metadata cannot count as completed evidence', () => {
  const a = fixture();
  for (const item of [a.eventRun,a.before,a.after]) item.status = 'in_progress';
  assert.throws(() => corroborate(a), /no final outcome/);
  const b = fixture();
  b.jobs[2].conclusion = null;
  assert.throws(() => corroborate(b), /not bound/);
  const c = fixture();
  c.context.trustedWorkflowSha = 'main';
  assert.throws(() => corroborate(c), /exact SHA/);
});
