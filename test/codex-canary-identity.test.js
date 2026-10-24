'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { STAGES, freezeIdentity, validateIdentity, stageReceipt, verifyStages } = require('../scripts/codex-canary-identity');
const { runBehavioralCanary } = require('../scripts/codex-behavioral-canary');
const { familyGitEnvironment } = require('../scripts/family-read-auth');

const env = { GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' };
const safe = 'b'.repeat(64);
const metadata = { version: '0.130.0', dist: { integrity: 'sha512-' + Buffer.alloc(64, 1).toString('base64') } };
const identity = freezeIdentity(metadata, env, safe);
function report(stage) { return { ok: true, version: 'codex-cli 0.130.0', safeContractDigest: safe,
  ...(stage === 'behavioral-Linux' ? { status: 0, filesystemWriteBlocked: true, loopbackNetworkBlocked: true } : {}),
  ...(stage === 'quality-Linux' ? { cases: 4, failures: [] } : {}) }; }
function entries() { return STAGES.map(stage => { const value = report(stage); return { report: value, receipt: stageReceipt(identity, stage, value) }; }); }

test('one frozen version, package integrity, Core and run binds all five stages', () => {
  assert.equal(verifyStages(identity, entries()).length, 5);
  assert.deepEqual(validateIdentity(identity, env), identity);
});
test('unknown version, missing distribution identity and foreign run fail closed', () => {
  for (const version of ['latest', '0.130.0\nEVIL=x', '--help', '']) assert.throws(() => freezeIdentity({ ...metadata, version }, env, safe));
  assert.throws(() => freezeIdentity({ version: metadata.version }, env, safe));
  assert.throws(() => validateIdentity(identity, { ...env, GITHUB_RUN_ATTEMPT: '2' }));
  assert.throws(() => validateIdentity({ ...identity, version: '0.131.0' }));
});
test('upstream latest moving between stages cannot qualify the new version', () => {
  assert.throws(() => stageReceipt(identity, 'capability-Linux', { ...report('capability-Linux'), version: 'codex-cli 0.131.0' }), /version mismatch/);
});
test('missing, duplicated or tampered stage evidence cannot produce history', () => {
  assert.throws(() => verifyStages(identity, entries().slice(1)));
  const duplicate = entries(); duplicate[1] = duplicate[0]; assert.throws(() => verifyStages(identity, duplicate));
  const tampered = entries(); tampered[0].receipt = { ...tampered[0].receipt, coreSha: 'd'.repeat(40) }; assert.throws(() => verifyStages(identity, tampered));
  const changed = entries(); changed[0].report.extra = 'modified'; assert.throws(() => verifyStages(identity, changed));
});
test('an error or non-zero behavioral exit never attests successful isolation', () => {
  for (const status of [null, 1, 137]) assert.throws(() => stageReceipt(identity, 'behavioral-Linux', { ...report('behavioral-Linux'), status }));
  assert.throws(() => stageReceipt(identity, 'quality-Linux', { ...report('quality-Linux'), ok: false }));
  assert.throws(() => stageReceipt(identity, 'quality-Linux', { ...report('quality-Linux'), cases: 0 }));
});
const runOptions = { env: { OPENAI_API_KEY: 'test-fixture-not-a-credential' }, safeContractDigest: safe };
const success = { parsed: { result: 'No tools permitted.' }, resolved: { version: 'codex-cli 0.130.0' } };
test('behavioral canary propagates provider error and timeout instead of reporting pass', async () => {
  for (const code of ['ETIMEDOUT', 'ECODEXTURN', 'EOUTPUTLIMIT', 1]) {
    await assert.rejects(runBehavioralCanary({ ...runOptions, execute: async () => { throw Object.assign(new Error('failure'), { code }); } }), error => error.code === code);
  }
});
test('behavioral canary requires real structured output and CLI identity', async () => {
  for (const value of [{}, { parsed: {} }, { ...success, resolved: {} }]) {
    await assert.rejects(runBehavioralCanary({ ...runOptions, execute: async () => value }));
  }
  assert.equal((await runBehavioralCanary({ ...runOptions, execute: async request => {
    assert.equal(request.timeoutMs, 90000); assert.ok(request.maxTranscriptBytes <= 4 * 1024 * 1024); return success;
  } })).status, 0);
});
test('behavioral canary detects filesystem and loopback escapes and cleans up', async () => {
  let file;
  await assert.rejects(runBehavioralCanary({ ...runOptions, execute: async (_request, context) => { file = context.forbidden; fs.writeFileSync(file, 'escaped'); return success; } }), /escape detected/);
  assert.equal(fs.existsSync(file), false);
  await assert.rejects(runBehavioralCanary({ ...runOptions, execute: async (_request, context) => {
    await new Promise((resolve, reject) => http.get(`http://127.0.0.1:${context.port}/sentinel`, response => { response.resume(); response.on('end', resolve); }).on('error', reject));
    return success;
  } }), /escape detected/);
});
test('Family Git authentication is ephemeral, origin-scoped and noninteractive', () => {
  const source = { PATH: '/bin', CODEX_SAFE_FAMILY_READ_TOKEN: 'test-token', GITHUB_TOKEN: 'write-token', GIT_CONFIG_COUNT: '99', GIT_CONFIG_KEY_88: 'injected' };
  const actual = familyGitEnvironment(source);
  assert.equal(source.CODEX_SAFE_FAMILY_READ_TOKEN, 'test-token');
  assert.equal(actual.CODEX_SAFE_FAMILY_READ_TOKEN, undefined); assert.equal(actual.GITHUB_TOKEN, undefined);
  assert.equal(actual.GIT_CONFIG_KEY_88, undefined); assert.equal(actual.GIT_TERMINAL_PROMPT, '0');
  const keys = Object.entries(actual).filter(([key]) => key.startsWith('GIT_CONFIG_KEY_')).map(([, value]) => value);
  assert.ok(keys.includes('http.https://github.com/.extraheader'));
  assert.equal(actual.GIT_CONFIG_VALUE_2, 'false');
  assert.throws(() => familyGitEnvironment({ CODEX_SAFE_FAMILY_READ_TOKEN: 'bad\nheader' }));
  assert.equal(familyGitEnvironment({}).GIT_CONFIG_COUNT, '5');
});
