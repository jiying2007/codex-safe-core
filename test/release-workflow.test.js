'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const release = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');

test('unchanged version is skipped only when immutable tag already exists', () => {
  assert.match(release, /previous.*==.*version[\s\S]*git ls-remote --exit-code --refs origin "refs\/tags\/\$\{tag\}"[\s\S]*publish=false/);
});

test('release provenance action stays SHA-pinned to v4.2.2', () => {
  assert.match(release, /actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4\.2\.2/);
  assert.doesNotMatch(release, /actions\/attest-build-provenance@(?:v|main|master)/);
});

test('release remains immutable and provenance-complete', () => {
  assert.match(release, /SBOM\.spdx\.json/);
  assert.match(release, /SHA256SUMS/);
  assert.match(release, /Release .* already exists; immutable assets will not be overwritten/);
  assert.doesNotMatch(release, /--clobber/);
});
