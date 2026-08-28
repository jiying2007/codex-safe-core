'use strict';

const crypto = require('node:crypto');

const SEMANTIC_REVIEW_VERSION = 1;
const EVIDENCE_MANIFEST_VERSION = 1;
const REVIEW_KEY_VERSION = 1;
const FINDING_LEDGER_VERSION = 1;
const FINDING_VERIFICATION_VERSION = 1;
const VERIFICATION_STATUSES = Object.freeze(['verified','insufficient_evidence','contradicted','suppressed_by_resolution']);
const EVIDENCE_GRADES = Object.freeze(['A','B','C','D','X']);
const RESOLUTION_VALUES = Object.freeze(['fixed','false_positive','accepted_risk','duplicate','obsolete','not_applicable','policy_exception']);

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)])));
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex'); }
function byteLength(value) { return Buffer.byteLength(String(value ?? ''), 'utf8'); }
function normalizePath(value) { return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^a\//, '').replace(/^b\//, ''); }
function normalizeText(value, max = 2000) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}
function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }

const C_CALL_KEYWORDS = new Set([
  'if','for','while','switch','return','sizeof','alignof','typeof','defined','do','case','catch','throw','new','delete',
  'static_assert','assert','offsetof','container_of','likely','unlikely'
]);
function extractCallSymbols(diff = '', { maxSymbols = 128 } = {}) {
  const symbols = new Set();
  const changedLines = String(diff || '').split(/\r?\n/).filter(line => /^\+(?!\+\+)/.test(line)).map(line => line.slice(1));
  for (const line of changedLines) {
    const scrubbed = line.replace(/\/\/.*$/g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, ' ');
    for (const match of scrubbed.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) {
      const symbol = match[1];
      if (C_CALL_KEYWORDS.has(symbol)) continue;
      symbols.add(symbol);
      if (symbols.size >= maxSymbols) return freeze([...symbols]);
    }
  }
  return freeze([...symbols]);
}

function normalizeEvidenceEntry(raw = {}) {
  const kind = normalizeText(raw.kind || 'dependency', 64) || 'dependency';
  const source = normalizeText(raw.source || 'index', 64) || 'index';
  const path = normalizePath(raw.path);
  const symbol = normalizeText(raw.symbol, 256);
  const line = Math.max(0, Math.floor(Number(raw.line) || 0));
  const endLine = Math.max(line, Math.floor(Number(raw.endLine) || line));
  const content = String(raw.content || '');
  const contentDigest = String(raw.contentDigest || sha256(content));
  const relatedPaths = [...new Set((Array.isArray(raw.relatedPaths) ? raw.relatedPaths : []).map(normalizePath).filter(Boolean))].sort();
  const id = String(raw.id || sha256(canonicalJson({ kind, source, path, symbol, line, endLine, contentDigest, relatedPaths })).slice(0, 24));
  return freeze({ id, kind, source, path, symbol, line, endLine, contentDigest, bytes: Number.isFinite(raw.bytes) ? Math.max(0, Math.floor(raw.bytes)) : byteLength(content), relatedPaths });
}
function buildEvidenceManifest(entries = [], meta = {}) {
  const normalized = (Array.isArray(entries) ? entries : []).map(normalizeEvidenceEntry)
    .sort((a, b) => a.id.localeCompare(b.id) || a.contentDigest.localeCompare(b.contentDigest));
  const subject = freeze({
    headOid: String(meta.headOid || ''),
    indexFingerprint: String(meta.indexFingerprint || ''),
    diffFingerprint: String(meta.diffFingerprint || '')
  });
  const body = { version: EVIDENCE_MANIFEST_VERSION, subject, entries: normalized };
  return freeze({ ...body, manifestDigest: sha256(canonicalJson(body)) });
}
function digestAnalyzerEvidence(findings = []) {
  const normalized = (Array.isArray(findings) ? findings : []).map(item => ({
    fingerprint: String(item?.fingerprint || ''), severity: String(item?.severity || ''), category: String(item?.category || ''),
    file: normalizePath(item?.file), line: Math.max(0, Math.floor(Number(item?.line) || 0)), message: normalizeText(item?.message || item?.description, 1000)
  })).sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  return sha256(canonicalJson(normalized));
}
function computeReviewKey(input = {}) {
  const body = {
    version: REVIEW_KEY_VERSION,
    subject: {
      headOid: String(input.subject?.headOid || ''),
      indexFingerprint: String(input.subject?.indexFingerprint || '')
    },
    diffFingerprint: String(input.diffFingerprint || ''),
    policyFingerprint: String(input.policyFingerprint || ''),
    profile: String(input.profile || 'standard'),
    evidenceManifestDigest: String(input.evidenceManifestDigest || ''),
    analyzerDigest: String(input.analyzerDigest || ''),
    promptContractVersion: Math.max(0, Math.floor(Number(input.promptContractVersion) || 0)),
    modelIdentity: String(input.modelIdentity || 'cli-default'),
    optionsFingerprint: String(input.optionsFingerprint || '')
  };
  return sha256(canonicalJson(body));
}

