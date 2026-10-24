'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCodexJsonlAccumulator } = require('../codex-jsonl-stream');

test('incrementally parses split JSONL events and retains only semantic state', () => {
  const parser = createCodexJsonlAccumulator();
  parser.push('{"type":"item.completed","item":{"type":"agent_message","text":"{\\"ok\\":');
  parser.push('true}"}}\n{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":2}}\n');
  const result = parser.finish();
  assert.equal(result.agentMessage, '{"ok":true}');
  assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 2 });
  assert.equal(result.events, 2);
});

test('later agent message supersedes earlier intermediate message', () => {
  const parser = createCodexJsonlAccumulator();
  parser.push('{"type":"item.completed","item":{"type":"agent_message","text":"first"}}\n');
  parser.push('{"type":"item.completed","item":{"type":"agent_message","text":"final"}}\n');
  parser.push('{"type":"turn.completed"}\n');
  assert.equal(parser.finish().agentMessage, 'final');
});

test('turn failures are surfaced when no final agent message exists', () => {
  const parser = createCodexJsonlAccumulator();
  parser.push('{"type":"turn.failed","error":{"message":"provider failed"}}\n');
  assert.throws(() => parser.finish(), error => error?.code === 'ECODEXTURN' && /provider failed/.test(error.message));
});

test('malformed retained JSONL fails closed', () => {
  const parser = createCodexJsonlAccumulator();
  assert.throws(() => parser.push('not-json\n'), error => error?.code === 'ECODEXOUTPUT');
});

test('single JSONL line is bounded independently of transcript length', () => {
  const parser = createCodexJsonlAccumulator({ maxLineBytes: 1024 });
  assert.throws(() => parser.push('x'.repeat(2048)), error => error?.code === 'ECODEXOUTPUT');
});

const message = text => ({ type: 'item.completed', item: { type: 'agent_message', text } });
const complete = { type: 'turn.completed', usage: { input_tokens: 3, output_tokens: 2 } };
const jsonl = values => values.map(value => JSON.stringify(value)).join('\n') + '\n';
const parse = values => { const parser = createCodexJsonlAccumulator(); parser.push(jsonl(values)); return parser.finish(); };

test('preserves Chinese paths and emoji at every UTF-8 byte boundary', () => {
  const expected = '{"message":"修复中文路径🐱","path":"源码/驱动.c"}';
  const bytes = Buffer.from(jsonl([message(expected), complete]));
  for (let offset = 0; offset <= bytes.length; offset++) {
    const parser = createCodexJsonlAccumulator();
    parser.push(bytes.subarray(0, offset));
    parser.push(bytes.subarray(offset));
    assert.equal(parser.finish().agentMessage, expected, `split ${offset}`);
  }
  const parser = createCodexJsonlAccumulator();
  for (const byte of bytes) parser.push(Buffer.from([byte]));
  assert.equal(parser.finish().agentMessage, expected);
});

test('random bounded Buffer chunks match one-shot parsing', () => {
  const bytes = Buffer.from(jsonl([message('早期'), message('最终🐱é𝄞'), complete]));
  let seed = 19;
  for (let round = 0; round < 64; round++) {
    const parser = createCodexJsonlAccumulator();
    for (let offset = 0; offset < bytes.length;) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const end = Math.min(bytes.length, offset + 1 + seed % 23);
      parser.push(bytes.subarray(offset, end)); offset = end;
    }
    assert.equal(parser.finish().agentMessage, '最终🐱é𝄞');
  }
});

test('terminal failure rejects an earlier valid model message', () => {
  assert.throws(() => parse([message('{"ok":true}'), { type: 'turn.failed', error: { message: 'failed after message' } }]),
    error => error.code === 'ECODEXTURN');
});

test('failure cannot be overwritten by a later completion or new turn', () => {
  assert.throws(() => parse([{ type: 'turn.failed' }, { type: 'turn.started' }, message('stale'), complete]),
    error => error.code === 'ECODEXTURN');
});

