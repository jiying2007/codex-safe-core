'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  modelRegistryPath,
  parseModelRegistryDocument,
  resolveModelRegistry,
  inspectModelRegistry
} = require('../model-registry-resolver');

function document() {
  return {
    schemaVersion: 1,
    revision: 'registry-v1',
    models: [{
      provider: 'relay', model: 'balanced-a', class: 'balanced', roles: ['reviewer'],
      status: 'approved', health: 'healthy', qualificationId: 'qual-1', capabilities: { structuredOutput: true }
    }]
  };
}

test('default registry path is machine scoped', () => {
  const home = path.resolve('home-example');
  assert.equal(modelRegistryPath({}, home), path.join(home, '.codex-safe', 'models.json'));
});

test('environment override resolves relative to home', () => {
  const home = path.resolve('home-example');
  assert.equal(
    modelRegistryPath({ CODEX_SAFE_MODEL_REGISTRY_FILE: 'config/models.json' }, home),
    path.resolve(home, 'config', 'models.json')
  );
});

test('parses closed registry document', () => {
  const registry = parseModelRegistryDocument(JSON.stringify(document()));
  assert.equal(registry.revision, 'registry-v1');
  assert.equal(registry.models[0].status, 'approved');
  assert.throws(() => parseModelRegistryDocument(JSON.stringify({ ...document(), extra: true })), error => error?.code === 'EMODELREGISTRY');
});

test('missing machine registry is explicit none rather than an invented approved default', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-registry-'));
  try {
    const result = resolveModelRegistry({}, { homeDir: dir, env: {} });
    assert.equal(result.registry, null);
    assert.equal(result.source, 'none');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('reads and inspects machine registry without secrets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-registry-'));
  try {
    const registryDir = path.join(dir, '.codex-safe');
    fs.mkdirSync(registryDir, { recursive: true });
    fs.writeFileSync(path.join(registryDir, 'models.json'), JSON.stringify(document()));
    const result = resolveModelRegistry({}, { homeDir: dir, env: {} });
    assert.equal(result.source, 'machine-registry');
    assert.equal(result.registry.models.length, 1);
    const inspection = inspectModelRegistry({}, { homeDir: dir, env: {} });
    assert.equal(inspection.present, true);
    assert.equal(inspection.approved, 1);
    assert.equal('apiKey' in inspection, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('symbolic-link registry is rejected', { skip: process.platform === 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-registry-'));
  try {
    const registryDir = path.join(dir, '.codex-safe');
    fs.mkdirSync(registryDir, { recursive: true });
    const real = path.join(dir, 'real.json');
    fs.writeFileSync(real, JSON.stringify(document()));
    fs.symlinkSync(real, path.join(registryDir, 'models.json'));
    assert.throws(() => resolveModelRegistry({}, { homeDir: dir, env: {} }), error => error?.code === 'EMODELREGISTRY');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
