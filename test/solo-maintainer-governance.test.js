'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const contract=require('../repository-governance-contract.json');
const {assess,policyFor}=require('../scripts/verify-repository-ruleset');
const root=path.resolve(__dirname,'..');

test('solo-maintainer governance separates native merge protection from private publisher protection',()=>{
  assert.equal(contract.maintenanceModel,'solo-maintainer');
  assert.equal(contract.pullRequest.minimumApprovals,0);
  assert.equal(contract.pullRequest.requireLastPushApproval,false);
  assert.equal(policyFor('codex-review-service').protection,'publisher');
  assert.equal(policyFor('codex-safe-core').protection,'native');
  assert.equal(policyFor('codex-review-service').nativeRulesetRequired,false);
});

test('native policy accepts PR plus CI Gate without a second human approval',()=>{
  const detail={name:contract.rulesetName,target:'branch',enforcement:'active',
    conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},
    bypass_actors:[],
    rules:[
      {type:'deletion'},{type:'non_fast_forward'},
      {type:'pull_request',parameters:{required_approving_review_count:0,
        dismiss_stale_reviews_on_push:false,require_last_push_approval:false,
        require_code_owner_review:false}},
      {type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,
        required_status_checks:[{context:'CI Gate'}]}}
    ]};
  const result=assess(detail,{default_branch:'main',delete_branch_on_merge:true});
  assert.deepEqual(result.reasons,[]);
  assert.equal(result.ok,true);
});

test('solo ruleset rejects extra reviewers, last-push and code-owner drift despite a green CI Gate',()=>{
  const detail={name:contract.rulesetName,target:'branch',enforcement:'active',
    conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},bypass_actors:[],
    rules:[{type:'deletion'},{type:'non_fast_forward'},
      {type:'pull_request',parameters:{
        required_approving_review_count:0,
        dismiss_stale_reviews_on_push:false,
        require_last_push_approval:false,
        require_code_owner_review:false
      }},
      {type:'required_status_checks',parameters:{
        strict_required_status_checks_policy:true,required_status_checks:[{context:'CI Gate'}]
      }}]};
  const repository={default_branch:'main',delete_branch_on_merge:true};
  const pr=detail.rules.find(rule=>rule.type==='pull_request').parameters;
  assert.equal(assess(detail,repository).ok,true);
  for(const [field,value,reason] of [
    ['required_approving_review_count',1,'unexpected-solo-approval-requirement'],
    ['require_last_push_approval',true,'last-push-approval-drift'],
    ['require_code_owner_review',true,'code-owner-review-drift'],
    ['dismiss_stale_reviews_on_push',true,'stale-review-dismissal-drift']
  ]){
    const mutated=structuredClone(detail);
    mutated.rules.find(rule=>rule.type==='pull_request').parameters[field]=value;
    const verdict=assess(mutated,repository);
    assert.equal(verdict.ok,false,field);
    assert.ok(verdict.reasons.includes(reason),JSON.stringify(verdict));
  }
  for(const missing of ['required_approving_review_count','require_last_push_approval']){
    const mutated=structuredClone(detail);
    delete mutated.rules.find(rule=>rule.type==='pull_request').parameters[missing];
    const verdict=assess(mutated,repository);
    assert.equal(verdict.ok,false,missing);
    assert.ok(verdict.reasons.includes(missing==='required_approving_review_count'?'approvals-missing-or-invalid':'last-push-approval-drift'));
  }
  assert.equal(pr.required_approving_review_count,0,'fixtures are never mutated in-place');
});

test('cross-repository private credential is not a Core development or release-validation hard gate',()=>{
  const governance=fs.readFileSync(path.join(root,'.github/workflows/repository-governance.yml'),'utf8');
  const release=fs.readFileSync(path.join(root,'.github/workflows/release.yml'),'utf8');
  const status=fs.readFileSync(path.join(root,'.github/workflows/family-status.yml'),'utf8');
  const fresh=fs.readFileSync(path.join(root,'.github/workflows/family-freshness.yml'),'utf8');
  assert.doesNotMatch(governance,/Missing CODEX_SAFE_FAMILY_READ_TOKEN|exit 2/);
  assert.doesNotMatch(release,/Missing CODEX_SAFE_FAMILY_READ_TOKEN|exit 2/);
  assert.match(status,/private-family-visibility-unavailable/);
  assert.match(fresh,/dispatch=false/);
  assert.match(status,/available != 'true'/);
  assert.match(fresh,/available != 'true'/);
});
