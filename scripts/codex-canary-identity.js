'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const STAGES = Object.freeze(['capability-Linux', 'capability-Windows', 'capability-macOS', 'behavioral-Linux', 'quality-Linux']);
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const SRI = /^sha512-[A-Za-z0-9+/]{86}==$/;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function readJson(file) {
  const stat = fs.lstatSync(file);
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 256 * 1024, 'Invalid or oversized canary evidence file.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function freezeIdentity(metadata, env, safeContractDigest) {
  requireValue(metadata && VERSION.test(metadata.version || ''), 'Canary requires one exact Codex package version.');
  const integrity = metadata.dist?.integrity || metadata['dist.integrity'];
  requireValue(SRI.test(integrity || ''), 'Codex package must have SHA-512 distribution integrity.');
  requireValue(SHA.test(env.GITHUB_SHA || '') && HASH.test(safeContractDigest || ''), 'Exact Core and Safe Contract identities are required.');
  requireValue(/^[1-9]\d*$/.test(env.GITHUB_RUN_ID || '') && /^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT || ''), 'Canary run identity is required.');
  const value = { schemaVersion: 1, packageName: '@openai/codex', version: metadata.version, integrity,
    coreSha: env.GITHUB_SHA, safeContractDigest, runId: String(env.GITHUB_RUN_ID), runAttempt: String(env.GITHUB_RUN_ATTEMPT) };
  return Object.freeze({ ...value, identityDigest: digest(value) });
}
function validateIdentity(value, env) {
  const expected = freezeIdentity({ version: value?.version, dist: { integrity: value?.integrity } }, {
    GITHUB_SHA: value?.coreSha, GITHUB_RUN_ID: value?.runId, GITHUB_RUN_ATTEMPT: value?.runAttempt
  }, value?.safeContractDigest);
  requireValue(JSON.stringify(value) === JSON.stringify(expected), 'Frozen canary identity is invalid or has drifted.');
  if (env) {
    requireValue(value.coreSha === env.GITHUB_SHA && value.runId === String(env.GITHUB_RUN_ID) && value.runAttempt === String(env.GITHUB_RUN_ATTEMPT),
      'Canary evidence belongs to another Core/run/attempt; rerun the complete qualification workflow.');
  }
  return expected;
}
function cliVersion(raw) {
  requireValue(typeof raw === 'string' && raw.length <= 512, 'Invalid Codex CLI version output.');
  const matches = raw.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/g) || [];
  requireValue(matches.length === 1 && VERSION.test(matches[0]), 'Ambiguous Codex CLI version output.');
  return matches[0];
}
function stageReceipt(identity, stage, report) {
  validateIdentity(identity);
  requireValue(STAGES.includes(stage), 'Unknown canary stage.');
  requireValue(report?.ok === true, `${stage} did not succeed.`);
  requireValue(report.safeContractDigest === identity.safeContractDigest, `${stage} Safe Contract mismatch.`);
  const rawVersion = report.codexVersion || report.version;
  requireValue(cliVersion(rawVersion) === identity.version, `${stage} CLI version mismatch.`);
  if (stage === 'behavioral-Linux') {
    requireValue(report.status === 0 && report.filesystemWriteBlocked === true && report.loopbackNetworkBlocked === true,
      'Behavioral canary requires successful execution as well as negative escape checks.');
  }
  if (stage === 'quality-Linux') {
    requireValue(report.cases === 4 && Array.isArray(report.failures) && report.failures.length === 0, 'Quality canary result is incomplete.');
  }
  const value = { schemaVersion: 1, stage, identityDigest: identity.identityDigest, coreSha: identity.coreSha,
    runId: identity.runId, runAttempt: identity.runAttempt, codexCliVersion: identity.version,
    safeContractDigest: identity.safeContractDigest, reportDigest: digest(report), result: 'pass' };
  return Object.freeze({ ...value, receiptDigest: digest(value) });
}
function verifyStages(identity, entries) {
  validateIdentity(identity);
  requireValue(Array.isArray(entries) && entries.length === STAGES.length, 'Exactly five successful canary stages are required.');
  const seen = new Set();
  for (const entry of entries) {
    requireValue(!seen.has(entry?.receipt?.stage), 'Duplicate canary stage.');
    const expected = stageReceipt(identity, entry?.receipt?.stage, entry?.report);
    requireValue(JSON.stringify(expected) === JSON.stringify(entry.receipt), 'Canary stage receipt/report binding mismatch.');
    seen.add(expected.stage);
  }
  requireValue(STAGES.every(stage => seen.has(stage)), 'A required canary stage is missing.');
  return STAGES.map(stage => entries.find(entry => entry.receipt.stage === stage).receipt);
}
function collectStages(dir) {
  const entries = [];
  function visit(current, depth) {
    requireValue(depth <= 2, 'Canary artifact directory is too deep.');
    const names = fs.readdirSync(current);
    requireValue(names.length <= 32, 'Too many canary artifact files.');
    for (const name of names) {
      const file = path.join(current, name), stat = fs.lstatSync(file);
      requireValue(!stat.isSymbolicLink(), 'Canary artifacts must not contain symlinks.');
      if (stat.isDirectory()) { visit(file, depth + 1); continue; }
      if (name.endsWith('.receipt.json')) {
        const receipt = readJson(file), report = readJson(file.replace(/\.receipt\.json$/, '.report.json'));
        entries.push({ receipt, report });
      }
    }
  }
  visit(dir, 0);
  return entries;
}
async function run(command, args, timeoutMs = 120000) {
  const { createProcessRunner } = require('../process-runner');
  const runner = createProcessRunner((_zh, en) => en);
  const result = await runner.runPreparedProcess(command, args, { timeoutMs, maxStdoutBytes: 2 * 1024 * 1024, maxStderrBytes: 256 * 1024 });
  return String(result.stdout || '').trim();
}
async function installedVersion() {
  const { createProcessRunner } = require('../process-runner');
  const { createCodexCli } = require('../codex-cli');
  const runner = createProcessRunner((_zh, en) => en);
  return (await createCodexCli({ runPreparedProcess: runner.runPreparedProcess }).resolveCodexExecutable('codex')).version;
}
async function installFrozen(identity) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-canary-package-'));
  try {
    const packed = JSON.parse(await run(npm, ['pack', `@openai/codex@${identity.version}`, '--json', '--ignore-scripts', '--registry=https://registry.npmjs.org', '--pack-destination', dir]));
    requireValue(packed.length === 1 && /^[A-Za-z0-9._-]+\.tgz$/.test(packed[0].filename || ''), 'Unexpected Codex package archive.');
    const archive = path.join(dir, packed[0].filename), stat = fs.lstatSync(archive);
    requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 128 * 1024 * 1024, 'Invalid Codex package archive.');
    const integrity = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(archive)).digest('base64');
    requireValue(integrity === identity.integrity, 'Downloaded Codex package differs from the frozen distribution.');
    await run(npm, ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', archive]);
    requireValue(cliVersion(await installedVersion()) === identity.version, 'Installed CLI differs from the frozen package version.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
async function main() {
  const command = process.argv[2];
  const { SAFE_CONTRACT_DIGEST } = require('../safe-contract');
  if (command === 'resolve') {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const metadata = JSON.parse(await run(npm, ['view', '@openai/codex@latest', 'version', 'dist.integrity', '--json', '--registry=https://registry.npmjs.org']));
    const identity = freezeIdentity(metadata, process.env, SAFE_CONTRACT_DIGEST);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `identity=${JSON.stringify(identity)}\n`);
    process.stdout.write(`Frozen Codex ${identity.version} (${identity.identityDigest})\n`);
    return;
  }
  const identity = validateIdentity(JSON.parse(process.env.CODEX_CANARY_IDENTITY || '{}'), process.env);
  requireValue(identity.safeContractDigest === SAFE_CONTRACT_DIGEST, 'Current Safe Contract differs from frozen input.');
  if (command === 'install') return installFrozen(identity);
  if (command === 'stage') {
    const stage = process.argv[3], report = readJson(process.argv[4]), receipt = stageReceipt(identity, stage, report);
    const dir = path.resolve(process.argv[5] || 'evidence');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${stage}.report.json`), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, `${stage}.receipt.json`), JSON.stringify(receipt, null, 2) + '\n');
    return;
  }
  throw new Error('Expected resolve, install, or stage.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { STAGES, freezeIdentity, validateIdentity, cliVersion, stageReceipt, verifyStages, collectStages };
