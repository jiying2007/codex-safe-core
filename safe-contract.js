'use strict';

const crypto = require('crypto');

const SAFE_CORE_VERSION = 2;
const SAFE_CONTRACT_VERSION = 2;
const REVIEW_RECEIPT_SCHEMA_VERSION = 2;
const COMMIT_RECEIPT_SCHEMA_VERSION = 2;

const REQUIRED_CODEX_TOP_LEVEL_FLAGS = Object.freeze(['--ask-for-approval']);
const REQUIRED_CODEX_EXEC_FLAGS = Object.freeze([
  '--json',
  '--ephemeral',
  '--skip-git-repo-check',
  '--ignore-user-config',
  '--ignore-rules',
  '--sandbox',
  '--output-schema',
  '--config'
]);
const SAFE_CODEX_CONFIG_OVERRIDES = Object.freeze([
  'web_search="disabled"',
  'features.shell_tool=false',
  'features.unified_exec=false',
  'features.shell_snapshot=false',
  'features.apps=false',
  'features.multi_agent=false',
  'features.remote_plugin=false',
  'features.hooks=false',
  'features.goals=false',
  'features.memories=false',
  'features.skill_mcp_dependency_install=false'
]);

function buildSafeCodexArgs(schemaPath, model = '') {
  const args = [
    '--ask-for-approval', 'never',
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--ignore-user-config',
    '--ignore-rules',
    '--sandbox', 'read-only',
    '--output-schema', schemaPath
  ];
  for (const value of SAFE_CODEX_CONFIG_OVERRIDES) args.push('--config', value);
  if (model) args.push('--model', model);
  args.push('-');
  return args;
}

function missingHelpFlags(helpText, requiredFlags) {
  const text = String(helpText || '');
  return requiredFlags.filter(flag => !text.includes(flag));
}

function isCliCompatibilityError(error) {
  const text = `${error?.stderr || ''}\n${error?.stdout || ''}\n${error?.message || ''}`.toLowerCase();
  return [
    'unexpected argument',
    'unknown argument',
    'unrecognized option',
    'unknown option',
    'unknown feature',
    'unknown config key',
    'unrecognized config key'
  ].some(fragment => text.includes(fragment));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

const fingerprintPolicy = fingerprint;

function validOid(value) {
  return value === '<unborn>' || /^[0-9a-f]{40,64}$/i.test(String(value || ''));
}
function validHash(value, allowNone = false) {
  return (allowNone && value === '<none>') || /^[0-9a-f]{64}$/i.test(String(value || ''));
}
function validMetadataString(value) {
  return value === undefined || (typeof value === 'string' && value.length <= 256 && !/[\r\n\0]/.test(value));
}

function validateReviewReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.schemaVersion !== REVIEW_RECEIPT_SCHEMA_VERSION || value.kind !== 'codex-review-safe') return null;
  for (const key of ['headOid', 'indexFingerprint', 'diffFingerprint', 'policyFingerprint', 'qualityVerdict', 'readinessVerdict', 'mechanicalGate', 'createdAt']) {
    if (typeof value[key] !== 'string' || !value[key]) return null;
  }
  if (!validOid(value.headOid)) return null;
  if (!validHash(value.indexFingerprint) || !validHash(value.diffFingerprint)) return null;
  if (!validHash(value.policyFingerprint, true)) return null;
  if (!['no_findings', 'findings_open', 'blocked'].includes(value.qualityVerdict)) return null;
  if (!['needs_evidence', 'blocked', 'ready'].includes(value.readinessVerdict)) return null;
  if (!['not_run', 'pass', 'fail'].includes(value.mechanicalGate)) return null;
  if (!Number.isInteger(value.stagedFileCount) || value.stagedFileCount < 0 || value.stagedFileCount > 5000) return null;
  if (!Number.isFinite(Date.parse(value.createdAt))) return null;
  if (!validMetadataString(value.model) || !validMetadataString(value.codexVersion)) return null;
  return Object.freeze({ ...value });
}

function validateCommitReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.schemaVersion !== COMMIT_RECEIPT_SCHEMA_VERSION || value.kind !== 'codex-commit-safe') return null;
  for (const key of ['headOid', 'indexFingerprint', 'diffFingerprint', 'messageFingerprint', 'policyFingerprint', 'reviewReceiptFingerprint', 'createdAt']) {
    if (typeof value[key] !== 'string' || !value[key]) return null;
  }
  if (!validOid(value.headOid)) return null;
  if (!validHash(value.indexFingerprint) || !validHash(value.diffFingerprint) || !validHash(value.messageFingerprint)) return null;
  if (!validHash(value.policyFingerprint, true) || !validHash(value.reviewReceiptFingerprint, true)) return null;
  if (value.commitOid !== undefined && value.commitOid !== '<pending>' && !/^[0-9a-f]{40,64}$/i.test(value.commitOid)) return null;
  if (!Number.isFinite(Date.parse(value.createdAt))) return null;
  if (!validMetadataString(value.model) || !validMetadataString(value.codexVersion)) return null;
  return Object.freeze({ ...value });
}

module.exports = {
  SAFE_CORE_VERSION,
  SAFE_CONTRACT_VERSION,
  REVIEW_RECEIPT_SCHEMA_VERSION,
  COMMIT_RECEIPT_SCHEMA_VERSION,
  REQUIRED_CODEX_TOP_LEVEL_FLAGS,
  REQUIRED_CODEX_EXEC_FLAGS,
  SAFE_CODEX_CONFIG_OVERRIDES,
  buildSafeCodexArgs,
  missingHelpFlags,
  isCliCompatibilityError,
  fingerprint,
  fingerprintPolicy,
  validateReviewReceipt,
  validateCommitReceipt
};
