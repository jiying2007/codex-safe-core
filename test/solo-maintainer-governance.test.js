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

test('CI Gate source is reported independently without inventing server-side enforcement',()=>{
  const {requiredCheckSourceBinding}=require('../scripts/verify-repository-ruleset');
  const expected=contract.requiredStatusChecks.expectedSource;
  assert.equal(expected.integrationId,15368);
  assert.equal(expected.appSlug,'github-actions');
  const unbound={required_status_checks:[{context:'CI Gate'}]};
  assert.equal(requiredCheckSourceBinding(unbound).state,'unbound');
  const bound={required_status_checks:[{context:'CI Gate',integration_id:15368}]};
  assert.equal(requiredCheckSourceBinding(bound).state,'bound');
  assert.equal(requiredCheckSourceBinding({required_status_checks:[{context:'CI Gate',integration_id:99999}]}).state,'unexpected');
  assert.equal(requiredCheckSourceBinding({required_status_checks:[{context:'CI Gate'},{context:'CI Gate'}]}).state,'ambiguous');
});
test('governance apply preserves existing source binding and other PR protections',()=>{
  const {desiredRuleset}=require('../scripts/apply-repository-governance');
  const repo={full_name:'jiying2007/codex-safe-core',allow_merge_commit:true,allow_squash_merge:true,allow_rebase_merge:true};
  const template={
    name:contract.rulesetName,target:'branch',enforcement:'active',
    conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},bypass_actors:[],
    rules:[{type:'deletion'},{type:'non_fast_forward'},
      {type:'pull_request',parameters:{
        required_approving_review_count:0,require_last_push_approval:false,
        dismiss_stale_reviews_on_push:false,require_code_owner_review:false,
        require_extra_approval_for_unattributed_changes:true,required_reviewers:[]}},
      {type:'required_status_checks',parameters:{
        strict_required_status_checks_policy:true,required_status_checks:[{context:'CI Gate'}]}}
    ]
  };
  const normal=desiredRuleset(repo,template,{bindStatusSource:false});
  const status=normal.rules.find(rule=>rule.type==='required_status_checks').parameters.required_status_checks;
  assert.deepEqual(status,[{context:'CI Gate'}]);
  assert.equal(assess(normal,{default_branch:'main',delete_branch_on_merge:true}).sourceBinding.state,'unbound');
  assert.equal(assess(normal,{default_branch:'main',delete_branch_on_merge:true},{requireStatusSource:true}).ok,false);
  const proposed=desiredRuleset(repo,template,{bindStatusSource:true});
  assert.deepEqual(proposed.rules.find(rule=>rule.type==='required_status_checks').parameters.required_status_checks,[{context:'CI Gate',integration_id:15368}]);
  assert.equal(proposed.rules.find(rule=>rule.type==='pull_request').parameters.require_extra_approval_for_unattributed_changes,true);
  assert.equal(assess(proposed,{default_branch:'main',delete_branch_on_merge:true},{requireStatusSource:true}).ok,true);
  const alreadyBound=structuredClone(template);
  alreadyBound.rules.find(rule=>rule.type==='required_status_checks').parameters.required_status_checks[0].integration_id=15368;
  assert.deepEqual(desiredRuleset(repo,alreadyBound,{bindStatusSource:false}).rules.find(rule=>rule.type==='required_status_checks').parameters.required_status_checks,[{context:'CI Gate',integration_id:15368}]);
  const foreign=structuredClone(template);
  foreign.rules.find(rule=>rule.type==='required_status_checks').parameters.required_status_checks[0].integration_id=6;
  assert.throws(()=>desiredRuleset(repo,foreign,{bindStatusSource:false}),/different source/);
  const extra=structuredClone(template);extra.rules.push({type:'commit_message_pattern'});
  assert.throws(()=>desiredRuleset(repo,extra,{bindStatusSource:true}),/extra Ruleset/);
});
test('only a complete successful GitHub Actions CI Gate at exact main SHA qualifies for binding',()=>{
  const {validateMainGateCheckRuns}=require('../scripts/apply-repository-governance');
  const head='a'.repeat(40);
  const base={total_count:2,check_runs:[
    {name:'CI Gate',head_sha:head,app:{id:15368,slug:'github-actions'},conclusion:'success'},
    {name:'Node 22',head_sha:head,app:{id:15368,slug:'github-actions'},conclusion:'success'}]};
  assert.deepEqual(validateMainGateCheckRuns(base,head),{headSha:head,integrationId:15368,appSlug:'github-actions'});
  for(const [mutate,phrase] of [
    [x=>{x.check_runs[0].app.id=7},/declared source/],
    [x=>{x.check_runs[0].app.slug='other'},/declared source/],
    [x=>{x.check_runs[0].head_sha='b'.repeat(40)},/exact-main/],
    [x=>{x.check_runs[0].conclusion='failure'},/successful/],
    [x=>{x.total_count=3},/incomplete/],
    [x=>{x.check_runs.push(structuredClone(x.check_runs[0]));x.total_count=3},/declared source/]
  ]){
    const changed=structuredClone(base);mutate(changed);
    assert.throws(()=>validateMainGateCheckRuns(changed,head),phrase);
  }
  assert.throws(()=>validateMainGateCheckRuns(base,'missing'),/SHA/);
});
