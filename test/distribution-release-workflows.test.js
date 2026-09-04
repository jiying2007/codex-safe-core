'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const registry=require('../family-registry.json');
const distribution=fs.readFileSync(path.join(root,'.github','workflows','distribution-receipt.yml'),'utf8');
const integrity=fs.readFileSync(path.join(root,'.github','workflows','consumer-release-integrity.yml'),'utf8');

test('VSIX products use immutable GitHub Release as the required current-stage distribution boundary',()=>{
  for(const repo of ['codex-pr','codex-commit','codex-review']){
    assert.equal(registry.consumers[repo].distribution.channel,'github-release');
    assert.equal(registry.consumers[repo].distribution.required,true);
    assert.equal(registry.consumers[repo].distribution.receiptPrefix,undefined);
  }
  assert.equal(registry.consumers['codex-review-service'].distribution.channel,'ghcr');
  assert.equal(registry.consumers['codex-diagnose'].distribution.channel,'github-release');
});

test('Marketplace Distribution Receipt machinery remains canonical for optional manual publication',()=>{
  assert.match(distribution,/vscode-marketplace\) tag_channel=marketplace/);
  assert.match(distribution,/channel:process\.env\.CHANNEL/);
  assert.match(distribution,/tag="distribution-\$\{tag_channel\}-v\$\{PRODUCT_VERSION\}-\$\{digest:0:12\}"/);
  assert.doesNotMatch(distribution,/tag="distribution-\$\{safe_channel\}/);
});

test('consumer release integrity peels bounded annotated tags to the exact release commit',()=>{
  assert.match(integrity,/for depth in \{1\.\.4\}; do/);
  assert.match(integrity,/\[\[ "\$object_type" == tag \]\] \|\| break/);
  assert.match(integrity,/test "\$object_type" = commit/);
  assert.match(integrity,/test "\$release_sha" = "\$EXPECTED_SHA"/);
});