function normalizeHypothesis(raw = {}) {
  const assumptions = [...new Set((Array.isArray(raw.assumptions) ? raw.assumptions : []).map(value => normalizeText(value, 500)).filter(Boolean))].slice(0, 12);
  const requiredSymbols = [...new Set((Array.isArray(raw.requiredSymbols) ? raw.requiredSymbols : []).map(value => normalizeText(value, 256)).filter(Boolean))].slice(0, 24);
  return freeze({
    severity: String(raw.severity || 'medium'), category: String(raw.category || 'other'), file: normalizePath(raw.file),
    line: Math.max(1, Math.floor(Number(raw.line) || 1)), endLine: Math.max(1, Math.floor(Number(raw.endLine) || Number(raw.line) || 1)),
    claim: normalizeText(raw.claim || raw.description, 1600), suggestion: normalizeText(raw.suggestion, 1200),
    assumptions, requiredSymbols, rootCauseSymbol: normalizeText(raw.rootCauseSymbol || requiredSymbols[0], 256),
    modelConfidence: Math.max(0, Math.min(1, Number(raw.modelConfidence ?? raw.confidence ?? 0) || 0)),
    anchorContextDigest: String(raw.anchorContextDigest || '')
  });
}
function computeStableFindingId(raw = {}) {
  const finding = normalizeHypothesis(raw);
  const body = {
    version: FINDING_LEDGER_VERSION,
    category: finding.category,
    file: finding.file,
    rootCauseSymbol: finding.rootCauseSymbol,
    anchorContextDigest: String(raw.anchorContextDigest || finding.anchorContextDigest || ''),
    claimClass: normalizeText(raw.claimClass || finding.category, 160)
  };
  if (!body.anchorContextDigest && !body.rootCauseSymbol) body.fallbackAnchor = Math.max(1, Math.floor(Number(raw.line) || finding.line));
  return sha256(canonicalJson(body));
}
function normalizeResolutionRecord(raw = {}) {
  const resolution = RESOLUTION_VALUES.includes(String(raw.resolution)) ? String(raw.resolution) : 'obsolete';
  return freeze({
    version: FINDING_LEDGER_VERSION,
    stableFindingId: String(raw.stableFindingId || ''), resolution,
    evidenceDigest: String(raw.evidenceDigest || ''), actor: normalizeText(raw.actor, 160), note: normalizeText(raw.note, 1000),
    resolvedAt: String(raw.resolvedAt || new Date(0).toISOString())
  });
}
function activeResolution(records = [], stableFindingId, evidenceDigest) {
  return (Array.isArray(records) ? records : []).map(normalizeResolutionRecord)
    .find(record => record.stableFindingId === stableFindingId && record.evidenceDigest && record.evidenceDigest === String(evidenceDigest || '')) || null;
}

