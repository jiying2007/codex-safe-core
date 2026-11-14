#!/usr/bin/env node
'use strict';

// Governance-only, read-only corroboration of a completed CI run.
// Never signs an authorization or uses an untrusted PR checkout.
const fs = require('node:fs');
const crypto = require('node:crypto');

const SHA = /^[0-9a-f]{40}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const EXPECTED = Object.freeze([
  'Node 22.22.2 / ubuntu-latest',
  'Node 22.22.2 / windows-latest',
  'Node 22.22.2 / macos-latest',
  'Node 24.19.0 / ubuntu-latest',
  'Node 24.19.0 / windows-latest',
  'Node 24.19.0 / macos-latest',
  'dependency-review',
  'package-reproducibility',
  'security / codeql',
  'security / zizmor',
  'canary-impact',
  'codex-canary-capability',
  'codex-canary-behavioral',
  'CI Gate'
]);
const CONDITIONAL = new Set(['codex-canary-capability', 'codex-canary-behavioral']);
const CAPABILITY_MATRIX = Object.freeze(['ubuntu-latest','windows-latest','macos-latest']
  .map(os => `codex-canary-capability (${os})`));
function expectedJobNames(jobs) {
  const expanded = jobs.some(job => CAPABILITY_MATRIX.includes(job?.name));
  return { expanded, names: expanded ? EXPECTED.flatMap(name => name === 'codex-canary-capability' ? CAPABILITY_MATRIX : [name]) : [...EXPECTED] };
}
function positiveInt(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(name + ' must be a positive integer.');
  return value;
}
function sha(value, name) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error(name + ' must be an exact SHA.');
  return value;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}
