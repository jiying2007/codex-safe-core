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

test('timeouts terminate the process', async () => {
  await assert.rejects(
    runner.runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { timeoutMs: 50 }),
    error => error?.code === 'ETIMEDOUT'
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
});
