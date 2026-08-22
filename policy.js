'use strict';

const crypto = require('crypto');

const POLICY_FILE = '.codex-safe.json';
const POLICY_SCHEMA_VERSION = 2;
const POLICY_SECTIONS = Object.freeze(['commit', 'review', 'pr']);
const TOP_LEVEL_KEYS = new Set(['schemaVersion', ...POLICY_SECTIONS]);

function validatePolicyDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${POLICY_FILE} must contain a JSON object.`);
  }
  const unknown = Object.keys(value).filter(key => !TOP_LEVEL_KEYS.has(key));
  if (unknown.length) throw new Error(`${POLICY_FILE} contains unsupported top-level fields: ${unknown.join(', ')}`);
  if (value.schemaVersion !== POLICY_SCHEMA_VERSION) {
    throw new Error(`${POLICY_FILE} schemaVersion must be ${POLICY_SCHEMA_VERSION}.`);
  }
  for (const section of POLICY_SECTIONS) {
    if (value[section] !== undefined && (!value[section] || typeof value[section] !== 'object' || Array.isArray(value[section]))) {
      throw new Error(`${POLICY_FILE}.${section} must be a JSON object.`);
    }
  }
  return value;
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
  if (headOid === '<unborn>') return { rules: {}, source: 'unborn-default', fingerprint: '<none>' };

  const { stdout: listed } = await git(['ls-tree', '-z', headOid, '--', POLICY_FILE], repoRoot, token);
  const entry = listed.split('\0').find(Boolean);
  if (!entry) return { rules: {}, source: 'head-default', fingerprint: '<none>' };
  const tab = entry.indexOf('\t');
  const header = tab >= 0 ? entry.slice(0, tab) : '';
  const mode = header.split(/\s+/)[0];
  if (mode !== '100644' && mode !== '100755') throw new Error(`${POLICY_FILE} in HEAD must be a regular file.`);

  const { stdout } = await git(['show', `${headOid}:${POLICY_FILE}`], repoRoot, token, { maxStdoutBytes: maxBytes + 1 });
  if (Buffer.byteLength(stdout, 'utf8') > maxBytes) throw new Error(`${POLICY_FILE} in HEAD cannot exceed ${maxBytes} bytes.`);
  const document = parsePolicyDocument(stdout);
  return {
    rules: Object.freeze({ ...(document[section] || {}) }),
    source: 'head-policy',
    fingerprint: crypto.createHash('sha256').update(stdout, 'utf8').digest('hex'),
    schemaVersion: document.schemaVersion
  };
}

module.exports = {
  POLICY_FILE,
  POLICY_SCHEMA_VERSION,
  POLICY_SECTIONS,
  validatePolicyDocument,
  parsePolicyDocument,
  readPolicySectionAtHead
};
