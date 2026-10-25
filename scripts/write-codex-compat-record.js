'use strict';
const fs = require('node:fs');
const { validateIdentity, collectStages, verifyStages } = require('./codex-canary-identity');
const { SAFE_CONTRACT_DIGEST } = require('../safe-contract');

const identity = validateIdentity(JSON.parse(process.env.CODEX_CANARY_IDENTITY || '{}'), process.env);
if (identity.safeContractDigest !== SAFE_CONTRACT_DIGEST) throw new Error('Canary Safe Contract drift.');
const stages = verifyStages(identity, collectStages(process.argv[3] || 'evidence'));
const record = {
  schemaVersion: 2,
  codexCliVersion: identity.version,
  packageIntegrity: identity.integrity,
  safeContractDigest: SAFE_CONTRACT_DIGEST,
  coreSha: identity.coreSha,
  coreVersion: require('../core-contract.json').coreVersion,
  qualificationRunId: identity.runId,
  qualificationRunAttempt: identity.runAttempt,
  qualificationIdentityDigest: identity.identityDigest,
  stages,
  result: 'pass',
  recordedAt: new Date().toISOString()
};
const out = process.argv[2] || `codex-cli-${identity.version.replace(/[^0-9A-Za-z._-]/g, '_')}.json`;
fs.writeFileSync(out, JSON.stringify(record, null, 2) + '\n');
console.log(out);
