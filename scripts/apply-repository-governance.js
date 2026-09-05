#!/usr/bin/env node
'use strict';

const contract = require('../repository-governance-contract.json');
const registry = require('../family-registry.json');
const { assess } = require('./verify-repository-ruleset');

const API = 'https://api.github.com';
const apply = process.argv.includes('--apply');
const zeroBypass = process.argv.includes('--zero-bypass');
const cleanBranches = !process.argv.includes('--no-clean-branches');
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

async function api(method, pathname, body) {
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: headers(),
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`GitHub API ${method} ${pathname} failed: ${response.status}${text ? ` ${text.slice(0, 300)}` : ''}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function pages(pathname) {
  const out = [];
  for (let page = 1; page <= 50; page += 1) {
    const join = pathname.includes('?') ? '&' : '?';
    const values = await api('GET', `${pathname}${join}per_page=100&page=${page}`);
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

function desiredRuleset(repo, detail) {
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
          allowed_merge_methods: mergeMethods(repo),
          dismiss_stale_reviews_on_push: contract.pullRequest.dismissStaleReviewsOnPush,
          require_code_owner_review: contract.pullRequest.requireCodeOwnerReview,
          require_last_push_approval: contract.pullRequest.requireLastPushApproval,
          required_approving_review_count: contract.pullRequest.minimumApprovals,
          required_review_thread_resolution: false
        }
      },
      {
        type: 'required_status_checks',
        parameters: {
          do_not_enforce_on_create: false,
          required_status_checks: contract.requiredStatusChecks.contexts.map(context => ({ context })),
          strict_required_status_checks_policy: contract.requiredStatusChecks.strictRequiredStatusChecksPolicy
        }
      }
    ]
  };
}

async function safeRef(owner, repo, branch) {
  const pathname = `/repos/${owner}/${repo}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
  try { return await api('GET', pathname); }
  catch (error) { if (error.status === 404) return null; throw error; }
}

async function cleanupMergedBranches(owner, repo) {
  const open = await pages(`/repos/${owner}/${repo}/pulls?state=open`);
  const protectedHeads = new Set(open.filter(pr => pr?.head?.repo?.full_name === `${owner}/${repo}`).map(pr => pr.head.ref));
  const closed = await pages(`/repos/${owner}/${repo}/pulls?state=closed`);
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
    if (apply) await api('DELETE', `/repos/${owner}/${repo}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`);
    deleted.push(branch);
  }
  return { deleted, skipped };
}

async function main() {
  const owner = registry.owner;
  const results = [];
  for (const repoName of contract.repositories) {
    const full = `${owner}/${repoName}`;
    const repo = await api('GET', `/repos/${full}`);
    const summaries = await api('GET', `/repos/${full}/rulesets`);
    const summary = summaries.find(item => item?.name === contract.rulesetName);
    if (!summary?.id) throw new Error(`${full} is missing Ruleset ${contract.rulesetName}.`);
    const detail = await api('GET', `/repos/${full}/rulesets/${summary.id}`);
    const desired = desiredRuleset(repo, detail);

    process.stdout.write(`${apply ? 'APPLY' : 'DRY-RUN'} ${full}: Ruleset ${summary.id} -> CI Gate; delete_branch_on_merge=true; bypass=${desired.bypass_actors.map(a => a.bypass_mode).join(',') || 'none'}\n`);

    if (apply) {
      await api('PATCH', `/repos/${full}`, { delete_branch_on_merge: true });
      await api('PUT', `/repos/${full}/rulesets/${summary.id}`, desired);
    }

    const cleanup = cleanBranches ? await cleanupMergedBranches(owner, repoName) : { deleted: [], skipped: [] };
    const postRepo = apply ? await api('GET', `/repos/${full}`) : { ...repo, delete_branch_on_merge: true };
    const postDetail = apply ? await api('GET', `/repos/${full}/rulesets/${summary.id}`) : { ...desired, id: summary.id };
    const verdict = assess(postDetail, postRepo);
    if (!verdict.ok) throw new Error(`${full} desired governance does not satisfy contract: ${verdict.reasons.join(', ')}`);
    results.push({ repository: full, rulesetId: summary.id, cleanup });
  }
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, mode: apply ? 'apply' : 'dry-run', zeroBypass, cleanBranches, results }, null, 2)}\n`);
  if (!apply) process.stdout.write('Dry-run only. Re-run with --apply after CI Gate exists on main in all six repositories.\n');
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 2;
});
