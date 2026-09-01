'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  normalizeCodexRuntimeOptions,
  providerConfigOverrides,
  appendProviderArgs,
  resolveAuthJsonPath,
  readAuthJsonApiKey,
  resolveProviderCredential,
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
  assert.equal(runtime.provider.credentialSource, 'auto');
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

test('provider config rejects unsafe URLs by default but supports explicit HTTP opt-in', () => {
  assert.throws(
    () => normalizeCodexRuntimeOptions({ provider: { mode: 'openai-compatible', baseUrl: 'http://192.168.2.109:3000/v1', apiKeyEnv: 'KEY' } }),
    error => error?.code === 'ECODEX_PROVIDER_CONFIG'
  );
  const insecure = normalizeCodexRuntimeOptions({
    provider: {
      mode: 'openai-compatible',
      baseUrl: 'http://192.168.2.109:3000/v1',
      apiKeyEnv: 'KEY',
      allowInsecureHttp: true
    }
  });
  assert.equal(insecure.provider.baseUrl, 'http://192.168.2.109:3000/v1');
  assert.equal(insecure.provider.allowInsecureHttp, true);
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

test('compatible provider resolves environment credential before auth.json', () => {
  const runtime = {
    provider: {
      mode: 'openai-compatible',
      baseUrl: 'https://relay.example.com/v1',
      apiKeyEnv: 'RELAY_API_KEY',
      credentialSource: 'auto'
    }
  };
  const resolved = resolveProviderCredential(runtime, { env: { RELAY_API_KEY: 'env-secret' }, homeDir: '/not-used' });
  assert.equal(resolved.source, 'env');
  assert.equal(resolved.environment.RELAY_API_KEY, 'env-secret');
  assert.equal(assertProviderCredential(runtime, { RELAY_API_KEY: 'env-secret' }).provider.mode, 'openai-compatible');
});

test('compatible provider can read API key directly from Codex auth.json', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-runtime-auth-'));
  try {
    const codexHome = path.join(homeDir, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'auth.json'), JSON.stringify({
      auth_mode: 'apikey',
      OPENAI_API_KEY: 'auth-json-secret'
    }), { mode: 0o600 });
    const runtime = {
      provider: {
        mode: 'openai-compatible',
        baseUrl: 'https://relay.example.com/v1',
        apiKeyEnv: 'RELAY_API_KEY',
        credentialSource: 'auth-json'
      }
    };
    const credential = readAuthJsonApiKey({ env: {}, homeDir });
    assert.equal(credential.value, 'auth-json-secret');
    assert.equal(credential.path, path.join(codexHome, 'auth.json'));
    const resolved = resolveProviderCredential(runtime, { env: {}, homeDir });
    assert.equal(resolved.source, 'auth-json');
    assert.equal(resolved.environment.RELAY_API_KEY, 'auth-json-secret');
    assert.equal(resolveAuthJsonPath({}, homeDir), path.join(codexHome, 'auth.json'));
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('CODEX_HOME controls auth.json discovery and non-apikey auth is rejected', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-runtime-home-'));
  try {
    const codexHome = path.join(homeDir, 'custom-codex');
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', OPENAI_API_KEY: 'must-not-use' }));
    assert.equal(resolveAuthJsonPath({ CODEX_HOME: codexHome }, homeDir), path.join(codexHome, 'auth.json'));
    assert.throws(
      () => readAuthJsonApiKey({ env: { CODEX_HOME: codexHome }, homeDir }),
      error => error?.code === 'ECODEX_CREDENTIAL'
    );
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('missing compatible-provider credential fails with bounded metadata', () => {
  const runtime = {
    provider: {
      mode: 'openai-compatible',
      baseUrl: 'https://relay.example.com/v1',
      apiKeyEnv: 'RELAY_API_KEY',
      credentialSource: 'env'
    }
  };
  assert.throws(
    () => assertProviderCredential(runtime, {}),
    error => error?.code === 'ECODEX_CREDENTIAL' && error.credentialEnv === 'RELAY_API_KEY'
  );
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
    credentialSource: 'auto',
    transport: 'https',
    allowInsecureHttp: false,
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
