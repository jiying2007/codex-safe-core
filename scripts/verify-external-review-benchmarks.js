'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SHA = /^[a-f0-9]{40}$/;
const FORBIDDEN_KEYS = new Set([
  'message', 'body', 'patch', 'diff', 'raw_comment', 'comment',
  'tp_fp_justification', 'severity_justification', 'category_justification',
  'fix_evidence', 'comment_permalink', 'source_code', 'code_content'
]);

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}
function requireSha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error('Invalid pinned SHA: ' + label);
}
function requirePath(value, label) {
  const text = String(value || '');
  if (!text || text.length > 1024 || text.startsWith('/') ||
      text.includes(String.fromCharCode(0)) ||
      text.includes(String.fromCharCode(13)) ||
      text.includes(String.fromCharCode(10)) ||
      text.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe benchmark path: ' + label);
  }
}
function rejectRawPayload(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectRawPayload(item, label + '[' + index + ']'));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new Error('Raw source/review payload is forbidden: ' + label + '.' + key);
    rejectRawPayload(child, label + '.' + key);
  }
}
function validateSource(source, label) {
  if (source.partition !== 'development' || source.holdout !== false ||
      source.freshModelExecution !== false || source.qualificationAuthority !== false) {
    throw new Error(label + ' must remain a non-qualifying development snapshot');
  }
  if (source.sourceLicense !== 'MIT' || !String(source.sourceLicenseText || '').startsWith('MIT License')) {
    throw new Error(label + ' is missing its verified MIT license text');
  }
  requireSha(source.sourceRevision, label + '.sourceRevision');
  if (source.sourceCodeRedistributed !== false) throw new Error(label + ' must not redistribute upstream source code');
  rejectRawPayload(source, label);
}
function prNumber(record) {
  if (Number.isSafeInteger(record.pr && record.pr.pr_number) && record.pr.pr_number > 0) return record.pr.pr_number;
  const match = String(record.pr_key || '').match(new RegExp('_([0-9]+)-[a-f0-9]{8}$', 'i'));
  if (match) return Number(match[1]);
  throw new Error('Missing pinned PR number');
}
function validateFinding(finding, label, lineKey, endKey) {
  const file = finding.file || finding.path;
  requirePath(file, label + '.file');
  const line = finding[lineKey];
  const end = finding[endKey] ?? line;
  if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(end) || end < line || end - line > 200) {
    throw new Error('Invalid bounded finding range: ' + label);
  }
}
function verifyExternalReviewBenchmarks(root = path.resolve(__dirname, '..')) {
  const review = readJson(root, 'quality/reviewbench-public-test-development-v1.json');
  const cpp = readJson(root, 'quality/cloudae-cpp-development-v1.json');
  const embedded = readJson(root, 'quality/reviewbench-embedded-development.json');
  const pkg = readJson(root, 'package.json');

  validateSource(review, 'ReviewBench');
  validateSource(cpp, 'CloudAEye C/C++');
  if (embedded.partition !== 'development' || embedded.holdout !== false ||
      embedded.freshModelExecution !== false || embedded.qualificationAuthority !== false) {
    throw new Error('Embedded ReviewBench fixture must remain development-only');
  }
  if (embedded.sourceLicense !== 'MIT' || !String(embedded.sourceLicenseText || '').startsWith('MIT License')) {
    throw new Error('Embedded ReviewBench fixture is missing its verified MIT license text');
  }
  requireSha(embedded.sourceRevision, 'Embedded ReviewBench source revision');
  rejectRawPayload(embedded, 'Embedded ReviewBench');
  requireSha(review.sourceManifestBlobSha, 'ReviewBench manifest blob');
  requireSha(review.sourceLicenseBlobSha, 'ReviewBench license blob');
  requireSha(cpp.sourceBlobSha, 'CloudAEye corpus blob');
  requireSha(cpp.sourceLicenseBlobSha, 'CloudAEye license blob');
  if (review.snapshotComplete !== true || review.records.length !== 25 || review.sources.length !== 25) {
    throw new Error('ReviewBench snapshot must contain the complete pinned 25-PR public test subset');
  }
  if (cpp.snapshotComplete !== true || cpp.records.length !== 16 || cpp.rootCauseGroupCount !== 6) {
    throw new Error('CloudAEye snapshot must contain the complete pinned 16-PR / 6-group dataset');
  }
  if (embedded.records.length !== 2 || embedded.sources.length !== 2) {
    throw new Error('Embedded development fixture must retain its two source projects');
  }
  for (const source of review.sources.concat(embedded.sources)) {
    requireSha(source.sourceBlobSha, 'ReviewBench source blob');
    requireSha(source.base, 'ReviewBench source base');
    requireSha(source.head, 'ReviewBench source head');
  }
  const packaged = new Set(pkg.files || []);
  for (const file of [
    'quality/reviewbench-public-test-development-v1.json',
    'quality/cloudae-cpp-development-v1.json',
    'scripts/verify-external-review-benchmarks.js'
  ]) {
    if (packaged.has(file)) throw new Error('Research-only benchmark asset must not enter the runtime package: ' + file);
  }

  const prs = new Set();
  const repos = new Set();
  const groups = new Set();
  const highGroups = new Set();
  let positives = 0;
  let falsePositiveReferences = 0;
  let reviewPositive = 0;
  let reviewHigh = 0;
  let reviewFalsePositive = 0;
  let cppPositive = 0;
  let cppHigh = 0;
  let embeddedPositive = 0;
  let embeddedHigh = 0;

  function addPr(record, label, groupIds, findings, lineKey, endKey, positivePredicate, highGroupForFinding) {
    const repo = String(record.pr && record.pr.repo || '');
    const number = prNumber(record);
    const base = String(record.pr && record.pr.base || '');
    const head = String(record.pr && record.pr.head || '');
    if (!repo || !SHA.test(base) || !SHA.test(head)) throw new Error('Incomplete base/head identity: ' + label);
    const key = repo.toLowerCase() + '#' + number;
    if (prs.has(key)) throw new Error('Duplicate PR across benchmark sources: ' + key);
    prs.add(key);
    repos.add(repo.toLowerCase());
    for (const group of groupIds) {
      if (!group) throw new Error('Missing root/case group: ' + label);
      groups.add(group);
    }
    for (const finding of findings) {
      validateFinding(finding, label + ':' + String(finding.file || finding.path), lineKey, endKey);
      if (finding.tp_fp === 'fp') {
        falsePositiveReferences += 1;
        if (label === 'ReviewBench') reviewFalsePositive += 1;
      }
      if (positivePredicate(finding)) {
        positives += 1;
        if (label === 'ReviewBench') reviewPositive += 1;
        if (label === 'CloudAEye') cppPositive += 1;
        if (label === 'Embedded ReviewBench') embeddedPositive += 1;
        if (finding.severity === 'high' || finding.severity === 'critical') {
          const highIds = highGroupForFinding(finding, groupIds);
          for (const group of highIds) highGroups.add(group);
          if (label === 'ReviewBench') reviewHigh += 1;
          if (label === 'CloudAEye') cppHigh += 1;
          if (label === 'Embedded ReviewBench') embeddedHigh += 1;
        }
      }
    }
  }

  for (const record of review.records) {
    addPr(record, 'ReviewBench', [record.caseGroup], record.findings, 'start_line', 'end_line',
      finding => finding.tp_fp === 'tp' && finding.scope === 'introduced-by-pr',
      () => [record.caseGroup]);
  }
  for (const record of cpp.records) {
    const groupIds = (record.rootCauseGroups || []).map(group => 'cloudae:' + group);
    addPr(record, 'CloudAEye', groupIds, record.findings, 'line', 'endLine', () => true,
      finding => finding.rootCauseGroup ? ['cloudae:' + finding.rootCauseGroup] : []);
  }
  for (const record of embedded.records) {
    const number = prNumber(record);
    const group = 'embedded:' + String(record.pr.repo).toLowerCase() + '#' + number;
    addPr(record, 'Embedded ReviewBench', [group], record.findings, 'line', 'endLine',
      finding => finding.tp_fp === 'tp' && finding.scope === 'introduced-by-pr',
      () => [group]);
  }

  const reviewHighGroups = new Set(review.records.filter(record =>
    record.findings.some(f => f.tp_fp === 'tp' && f.scope === 'introduced-by-pr' &&
      (f.severity === 'high' || f.severity === 'critical'))).map(record => record.caseGroup));
  const cppGroups = new Set(cpp.records.flatMap(record => record.rootCauseGroups || []));
  const cppHighGroups = new Set(cpp.records.flatMap(record => record.findings
    .filter(f => f.severity === 'high' || f.severity === 'critical')
    .map(f => 'cloudae:' + f.rootCauseGroup)));
  const embeddedHighGroups = new Set(embedded.records.filter(record =>
    record.findings.some(f => f.tp_fp === 'tp' && f.scope === 'introduced-by-pr' &&
      (f.severity === 'high' || f.severity === 'critical'))).map(record => {
        const number = prNumber(record);
        return 'embedded:' + String(record.pr.repo).toLowerCase() + '#' + number;
      }));

  if (reviewPositive !== review.positiveFindingCount || reviewFalsePositive !== review.falsePositiveReferenceCount ||
      reviewHighGroups.size !== review.highRiskCaseGroups) {
    throw new Error('ReviewBench snapshot metadata does not match its labels');
  }
  if (cppPositive !== cpp.positiveFindingCount || cppGroups.size !== cpp.rootCauseGroupCount ||
      cppHighGroups.size !== cpp.highRiskRootCauseGroups) {
    throw new Error('CloudAEye snapshot metadata does not match its labels');
  }
  if (reviewHigh !== review.records.reduce((sum, record) => sum + record.findings.filter(f =>
      f.tp_fp === 'tp' && f.scope === 'introduced-by-pr' && (f.severity === 'high' || f.severity === 'critical')).length, 0)) {
    throw new Error('ReviewBench high-severity finding count mismatch');
  }
  if (cppHigh !== cpp.records.reduce((sum, record) => sum + record.findings.filter(f =>
      f.severity === 'high' || f.severity === 'critical').length, 0)) {
    throw new Error('CloudAEye high-severity finding count mismatch');
  }
  const expectedHighGroups = new Set([...reviewHighGroups, ...cppHighGroups, ...embeddedHighGroups]);
  if (expectedHighGroups.size !== highGroups.size) throw new Error('High-risk grouping projection mismatch');

  const cleanNegativeCases = Number(review.cleanNegativeCases || 0) +
    Number(cpp.cleanNegativeCases || 0) + Number(embedded.cleanNegativeCases || 0);
  const holdoutCases = [review, cpp, embedded].reduce((sum, source) =>
    sum + source.records.filter(record => record.holdout === true).length, 0);
  const independenceVerified = review.rootCauseIndependenceVerified === true &&
    cpp.rootCauseIndependenceVerified === true && embedded.rootCauseIndependenceVerified === true;
  const freshModelExecution = review.freshModelExecution === true &&
    cpp.freshModelExecution === true && embedded.freshModelExecution === true;
  const blockers = [];
  if (!independenceVerified) blockers.push('root_cause_independence_not_independently_adjudicated');
  if (cleanNegativeCases < 1) blockers.push('clean_negative_cases_missing');
  if (holdoutCases < 1) blockers.push('independent_holdout_missing');
  if (!freshModelExecution) blockers.push('fresh_model_execution_missing');
  if (review.upstreamProjectLicensesVerified !== true || cpp.upstreamProjectLicensesVerified !== true) {
    blockers.push('upstream_project_license_review_required_before_source_acquisition');
  }
  return Object.freeze({
    reviewBench: Object.freeze({prs: review.records.length, positiveFindings: reviewPositive,
      falsePositiveReferences: review.falsePositiveReferenceCount, highRiskCaseGroups: reviewHighGroups.size}),
    cloudae: Object.freeze({prs: cpp.records.length, findings: cppPositive,
      rootCauseGroups: cppGroups.size, highRiskRootCauseGroups: cppHighGroups.size}),
    embedded: Object.freeze({prs: embedded.records.length, positiveFindings: embeddedPositive,
      highRiskCaseGroups: embeddedHighGroups.size}),
    uniquePullRequests: prs.size,
    distinctRepositories: repos.size,
    candidateGroupingUnits: groups.size,
    highRiskCandidateGroups: highGroups.size,
    positiveFindingCount: positives,
    falsePositiveReferenceCount,
    cleanNegativeCases,
    holdoutCases,
    independenceVerified,
    freshModelExecution,
    competitionQualified: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
}
if (require.main === module) {
  try { process.stdout.write(JSON.stringify(verifyExternalReviewBenchmarks(), null, 2) + String.fromCharCode(10)); }
  catch (error) { console.error(error.stack || error.message || String(error)); process.exitCode = 2; }
}
module.exports = Object.freeze({ verifyExternalReviewBenchmarks });
