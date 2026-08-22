'use strict';

const crypto = require('crypto');

const POLICY_FILE = '.codex-safe.json';
const POLICY_SCHEMA_VERSION = 2;
const POLICY_SECTIONS = Object.freeze(['commit', 'review', 'pr']);
const POLICY_SECTION_KEYS = Object.freeze({
  commit: Object.freeze([
    'language', 'maxDiffBytes', 'subjectMaxLength', 'maxBodyChars', 'scopes', 'scopeHints',
    'scopePolicy', 'autoInferScope', 'styleHistoryLimit', 'extraInstructions', 'timeoutSeconds'
  ]),
  review: Object.freeze([
    'language', 'maxDiffBytes', 'maxFindings', 'severityThreshold', 'confidenceThreshold',
    'timeoutSeconds', 'extraInstructions'
  ]),
  pr: Object.freeze([
    'language', 'baseBranch', 'maxDiffBytes', 'maxCommitBytes', 'titleMaxLength', 'maxBodyChars',
    'includePullRequestTemplate', 'extraInstructions', 'timeoutSeconds'
  ])
});
const TOP_LEVEL_KEYS = new Set(['schemaVersion', ...POLICY_SECTIONS]);
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const CONTROL_CHARS = /[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/;

function deepFreezeJson(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreezeJson));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFreezeJson(item)])));
  }
  return value;
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be a JSON object.`);
  return value;
}

function assertKnownKeys(value, allowedKeys, name) {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`);
}

