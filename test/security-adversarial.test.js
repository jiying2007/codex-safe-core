'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const corpus=require('./fixtures/security-adversarial-corpus.json');
const {buildSafeCodexArgs,SAFE_CODEX_CONFIG_OVERRIDES,SAFE_CONTRACT_MANIFEST,SAFE_CONTRACT_DIGEST}=require('../safe-contract');

test('untrusted instruction corpus cannot alter Safe Contract argv',()=>{
  const baseline=buildSafeCodexArgs('/tmp/schema.json','gpt-test');
  for(const sample of corpus){
    const args=buildSafeCodexArgs('/tmp/schema.json','gpt-test');
    assert.deepEqual(args,baseline,sample.id);
    assert.equal(args.includes(sample.text),false,sample.id);
    assert.equal(args[args.indexOf('--ask-for-approval')+1],'never',sample.id);
    assert.equal(args[args.indexOf('--sandbox')+1],'read-only',sample.id);
    for(const value of SAFE_CODEX_CONFIG_OVERRIDES)assert.ok(args.includes(value),`${sample.id}: ${value}`);
  }
});

test('Safe Contract manifest explicitly denies authority-bearing capabilities',()=>{
  assert.equal(SAFE_CONTRACT_MANIFEST.approval,'never');
  assert.equal(SAFE_CONTRACT_MANIFEST.sandbox,'read-only');
  assert.equal(SAFE_CONTRACT_MANIFEST.ignoreUserConfig,true);
  assert.equal(SAFE_CONTRACT_MANIFEST.ignoreRepositoryRules,true);
  for(const capability of ['web_search','shell_tool','unified_exec','apps','multi_agent','remote_plugin','hooks','goals','memories','skill_mcp_dependency_install'])assert.ok(SAFE_CONTRACT_MANIFEST.disabledCapabilities.includes(capability));
  assert.match(SAFE_CONTRACT_DIGEST,/^[0-9a-f]{64}$/);
});

test('workflow pin verifier scans standard dash-uses steps and rejects symbolic refs',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'safe-core-actions-pin-')),verifier=path.resolve(__dirname,'..','scripts','verify-actions-pins.js');
  try{
    const pinned=`name: x\non: push\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${'a'.repeat(40)}\n      - uses: ./local-action\n`;
    fs.writeFileSync(path.join(root,'ci.yml'),pinned);
    const ok=spawnSync(process.execPath,[verifier,root],{encoding:'utf8'});
    assert.equal(ok.status,0,ok.stderr||ok.stdout);
    assert.match(ok.stdout,/verified 1 immutable action references/);
    fs.writeFileSync(path.join(root,'ci.yml'),pinned.replace(`@${'a'.repeat(40)}`,'@v4'));
    const bad=spawnSync(process.execPath,[verifier,root],{encoding:'utf8'});
    assert.notEqual(bad.status,0);
    assert.match(bad.stderr,/unpinned action\/reusable workflow/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
