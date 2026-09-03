'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_CODEX_STDOUT_CAPTURE_LIMIT,
  DEFAULT_CODEX_TRANSCRIPT_LIMIT,
  createCodexCli,
  parseCodexJsonl
} = require('../codex-cli');
const { REQUIRED_CODEX_TOP_LEVEL_FLAGS, REQUIRED_CODEX_EXEC_FLAGS } = require('../safe-contract');

function createRunner({
  missingExec = false,
  finalText = '{"ok":true}',
  failExec = null,
  execStdoutPrefix = '',
  execMetadata = {}
} = {}) {
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
        stdout: execStdoutPrefix + [
          JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 30, output_tokens: 20, reasoning_output_tokens: 7 } }),
          JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: finalText } })
        ].join('\n') + '\n',
        stderr: '',
        ...execMetadata
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

test('JSONL parser can ignore only a truncated leading fragment', () => {
  const final = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"ok":true}' } });
  assert.equal(parseCodexJsonl(`partial-json-fragment\n${final}\n`, { allowLeadingPartial: true }), '{"ok":true}');
  assert.throws(
    () => parseCodexJsonl(`partial-json-fragment\n${final}\n`),
    error => error?.code === 'ECODEXOUTPUT'
  );
  assert.throws(
    () => parseCodexJsonl(`${final}\npartial-json-fragment\n`, { allowLeadingPartial: true }),
    error => error?.code === 'ECODEXOUTPUT'
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

test('structured execution returns usage, request estimate, provider metadata, and duration', async () => {
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
  assert.equal(result.provider.mode, 'openai');
  assert.ok(result.requestEstimate.totalTokens >= 100);
  assert.ok(result.durationMs >= 0);
  const exec = fake.calls.find(call => call.args.includes('exec') && call.args.includes('--output-schema'));
  assert.ok(exec);
  assert.equal(exec.stdinText, 'untrusted input');
  assert.ok(exec.options.cwd);
  assert.ok(exec.args.indexOf('--ask-for-approval') < exec.args.indexOf('exec'));
  assert.equal(exec.options.maxStdoutBytes, DEFAULT_CODEX_TRANSCRIPT_LIMIT);
  assert.equal(exec.options.maxCapturedStdoutBytes, DEFAULT_CODEX_STDOUT_CAPTURE_LIMIT);
});

test('structured execution accepts a long transcript from bounded tail capture', async () => {
  const fake = createRunner({
    execStdoutPrefix: 'partial-json-fragment\n',
    execMetadata: { stdoutTruncated: true, stdoutBytes: 8 * 1024 * 1024 }
  });
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  const result = await cli.runStructuredCodex({
    codexPath: 'codex',
    schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    input: 'x',
    maxStdoutBytes: 1024 * 1024,
    maxTranscriptBytes: 12 * 1024 * 1024
  });
  assert.deepEqual(result.parsed, { ok: true });
  assert.equal(result.usage.inputTokens, 100);
  const exec = fake.calls.find(call => call.args.includes('exec') && call.args.includes('--output-schema'));
  assert.equal(exec.options.maxStdoutBytes, 12 * 1024 * 1024);
  assert.equal(exec.options.maxCapturedStdoutBytes, 1024 * 1024);
});

test('structured execution injects a safe HTTP-only compatible provider before stdin marker', async () => {
  const fake = createRunner();
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  const result = await cli.runStructuredCodex({
    codexPath: 'codex',
    runtime: {
      provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'RELAY_API_KEY' },
      timeouts: { requestMs: 120000, operationMs: 300000 }
    },
    processOptions: { env: { RELAY_API_KEY: 'secret' } },
    schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    input: 'x'
  });
  const exec = fake.calls.find(call => call.args.includes('exec') && call.args.includes('--output-schema'));
  assert.equal(exec.args.at(-1), '-');
  assert.ok(exec.args.includes('model_provider="codex_safe_compatible"'));
  assert.ok(exec.args.includes('model_providers.codex_safe_compatible.supports_websockets=false'));
  assert.ok(exec.args.includes('model_providers.codex_safe_compatible.wire_api="responses"'));
  assert.equal(exec.options.timeoutMs, 120000);
  assert.equal(exec.options.env.RELAY_API_KEY, 'secret');
  assert.equal(result.provider.credentialSource, 'env');
  assert.ok(!exec.args.join(' ').includes('secret'));
});

test('structured execution reads auth.json and injects only the selected provider env variable', async () => {
  const fake = createRunner();
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-cli-auth-'));
  try {
    fs.writeFileSync(path.join(root, 'auth.json'), JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'auth-secret' }), { mode: 0o600 });
    const result = await cli.runStructuredCodex({
      codexPath: 'codex',
      runtime: {
        provider: {
          mode: 'openai-compatible',
          baseUrl: 'http://192.168.2.109:3000/v1',
          apiKeyEnv: 'RELAY_API_KEY',
          credentialSource: 'auth-json',
          allowInsecureHttp: true
        }
      },
      processOptions: { env: { CODEX_HOME: root } },
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] },
      input: 'x'
    });
    const exec = fake.calls.find(call => call.args.includes('exec') && call.args.includes('--output-schema'));
    assert.equal(exec.options.env.RELAY_API_KEY, 'auth-secret');
    assert.equal(result.provider.credentialSource, 'auth-json');
    assert.equal(result.provider.transport, 'http');
    assert.equal(result.provider.allowInsecureHttp, true);
    assert.ok(!exec.args.join(' ').includes('auth-secret'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('live runtime probe uses the same structured provider path', async () => {
  const fake = createRunner();
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  const previous = process.env.RELAY_API_KEY;
  process.env.RELAY_API_KEY = 'secret';
  try {
    const probe = await cli.probeCodexRuntime({
      codexPath: 'codex',
      runtime: {
        provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'RELAY_API_KEY' }
      }
    });
    assert.equal(probe.ok, true);
    assert.equal(probe.provider.mode, 'openai-compatible');
  } finally {
    if (previous === undefined) delete process.env.RELAY_API_KEY;
    else process.env.RELAY_API_KEY = previous;
  }
});

test('missing compatible-provider credential fails before Codex probing', async () => {
  const fake = createRunner();
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  await assert.rejects(
    cli.runStructuredCodex({
      runtime: { provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'RELAY_API_KEY', credentialSource: 'env' } },
      processOptions: { env: {} },
      schema: { type: 'object' },
      input: 'x'
    }),
    error => error?.code === 'ECODEX_CREDENTIAL'
  );
  assert.equal(fake.calls.length, 0);
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

test('provider DNS failures are classified with endpoint metadata', async () => {
  const error = Object.assign(new Error('network'), { stderr: 'failed to lookup address information: Try again' });
  const fake = createRunner({ failExec: error });
  const cli = createCodexCli({ runPreparedProcess: fake.runPreparedProcess });
  await assert.rejects(
    cli.runStructuredCodex({
      runtime: { provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'RELAY_API_KEY' } },
      processOptions: { env: { RELAY_API_KEY: 'secret' } },
      schema: { type: 'object' },
      input: 'x'
    }),
    value => value?.code === 'ECODEX_DNS' && value.provider?.endpointHost === 'relay.example.com'
  );
});
