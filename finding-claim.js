'use strict';

const crypto = require('node:crypto');

const FINDING_CLAIM_VERSION = 1;
const CLAIM_KEY_PATTERN = /^[a-z][a-z0-9_]{2,95}$/;
const CATEGORY_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function freeze(value) { return Object.freeze(value); }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function normalizeClaimKey(value) {
  const text = String(value || '').trim();
  return CLAIM_KEY_PATTERN.test(text) ? text : '';
}
function normalizeCategory(value) {
  const text = String(value || '').trim();
  return CATEGORY_PATTERN.test(text) ? text : '';
}
function computeFindingClaimIdentity({ anchorFingerprint = '', category = '', rootCauseKey = '', claimClass = '' } = {}) {
  const anchor = String(anchorFingerprint || '').trim().toLowerCase();
  const normalizedCategory = normalizeCategory(category);
  const normalizedRootCauseKey = normalizeClaimKey(rootCauseKey);
  const normalizedClaimClass = normalizeClaimKey(claimClass);
  if (!SHA256_PATTERN.test(anchor) || !normalizedCategory || !normalizedRootCauseKey || !normalizedClaimClass) {
    return freeze({ version: FINDING_CLAIM_VERSION, state: 'unknown', anchorFingerprint: SHA256_PATTERN.test(anchor) ? anchor : '', category: normalizedCategory, rootCauseKey: normalizedRootCauseKey, claimClass: normalizedClaimClass, claimFingerprint: '' });
  }
  const claimFingerprint = digest({ version: FINDING_CLAIM_VERSION, anchorFingerprint: anchor, category: normalizedCategory, rootCauseKey: normalizedRootCauseKey, claimClass: normalizedClaimClass });
  return freeze({ version: FINDING_CLAIM_VERSION, state: 'known', anchorFingerprint: anchor, category: normalizedCategory, rootCauseKey: normalizedRootCauseKey, claimClass: normalizedClaimClass, claimFingerprint });
}

module.exports = freeze({ FINDING_CLAIM_VERSION, CLAIM_KEY_PATTERN, normalizeClaimKey, computeFindingClaimIdentity });
