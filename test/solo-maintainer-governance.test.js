'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const contract=require('../repository-governance-contract.json');
const {assess,policyFor}=require('../scripts/verify-repository-ruleset');
const root=path.resolve(__dirname,'..');

test('all seven public products have native protection independently of release lifecycle',()=>{
  assert.equal(contract.maintenanceModel,'solo-maintainer');
  assert.equal(contract.pullRequest.minimumApprovals,0);
  assert.equal(contract.pullRequest.requireLastPushApproval,false);
  assert.equal(contract.repositories.length,7);
  assert.ok(contract.repositories.includes('codex-debug'));
  assert.equal(contract.requiredStatusChecks.requireSourceBinding,true);
  assert.equal(contract.allowAutoMerge,false);
  assert.equal(policyFor('codex-review-service').protection,'native');
  assert.equal(policyFor('codex-debug').protection,'native');
  assert.equal(policyFor('codex-safe-core').protection,'native');
  assert.equal(policyFor('codex-review-service').nativeRulesetRequired,true);
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
        required_status_checks:[{context:'CI Gate',integration_id:15368}]}}
    ]};
  const result=assess(detail,{default_branch:'main',delete_branch_on_merge:true});
  assert.deepEqual(result.reasons,[]);
  assert.equal(result.ok,true);
  assert.equal(result.administrativeMetadata.allowAutoMerge,null,'unobserved settings remain explicit');
  const unobservable=assess(detail,{default_branch:'main'},{requireAdministrativeMetadata:true});
  assert.ok(unobservable.reasons.includes('delete-branch-on-merge-unobservable'));
  assert.ok(unobservable.reasons.includes('auto-merge-unobservable'));
  assert.equal(assess(detail,{default_branch:'main',delete_branch_on_merge:true,allow_auto_merge:false},{requireAdministrativeMetadata:true}).ok,true);
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
        strict_required_status_checks_policy:true,required_status_checks:[{context:'CI Gate',integration_id:15368}]
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
  assert.doesNotMatch(status,/private-family-visibility-unavailable/);
  assert.ok(status.includes('GITHUB_TOKEN: ${{ secrets.CODEX_SAFE_FAMILY_READ_TOKEN || github.token }}'));
  assert.match(status,/node scripts\/generate-family-status\.js FAMILY_STATUS\.json/);
  assert.match(fresh,/if: steps\.evaluate\.outputs\.dispatch == 'true'/);
  assert.doesNotMatch(status,/steps\.visibility|available != 'true'/);
  assert.doesNotMatch(fresh,/steps\.visibility|available != 'true'/);
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
        require_extra_approval_for_unattributed_changes:true,required_review_thread_resolution:true,required_reviewers:[]}},
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
  assert.equal(proposed.rules.find(rule=>rule.type==='pull_request').parameters.required_review_thread_resolution,true);
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
    {name:'CI Gate',head_sha:head,app:{id:15368,slug:'github-actions'},status:'completed',conclusion:'success'},
    {name:'Node 22',head_sha:head,app:{id:15368,slug:'github-actions'},status:'completed',conclusion:'success'}]};
  assert.deepEqual(validateMainGateCheckRuns(base,head),{headSha:head,integrationId:15368,appSlug:'github-actions'});
  for(const [mutate,phrase] of [
    [x=>{x.check_runs[0].app.id=7},/declared source/],
    [x=>{x.check_runs[0].app.slug='other'},/declared source/],
    [x=>{x.check_runs[0].head_sha='b'.repeat(40)},/exact-main/],
    [x=>{x.check_runs[0].conclusion='failure'},/successful/],
    [x=>{x.check_runs[0].status='in_progress'},/successful/],
    [x=>{x.total_count=3},/incomplete/],
    [x=>{x.check_runs.push(structuredClone(x.check_runs[0]));x.total_count=3},/declared source/]
  ]){
    const changed=structuredClone(base);mutate(changed);
    assert.throws(()=>validateMainGateCheckRuns(changed,head),phrase);
  }
  assert.throws(()=>validateMainGateCheckRuns(base,'missing'),/SHA/);
});

