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
