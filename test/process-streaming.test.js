'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProcessRunner } = require('../process-runner');

test('process runner streams stdout while retaining only configured tail', async () => {
  const runner = createProcessRunner();
  const chunks = [];
  const script = "process.stdout.write('a'.repeat(4096)); process.stdout.write('END\\n')";
  const result = await runner.runProcess(process.execPath, ['-e', script], {
    maxStdoutBytes: 8192,
    maxCapturedStdoutBytes: 64,
    onStdoutChunk: chunk => chunks.push(Buffer.from(chunk))
  });
  const streamed = Buffer.concat(chunks).toString('utf8');
  assert.equal(streamed.length, 4100);
  assert.match(streamed, /END\n$/);
  assert.equal(result.stdoutTruncated, true);
  assert.ok(Buffer.byteLength(result.stdout, 'utf8') <= 64);
});

test('stream consumer failure terminates child fail closed', async () => {
  const runner = createProcessRunner();
  await assert.rejects(
    runner.runProcess(process.execPath, ['-e', "setInterval(()=>process.stdout.write('x'),1)"], {
      timeoutMs: 5000,
      maxStdoutBytes: 8192,
      maxCapturedStdoutBytes: 64,
      onStdoutChunk: () => { throw new Error('parser failed'); }
    }),
    error => error?.code === 'EOUTPUTPARSE' && error?.cause?.message === 'parser failed'
  );
});