function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function sourceIdentity(run, repo) {
  if (!run || run.name !== 'CI' || run.event !== 'pull_request' ||
      run.path !== '.github/workflows/ci.yml' || run.repository?.full_name !== repo) {
    throw new Error('CI run provenance is not the canonical repository workflow.');
  }
  return {
    runId: positiveInt(run.id, 'Run ID'),
    attempt: positiveInt(run.run_attempt, 'Run attempt'),
    workflowId: positiveInt(run.workflow_id, 'Workflow ID'),
    headSha: sha(run.head_sha, 'Run head'),
    status: run.status,
    conclusion: run.conclusion,
    path: run.path
  };
}
function corroborate({eventRun, before, after, prs, jobs, context}) {
  if (!context || !REPO.test(context.repository || '')) throw new Error('Missing repository identity.');
  const repository = context.repository;
  const trustedWorkflowSha = sha(context.trustedWorkflowSha, 'Trusted workflow checkout');
  const wantedRun = positiveInt(context.runId, 'Expected run ID');
  const wantedAttempt = positiveInt(context.runAttempt, 'Expected attempt');
  const wantedHead = sha(context.eventHead, 'Event head');
  const live = sourceIdentity(after, repository);
  const earlier = sourceIdentity(before, repository);
  const event = sourceIdentity(eventRun, repository);
  for (const [name, identity] of [['before', earlier], ['event', event]]) {
    for (const field of Object.keys(live)) {
      if (identity[field] !== live[field]) throw new Error(name + ' CI run identity drift: ' + field);
    }
  }
  if (live.runId !== wantedRun || live.attempt !== wantedAttempt || live.headSha !== wantedHead) {
    throw new Error('CI event and current run identity disagree.');
  }
  if (live.status !== 'completed' || !['success', 'failure', 'cancelled', 'timed_out'].includes(live.conclusion)) {
    throw new Error('CI run has no final outcome.');
  }
  if (!Array.isArray(prs) || prs.length !== 1) throw new Error('CI head must resolve to exactly one pull request.');
  const pr = prs[0];
  if (!pr || !Number.isSafeInteger(pr.number) || pr.number <= 0 ||
      pr.head?.sha !== wantedHead || pr.base?.repo?.full_name !== repository ||
      pr.base?.ref !== 'main' || !SHA.test(pr.base?.sha || '')) {
    throw new Error('Pull request association is missing, stale, or ambiguous.');
  }
  if (!Array.isArray(jobs)) throw new Error('CI job inventory is incomplete or changed.');
  const {expanded,names:expectedNames}=expectedJobNames(jobs);
  if (jobs.length !== expectedNames.length) throw new Error('CI job inventory is incomplete or changed.');
  const byName = new Map();
  for (const job of jobs) {
    if (!job || typeof job.name !== 'string' || !expectedNames.includes(job.name) || byName.has(job.name)) {
      throw new Error('CI job name is unknown or duplicated.');
    }
    if (positiveInt(job.run_id, 'Job run ID') !== wantedRun || sha(job.head_sha, 'Job head') !== wantedHead ||
        job.status !== 'completed' || !['success', 'failure', 'skipped', 'cancelled', 'timed_out'].includes(job.conclusion)) {
      throw new Error('CI job result is missing or not bound to this exact run and head.');
    }
    positiveInt(job.id, 'Job ID');
    byName.set(job.name, job);
  }
  for (const name of expectedNames) if (!byName.has(name)) throw new Error('Missing canonical CI job: ' + name);
  const gate = byName.get('CI Gate');
  const critical = EXPECTED.filter(name => !CONDITIONAL.has(name));
  const allRequiredGreen = critical.every(name => byName.get(name).conclusion === 'success');
  const canaryGreen=expanded
    ? [...CAPABILITY_MATRIX,'codex-canary-behavioral'].every(name=>byName.get(name).conclusion==='success')
    : [...CONDITIONAL].every(name=>byName.get(name).conclusion==='skipped');
  const observedSuccess = live.conclusion === 'success' && allRequiredGreen && gate.conclusion === 'success' &&
    canaryGreen;
  const behavioral=byName.get('codex-canary-behavioral');
  const liveSteps=['Live filesystem/network negative behavior check','Live model quality smoke'];
  const liveCanary=expanded&&behavioral.conclusion==='success'&&Array.isArray(behavioral.steps)&&
    liveSteps.every(name=>behavioral.steps.filter(step=>step.name===name&&step.status==='completed'&&step.conclusion==='success').length===1);
  const summary = expectedNames.map(name => {
    const j = byName.get(name);
    return {id: j.id, name, conclusion: j.conclusion, conditional: CONDITIONAL.has(name)||CAPABILITY_MATRIX.includes(name)};
  });
  const result = {
    schemaVersion: 1,
    kind: 'codex-safe-ci-corroboration',
    identity: {
      repository, prNumber: pr.number, headSha: wantedHead, baseSha: pr.base.sha,
      trustedWorkflowSha, runId: wantedRun, runAttempt: wantedAttempt,
      workflowId: live.workflowId, workflowPath: live.path
    },
    verification: {
      ci: observedSuccess ? 'observed-success' : 'observed-non-success',
      ciRunConclusion: live.conclusion,
      canonicalJobs: summary.length,
      skippedJobs: summary.filter(job => job.conclusion === 'skipped').map(job => job.name),
      jobResults: summary,
      ciTrust: 'workflow-result-only-not-independent-security-proof',
      canaryApplication: expanded ? 'capability-matrix-requested' : 'not-requested',
      runtimeBehavior: liveCanary ? 'observed-live-canary-success' : 'not-evaluated',
      postMergeQuality: 'not-evaluated'
    },
    autonomy: {
      mode: 'shadow',
      candidate: false,
      autoMerge: false, mergeAuthorized: false,
      requiresHuman: true,
      reason: 'CI observation cannot confer merge authority or attest correctness'
    }
  };
  result.contentDigest = digest(result); // Content checksum, not signature or trusted CI receipt.
  return result;
}
// Two views come from one read-only workflow. They must match by exact PR/head/base
// and trusted executor identity before publication. This is NOT a merge decision.
function verifyObservationPair(ci, risk) {
  if (!ci || !risk || ci.kind !== 'codex-safe-ci-corroboration' ||
      risk.kind !== 'codex-safe-autonomy-observation' || !ci.identity || !risk.identity) {
    throw new Error('Missing or unexpected evidence type.');
  }
  for (const field of ['repository', 'prNumber', 'headSha', 'baseSha', 'trustedWorkflowSha']) {
    if (ci.identity[field] !== risk.identity[field]) throw new Error('CI and risk observation identity drift: ' + field);
  }
  if (ci.autonomy?.mergeAuthorized !== false || ci.autonomy?.autoMerge !== false ||
      risk.autonomy?.mergeAuthorized !== false || risk.autonomy?.autoMerge !== false) {
    throw new Error('Shadow observations must not confer merge authorization.');
  }
  if (risk.identity.prLifecycle === 'merged' && risk.autonomy?.candidate !== false) {
    throw new Error('Merged PR cannot retroactively qualify for auto-merge.');
  }
  return Object.freeze({consistent: true, mergeAuthorized: false});
}
function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i]?.startsWith('--') || !args[i + 1] || out[args[i]]) throw new Error('Invalid CLI arguments.');
    out[args[i]] = args[i + 1];
  }
  const required = ['--event','--before','--after','--prs','--jobs','--out','--head','--repo','--run','--attempt','--trusted-sha'];
  if (required.length !== Object.keys(out).length || required.some(key => !out[key])) {
    throw new Error('Missing CI corroboration input.');
  }
  return out;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const output = corroborate({
    eventRun: read(args['--event']), before: read(args['--before']), after: read(args['--after']),
    prs: read(args['--prs']), jobs: read(args['--jobs']),
    context: {
      eventHead: args['--head'], repository: args['--repo'],
      runId: Number(args['--run']), runAttempt: Number(args['--attempt']),
      trustedWorkflowSha: args['--trusted-sha']
    }
  });
  fs.writeFileSync(args['--out'], JSON.stringify(output, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  process.stdout.write('CI corroboration: ' + output.verification.ci + '; merge authorization remains disabled.\n');
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = {corroborate, verifyObservationPair, sourceIdentity, EXPECTED, CAPABILITY_MATRIX, expectedJobNames, digest};
