'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProcessRunner } = require('../process-runner');

const runner = createProcessRunner((_zh, en) => en);

function cancellationToken() {
  const listeners = new Set();
  const token = {
    isCancellationRequested: false,
    onCancellationRequested(listener) {
      listeners.add(listener);
      return { dispose() { listeners.delete(listener); } };
    }
  };
  return {
    token,
    cancel() {
      token.isCancellationRequested = true;
      for (const listener of [...listeners]) listener();
    }
  };
}

test('text and buffer execution share successful semantics', async () => {
  const text = await runner.runPreparedProcess(process.execPath, ['-e', 'process.stdout.write("ok");process.stderr.write("warn")'], { timeoutMs: 5000 });
  assert.deepEqual(text, { stdout: 'ok', stderr: 'warn' });
  const buffer = await runner.runProcessBuffer(process.execPath, ['-e', 'process.stdout.write(Buffer.from([0,1,2,255]))'], { timeoutMs: 5000 });
  assert.deepEqual([...buffer.stdout], [0, 1, 2, 255]);
  assert.equal(buffer.stderr.length, 0);
});

test('shell execution is forbidden', async () => {
  await assert.rejects(
    runner.runProcess(process.execPath, ['-e', '0'], { shell: true }),
    error => error?.code === 'ESHELLFORBIDDEN'
  );
});

test('stdout limits fail closed', async () => {
  await assert.rejects(
    runner.runProcess(process.execPath, ['-e', 'process.stdout.write("12345")'], { timeoutMs: 5000, maxStdoutBytes: 4 }),
    error => error?.code === 'EOUTPUTLIMIT'
  );
});

test('bounded stdout capture retains only the tail while enforcing a larger total-output limit', async () => {
  const result = await runner.runProcess(
    process.execPath,
    ['-e', 'process.stdout.write("0123456789")'],
    { timeoutMs: 5000, maxStdoutBytes: 64, maxCapturedStdoutBytes: 4 }
  );
  assert.equal(result.stdout, '6789');
  assert.equal(result.stderr, '');
  assert.equal(result.stdoutBytes, 10);
  assert.equal(result.stdoutTruncated, true);
});

test('bounded stdout capture still fails closed on the total-output limit', async () => {
  await assert.rejects(
    runner.runProcess(
      process.execPath,
      ['-e', 'process.stdout.write("0123456789")'],
      { timeoutMs: 5000, maxStdoutBytes: 8, maxCapturedStdoutBytes: 4 }
    ),
    error => error?.code === 'EOUTPUTLIMIT'
      && error.stdoutBytes === 10
  );
});

test('timeouts terminate the process and preserve bounded diagnostics', async () => {
  await assert.rejects(
    runner.runProcess(
      process.execPath,
      ['-e', 'process.stdout.write("partial-out");process.stderr.write("partial-err");setTimeout(() => {}, 10000)'],
      // Leave enough time for a fresh Node child to start and flush both streams.
      // The assertion below verifies diagnostic preservation, not startup latency.
      { timeoutMs: 250 }
    ),
    error => error?.code === 'ETIMEDOUT'
      && error.stdoutTail.includes('partial-out')
      && error.stderrTail.includes('partial-err')
      && Number.isFinite(error.elapsedMs)
      && Number.isFinite(error.lastActivityMs)
  );
});

test('cancellation terminates the process', async () => {
  const source = cancellationToken();
  const promise = runner.runProcess(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 10000)'],
    { timeoutMs: 5000 },
    '',
    source.token
  );
  setTimeout(() => source.cancel(), 30);
  await assert.rejects(promise, error => error?.code === 'ECANCELLED');
});

test('command and limits are validated before spawn', async () => {
  await assert.rejects(runner.runPreparedProcess('bad\ncommand', []), TypeError);
  assert.throws(
    () => runner.runProcess(process.execPath, ['-e', '0'], { maxStdoutBytes: -1 }),
    RangeError
  );
  assert.throws(
    () => runner.runProcess(process.execPath, ['-e', '0'], { maxCapturedStdoutBytes: -1 }),
    RangeError
  );
});
