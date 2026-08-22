'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProcessRunner } = require('../process-runner');

function cancellationToken() {
  let listener = null;
  return {
    token: {
      isCancellationRequested: false,
      onCancellationRequested(fn) {
        listener = fn;
        return { dispose() { listener = null; } };
      }
    },
    cancel() {
      this.token.isCancellationRequested = true;
      listener?.();
    }
  };
}

const runner = createProcessRunner((_zh, en) => en);

test('text and buffer execution share successful semantics', async () => {
  const text = await runner.runProcess(process.execPath, ['-e', 'process.stdout.write("ok")']);
  assert.equal(text.stdout, 'ok');
  const buffer = await runner.runProcessBuffer(process.execPath, ['-e', 'process.stdout.write("ok")']);
  assert.ok(Buffer.isBuffer(buffer.stdout));
  assert.equal(buffer.stdout.toString('utf8'), 'ok');
});

test('shell execution is forbidden', async () => {
  await assert.rejects(
    runner.runProcess(process.execPath, ['-e', '0'], { shell: true }),
    error => error?.code === 'ESHELLFORBIDDEN'
  );
});

test('stdout limits fail closed', async () => {
  await assert.rejects(
    runner.runProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(2048))'], { maxStdoutBytes: 128 }),
    error => error?.code === 'EOUTPUTLIMIT'
  );
  await assert.rejects(
    runner.runProcessBuffer(process.execPath, ['-e', 'process.stdout.write("x".repeat(2048))'], { maxStdoutBytes: 128 }),
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
  await assert.rejects(
    runner.runProcess(process.execPath, ['-e', '0'], { maxStdoutBytes: -1 }),
    RangeError
  );
});