function assertInteger(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function assertNumber(value, min, max, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number between ${min} and ${max}.`);
  return value;
}

function assertString(value, maxLength, name, { allowEmpty = true } = {}) {
  if (typeof value !== 'string' || value.length > maxLength || CONTROL_CHARS.test(value) || (!allowEmpty && !value.trim())) {
    throw new Error(`${name} must be a${allowEmpty ? '' : ' non-empty'} string no longer than ${maxLength} characters without control characters.`);
  }
  return value;
}

function assertLanguage(value, name) {
  if (!['zh-CN', 'en'].includes(value)) throw new Error(`${name} must be zh-CN or en.`);
}

function validateScopes(value, name) {
  if (!Array.isArray(value) || value.length > 64) throw new Error(`${name} must be an array with at most 64 entries.`);
  const seen = new Set();
  for (const scope of value) {
    if (typeof scope !== 'string' || !SCOPE_PATTERN.test(scope)) throw new Error(`${name} contains an invalid scope.`);
    if (seen.has(scope)) throw new Error(`${name} must not contain duplicate scopes.`);
    seen.add(scope);
  }
}

function validateScopeHints(value, name) {
  assertPlainObject(value, name);
  const keys = Object.keys(value);
  if (keys.length > 64) throw new Error(`${name} cannot contain more than 64 scopes.`);
  for (const scope of keys) {
    if (!SCOPE_PATTERN.test(scope)) throw new Error(`${name} contains an invalid scope key: ${scope}.`);
    const hints = value[scope];
    if (!Array.isArray(hints) || hints.length > 32) throw new Error(`${name}.${scope} must be an array with at most 32 strings.`);
    const seen = new Set();
    for (const hint of hints) {
      assertString(hint, 64, `${name}.${scope} entry`, { allowEmpty: false });
      const normalized = hint.trim().toLowerCase();
      if (seen.has(normalized)) throw new Error(`${name}.${scope} must not contain duplicate hints.`);
      seen.add(normalized);
    }
  }
}

function validateCommitSection(rules) {
  const name = `${POLICY_FILE}.commit`;
  assertKnownKeys(rules, POLICY_SECTION_KEYS.commit, name);
  if (rules.language !== undefined) assertLanguage(rules.language, `${name}.language`);
  if (rules.maxDiffBytes !== undefined) assertInteger(rules.maxDiffBytes, 4096, 2097152, `${name}.maxDiffBytes`);
  if (rules.subjectMaxLength !== undefined) assertInteger(rules.subjectMaxLength, 30, 120, `${name}.subjectMaxLength`);
  if (rules.maxBodyChars !== undefined) assertInteger(rules.maxBodyChars, 200, 10000, `${name}.maxBodyChars`);
  if (rules.scopes !== undefined) validateScopes(rules.scopes, `${name}.scopes`);
  if (rules.scopeHints !== undefined) validateScopeHints(rules.scopeHints, `${name}.scopeHints`);
  if (rules.scopePolicy !== undefined && !['flexible', 'strict'].includes(rules.scopePolicy)) throw new Error(`${name}.scopePolicy must be flexible or strict.`);
  if (rules.autoInferScope !== undefined && typeof rules.autoInferScope !== 'boolean') throw new Error(`${name}.autoInferScope must be boolean.`);
  if (rules.styleHistoryLimit !== undefined) assertInteger(rules.styleHistoryLimit, 0, 50, `${name}.styleHistoryLimit`);
  if (rules.extraInstructions !== undefined) assertString(rules.extraInstructions, 4000, `${name}.extraInstructions`);
  if (rules.timeoutSeconds !== undefined) assertInteger(rules.timeoutSeconds, 10, 300, `${name}.timeoutSeconds`);
  return deepFreezeJson(rules);
}

function validateReviewSection(rules) {
  const name = `${POLICY_FILE}.review`;
  assertKnownKeys(rules, POLICY_SECTION_KEYS.review, name);
  if (rules.language !== undefined) assertLanguage(rules.language, `${name}.language`);
  if (rules.maxDiffBytes !== undefined) assertInteger(rules.maxDiffBytes, 4096, 2097152, `${name}.maxDiffBytes`);
  if (rules.maxFindings !== undefined) assertInteger(rules.maxFindings, 1, 100, `${name}.maxFindings`);
  if (rules.severityThreshold !== undefined && !['critical', 'high', 'medium', 'low', 'info'].includes(rules.severityThreshold)) throw new Error(`${name}.severityThreshold is invalid.`);
  if (rules.confidenceThreshold !== undefined) assertNumber(rules.confidenceThreshold, 0, 1, `${name}.confidenceThreshold`);
  if (rules.timeoutSeconds !== undefined) assertInteger(rules.timeoutSeconds, 10, 300, `${name}.timeoutSeconds`);
  if (rules.extraInstructions !== undefined) assertString(rules.extraInstructions, 5000, `${name}.extraInstructions`);
  return deepFreezeJson(rules);
}

function validatePrSection(rules) {
  const name = `${POLICY_FILE}.pr`;
  assertKnownKeys(rules, POLICY_SECTION_KEYS.pr, name);
  if (rules.language !== undefined) assertLanguage(rules.language, `${name}.language`);
  if (rules.baseBranch !== undefined) {
    assertString(rules.baseBranch, 256, `${name}.baseBranch`);
    if (rules.baseBranch.startsWith('-')) throw new Error(`${name}.baseBranch must not start with '-'.`);
  }
  if (rules.maxDiffBytes !== undefined) assertInteger(rules.maxDiffBytes, 4096, 2097152, `${name}.maxDiffBytes`);
  if (rules.maxCommitBytes !== undefined) assertInteger(rules.maxCommitBytes, 4096, 524288, `${name}.maxCommitBytes`);
  if (rules.titleMaxLength !== undefined) assertInteger(rules.titleMaxLength, 40, 160, `${name}.titleMaxLength`);
  if (rules.maxBodyChars !== undefined) assertInteger(rules.maxBodyChars, 1000, 20000, `${name}.maxBodyChars`);
  if (rules.includePullRequestTemplate !== undefined && typeof rules.includePullRequestTemplate !== 'boolean') throw new Error(`${name}.includePullRequestTemplate must be boolean.`);
  if (rules.extraInstructions !== undefined) assertString(rules.extraInstructions, 4000, `${name}.extraInstructions`);
  if (rules.timeoutSeconds !== undefined) assertInteger(rules.timeoutSeconds, 10, 300, `${name}.timeoutSeconds`);
  return deepFreezeJson(rules);
}

function validatePolicySection(section, value) {
  if (!POLICY_SECTIONS.includes(section)) throw new Error(`Unknown policy section: ${section}`);
  const rules = value === undefined ? {} : assertPlainObject(value, `${POLICY_FILE}.${section}`);
  if (section === 'commit') return validateCommitSection(rules);
  if (section === 'review') return validateReviewSection(rules);
  return validatePrSection(rules);
}

function validatePolicyDocument(value) {
  assertPlainObject(value, POLICY_FILE);
  const unknown = Object.keys(value).filter(key => !TOP_LEVEL_KEYS.has(key));
  if (unknown.length) throw new Error(`${POLICY_FILE} contains unsupported top-level fields: ${unknown.join(', ')}`);
  if (value.schemaVersion !== POLICY_SCHEMA_VERSION) throw new Error(`${POLICY_FILE} schemaVersion must be ${POLICY_SCHEMA_VERSION}.`);
  const normalized = { schemaVersion: POLICY_SCHEMA_VERSION };
  for (const section of POLICY_SECTIONS) if (value[section] !== undefined) normalized[section] = validatePolicySection(section, value[section]);
  return deepFreezeJson(normalized);
}

function parsePolicyDocument(text) {
  let parsed;
  try { parsed = JSON.parse(String(text)); }
  catch (error) { throw new Error(`Failed to parse ${POLICY_FILE}: ${error.message}`); }
  return validatePolicyDocument(parsed);
}

async function readPolicySectionAtHead({ git, repoRoot, headOid, section, token, maxBytes = 64 * 1024 }) {
  if (typeof git !== 'function') throw new TypeError('readPolicySectionAtHead requires a git function.');
  if (!POLICY_SECTIONS.includes(section)) throw new Error(`Unknown policy section: ${section}`);
  if (headOid === '<unborn>') return Object.freeze({ rules: deepFreezeJson({}), source: 'unborn-default', fingerprint: '<none>' });

  const { stdout: listed } = await git(['ls-tree', '-z', headOid, '--', POLICY_FILE], repoRoot, token);
  const entry = listed.split('\0').find(Boolean);
  if (!entry) return Object.freeze({ rules: deepFreezeJson({}), source: 'head-default', fingerprint: '<none>' });
  const tab = entry.indexOf('\t');
  const header = tab >= 0 ? entry.slice(0, tab) : '';
  const mode = header.split(/\s+/)[0];
  if (mode !== '100644' && mode !== '100755') throw new Error(`${POLICY_FILE} in HEAD must be a regular file.`);

  const { stdout } = await git(['show', `${headOid}:${POLICY_FILE}`], repoRoot, token, { maxStdoutBytes: maxBytes + 1 });
  if (Buffer.byteLength(stdout, 'utf8') > maxBytes) throw new Error(`${POLICY_FILE} in HEAD cannot exceed ${maxBytes} bytes.`);
  const document = parsePolicyDocument(stdout);
  return Object.freeze({
    rules: document[section] || deepFreezeJson({}),
    source: 'head-policy',
    fingerprint: crypto.createHash('sha256').update(stdout, 'utf8').digest('hex'),
    schemaVersion: document.schemaVersion
  });
}

module.exports = {
  POLICY_FILE,
  POLICY_SCHEMA_VERSION,
  POLICY_SECTIONS,
  POLICY_SECTION_KEYS,
  SCOPE_PATTERN,
  deepFreezeJson,
  validatePolicySection,
  validatePolicyDocument,
  parsePolicyDocument,
  readPolicySectionAtHead
};
