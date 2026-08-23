'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflowDir = path.join(root, '.github', 'workflows');
const workflows = fs.readdirSync(workflowDir)
  .filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map(name => [name, fs.readFileSync(path.join(workflowDir, name), 'utf8')]);
const canary = fs.readFileSync(path.join(workflowDir, 'codex-canary.yml'), 'utf8');
const canaryScript = fs.readFileSync(path.join(root, 'scripts', 'codex-canary.js'), 'utf8');

const vulnerableSetupNode = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const patchedSetupNode = 'actions/setup-node@e51e5fe84fc33b4c73ebe40526b2694712b5b858';

test('Core workflows do not use the vulnerable setup-node v7.0.0 bundle', () => {
  for (const [name, workflow] of workflows) {
    assert.doesNotMatch(workflow, new RegExp(vulnerableSetupNode), `${name} must not restore the vulnerable setup-node pin`);
    if (workflow.includes('actions/setup-node@')) assert.match(workflow, new RegExp(patchedSetupNode), `${name} must use the patched verified setup-node commit`);
  }
});

test('latest Codex canary validates changes before merge', () => {
  assert.match(canary, /pull_request:/);
  assert.match(canary, /@openai\/codex@latest/);
  assert.match(canary, /ubuntu-latest, windows-latest, macos-latest/);
});

test('latest Codex canary exercises Safe Contract config overrides under strict config parsing', () => {
  assert.match(canaryScript, /SAFE_CODEX_CONFIG_OVERRIDES/);
  assert.match(canaryScript, /--strict-config/);
  assert.match(canaryScript, /strictConfigOverridesVerified/);
});
