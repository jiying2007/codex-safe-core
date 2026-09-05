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
const ci = fs.readFileSync(path.join(workflowDir, 'ci.yml'), 'utf8');
const canary = fs.readFileSync(path.join(workflowDir, 'codex-canary.yml'), 'utf8');
const performanceTrend = fs.readFileSync(path.join(workflowDir, 'performance-trend.yml'), 'utf8');
const canaryScript = fs.readFileSync(path.join(root, 'scripts', 'codex-canary.js'), 'utf8');
const qualityCanaryScript = fs.readFileSync(path.join(root, 'scripts', 'codex-quality-canary.js'), 'utf8');

const vulnerableSetupNode = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const patchedSetupNode = 'actions/setup-node@94196ee1d15439c1b6651cd87ef14e88ec435966';

test('Core workflows do not use the vulnerable setup-node v7.0.0 bundle', () => {
  for (const [name, workflow] of workflows) {
    assert.doesNotMatch(workflow, new RegExp(vulnerableSetupNode), `${name} must not restore the vulnerable setup-node pin`);
    if (workflow.includes('actions/setup-node@')) assert.match(workflow, new RegExp(patchedSetupNode), `${name} must use the patched verified setup-node commit`);
  }
});

test('latest Codex canary validates relevant changes before merge through CI Gate', () => {
  assert.doesNotMatch(canary, /pull_request:/);
  assert.match(canary, /schedule:/);
  assert.match(canary, /@openai\/codex@latest/);
  assert.match(canary, /ubuntu-latest, windows-latest, macos-latest/);
  assert.match(ci, /canary-impact:/);
  assert.match(ci, /core-contract\.json\|safe-contract\.js\|codex-cli\.js/);
  assert.match(ci, /codex-canary-capability:/);
  assert.match(ci, /codex-canary-behavioral:/);
  assert.match(ci, /@openai\/codex@latest/);
  assert.match(ci, /ubuntu-latest, windows-latest, macos-latest/);
  assert.match(ci, /needs: \[verify, package-reproducibility, security, dependency-review, canary-impact, codex-canary-capability, codex-canary-behavioral\]/);
  assert.match(ci, /CANARY_REQUIRED/);
});

test('latest Codex canary exercises Safe Contract config overrides under strict config parsing', () => {
  assert.match(canaryScript, /SAFE_CODEX_CONFIG_OVERRIDES/);
  assert.match(canaryScript, /--strict-config/);
  assert.match(canaryScript, /strictConfigOverridesVerified/);
});

test('scheduled live canary is fail-closed and gates compatibility history', () => {
  assert.match(canary, /CODEX_CANARY_OPENAI_API_KEY/);
  assert.match(canary, /Scheduled\/manual Codex behavioral canary requires/);
  assert.match(canary, /node scripts\/codex-behavioral-canary\.js/);
  assert.match(canary, /node scripts\/codex-quality-canary\.js/);
  assert.match(canary, /needs: \[capability, behavioral\]/);
});

test('compatibility history never mutates an immutable fixed release', () => {
  assert.doesNotMatch(canary, /tag="codex-cli-compatibility-history"/);
  assert.doesNotMatch(canary, /gh release upload/);
  assert.match(canary, /codex-cli-compat-v\$\{safe\}-core-v\$\{core_version\}-\$\{core_short\}/);
  assert.match(canary, /gh release create "\$tag" "\$asset"/);
  assert.match(canary, /\.immutable/);
  assert.match(canary, /gh release verify-asset "\$tag" "\$asset"/);
});

test('performance history uses one provenance-attested immutable release per exact Core snapshot', () => {
  assert.doesNotMatch(performanceTrend, /tag="codex-safe-performance-history"/);
  assert.doesNotMatch(performanceTrend, /gh release upload/);
  assert.doesNotMatch(performanceTrend, /--clobber/);
  assert.match(performanceTrend, /codex-safe-performance-v\$\{core_version\}-\$\{short\}/);
  assert.match(performanceTrend, /actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8/);
  assert.match(performanceTrend, /gh release create "\$PERFORMANCE_TAG" "\$PERFORMANCE_ASSET"/);
  assert.match(performanceTrend, /\.immutable/);
  assert.match(performanceTrend, /gh release verify "\$PERFORMANCE_TAG"/);
  assert.match(performanceTrend, /gh release verify-asset "\$PERFORMANCE_TAG" "\$PERFORMANCE_ASSET"/);
  assert.match(performanceTrend, /gh release download "\$PERFORMANCE_TAG" --pattern "\$PERFORMANCE_ASSET"/);
});

test('live quality canary stays bounded and includes a clean negative', () => {
  assert.match(qualityCanaryScript, /maxEstimatedTokens:8000/);
  assert.match(qualityCanaryScript, /command-injection/);
  assert.match(qualityCanaryScript, /lock-order/);
  assert.match(qualityCanaryScript, /use-after-free/);
  assert.match(qualityCanaryScript, /clean-doc-change/);
  assert.match(qualityCanaryScript, /hasDefect:false/);
});