test('missing success terminal rejects otherwise valid JSON model text', () => {
  assert.throws(() => parse([message('{"ok":true}')]), error => error.code === 'ECODEXOUTPUT');
});

test('completion without a final message is not success', () => {
  assert.throws(() => parse([complete]), error => error.code === 'ECODEXOUTPUT');
});

test('new turn clears stale message and requires a new successful terminal', () => {
  for (const suffix of [[{ type: 'turn.started' }], [{ type: 'turn.started' }, complete]]) {
    assert.throws(() => parse([message('old'), complete, ...suffix]), error => error.code === 'ECODEXOUTPUT');
  }
  assert.equal(parse([message('old'), complete, { type: 'turn.started' }, message('new'), complete]).agentMessage, 'new');
});

test('message after completion and duplicate completion fail closed', () => {
  assert.throws(() => parse([message('old'), complete, message('new')]), error => error.code === 'ECODEXOUTPUT');
  assert.throws(() => parse([message('old'), complete, complete]), error => error.code === 'ECODEXOUTPUT');
});

test('recoverable diagnostic may succeed only with explicit completion', () => {
  const diagnostic = { type: 'error', message: 'retrying transient connection' };
  assert.equal(parse([diagnostic, message('ok'), complete]).agentMessage, 'ok');
  assert.throws(() => parse([diagnostic, message('ok')]), error => error.code === 'ECODEXTURN');
});

test('invalid or incomplete UTF-8 cannot silently corrupt valid JSON', () => {
  const parser = createCodexJsonlAccumulator();
  assert.throws(() => parser.push(Buffer.from([0xff])), error => error.code === 'ECODEXOUTPUT');
  assert.throws(() => parser.finish(), error => error.code === 'ECODEXOUTPUT');
  const truncated = createCodexJsonlAccumulator();
  truncated.push(Buffer.from([0xe4, 0xb8]));
  assert.equal(truncated.snapshot().pendingBytes, 2);
  assert.throws(() => truncated.finish(), error => error.code === 'ECODEXOUTPUT');
});

test('unfinished suffix is bounded even when the chunk contains a newline', () => {
  const parser = createCodexJsonlAccumulator({ maxLineBytes: 1024 });
  assert.throws(() => parser.push(jsonl([{ type: 'turn.started' }]) + 'x'.repeat(2048)), error => error.code === 'ECODEXOUTPUT');
});

test('malformed event cannot be bypassed by catching push and supplying good output', () => {
  const parser = createCodexJsonlAccumulator();
  assert.throws(() => parser.push('not-json\n'), error => error.code === 'ECODEXOUTPUT');
  assert.throws(() => parser.push(jsonl([message('ok'), complete])), error => error.code === 'ECODEXOUTPUT');
});

test('supports CRLF, no trailing newline, and idempotent finish', () => {
  const parser = createCodexJsonlAccumulator();
  parser.push(jsonl([message('ok'), complete]).trimEnd().replace(/\n/g, '\r\n'));
  const result = parser.finish();
  assert.equal(result.agentMessage, 'ok');
  assert.equal(parser.finish(), result);
  assert.throws(() => parser.push('\n'), error => error.code === 'ECODEXOUTPUT');
});

test('diagnostics remain bounded independently of transcript length', () => {
  const parser = createCodexJsonlAccumulator();
  for (let i = 0; i < 100; i++) parser.push(jsonl([{ type: 'error', message: 'e'.repeat(4096) }]));
  parser.push(jsonl([message('ok'), complete]));
  assert.equal(parser.finish().errors.length, 16);
  assert.ok(parser.finish().errors.every(error => error.length <= 1024));
});

test('error after successful terminal cannot inherit prior success', () => {
  assert.throws(() => parse([message('old'), complete, { type: 'error', message: 'late failure' }]), error => error.code === 'ECODEXTURN');
});
