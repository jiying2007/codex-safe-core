#!/usr/bin/env node
'use strict';

// Governance-only observer. Never authorizes a merge, approval, or deployment.
const fs = require('node:fs');
const crypto = require('node:crypto');

const SHA = /^[0-9a-f]{40}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_DOC = /^(?:docs\/.+\.md|README(?:\.zh-CN)?\.md|CONTRIBUTING\.md|SUPPORT\.md)$/i;
const PROTECTED = /^(?:\.github\/|SECURITY\.md$|(?:core-contract|core-surface-manifest|core-ownership-manifest|repository-governance-contract|family-registry|family-non-goals)\.json$|(?:policy|safe-contract|codex-runtime|codex-runtime-resolver|process-runner|secure-local-file|review-rules)\.js$|scripts\/(?:trusted-autonomy-shadow|verify-|apply-repository-governance|family-|generate-consumer-ci-receipt|core-digests|codeql-findings-gate))/;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function safePath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 ||
      value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value) ||
      value.split('/').some(part => part === '' || part === '.' || part === '..')) {
    throw new Error('Malformed changed-file path; cannot evaluate.');
  }
  return value;
}
function exactSha(value, field) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error(field + ' must be an exact SHA.');
  return value;
}
function metric(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(field + ' must be a nonnegative integer.');
  return value;
}
function evaluate({pr, before, files, context}) {
  if (!pr || typeof pr !== 'object' || !before || typeof before !== 'object') throw new Error('Missing live PR metadata.');
  if (!context || typeof context !== 'object' || !REPO.test(context.repository || '')) throw new Error('Missing repository identity.');
  const number = metric(pr.number, 'PR number');
  if (number < 1 || number !== context.prNumber || number !== before.number) throw new Error('PR number drift.');
  // workflow_run executes after CI completion and may race an already-merged PR.
  // A closed, confirmed-merged PR can be observed retrospectively; it can never
  // become a candidate for autonomous merging.
  const isOpen = pr.state === 'open' && before.state === 'open';
  const isMerged = pr.state === 'closed' && before.state === 'closed' &&
    pr.merged === true && before.merged === true &&
    typeof pr.merged_at === 'string' && pr.merged_at.length > 0 &&
    pr.merged_at === before.merged_at;
  if (!isOpen && !isMerged) throw new Error('PR is neither open nor consistently merged.');
  const head = exactSha(pr.head?.sha, 'PR head');
  const base = exactSha(pr.base?.sha, 'PR base');
  exactSha(context.eventHead, 'Event head');
  exactSha(context.trustedBase, 'PR base');
  const trustedWorkflowSha = exactSha(context.trustedWorkflowSha, 'Trusted workflow checkout');
  if (head !== context.eventHead || head !== before.head?.sha) throw new Error('PR head changed during observation.');
  if (base !== context.trustedBase || base !== before.base?.sha) throw new Error('PR base changed during observation.');
  if (pr.base?.ref !== 'main' || before.base?.ref !== 'main' || pr.base?.repo?.full_name !== context.repository ||
      before.base?.repo?.full_name !== context.repository) throw new Error('PR target is not the trusted main branch.');
  const changed = metric(pr.changed_files, 'Changed-file count');
  if (changed !== before.changed_files) throw new Error('PR file count changed during observation.');
  const additions = metric(pr.additions, 'Added lines'), deletions = metric(pr.deletions, 'Deleted lines');
  if (additions !== before.additions || deletions !== before.deletions) throw new Error('PR size changed during observation.');
  if (!Array.isArray(files) || files.length === 0 || files.length !== changed || files.length > 3000) {
    throw new Error('Incomplete PR file inventory (fail closed).');
  }
  const filenames = [], reasons = new Set();
  let high = false, medium = false, fileAdditions = 0, fileDeletions = 0;
  for (const file of files) {
    if (!file || typeof file !== 'object') throw new Error('Malformed PR file.');
    if (!['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged'].includes(file.status)) {
      throw new Error('Unrecognized PR file status.');
    }
    const current = safePath(file.filename);
    const names = [current];
    if (file.status === 'renamed') names.push(safePath(file.previous_filename));
    else if (file.previous_filename != null) names.push(safePath(file.previous_filename));
    const a = metric(file.additions, 'File additions'), d = metric(file.deletions, 'File deletions');
    fileAdditions += a;
    fileDeletions += d;
    for (const name of names) {
      filenames.push(name);
      if (PROTECTED.test(name)) { high = true; reasons.add('protected-surface'); }
      else if (!SAFE_DOC.test(name)) { medium = true; reasons.add('non-documentation-change'); }
    }
    if (file.status === 'removed') { medium = true; reasons.add('file-removal'); }
  }
  if (fileAdditions !== additions || fileDeletions !== deletions) {
    throw new Error('PR file diff accounting does not match PR metadata.');
  }
  if (files.length > 20 || additions + deletions > 1000) {
    high = true; reasons.add('large-change');
  } else if (files.length > 5 || additions + deletions > 200) {
    medium = true; reasons.add('moderate-change');
  }
  if (pr.draft) { medium = true; reasons.add('draft-pr'); }
  if (pr.head?.repo?.full_name !== context.repository) { medium = true; reasons.add('fork-contribution'); }
  const level = high ? 'high' : medium ? 'medium' : 'low';
  if (!reasons.size) reasons.add('bounded-documentation-only');
  const result = {
    schemaVersion: 1,
    kind: 'codex-safe-autonomy-observation',
    identity: {
      repository: context.repository, prNumber: number, headSha: head, baseSha: base,
      trustedWorkflowSha, prLifecycle: isOpen ? 'open' : 'merged',
      runId: String(context.runId || ''), runAttempt: String(context.runAttempt || '')
    },
    change: { fileCount: changed, additions, deletions, paths: [...new Set(filenames)].sort() },
    risk: { level, reasons: [...reasons].sort() },
    verification: {
      source: 'GitHub pull request REST metadata (read twice) and paginated files',
      ci: 'not-evaluated', codeql: 'not-evaluated', runtime: 'not-evaluated',
      downstream: 'not-evaluated'
    },
    autonomy: {
      mode: 'shadow', candidate: level === 'low' && !pr.draft && isOpen,
      autoMerge: false, mergeAuthorized: false, requiresHuman: true
    }
  };
  result.contentDigest = digest(result); // Integrity check only; not a signature or CI Receipt.
  return result;
}
function options(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i]?.startsWith('--') || !args[i + 1] || out[args[i]]) throw new Error('Invalid CLI arguments.');
    out[args[i]] = args[i + 1];
  }
  const required = ['--pr', '--before', '--files', '--out', '--head', '--base', '--trusted-sha', '--repo', '--number', '--run', '--attempt'];
  if (Object.keys(out).length !== required.length || required.some(key => !out[key])) throw new Error('Incomplete CLI arguments.');
  return out;
}
function main() {
  const args = options(process.argv.slice(2));
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = evaluate({
    pr: read(args['--pr']), before: read(args['--before']), files: read(args['--files']),
    context: {
      eventHead: args['--head'], trustedBase: args['--base'], trustedWorkflowSha: args['--trusted-sha'], repository: args['--repo'],
      prNumber: Number(args['--number']), runId: args['--run'], runAttempt: args['--attempt']
    }
  });
  fs.writeFileSync(args['--out'], JSON.stringify(report, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  process.stdout.write('Shadow observation recorded: ' + report.risk.level + '; automatic merging remains disabled.\n');
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = {evaluate, safePath, digest};
