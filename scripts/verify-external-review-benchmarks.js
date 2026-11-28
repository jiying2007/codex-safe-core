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
function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error('External benchmark provenance mismatch: ' + label);
}
function validateLedgerBinding(ledger, review, cpp, embedded) {
  if (ledger.schemaVersion !== 1 || ledger.kind !== 'external-review-benchmark-source-ledger' ||
      ledger.status !== 'development-only-source-registration') {
    throw new Error('External benchmark source ledger has an unsupported identity');
  }
  const policy = ledger.policy || {};
  for (const key of [
    'noAutomaticHoldout', 'noModelExecution', 'noPromotionAuthority',
    'noCleanNegativeInferenceFromMissingLabels', 'requireExactRepositoryAndDatasetRevision',
    'requireOriginalProjectLicenseReview'
  ]) requireEqual(policy[key], true, 'policy.' + key);

  const sources = ledger.sources || [];
  const sourceById = id => {
    const matches = sources.filter(source => source.id === id);
    if (matches.length !== 1) throw new Error('External benchmark source ledger must contain exactly one ' + id);
    return matches[0];
  };
  const assetByPath = (source, assetPath, label) => {
    const matches = (source.assets || []).filter(asset => asset.path === assetPath);
    if (matches.length !== 1) throw new Error('External benchmark ledger asset missing or duplicated: ' + label);
    return matches[0];
  };
  const reviewSource = sourceById('github-reviewbench-2026');
  requireEqual(reviewSource.repository, review.sourceRepository, 'ReviewBench repository');
  requireEqual(reviewSource.revision, review.sourceRevision, 'ReviewBench revision');
  requireSha(reviewSource.revision, 'ledger ReviewBench revision');
  requireEqual(reviewSource.license.repositoryLicense, review.sourceLicense, 'ReviewBench repository license');
  requireEqual(reviewSource.license.licenseBlobSha, review.sourceLicenseBlobSha, 'ReviewBench license blob');
  requireSha(reviewSource.license.licenseBlobSha, 'ledger ReviewBench license blob');
  const reviewManifest = assetByPath(reviewSource, review.sourceManifestPath, 'ReviewBench manifest');
  requireEqual(reviewManifest.blobSha, review.sourceManifestBlobSha, 'ReviewBench manifest blob');
  requireSha(reviewManifest.blobSha, 'ledger ReviewBench manifest blob');
  requireEqual(reviewManifest.records, review.records.length, 'ReviewBench manifest record count');
  const reviewGolden = assetByPath(reviewSource, 'golden/', 'ReviewBench golden directory');
  requireEqual(typeof reviewGolden.role, 'string', 'ReviewBench golden role');

  const cppSource = sourceById('cloudaeye-c-cpp-review-benchmark');
  requireEqual(cppSource.repository, cpp.sourceRepository, 'CloudAEye repository');
  requireEqual(cppSource.revision, cpp.sourceRevision, 'CloudAEye revision');
  requireSha(cppSource.revision, 'ledger CloudAEye revision');
  requireEqual(cppSource.license.repositoryLicense, cpp.sourceLicense, 'CloudAEye repository license');
  requireEqual(cppSource.license.licenseBlobSha, cpp.sourceLicenseBlobSha, 'CloudAEye license blob');
  requireSha(cppSource.license.licenseBlobSha, 'ledger CloudAEye license blob');
  const cppAsset = assetByPath(cppSource, cpp.sourcePath, 'CloudAEye corpus');
  requireEqual(cppAsset.blobSha, cpp.sourceBlobSha, 'CloudAEye corpus blob');
  requireSha(cppAsset.blobSha, 'ledger CloudAEye corpus blob');
  requireEqual(cppAsset.pullRequests, cpp.records.length, 'CloudAEye PR count');

  const aacrSource = sourceById('alibaba-aacr-bench-2026');
  requireEqual(aacrSource.repository, 'https://github.com/alibaba/aacr-bench', 'AACR repository');
  requireSha(aacrSource.revision, 'AACR revision');
  requireEqual(aacrSource.license.repositoryLicense, 'Apache-2.0', 'AACR repository license');
  requireSha(aacrSource.license.licenseBlobSha, 'AACR license blob');
  const aacrPositive = assetByPath(aacrSource, 'dataset/v1/positive_samples.json', 'AACR positive references');
  const aacrNegative = assetByPath(aacrSource, 'dataset/v1/negative_samples.json', 'AACR negative references');
  requireSha(aacrPositive.blobSha, 'AACR positive asset blob');
  requireSha(aacrNegative.blobSha, 'AACR negative asset blob');
  requireEqual(aacrPositive.records, 196, 'AACR positive reference count');
  requireEqual(aacrNegative.records, 155, 'AACR negative reference count');
  requireEqual(aacrSource.snapshot.imported, false, 'AACR must remain unimported');
  requireEqual(aacrSource.snapshot.partition, 'candidate-only', 'AACR partition');
  requireEqual(aacrSource.snapshot.holdout, false, 'AACR holdout');
  requireEqual(aacrSource.snapshot.note.includes('not imported') && aacrSource.snapshot.note.includes('used for model evaluation'), true, 'AACR evaluation exclusion');
  const positiveAcquisition = aacrSource.snapshot.positiveAssetAcquisition || {};
  requireEqual(positiveAcquisition.attempted, true, 'AACR positive acquisition attempted');
  requireEqual(positiveAcquisition.acquired, true, 'AACR positive blob acquisition');
  requireEqual(positiveAcquisition.method, 'github-git-blob-api', 'AACR positive acquisition method');
  requireEqual(positiveAcquisition.blobSha, aacrPositive.blobSha, 'AACR positive acquisition blob');
  requireEqual(positiveAcquisition.records, aacrPositive.records, 'AACR positive acquisition count');
  requireEqual(positiveAcquisition.contentBytes, 1116722, 'AACR positive content byte count');
  requireEqual(positiveAcquisition.commentRecords, 1506, 'AACR positive comment count');
  requireEqual(positiveAcquisition.uniqueRepositories, 50, 'AACR positive repository count');
  requireEqual(positiveAcquisition.uniquePaths, 633, 'AACR positive path count');
  requireEqual(positiveAcquisition.validAnchors, 1505, 'AACR positive valid anchor count');
  requireEqual(positiveAcquisition.invalidAnchors, 1, 'AACR positive invalid anchor count');
  requireEqual(positiveAcquisition.commentOriginCounts.aiGenerated, 1114, 'AACR AI reference count');
  requireEqual(positiveAcquisition.commentOriginCounts.humanDiscussion, 392, 'AACR human reference count');
  requireEqual(Object.values(positiveAcquisition.languageCounts || {}).reduce((sum, count) => sum + count, 0),
    positiveAcquisition.records, 'AACR positive language distribution');
  requireEqual(Object.values(positiveAcquisition.categoryCounts || {}).reduce((sum, count) => sum + count, 0),
    positiveAcquisition.commentRecords, 'AACR positive category distribution');
  const negativeInspection = aacrSource.snapshot.negativeReferenceInspection || {};
  requireEqual(negativeInspection.inspected, true, 'AACR negative shape inspected');
  requireEqual(negativeInspection.records, aacrNegative.records, 'AACR negative inspected count');
  requireEqual(negativeInspection.commentRecords, 639, 'AACR negative comment count');
  requireEqual(negativeInspection.uniqueRepositories, 49, 'AACR negative repository count');
  requireEqual(negativeInspection.uniquePaths, 375, 'AACR negative path count');
  requireEqual(negativeInspection.validAnchors, 639, 'AACR negative valid anchor count');
  requireEqual(negativeInspection.commentsArrayPresent, true, 'AACR negative comment arrays');
  requireEqual(negativeInspection.nestedCommentPathsPresent, true, 'AACR negative nested paths');
  requireEqual(negativeInspection.nestedCommentLineAnchorsPresent, true, 'AACR negative nested line anchors');
  requireEqual(negativeInspection.explicitTopLevelFileOrPathField, false, 'AACR negative top-level file/path mapping');
  requireEqual(negativeInspection.cleanNegativeEligible, false, 'AACR clean-negative eligibility');
  requireEqual(Object.values(negativeInspection.languageCounts || {}).reduce((sum, count) => sum + count, 0),
    aacrNegative.records, 'AACR negative language distribution');
  requireEqual(Object.values(negativeInspection.commentOriginCounts || {}).reduce((sum, count) => sum + count, 0),
    negativeInspection.commentRecords, 'AACR negative comment-origin distribution');
  const partitionOverlap = negativeInspection.positiveNegativePrOverlap || {};
  requireEqual(partitionOverlap.positiveRows, aacrPositive.records, 'AACR positive PR rows');
  requireEqual(partitionOverlap.negativeRows, aacrNegative.records, 'AACR negative PR rows');
  requireEqual(partitionOverlap.intersectionPrs, 151, 'AACR positive/negative PR overlap');
  requireEqual(partitionOverlap.positiveOnlyPrs, 45, 'AACR positive-only PRs');
  requireEqual(partitionOverlap.negativeOnlyPrs, 4, 'AACR negative-only PRs');
  requireEqual(partitionOverlap.unionPrs, 200, 'AACR unique PR union');
  requireEqual(partitionOverlap.positiveRows + partitionOverlap.negativeRows - partitionOverlap.intersectionPrs,
    partitionOverlap.unionPrs, 'AACR partition overlap arithmetic');
  requireEqual(negativeInspection.reviewBenchOverlap?.reviewBenchManifestRecords, 219, 'ReviewBench manifest PR count');
  requireEqual(negativeInspection.reviewBenchOverlap?.overlappingPrs, 0, 'AACR/ReviewBench PR overlap');

  requireEqual(embedded.sourceRepository, reviewSource.repository, 'embedded ReviewBench repository');
  requireEqual(embedded.sourceRevision, reviewSource.revision, 'embedded ReviewBench revision');
  requireEqual(embedded.sourceLicense, reviewSource.license.repositoryLicense, 'embedded ReviewBench license');
  requireEqual(embedded.sources.length, embedded.records.length, 'embedded source/record count');
  for (const source of embedded.sources) {
    requireSha(source.sourceBlobSha, 'embedded golden blob');
    requireSha(source.base, 'embedded source base');
    requireSha(source.head, 'embedded source head');
    const record = embedded.records.find(item =>
      item.pr && item.pr.repo === source.repo &&
      item.pr.base === source.base && item.pr.head === source.head);
    if (!record) throw new Error('Embedded golden source identity does not match a projected PR record');
    if (!String(source.projectLicenseUrl || '').includes(source.head)) {
      throw new Error('Embedded project license URL is not pinned to the source Head');
    }
  }
  requireEqual(ledger.acceptance.independentHoldoutAvailable, false, 'ledger holdout authority');
  requireEqual(ledger.acceptance.liveModelEvaluationPerformed, false, 'ledger model execution authority');
  requireEqual(ledger.acceptance.tokenOrCostSavingsEstablished, false, 'ledger cost authority');
  requireEqual(ledger.acceptance.embeddedProductionQualificationEstablished, false, 'ledger production qualification');
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
  const ledger = readJson(root, 'quality/external-benchmark-sources.json');
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
  validateLedgerBinding(ledger, review, cpp, embedded);
  const aacrSource = ledger.sources.find(source => source.id === 'alibaba-aacr-bench-2026');
  const aacrPositive = aacrSource.assets.find(asset => asset.path === 'dataset/v1/positive_samples.json');
  const aacrNegative = aacrSource.assets.find(asset => asset.path === 'dataset/v1/negative_samples.json');
  const positiveAcquisition = aacrSource.snapshot.positiveAssetAcquisition;
  const aacrInspection = aacrSource.snapshot.negativeReferenceInspection;
  const partitionOverlap = aacrInspection.positiveNegativePrOverlap;
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
    addPr(record, 'Embedded ReviewBench', [group], record.findings, 'start_line', 'end_line',
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
  if (embeddedHigh !== embedded.records.reduce((sum, record) => sum + record.findings.filter(f =>
      f.tp_fp === 'tp' && f.scope === 'introduced-by-pr' && (f.severity === 'high' || f.severity === 'critical')).length, 0)) {
    throw new Error('Embedded high-severity finding count mismatch');
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
  const derivedSummary = {
    uniquePullRequests: prs.size,
    distinctRepositories: repos.size,
    candidateGroupingUnits: groups.size,
    highRiskCandidateGroups: highGroups.size,
    cleanNegativeCases,
    blindHoldoutCases: holdoutCases,
    independentRootCauseAdjudication: independenceVerified,
    freshModelExecution
  };
  for (const [key, value] of Object.entries(derivedSummary)) {
    requireEqual(ledger.executionSummary && ledger.executionSummary[key], value, 'executionSummary.' + key);
  }
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
    aacr: Object.freeze({positiveReferences: aacrPositive.records, positiveComments: positiveAcquisition.commentRecords,
      positiveAssetAcquired: positiveAcquisition.acquired, positiveValidAnchors: positiveAcquisition.validAnchors,
      positiveInvalidAnchors: positiveAcquisition.invalidAnchors, positiveAiComments: positiveAcquisition.commentOriginCounts.aiGenerated,
      positiveHumanComments: positiveAcquisition.commentOriginCounts.humanDiscussion,
      negativeReferences: aacrNegative.records, negativeComments: aacrInspection.commentRecords,
      negativeCommentArrays: aacrInspection.commentsArrayPresent,
      negativeNestedPaths: aacrInspection.nestedCommentPathsPresent,
      negativeNestedLineAnchors: aacrInspection.nestedCommentLineAnchorsPresent,
      explicitNegativeFilePathMapping: aacrInspection.explicitTopLevelFileOrPathField,
      cleanNegativeEligible: aacrInspection.cleanNegativeEligible,
      positiveNegativePrOverlap: partitionOverlap.intersectionPrs,
      uniqueAacrPrs: partitionOverlap.unionPrs,
      reviewBenchOverlap: aacrInspection.reviewBenchOverlap.overlappingPrs}),
    uniquePullRequests: prs.size,
    distinctRepositories: repos.size,
    candidateGroupingUnits: groups.size,
    highRiskCandidateGroups: highGroups.size,
    positiveFindingCount: positives,
    falsePositiveReferenceCount: falsePositiveReferences,
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