test('Service and development Debug are audited against actual public native server state',async()=>{
  const {auditRepository}=require('../scripts/verify-repository-ruleset');
  const {desiredRuleset,newRulesetTemplate}=require('../scripts/apply-repository-governance');
  const repository={default_branch:'main',delete_branch_on_merge:true,allow_auto_merge:false,private:false,allow_squash_merge:true};
  for(const name of ['codex-review-service','codex-debug']){
    const detail={id:17,...desiredRuleset(repository,newRulesetTemplate(),{repositoryName:name})};
    assert.deepEqual(detail.bypass_actors,[],'new development protection grants no bypass actor');
    const reads=[];
    const readJson=async url=>{reads.push(url);return url.endsWith('/rulesets/17')?detail:url.endsWith('/rulesets')?[{id:17}]:repository;};
    const report=await auditRepository(name,'',{readJson});
    assert.equal(report.ok,true);assert.equal(report.protection,'native');assert.equal(reads.length,3);
    const unbound=structuredClone(detail);delete unbound.rules.at(-1).parameters.required_status_checks[0].integration_id;
    assert.equal((await auditRepository(name,'',{readJson:async url=>url.endsWith('/rulesets/17')?unbound:url.endsWith('/rulesets')?[{id:17}]:repository})).ok,false);
    assert.equal((await auditRepository(name,'',{readJson:async url=>url.endsWith('/rulesets')?[]:repository})).ok,false);
    assert.equal(assess(detail,{...repository,allow_auto_merge:true},{repositoryName:name}).ok,false);
  }
});

test('Service source binding preserves its existing stronger approval protections',()=>{
  const {desiredRuleset,newRulesetTemplate}=require('../scripts/apply-repository-governance');
  const repository={name:'codex-review-service',default_branch:'main',delete_branch_on_merge:true,allow_auto_merge:false,allow_squash_merge:true};
  const detail=newRulesetTemplate();
  const existing={required_approving_review_count:1,dismiss_stale_reviews_on_push:true,require_last_push_approval:true,require_code_owner_review:false,required_review_thread_resolution:true};
  detail.rules.find(rule=>rule.type==='pull_request').parameters={...existing};
  const proposed=desiredRuleset(repository,detail);
  const pr=proposed.rules.find(rule=>rule.type==='pull_request').parameters;
  for(const [field,value] of Object.entries(existing))assert.equal(pr[field],value,field);
  assert.equal(assess(proposed,repository).ok,true);
  for(const [field,value,reason] of [
    ['required_approving_review_count',0,'insufficient-approvals'],
    ['dismiss_stale_reviews_on_push',false,'stale-review-dismissal-drift'],
    ['require_last_push_approval',false,'last-push-approval-drift']
  ]){
    const downgraded=structuredClone(proposed);
    downgraded.rules.find(rule=>rule.type==='pull_request').parameters[field]=value;
    const result=assess(downgraded,repository);
    assert.equal(result.ok,false,field);assert.ok(result.reasons.includes(reason));
  }
});

test('undeclared stricter review settings survive preparation and fail policy qualification',()=>{
  const {desiredRuleset,newRulesetTemplate}=require('../scripts/apply-repository-governance');
  for(const name of ['codex-review-service','codex-safe-core']){
    const repository={name,default_branch:'main',delete_branch_on_merge:true,allow_auto_merge:false,allow_squash_merge:true};
    const detail=newRulesetTemplate();
    const existing={required_approving_review_count:2,dismiss_stale_reviews_on_push:true,require_last_push_approval:true,require_code_owner_review:true,required_review_thread_resolution:true};
    detail.rules.find(rule=>rule.type==='pull_request').parameters={...existing};
    const proposed=desiredRuleset(repository,detail);
    const pr=proposed.rules.find(rule=>rule.type==='pull_request').parameters;
    for(const [field,value] of Object.entries(existing))assert.equal(pr[field],value,`${name}:${field}`);
    const verdict=assess(proposed,repository);
    assert.equal(verdict.ok,false);assert.ok(verdict.reasons.includes('unexpected-solo-approval-requirement'));
    assert.ok(verdict.reasons.includes('code-owner-review-drift'));
    assert.deepEqual(detail.rules.find(rule=>rule.type==='pull_request').parameters,existing);
    for(const field of Object.keys(existing)){
      const missing=structuredClone(detail);delete missing.rules.find(rule=>rule.type==='pull_request').parameters[field];
      assert.throws(()=>desiredRuleset(repository,missing),/missing or invalid existing/);
    }
  }
});
