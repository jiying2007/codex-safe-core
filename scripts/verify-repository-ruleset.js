#!/usr/bin/env node
'use strict';

const contract = require('../repository-governance-contract.json');
const registry = require('../family-registry.json');

const API = 'https://api.github.com';
function headers(token) { return { accept: 'application/vnd.github+json', 'user-agent': 'codex-safe-ruleset-audit', ...(token ? { authorization: `Bearer ${token}` } : {}) }; }
async function request(pathname, token) { return fetch(`${API}${pathname}`, { headers: headers(token) }); }
async function json(pathname, token) {
  let response = await request(pathname, token);
  // GITHUB_TOKEN is repository-scoped. Family consumers are public repositories,
  // so a scoped installation token may legitimately get 403/404 for a sibling repo
  // even though the same Metadata endpoint is publicly readable. Retry only the
  // read-only public API request without credentials; never substitute local state.
  if (token && (response.status === 403 || response.status === 404)) response = await request(pathname, '');
  if (!response.ok) throw new Error(`GitHub API ${pathname} failed: ${response.status}`);
  return response.json();
}
function branchCovered(detail, branch) {
  const include = detail?.conditions?.ref_name?.include || [];
  return include.includes('~DEFAULT_BRANCH') || include.includes(`refs/heads/${branch}`) || include.includes(branch);
}
function assess(detail) {
  const reasons = [];
  if (detail?.enforcement !== contract.enforcement) reasons.push(`enforcement:${detail?.enforcement || 'missing'}`);
  if (!branchCovered(detail, contract.defaultBranch)) reasons.push('default-branch-not-covered');
  const rules = Array.isArray(detail?.rules) ? detail.rules : [];
  const byType = new Map(rules.map(rule => [rule.type, rule]));
  for (const type of contract.requiredRuleTypes) if (!byType.has(type)) reasons.push(`missing-rule:${type}`);
  const pr = byType.get('pull_request')?.parameters || {};
  if (Number(pr.required_approving_review_count || 0) < Number(contract.pullRequest.minimumApprovals)) reasons.push('insufficient-approvals');
  if (contract.pullRequest.dismissStaleReviewsOnPush && pr.dismiss_stale_reviews_on_push !== true) reasons.push('stale-review-dismissal-disabled');
  if (contract.pullRequest.requireLastPushApproval && pr.require_last_push_approval !== true) reasons.push('last-push-approval-disabled');
  if (contract.pullRequest.requireCodeOwnerReview && pr.require_code_owner_review !== true) reasons.push('code-owner-review-disabled');
  const checks = byType.get('required_status_checks')?.parameters || {};
  if (contract.requiredStatusChecks.requireNonEmpty && (!Array.isArray(checks.required_status_checks) || checks.required_status_checks.length === 0)) reasons.push('required-checks-empty');
  if (contract.requiredStatusChecks.strictRequiredStatusChecksPolicy && checks.strict_required_status_checks_policy !== true) reasons.push('required-checks-not-strict');
  const bypass = Array.isArray(detail?.bypass_actors) ? detail.bypass_actors : [];
  if (bypass.length > Number(contract.maximumBypassActors)) reasons.push(`too-many-bypass-actors:${bypass.length}`);
  return { ok: reasons.length === 0, reasons };
}
async function auditRepository(repo, token) {
  const owner = registry.owner;
  const summaries = await json(`/repos/${owner}/${repo}/rulesets`, token);
  const active = [];
  for (const summary of Array.isArray(summaries) ? summaries : []) {
    if (!summary?.id) continue;
    const detail = await json(`/repos/${owner}/${repo}/rulesets/${summary.id}`, token);
    const result = assess(detail);
    if (result.ok) active.push({ id: detail.id, name: detail.name });
  }
  return { repository: `${owner}/${repo}`, ok: active.length > 0, matchingRulesets: active };
}
async function main() {
  if (Number(contract.schemaVersion) !== 1) throw new Error('Unsupported repository governance contract schema.');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const results = [];
  for (const repo of contract.repositories) results.push(await auditRepository(repo, token));
  const failed = results.filter(item => !item.ok);
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, ok: failed.length === 0, results }, null, 2)}\n`);
  if (failed.length) {
    const error = new Error(`Repository Ruleset contract is incomplete for: ${failed.map(item => item.repository).join(', ')}`);
    error.code = 'EREPOSITORYGOVERNANCE';
    throw error;
  }
}
if (require.main === module) main().catch(error => { console.error(error.message || String(error)); process.exitCode = 2; });
module.exports = { assess, auditRepository, branchCovered, json };
