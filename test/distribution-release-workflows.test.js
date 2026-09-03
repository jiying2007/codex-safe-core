'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const registry=require('../family-registry.json');
const distribution=fs.readFileSync(path.join(root,'.github','workflows','distribution-receipt.yml'),'utf8');
const integrity=fs.readFileSync(path.join(root,'.github','workflows','consumer-release-integrity.yml'),'utf8');

test('Marketplace distribution receipt tag matches Family Registry while receipt channel remains canonical',()=>{
  for(const repo of ['codex-pr','codex-commit','codex-review']){
    assert.equal(registry.consumers[repo].distribution.channel,'vscode-marketplace');
    assert.equal(registry.consumers[repo].distribution.receiptPrefix,'distribution-marketplace-v');
  }
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
