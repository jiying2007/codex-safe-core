'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
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
