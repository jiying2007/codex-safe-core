'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const release=fs.readFileSync(path.join(root,'.github','workflows','release.yml'),'utf8');
const trusted=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8');

test('unchanged version is skipped only when immutable tag already exists',()=>{
  assert.match(release,/previous.*==.*version[\s\S]*git ls-remote --exit-code --refs origin "refs\/tags\/\$\{tag\}"[\s\S]*publish=false/);
});

test('caller validates both supported LTS release runtimes before trusted publication',()=>{
  assert.match(release,/node: \['22\.22\.2','24\.19\.0'\]/);
  assert.match(release,/uses: \.\/\.github\/workflows\/_trusted-release\.yml/);
  assert.doesNotMatch(release,/contents: write[\s\S]*runs-on:/);
});

test('trusted release provenance action stays SHA-pinned to v4.2.2',()=>{
  assert.match(trusted,/actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4\.2\.2/);
  assert.doesNotMatch(trusted,/actions\/attest-build-provenance@(?:v|main|master)/);
});

test('trusted release remains immutable, reproducible and provenance-complete',()=>{
  assert.match(trusted,/npm run check:reproducible/);
  assert.match(trusted,/SBOM\.spdx\.json/);
  assert.match(trusted,/CORE_CONTRACT\.json/);
  assert.match(trusted,/CORE_OWNERSHIP_MANIFEST\.json/);
  assert.match(trusted,/SHA256SUMS/);
  assert.match(trusted,/Release .* already exists; immutable assets will not be overwritten/);
  assert.doesNotMatch(trusted,/--clobber/);
});
