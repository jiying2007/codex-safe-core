'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const release=fs.readFileSync(path.join(root,'.github','workflows','release.yml'),'utf8');
const trusted=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8');
const family=fs.readFileSync(path.join(root,'.github','workflows','family-ci.yml'),'utf8');
const performanceTrend=fs.readFileSync(path.join(root,'.github','workflows','performance-trend.yml'),'utf8');

test('validation workflow is read-only and covers both LTS runtimes plus reproducibility',()=>{
  assert.match(release,/name: Release Validation/);
  assert.match(release,/permissions:\r?\n  contents: read/);
  assert.match(release,/node: \['22\.22\.2', '24\.19\.0'\]/);
  assert.match(release,/npm run ci/);
  assert.match(release,/npm run check:contract/);
  assert.match(release,/npm run check:reproducible/);
  assert.doesNotMatch(release,/outputs:|needs:|contents: write|id-token: write|attestations: write|gh release create/);
});

test('trusted publication is workflow_run gated to successful main validation',()=>{
  assert.match(trusted,/workflow_run:[\s\S]*workflows: \["Release Validation"\][\s\S]*types: \[completed\]/);
  assert.match(trusted,/workflow_run\.conclusion == 'success'/);
  assert.match(trusted,/workflow_run\.head_branch == 'main'/);
  assert.match(trusted,/workflow_run\.event == 'push'/);
  assert.match(trusted,/workflow_run\.head_sha/);
  assert.match(trusted,/remote_main=.*git ls-remote origin refs\/heads\/main/);
  assert.match(trusted,/test "\$remote_main" = "\$validated_sha"/);
});

test('formal release is skipped only when immutable and still exact-head',()=>{
  assert.match(trusted,/gh release view "\$tag"[\s\S]*tag_sha=.*git ls-remote origin[\s\S]*VALIDATED_SHA/);
  assert.match(trusted,/Existing formal release \$\{tag\} is not immutable/);
  assert.match(trusted,/release_verified=false[\s\S]*for attempt in \{1\.\.12\}; do[\s\S]*gh release verify "\$tag"/);
  assert.match(trusted,/Existing formal release \$\{tag\} attestation did not become verifiable/);
  assert.match(trusted,/publish=false/);
  assert.match(trusted,/git ls-remote --exit-code --refs origin "refs\/tags\/\$\{tag\}"/);
  assert.match(trusted,/git rev-list -n 1 "\$tag"[\s\S]*VALIDATED_SHA/);
  assert.match(trusted,/publish=true/);
});

test('trusted release provenance action stays SHA-pinned to v4.2.2',()=>{
  assert.match(trusted,/actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4\.2\.2/);
  assert.doesNotMatch(trusted,/actions\/attest-build-provenance@(?:v|main|master)/);
});

test('trusted release verifies actual immutable state without repository-admin preflight',()=>{
  assert.doesNotMatch(trusted,/\/immutable-releases/);
  assert.match(trusted,/releases\/tags\/\$\{RELEASE_TAG\}[\s\S]*--jq '\.immutable'/);
  assert.match(trusted,/did not become immutable/);
  assert.match(trusted,/gh release verify "\$RELEASE_TAG"/);
  assert.match(trusted,/gh release verify-asset "\$RELEASE_TAG"/);
});

test('trusted release tolerates bounded release and asset attestation propagation delay',()=>{
  assert.match(trusted,/release_verified=false/);
  assert.match(trusted,/for attempt in \{1\.\.12\}; do[\s\S]*if gh release verify "\$RELEASE_TAG"; then[\s\S]*gh release verify-asset "\$RELEASE_TAG" "\$asset"[\s\S]*sleep 5/);
  assert.match(trusted,/Release\/asset attestation for \$\{RELEASE_TAG\} is not fully visible yet/);
  assert.match(trusted,/attestation did not become fully verifiable/);
  assert.match(trusted,/test "\$release_verified" = true/);
});

test('trusted release remains reproducible and provenance-complete',()=>{
  assert.match(trusted,/npm run check:contract/);
  assert.match(trusted,/npm run check:reproducible/);
  assert.match(trusted,/npm run ci/);
  assert.match(trusted,/SBOM\.spdx\.json/);
  assert.match(trusted,/CORE_CONTRACT\.json/);
  assert.match(trusted,/CORE_OWNERSHIP_MANIFEST\.json/);
  assert.match(trusted,/SHA256SUMS/);
  assert.match(trusted,/gh release create/);
  assert.doesNotMatch(trusted,/--clobber/);
});

test('Family publication has one canonical manifest and verifies immutable release assets',()=>{
  assert.match(family,/FAMILY_MANIFEST\.json/);
  assert.match(family,/generate-family-manifest\.js/);
  assert.match(family,/codex-safe-family-manifest/);
  assert.doesNotMatch(family,/FAMILY_BASELINE\.json|FAMILY_BOM\.json|generate-family-baseline\.js/);
  assert.doesNotMatch(family,/\/immutable-releases/);
  assert.match(family,/gh release verify "\$tag"/);
  assert.match(family,/gh release verify-asset "\$tag" FAMILY_MANIFEST\.json/);
});

test('Family release verification tolerates bounded release-attestation propagation delay',()=>{
  assert.match(family,/release_verified=false/);
  assert.match(family,/for attempt in \{1\.\.12\}; do[\s\S]*if gh release verify "\$tag"; then[\s\S]*release_verified=true[\s\S]*sleep 5/);
  assert.match(family,/Release attestation for \$\{tag\} is not visible yet/);
  assert.match(family,/attestation did not become verifiable/);
  assert.match(family,/test "\$release_verified" = true/);
});

test('Performance publication is provenance-attested and uses only pinned actions',()=>{
  assert.match(performanceTrend,/permissions:\r?\n  contents: write\r?\n  id-token: write\r?\n  attestations: write/);
  assert.match(performanceTrend,/actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4\.2\.2/);
  assert.match(performanceTrend,/subject-path: \$\{\{ steps\.evidence\.outputs\.asset \}\}/);
  assert.doesNotMatch(performanceTrend,/actions\/attest-build-provenance@(?:v|main|master)/);
});

test('Performance immutable release reruns verify the existing canonical asset instead of overwriting it',()=>{
  assert.match(performanceTrend,/exists=false[\s\S]*gh release view "\$tag"[\s\S]*exists=true/);
  assert.match(performanceTrend,/if: steps\.evidence\.outputs\.exists != 'true'/);
  assert.match(performanceTrend,/gh release download "\$PERFORMANCE_TAG" --pattern "\$PERFORMANCE_ASSET" --dir \./);
  assert.match(performanceTrend,/release_verified=false/);
  assert.match(performanceTrend,/for attempt in \{1\.\.12\}; do[\s\S]*if gh release verify "\$PERFORMANCE_TAG"; then[\s\S]*release_verified=true/);
  assert.match(performanceTrend,/gh release verify-asset "\$PERFORMANCE_TAG" "\$PERFORMANCE_ASSET"/);
  assert.doesNotMatch(performanceTrend,/--clobber/);
});
