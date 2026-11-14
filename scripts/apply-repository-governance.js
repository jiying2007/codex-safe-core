#!/usr/bin/env node
'use strict';

const contract = require('../repository-governance-contract.json');
const registry = require('../family-registry.json');
const { assess, policyFor, pullRequestPolicyFor, repositoryNameOf } = require('./verify-repository-ruleset');

const API = 'https://api.github.com';
const apply = process.argv.includes('--apply');
const zeroBypass = process.argv.includes('--zero-bypass');
const bindCiSource = contract.requiredStatusChecks.requireSourceBinding === true || process.argv.includes('--bind-ci-source');
const createMissing = process.argv.includes('--create-missing');
const cleanBranches = process.argv.includes('--clean-branches');
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

if (apply && !token) throw new Error('GH_TOKEN or GITHUB_TOKEN with repository Administration write permission is required for --apply.');

function headers() {
  return {
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'user-agent': 'codex-safe-governance-apply',
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
}

async function api(method, pathname, body, { anonymousRetry = false } = {}) {
  const request = async authenticated => fetch(`${API}${pathname}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: {
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'codex-safe-governance-apply',
      ...(authenticated && token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  let response = await request(true);
  if (anonymousRetry && token && method === 'GET' && (response.status === 403 || response.status === 404)) response = await request(false);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`GitHub API ${method} ${pathname} failed: ${response.status}${text ? ` ${text.slice(0, 300)}` : ''}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function pages(pathname, options) {
  const out = [];
  for (let page = 1; page <= 50; page += 1) {
    const join = pathname.includes('?') ? '&' : '?';
    const values = await api('GET', `${pathname}${join}per_page=100&page=${page}`, undefined, options);
    if (!Array.isArray(values)) throw new Error(`Expected paginated array from ${pathname}`);
    out.push(...values);
    if (values.length < 100) break;
  }
  return out;
}

function mergeMethods(repo) {
  const methods = [];
  if (repo.allow_merge_commit) methods.push('merge');
  if (repo.allow_squash_merge) methods.push('squash');
  if (repo.allow_rebase_merge) methods.push('rebase');
  if (!methods.length) throw new Error(`${repo.full_name} has no enabled merge method.`);
  return methods;
}

function desiredBypass(detail) {
  if (zeroBypass) return [];
  const current = Array.isArray(detail.bypass_actors) ? detail.bypass_actors : [];
  if (current.length > Number(contract.maximumBypassActors)) throw new Error(`Current bypass actor count exceeds contract for ${detail.name}.`);
  return current.map(actor => ({
    actor_id: actor.actor_id,
    actor_type: actor.actor_type,
    bypass_mode: 'pull_request'
  }));
}

function desiredStatusChecks(detail, { bindStatusSource = false } = {}) {
  const source = contract.requiredStatusChecks.expectedSource;
  const rule = (detail.rules || []).find(item => item.type === 'required_status_checks');
  const current = rule?.parameters?.required_status_checks;
  if (!Array.isArray(current) || current.length !== contract.requiredStatusChecks.contexts.length)
    throw new Error('Refusing to replace an incomplete or extra required-check policy.');
  return contract.requiredStatusChecks.contexts.map(context => {
    const found = current.filter(item => item?.context === context);
    if (found.length !== 1) throw new Error(`Refusing ambiguous required status context: ${context}`);
    const existingId = found[0].integration_id;
    if (existingId != null && (!Number.isSafeInteger(existingId) || existingId !== source.integrationId))
      throw new Error(`Refusing to replace a required check from a different source: ${context}`);
    // Both ordinary apply and explicit binding preserve a prior source binding.
    return { context, ...((bindStatusSource || existingId === source.integrationId) ? { integration_id: source.integrationId } : {}) };
  });
}
function validateMainGateCheckRuns(checks, sha, full = 'repository') {
  const source = contract.requiredStatusChecks.expectedSource;
  if (!/^[0-9a-f]{40}$/.test(String(sha))) throw new Error(`${full}: invalid main-HEAD SHA.`);
  if (!Number.isSafeInteger(checks?.total_count) || checks.total_count < 1 ||
      checks.total_count > 100 || !Array.isArray(checks.check_runs) ||
      checks.check_runs.length !== checks.total_count) {
    throw new Error(`${full}: incomplete main-HEAD check-run inventory; no status-source binding.`);
  }
  const matches = checks.check_runs.filter(check => check?.name === 'CI Gate');
  if (matches.length !== 1 || matches[0].head_sha !== sha ||
      matches[0].app?.id !== source.integrationId || matches[0].app?.slug !== source.appSlug ||
      matches[0].status !== 'completed' || matches[0].conclusion !== 'success') {
    throw new Error(`${full}: CI Gate is not a successful, exact-main GitHub Actions check-run from the declared source.`);
  }
  return { headSha: sha, integrationId: source.integrationId, appSlug: source.appSlug };
}
async function verifyExpectedCheckSource(full) {
  const branch = await api('GET', `/repos/${full}/branches/${contract.defaultBranch}`, undefined, { anonymousRetry: true });
  const sha = String(branch?.commit?.sha || '');
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`${full}: cannot freeze main head for status-source verification.`);
  const checks = await api('GET', `/repos/${full}/commits/${sha}/check-runs?per_page=100`, undefined, { anonymousRetry: true });
  return validateMainGateCheckRuns(checks, sha, full);
}
function desiredRuleset(repo, detail, { bindStatusSource = bindCiSource, repositoryName = repositoryNameOf(repo) } = {}) {
  const rules = Array.isArray(detail?.rules) ? detail.rules : [];
  const allowed = new Set(contract.requiredRuleTypes);
  if (rules.some(rule => !allowed.has(rule.type)) || rules.length !== allowed.size ||
      new Set(rules.map(rule => rule.type)).size !== allowed.size) {
    throw new Error('Refusing to overwrite non-canonical or extra Ruleset rules.');
  }
  const existingPr = rules.find(rule => rule.type === 'pull_request')?.parameters || {};
  const existingChecks = rules.find(rule => rule.type === 'required_status_checks')?.parameters || {};
  const pullRequestPolicy = pullRequestPolicyFor(repositoryName);
  const existingApprovals = existingPr.required_approving_review_count;
  if (!Number.isSafeInteger(existingApprovals) || existingApprovals < 0)
    throw new Error('Refusing to replace a missing or invalid existing approval requirement.');
  for (const field of ['dismiss_stale_reviews_on_push', 'require_code_owner_review', 'require_last_push_approval', 'required_review_thread_resolution']) {
    if (typeof existingPr[field] !== 'boolean')
      throw new Error(`Refusing to replace a missing or invalid existing pull request requirement: ${field}.`);
  }
  return {
    name: contract.rulesetName,
    target: 'branch',
    enforcement: contract.enforcement,
    bypass_actors: desiredBypass(detail),
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          ...existingPr,
          allowed_merge_methods: mergeMethods(repo),
          dismiss_stale_reviews_on_push: existingPr.dismiss_stale_reviews_on_push === true || pullRequestPolicy.dismissStaleReviewsOnPush,
          require_code_owner_review: existingPr.require_code_owner_review === true || pullRequestPolicy.requireCodeOwnerReview,
          require_last_push_approval: existingPr.require_last_push_approval === true || pullRequestPolicy.requireLastPushApproval,
          required_approving_review_count: Math.max(existingApprovals, pullRequestPolicy.minimumApprovals),
          required_review_thread_resolution: existingPr.required_review_thread_resolution === true
        }
      },
      {
        type: 'required_status_checks',
        parameters: {
          ...existingChecks,
          do_not_enforce_on_create: false,
          required_status_checks: desiredStatusChecks(detail, { bindStatusSource }),
          strict_required_status_checks_policy: contract.requiredStatusChecks.strictRequiredStatusChecksPolicy
        }
      }
    ]
  };
}

