'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCodexCli, parseCodexJsonl } = require('../codex-cli');
const { REQUIRED_CODEX_TOP_LEVEL_FLAGS, REQUIRED_CODEX_EXEC_FLAGS } = require('../safe-contract');

function createRunner({ missingExec = false, finalText = '{"ok":true}', failExec = null } = {}) {
  const calls = [];
  const runPreparedProcess = async (command, args, options, stdinText) => {
    calls.push({ command, args, options, stdinText });
    if (args.length === 1 && args[0] === '--version') return { stdout: 'codex-cli 9.9.9\n', stderr: '' };
    if (args.length === 1 && args[0] === '--help') return { stdout: REQUIRED_CODEX_TOP_LEVEL_FLAGS.join(' '), stderr: '' };
    if (args.length === 2 && args[0] === 'exec' && args[1] === '--help') {
      const flags = missingExec ? REQUIRED_CODEX_EXEC_FLAGS.filter(flag => flag !== '--output-schema') : REQUIRED_CODEX_EXEC_FLAGS;
      return { stdout: [...flags, '--model'].join(' '), stderr: '' };
    }
    if (args.includes('exec')) {
      if (failExec) throw failExec;
      return {
        stdout: [
          JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 30, output_tokens: 20, reasoning_output_tokens: 7 } }),
          JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: finalText } })
        ].join('\n') + '\n',
        stderr: ''
      };
    }
    throw new Error(`unexpected call: ${command} ${args.join(' ')}`);
  };
  return { runPreparedProcess, calls };
}

test('JSONL parser returns the last agent message and rejects malformed output', () => {
  const stdout = [
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'first' } }),
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'second' } })
  ].join('\n');
  assert.equal(parseCodexJsonl(stdout), 'second');
  assert.throws(() => parseCodexJsonl('{bad'), error => error?.code === 'ECODEXOUTPUT');
  assert.throws(
    () => parseCodexJsonl(JSON.stringify({ type: 'turn.failed', error: { message: 'boom' } })),
    error => error?.code === 'ECODEXTURN'
  );
});

test('capability probing is fail closed and cached', async () => {
  const good = createRunner();
  const cache = new Map();
  const cli = createCodexCli({ runPreparedProcess: good.runPreparedProcess, capabilityCache: cache });
  const resolved = await cli.resolveCodexExecutable('codex');
  const first = await cli.probeCodexCapabilities(resolved, 'gpt-test');
  const callCount = good.calls.length;
  const second = await cli.probeCodexCapabilities(resolved, 'gpt-test');
  assert.equal(first.capabilitiesVerified, true);
  assert.deepEqual(second, first);
  assert.equal(good.calls.length, callCount);

  const bad = createRunner({ missingExec: true });
  const badCli = createCodexCli({ runPreparedProcess: bad.runPreparedProcess });
  await assert.rejects(
    badCli.probeCodexCapabilities({ executable: 'codex', version: 'old' }),
    error => error?.code === 'ECODEXCAPABILITY' && error.missingFlags.some(flag => flag.includes('--output-schema'))
  );
});

test('structured execution returns usage, request estimate, and duration', async () => {
  const fake = createRunner();
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess, tempPrefix: 'codex-safe-core-test-' });
  const result = await cli.runStructuredCodex({
    codexPath: 'codex',
    model: '',
    timeoutMs: 1000,
    schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    input: 'untrusted input',
    estimatedOutputTokens: 100
  });
  assert.deepEqual(result.parsed, { ok: true });
  assert.equal(result.usage.inputTokens, 100);
  assert.equal(result.usage.cachedInputTokens, 30);
  assert.equal(result.usage.outputTokens, 20);
  assert.ok(result.requestEstimate.totalTokens >= 100);
  assert.ok(result.durationMs >= 0);
  const exec = fake.calls.find(call => call.args.includes('exec') && call.args.includes('--output-schema'));
  assert.ok(exec);
  assert.equal(exec.stdinText, 'untrusted input');
  assert.ok(exec.options.cwd);
  assert.ok(exec.args.indexOf('--ask-for-approval') < exec.args.indexOf('exec'));
});

test('structured execution rejects over-budget input before probing or executing Codex', async () => {
  const fake = createRunner();
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  await assert.rejects(
    cli.runStructuredCodex({
      codexPath: 'codex',
      schema: { type: 'object' },
      input: 'x'.repeat(4000),
      maxEstimatedTokens: 100,
      estimatedOutputTokens: 100
    }),
    error => error?.code === 'ETOKENBUDGET'
  );
  assert.equal(fake.calls.length, 0);
});

test('CLI argument rejection is classified as version incompatibility', async () => {
  const error = Object.assign(new Error('unexpected argument'), { stderr: 'error: unexpected argument --ignore-rules' });
  const fake = createRunner({ failExec: error });
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  await assert.rejects(
    cli.runStructuredCodex({ codexPath: 'codex', schema: { type: 'object' }, input: 'x' }),
    value => value?.code === 'ECODEXVERSION'
  );
});
