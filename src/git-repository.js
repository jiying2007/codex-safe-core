'use strict';

const crypto = require('crypto');
const path = require('path');

function createGitRepository({ runProcess, runProcessBuffer, ui = (_zh, en) => en }) {
  if (typeof runProcess !== 'function' || typeof runProcessBuffer !== 'function') throw new TypeError('createGitRepository requires process runners.');
  const git = async (args, cwd, token, options = {}) => runProcess('git', args, { cwd, timeoutMs: 15000, ...options }, '', token);
  function normalizeFsPath(value) { const resolved = path.resolve(value); return process.platform === 'win32' ? resolved.toLowerCase() : resolved; }
  async function getHeadOid(repoRoot, token) {
    try { const { stdout } = await git(['rev-parse','--verify','--quiet','HEAD'], repoRoot, token); const oid = stdout.trim(); if (!/^[0-9a-f]{40,64}$/i.test(oid)) throw new Error(ui('Git HEAD 返回了无效 object id。','Git HEAD returned an invalid object id.')); return oid; }
    catch (error) { const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.toString('utf8') : String(error?.stderr || ''); if (error?.code === 1 && !stderr.trim()) return '<unborn>'; throw error; }
  }
  async function getIndexFingerprint(repoRoot, token) { const { stdout } = await runProcessBuffer('git',['ls-files','--stage','-z'],{cwd:repoRoot,timeoutMs:15000,maxStdoutBytes:16*1024*1024,maxStderrBytes:256*1024},token); return crypto.createHash('sha256').update(stdout).digest('hex'); }
  async function getRepositorySnapshot(repoRoot, token) { const [headOid,indexFingerprint] = await Promise.all([getHeadOid(repoRoot,token),getIndexFingerprint(repoRoot,token)]); return Object.freeze({headOid,indexFingerprint}); }
  function repositorySnapshotsEqual(a,b) { return Boolean(a && b && a.headOid === b.headOid && a.indexFingerprint === b.indexFingerprint); }
  async function getStagedDiff(repoRoot, token, unified = 3) { return (await git(['diff','--cached','--no-ext-diff','--no-textconv',`--unified=${unified}`],repoRoot,token,{maxStdoutBytes:32*1024*1024})).stdout; }
  async function getStagedPaths(repoRoot, token) { const { stdout } = await git(['diff','--cached','--name-only','--diff-filter=ACMRDTUXB','-z'],repoRoot,token); return stdout.split('\0').filter(Boolean); }
  async function getChangedPaths(repoRoot, base, head = 'HEAD', token) { const { stdout } = await git(['diff','--name-only','--diff-filter=ACMRDTUXB','-z',`${base}...${head}`],repoRoot,token); return stdout.split('\0').filter(Boolean); }
  async function getBranchDiff(repoRoot, base, head = 'HEAD', token, unified = 3) { return (await git(['diff','--no-ext-diff','--no-textconv',`--unified=${unified}`,`${base}...${head}`],repoRoot,token,{maxStdoutBytes:64*1024*1024})).stdout; }
  async function hasUnmergedEntries(repoRoot, token) { return (await git(['ls-files','-u','-z'],repoRoot,token)).stdout.length > 0; }
  async function getCurrentBranch(repoRoot, token) { return (await git(['branch','--show-current'],repoRoot,token)).stdout.trim(); }
  async function getRemoteUrl(repoRoot, remote = 'origin', token) { return (await git(['remote','get-url',remote],repoRoot,token)).stdout.trim(); }
  async function getRecentCommitSubjects(repoRoot, limit = 12, ref = 'HEAD', token) { const bounded = Math.max(0,Math.min(100,Number(limit)||0)); if (!bounded) return []; const { stdout } = await git(['log','--no-merges','-n',String(bounded),'--format=%s%x00',ref,'--'],repoRoot,token); return stdout.split('\0').map(v=>v.trim()).filter(Boolean).slice(0,bounded); }
  async function fingerprintDiff(diff) { return crypto.createHash('sha256').update(String(diff || ''),'utf8').digest('hex'); }
  return Object.freeze({ git, normalizeFsPath, getHeadOid, getIndexFingerprint, getRepositorySnapshot, repositorySnapshotsEqual, getStagedDiff, getStagedPaths, getChangedPaths, getBranchDiff, hasUnmergedEntries, getCurrentBranch, getRemoteUrl, getRecentCommitSubjects, fingerprintDiff });
}
module.exports = { createGitRepository };