function deriveEvidenceGrade({ status, assumptions = [], requiredSymbols = [], evidenceRefs = [], evidenceById = new Map() } = {}) {
  if (status === 'contradicted') return 'X';
  if (status !== 'verified') return 'D';
  const refs = evidenceRefs.map(id => evidenceById.get(String(id))).filter(Boolean);
  if ((assumptions.length || requiredSymbols.length) && refs.length === 0) return 'D';
  if (refs.some(ref => ref.kind === 'analyzer' || ref.kind === 'deterministic')) return 'A';
  if (refs.some(ref => ['dependency','symbol-declaration','symbol-definition','ownership-contract'].includes(ref.kind))) return 'B';
  return 'C';
}
function validateEvidenceBackedFinding(raw = {}, manifest = { entries: [] }, resolutions = []) {
  const hypothesis = normalizeHypothesis(raw);
  const status = VERIFICATION_STATUSES.includes(String(raw.verificationStatus)) ? String(raw.verificationStatus) : 'insufficient_evidence';
  const evidenceRefs = [...new Set((Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : []).map(String).filter(Boolean))];
  const evidenceById = new Map((manifest?.entries || []).map(entry => [String(entry.id), entry]));
  const missingEvidenceRefs = evidenceRefs.filter(id => !evidenceById.has(id));
  const stableFindingId = String(raw.stableFindingId || computeStableFindingId({ ...hypothesis, anchorContextDigest: raw.anchorContextDigest, claimClass: raw.claimClass }));
  const evidenceDigest = sha256(canonicalJson(evidenceRefs.map(id => evidenceById.get(id)).filter(Boolean).map(entry => ({ id: entry.id, digest: entry.contentDigest }))));
  const resolution = activeResolution(resolutions, stableFindingId, evidenceDigest);
  const effectiveStatus = resolution ? 'suppressed_by_resolution' : status;
  const evidenceGrade = resolution ? 'D' : deriveEvidenceGrade({ status, assumptions: hypothesis.assumptions, requiredSymbols: hypothesis.requiredSymbols, evidenceRefs, evidenceById });
  const publishable = !missingEvidenceRefs.length && effectiveStatus === 'verified' && ['A','B','C'].includes(evidenceGrade) &&
    (!(hypothesis.assumptions.length || hypothesis.requiredSymbols.length) || ['A','B'].includes(evidenceGrade));
  return freeze({
    ...hypothesis, stableFindingId, verificationStatus: effectiveStatus, evidenceGrade, evidenceRefs,
    evidenceDigest, missingEvidenceRefs, resolution, publishable,
    verificationReason: normalizeText(raw.verificationReason, 1000)
  });
}

function digestFindingSet(findings = []) {
  const stable = (Array.isArray(findings) ? findings : []).map(item => ({
    stableFindingId: String(item?.stableFindingId || computeStableFindingId(item || {})),
    verificationStatus: String(item?.verificationStatus || ''), evidenceGrade: String(item?.evidenceGrade || ''),
    severity: String(item?.severity || ''), evidenceDigest: String(item?.evidenceDigest || '')
  })).sort((a, b) => a.stableFindingId.localeCompare(b.stableFindingId));
  return sha256(canonicalJson(stable));
}
function compareFindingSets(runs = []) {
  const digests = (Array.isArray(runs) ? runs : []).map(run => digestFindingSet(run?.findings || run || []));
  const unique = [...new Set(digests)];
  return freeze({ runCount: digests.length, stable: unique.length <= 1, uniqueFindingSetCount: unique.length, digests });
}
function selectEvidenceForPaths(entries = [], paths = [], { maxBytes = 96 * 1024, maxEntries = 32 } = {}) {
  const wanted = new Set((paths || []).map(normalizePath));
  const selected = []; let bytes = 0; let truncated = false;
  for (const raw of entries || []) {
    const entry = normalizeEvidenceEntry(raw);
    const connected = wanted.has(entry.path) || entry.relatedPaths.some(path => wanted.has(path));
    if (!connected) continue;
    if (selected.length >= maxEntries || (maxBytes > 0 && bytes + entry.bytes > maxBytes)) { truncated = true; continue; }
    selected.push(entry); bytes += entry.bytes;
  }
  return freeze({ entries: selected, bytes, truncated });
}

module.exports = Object.freeze({
  SEMANTIC_REVIEW_VERSION, EVIDENCE_MANIFEST_VERSION, REVIEW_KEY_VERSION, FINDING_LEDGER_VERSION, FINDING_VERIFICATION_VERSION,
  VERIFICATION_STATUSES, EVIDENCE_GRADES, RESOLUTION_VALUES,
  canonicalJson, sha256, normalizePath, extractCallSymbols, normalizeEvidenceEntry, buildEvidenceManifest, digestAnalyzerEvidence,
  computeReviewKey, normalizeHypothesis, computeStableFindingId, normalizeResolutionRecord, activeResolution,
  deriveEvidenceGrade, validateEvidenceBackedFinding, digestFindingSet, compareFindingSets, selectEvidenceForPaths
});