function newRulesetTemplate() {
  return { bypass_actors: [], rules: [
    { type: 'deletion' }, { type: 'non_fast_forward' },
    { type: 'pull_request', parameters: {
      required_approving_review_count: contract.pullRequest.minimumApprovals,
      dismiss_stale_reviews_on_push: contract.pullRequest.dismissStaleReviewsOnPush,
      require_code_owner_review: contract.pullRequest.requireCodeOwnerReview,
      require_last_push_approval: contract.pullRequest.requireLastPushApproval,
      required_review_thread_resolution: false
    } },
    { type: 'required_status_checks', parameters: {
      required_status_checks: contract.requiredStatusChecks.contexts.map(context => ({ context }))
    } }
  ] };
}

async function safeRef(owner, repo, branch) {
  const pathname = `/repos/${owner}/${repo}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
  try { return await api('GET', pathname, undefined, { anonymousRetry: true }); }
  catch (error) { if (error.status === 404) return null; throw error; }
}

async function cleanupMergedBranches(owner, repo) {
  const open = await pages(`/repos/${owner}/${repo}/pulls?state=open`, { anonymousRetry: true });
  const protectedHeads = new Set(open.filter(pr => pr?.head?.repo?.full_name === `${owner}/${repo}`).map(pr => pr.head.ref));
  const closed = await pages(`/repos/${owner}/${repo}/pulls?state=closed`, { anonymousRetry: true });
  const candidates = new Map();
  for (const pr of closed) {
    if (!pr?.merged_at || pr?.head?.repo?.full_name !== `${owner}/${repo}`) continue;
    const branch = String(pr.head.ref || '');
    if (!branch || branch === contract.defaultBranch || protectedHeads.has(branch)) continue;
    candidates.set(branch, String(pr.head.sha || ''));
  }
  const deleted = [];
  const skipped = [];
  for (const [branch, mergedHead] of candidates) {
    const ref = await safeRef(owner, repo, branch);
    if (!ref) continue;
    const current = String(ref?.object?.sha || '');
    if (!mergedHead || current !== mergedHead) {
      skipped.push({ branch, reason: 'advanced-after-merge', current, mergedHead });
      continue;
    }
    if (apply) {
      try {
        await api('DELETE', `/repos/${owner}/${repo}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`);
      } catch (error) {
        if (error.status === 403) {
          error.message = `${error.message}\nHistorical branch cleanup requires existing authorized credentials with Contents: write. Governance settings were already applied before cleanup started.`;
        }
        throw error;
      }
    }
    deleted.push(branch);
  }
  return { deleted, skipped };
}

async function main() {
  const owner = registry.owner;
  const results = [];

  // Phase 1 is authoritative governance. Complete and verify all repositories
  // before any optional historical branch deletion is attempted.
  for (const repoName of contract.repositories) {
    const full = `${owner}/${repoName}`;
    policyFor(repoName); // Reject stale publisher exceptions instead of skipping server reads.
    const repo = await api('GET', `/repos/${full}`, undefined, { anonymousRetry: true });
    if (repo.private !== false) throw new Error(`${full}: observed visibility does not match public native policy.`);
    const summaries = await api('GET', `/repos/${full}/rulesets`, undefined, { anonymousRetry: true });
    const matching = summaries.filter(item => item?.name === contract.rulesetName);
    if (matching.length > 1) throw new Error(`${full}: canonical Ruleset is ambiguous.`);
    let rulesetId = matching[0]?.id || null;
    if (!rulesetId && !createMissing) throw new Error(`${full} is missing Ruleset ${contract.rulesetName}; use --create-missing after reviewing the creation plan.`);
    const detail = rulesetId ? await api('GET', `/repos/${full}/rulesets/${rulesetId}`, undefined, { anonymousRetry: true }) : newRulesetTemplate();
    const verifiedSource = bindCiSource ? await verifyExpectedCheckSource(full) : null;
    const desired = desiredRuleset(repo, detail, { bindStatusSource: bindCiSource, repositoryName: repoName });
    // Preserve stronger existing protections, then reject undeclared policy drift
    // before any write to this repository. Binding CI must never lower reviews.
    const proposedRepo = { ...repo, delete_branch_on_merge: true, allow_auto_merge: false };
    const proposal = assess(desired, proposedRepo, { requireStatusSource: bindCiSource, repositoryName: repoName });
    if (!proposal.ok) throw new Error(`${full}: existing protection was preserved but the proposal does not satisfy the declared policy: ${proposal.reasons.join(', ')}`);

    process.stdout.write(`${apply ? 'APPLY' : 'DRY-RUN'} ${full}: Ruleset ${rulesetId || 'CREATE'} -> CI Gate; source=${bindCiSource ? 'github-actions#15368 (verified)' : 'preserve-current'}; delete_branch_on_merge=true; allow_auto_merge=false; bypass=${desired.bypass_actors.map(a => a.bypass_mode).join(',') || 'none'}\n`);

    if (apply) {
      await api('PATCH', `/repos/${full}`, { delete_branch_on_merge: true, allow_auto_merge: false });
      if (rulesetId) await api('PUT', `/repos/${full}/rulesets/${rulesetId}`, desired);
      else {
        const created = await api('POST', `/repos/${full}/rulesets`, desired);
        if (!Number.isSafeInteger(created?.id) || created.id <= 0) throw new Error(`${full}: created Ruleset identity is missing.`);
        rulesetId = created.id;
      }
    }

    const postRepo = apply ? await api('GET', `/repos/${full}`, undefined, { anonymousRetry: true }) : { ...repo, delete_branch_on_merge: true, allow_auto_merge: false };
    const postDetail = apply ? await api('GET', `/repos/${full}/rulesets/${rulesetId}`, undefined, { anonymousRetry: true }) : { ...desired, id: rulesetId };
    const verdict = assess(postDetail, postRepo, { requireStatusSource: bindCiSource, requireAdministrativeMetadata: apply, repositoryName: repoName });
    if (!verdict.ok) throw new Error(`${full} desired governance does not satisfy contract: ${verdict.reasons.join(', ')}`);
    results.push({ repository: full, rulesetId, sourceBinding: verdict.sourceBinding, verifiedSource, cleanup: { requested: cleanBranches, deleted: [], skipped: [] } });
  }

  // Phase 2 is optional hygiene. It is deliberately separate so a token with
  // Administration: write can close governance without also gaining Contents: write.
  if (cleanBranches) {
    for (const result of results) {
      const repoName = result.repository.slice(owner.length + 1);
      result.cleanup = { requested: true, ...(await cleanupMergedBranches(owner, repoName)) };
    }
  }

  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, mode: apply ? 'apply' : 'dry-run', bindCiSource, zeroBypass, cleanBranches, results }, null, 2)}\n`);
  if (!apply) process.stdout.write('Dry-run only. Re-run with --apply after CI Gate exists on every native-protected repository. --create-missing creates only the reviewed canonical Ruleset; existing extra rules are never overwritten. Add --clean-branches only when the token also has Contents: write.\n');
  else if (!cleanBranches) process.stdout.write('Governance applied. Historical branch cleanup was not requested; use --apply --clean-branches with Contents: write if desired.\n');
}

if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 2;
});
module.exports = { desiredRuleset, desiredStatusChecks, newRulesetTemplate, validateMainGateCheckRuns, verifyExpectedCheckSource };
