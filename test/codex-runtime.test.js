'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCodexRuntimeOptions,
  providerConfigOverrides,
  appendProviderArgs,
  assertProviderCredential,
  providerMetadata,
  redactDiagnosticText,
  classifyCodexFailure
} = require('../codex-runtime');

test('default runtime preserves the built-in OpenAI provider', () => {
  const runtime = normalizeCodexRuntimeOptions({});
  assert.equal(runtime.provider.mode, 'openai');
  assert.deepEqual(providerConfigOverrides(runtime), []);
  assert.equal(runtime.timeouts.requestMs, 180000);
  assert.equal(runtime.timeouts.operationMs, 600000);
});

test('OpenAI-compatible provider is explicit, HTTP/SSE-only, and secret-by-reference', () => {
  const runtime = normalizeCodexRuntimeOptions({
    provider: {
      mode: 'openai-compatible',
      baseUrl: 'https://relay.example.com/v1/',
      apiKeyEnv: 'RELAY_API_KEY'
    },
    timeouts: { connectMs: 8000, requestMs: 120000, operationMs: 300000, idleMs: 45000 }
  });
  assert.equal(runtime.provider.baseUrl, 'https://relay.example.com/v1');
  assert.equal(runtime.provider.supportsWebsockets, false);
  const overrides = providerConfigOverrides(runtime);
  assert.ok(overrides.some(value => value === 'model_provider="codex_safe_compatible"'));
  assert.ok(overrides.some(value => value.includes('base_url="https://relay.example.com/v1"')));
  assert.ok(overrides.some(value => value.endsWith('env_key="RELAY_API_KEY"')));
  assert.ok(overrides.some(value => value.endsWith('wire_api="responses"')));
  assert.ok(overrides.some(value => value.endsWith('supports_websockets=false')));
  assert.ok(!overrides.join('\n').includes('secret-value'));

  const args = appendProviderArgs(['--ask-for-approval', 'never', 'exec', '--json', '-'], runtime);
  assert.equal(args.at(-1), '-');
  assert.ok(args.includes('--config'));
  assert.ok(args.indexOf('--config') < args.length - 1);
});

test('provider config rejects unsafe URLs, inline credentials, and invalid env names', () => {
  assert.throws(
    () => normalizeCodexRuntimeOptions({ provider: { mode: 'openai-compatible', baseUrl: 'http://relay.example.com/v1', apiKeyEnv: 'KEY' } }),
    error => error?.code === 'ECODEX_PROVIDER_CONFIG'
  );
  assert.throws(
    () => normalizeCodexRuntimeOptions({ provider: { mode: 'openai-compatible', baseUrl: 'https://user:pass@relay.example.com/v1', apiKeyEnv: 'KEY' } }),
    error => error?.code === 'ECODEX_PROVIDER_CONFIG'
  );
  assert.throws(
    () => normalizeCodexRuntimeOptions({ provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1?token=x', apiKeyEnv: 'KEY' } }),
    error => error?.code === 'ECODEX_PROVIDER_CONFIG'
  );
  assert.throws(
    () => normalizeCodexRuntimeOptions({ provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'BAD-NAME' } }),
    error => error?.code === 'ECODEX_PROVIDER_CONFIG'
  );
  const local = normalizeCodexRuntimeOptions({ provider: { mode: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'KEY' } });
  assert.equal(local.provider.baseUrl, 'http://localhost:11434/v1');
});

test('missing compatible-provider credential fails before Codex execution', () => {
  const runtime = {
    provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'RELAY_API_KEY' }
  };
  assert.throws(
    () => assertProviderCredential(runtime, {}),
    error => error?.code === 'ECODEX_CREDENTIAL' && error.credentialEnv === 'RELAY_API_KEY'
  );
  assert.equal(assertProviderCredential(runtime, { RELAY_API_KEY: 'secret-value' }).provider.mode, 'openai-compatible');
});

test('diagnostics classify provider failures and redact credentials', () => {
  const runtime = normalizeCodexRuntimeOptions({
    provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'RELAY_API_KEY' }
  });
  const env = { RELAY_API_KEY: 'super-secret' };
  const source = Object.assign(new Error('failed to lookup address information: Try again'), {
    stderrTail: 'Authorization: Bearer super-secret\nfailed to lookup address information: Try again'
  });
  const classified = classifyCodexFailure(source, runtime, { phase: 'hypothesis', env });
  assert.equal(classified.code, 'ECODEX_DNS');
  assert.equal(classified.provider.endpointHost, 'relay.example.com');
  assert.ok(!classified.diagnosticTail.includes('super-secret'));
  assert.match(classified.diagnosticTail, /REDACTED/);
  assert.deepEqual(providerMetadata(runtime), {
    mode: 'openai-compatible',
    endpointHost: 'relay.example.com',
    credentialEnv: 'RELAY_API_KEY',
    wireApi: 'responses',
    supportsWebsockets: false
  });
  assert.ok(!redactDiagnosticText('token=super-secret', runtime, env).includes('super-secret'));
});

test('process timeout becomes request timeout with bounded provider metadata', () => {
  const runtime = normalizeCodexRuntimeOptions({
    provider: { mode: 'openai-compatible', baseUrl: 'https://relay.example.com/v1', apiKeyEnv: 'RELAY_API_KEY' }
  });
  const source = Object.assign(new Error('Process timed out after 120 seconds'), {
    code: 'ETIMEDOUT', elapsedMs: 120000, lastActivityMs: 37000, stderrTail: 'reconnecting'
  });
  const classified = classifyCodexFailure(source, runtime, { phase: 'verification', env: { RELAY_API_KEY: 'x' } });
  assert.equal(classified.code, 'ECODEX_REQUEST_TIMEOUT');
  assert.equal(classified.elapsedMs, 120000);
  assert.equal(classified.lastActivityMs, 37000);
  assert.match(classified.message, /verification/);
});
