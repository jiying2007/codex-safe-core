'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  isPrivateNetworkHost,
  parseCodexProviderToml,
  resolveCodexRuntime,
  inspectCodexRuntime,
  writeFamilyRuntimeProfile,
  runtimeProfilePath
} = require('../codex-runtime-resolver');

function tempHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-safe-runtime-')); }

function writeCodexConfig(home, text) {
  const dir = path.join(home, '.codex');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.toml'), text);
}

test('private IP classification covers enterprise LAN ranges without treating public IPs as private', () => {
  for (const host of ['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.10.20', '127.0.0.1', '169.254.1.2', '::1', 'fd12::1']) {
    assert.equal(isPrivateNetworkHost(host), true, host);
  }
  for (const host of ['172.32.0.1', '8.8.8.8', '1.1.1.1', 'relay.example.com']) assert.equal(isPrivateNetworkHost(host), false, host);
});

test('minimal Codex TOML parser resolves selected provider fields only', () => {
  const parsed = parseCodexProviderToml(`
model_provider = "corp"
# base URL in a provider table
[model_providers.corp]
name = "Corp Relay"
base_url = "http://192.168.10.20:8317/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"
`);
  assert.equal(parsed.top.model_provider, 'corp');
  assert.equal(parsed.providers.get('corp').base_url, 'http://192.168.10.20:8317/v1');
});

test('auto mode inherits private HTTP relay from machine Codex config with no second opt-in', () => {
  const home = tempHome();
  try {
    writeCodexConfig(home, `model_provider="corp"\n[model_providers.corp]\nbase_url="http://192.168.10.20:8317/v1"\nenv_key="OPENAI_API_KEY"\nwire_api="responses"\n`);
    const resolved = resolveCodexRuntime({ provider: { mode: 'auto' } }, { homeDir: home, env: {} });
    assert.equal(resolved.source, 'codex-config');
    assert.equal(resolved.providerId, 'corp');
    assert.equal(resolved.runtime.provider.mode, 'openai-compatible');
    assert.equal(resolved.runtime.provider.baseUrl, 'http://192.168.10.20:8317/v1');
    assert.equal(resolved.runtime.provider.allowInsecureHttp, true);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('auto mode refuses public HTTP provider inherited from machine config', () => {
  const home = tempHome();
  try {
    writeCodexConfig(home, `model_provider="corp"\n[model_providers.corp]\nbase_url="http://8.8.8.8:8317/v1"\nenv_key="OPENAI_API_KEY"\nwire_api="responses"\n`);
    assert.throws(
      () => resolveCodexRuntime({ provider: { mode: 'auto' } }, { homeDir: home, env: {} }),
      error => error?.code === 'ECODEX_RUNTIME_PUBLIC_HTTP'
    );
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('family runtime profile has priority over Codex config and remains secret-by-reference', () => {
  const home = tempHome();
  try {
    writeCodexConfig(home, `model_provider="corp"\n[model_providers.corp]\nbase_url="https://old.example/v1"\nenv_key="OLD_KEY"\nwire_api="responses"\n`);
    const saved = writeFamilyRuntimeProfile({
      mode: 'openai-compatible',
      baseUrl: 'http://10.0.0.8:9000/v1',
      apiKeyEnv: 'CORP_RELAY_KEY',
      credentialSource: 'env'
    }, { homeDir: home, env: {} });
    assert.equal(saved, runtimeProfilePath({}, home));
    const onDisk = fs.readFileSync(saved, 'utf8');
    assert.ok(!onDisk.includes('secret-value'));
    const resolved = resolveCodexRuntime({ provider: { mode: 'auto' } }, { homeDir: home, env: { CORP_RELAY_KEY: 'secret-value' } });
    assert.equal(resolved.source, 'family-profile');
    assert.equal(resolved.runtime.provider.baseUrl, 'http://10.0.0.8:9000/v1');
    assert.equal(resolved.runtime.provider.apiKeyEnv, 'CORP_RELAY_KEY');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('explicit provider override remains higher priority than family and Codex machine config', () => {
  const home = tempHome();
  try {
    writeCodexConfig(home, `model_provider="corp"\n[model_providers.corp]\nbase_url="http://192.168.1.2/v1"\nwire_api="responses"\n`);
    writeFamilyRuntimeProfile({ mode: 'openai-compatible', baseUrl: 'http://10.0.0.8/v1' }, { homeDir: home, env: {} });
    const resolved = resolveCodexRuntime({ provider: { mode: 'openai' } }, { homeDir: home, env: {} });
    assert.equal(resolved.source, 'explicit');
    assert.equal(resolved.runtime.provider.mode, 'openai');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('auto mode falls back to built-in OpenAI when no machine runtime is configured', () => {
  const home = tempHome();
  try {
    const resolved = resolveCodexRuntime({ provider: { mode: 'auto' } }, { homeDir: home, env: {} });
    assert.equal(resolved.source, 'built-in-openai');
    assert.equal(resolved.runtime.provider.mode, 'openai');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('runtime inspection is redacted and surfaces plaintext/private-network state', () => {
  const home = tempHome();
  try {
    writeCodexConfig(home, `model_provider="corp"\n[model_providers.corp]\nbase_url="http://192.168.20.10:8317/v1"\nenv_key="CORP_KEY"\nwire_api="responses"\n`);
    const info = inspectCodexRuntime({ provider: { mode: 'auto' } }, { homeDir: home, env: { CORP_KEY: 'do-not-print' } });
    assert.equal(info.source, 'codex-config');
    assert.equal(info.endpointHost, '192.168.20.10:8317');
    assert.equal(info.transport, 'http');
    assert.equal(info.privateNetwork, true);
    assert.equal(info.credentialEnvPresent, true);
    assert.match(info.plaintextWarning, /plaintext HTTP/);
    assert.ok(!JSON.stringify(info).includes('do-not-print'));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
