'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { createProcessRunner } = require('../process-runner');
const { createGitRepository, assertSafeGitToken } = require('../git-repository');

function gitSync(root, args) {
  return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-safe-core-git-'));
  gitSync(root, ['init']);
  gitSync(root, ['config', 'user.email', 'test@example.invalid']);
  gitSync(root, ['config', 'user.name', 'Codex Safe Core Test']);
  return root;
}

const runner = createProcessRunner((_zh, en) => en);
const repo = createGitRepository({
  runProcess: runner.runPreparedProcess,
  runProcessBuffer: runner.runProcessBuffer
});

test('safe Git token validation rejects option injection and controls', () => {
  assert.equal(assertSafeGitToken('HEAD'), 'HEAD');
  assert.equal(assertSafeGitToken('origin/main'), 'origin/main');
  assert.throws(() => assertSafeGitToken('-n'), /invalid/);
  assert.throws(() => assertSafeGitToken('main\nHEAD'), /invalid/);
  assert.throws(() => assertSafeGitToken(''), /invalid/);
});

test('repository snapshots track unborn HEAD, index, and staged diff', async () => {
  const root = createRepo();
  try {
    assert.equal(await repo.getHeadOid(root), '<unborn>');
    fs.writeFileSync(path.join(root, 'a.txt'), 'one\n');
    gitSync(root, ['add', 'a.txt']);
    const first = await repo.getRepositorySnapshot(root);
    assert.match(first.indexFingerprint, /^[0-9a-f]{64}$/);
    assert.match(await repo.getStagedDiff(root), /\+one/);
    assert.deepEqual(await repo.getStagedPaths(root), ['a.txt']);

    gitSync(root, ['commit', '-m', 'feat: initial']);
    const head = await repo.getHeadOid(root);
    assert.match(head, /^[0-9a-f]{40,64}$/);
    const second = await repo.getRepositorySnapshot(root);
    assert.equal(repo.repositorySnapshotsEqual(first, second), false);

    fs.writeFileSync(path.join(root, 'a.txt'), 'two\n');
    gitSync(root, ['add', 'a.txt']);
    assert.equal(await repo.hasUnmergedEntries(root), false);
    assert.match(repo.fingerprintDiff(await repo.getStagedDiff(root)), /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('branch range helpers reject unsafe refs before invoking Git', async () => {
  const root = createRepo();
  try {
    await assert.rejects(repo.getChangedPaths(root, '-bad', 'HEAD'), /base ref is invalid/);
    await assert.rejects(repo.getBranchDiff(root, 'HEAD', '-bad'), /head ref is invalid/);
    await assert.rejects(repo.getRecentCommitSubjects(root, 5, '-bad'), /history ref is invalid/);
    await assert.rejects(repo.getRemoteUrl(root, '-bad'), /remote name is invalid/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
