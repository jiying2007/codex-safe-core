'use strict';

const crypto = require('node:crypto');
const CORE_CONTRACT = Object.freeze(require('./core-contract.json'));

const JUDGMENT_LIFECYCLE_VERSION = Number(CORE_CONTRACT.judgmentLifecycleVersion);
const EXECUTION_MODES = Object.freeze(['fresh', 'replay']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function validDigest(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ''));
}

function computeReviewSubjectFingerprint({
  subject,
  diffFingerprint,
  policyFingerprint,
  evidenceManifestDigest,
  promptContractVersion = Number(CORE_CONTRACT.reviewPromptContractVersion),
  reviewProfile = '',
  model = ''
} = {}) {
  if (!subject || typeof subject !== 'object') throw new TypeError('Review subject is required.');
  for (const [name, value] of [['diffFingerprint', diffFingerprint], ['evidenceManifestDigest', evidenceManifestDigest]]) {
    if (!validDigest(value)) throw new TypeError(`${name} must be a SHA-256 digest.`);
  }
  if (!(policyFingerprint === '<none>' || validDigest(policyFingerprint))) throw new TypeError('policyFingerprint must be <none> or SHA-256.');
  return digest({
    judgmentLifecycleVersion: JUDGMENT_LIFECYCLE_VERSION,
    subject,
    diffFingerprint,
    policyFingerprint,
    evidenceManifestDigest,
    promptContractVersion: Number(promptContractVersion),
    reviewProfile: String(reviewProfile || ''),
    model: String(model || '')
  });
}

function shouldPersistJudgmentReceipt({ executionMode = 'fresh', inference = true } = {}) {
  if (!EXECUTION_MODES.includes(executionMode)) throw new TypeError(`Unsupported execution mode: ${executionMode}`);
  return executionMode === 'fresh' && inference !== false;
}

function reviewReceiptMatchesIdentity(receipt, identity = {}) {
  if (!receipt || typeof receipt !== 'object') return false;
  if (!validDigest(identity.reviewSubjectFingerprint) || !validDigest(identity.evidenceManifestDigest)) return false;
  return receipt.reviewSubjectFingerprint === identity.reviewSubjectFingerprint &&
    receipt.evidenceManifestDigest === identity.evidenceManifestDigest;
}

function reviewReceiptQualifiesForDelivery(receipt) {
  return Boolean(receipt &&
    receipt.coverageVerdict === 'complete' &&
    receipt.mechanicalGate !== 'fail' &&
    receipt.qualityVerdict !== 'blocked');
}

module.exports = Object.freeze({
  JUDGMENT_LIFECYCLE_VERSION,
  EXECUTION_MODES,
  computeReviewSubjectFingerprint,
  shouldPersistJudgmentReceipt,
  reviewReceiptMatchesIdentity,
  reviewReceiptQualifiesForDelivery
});
