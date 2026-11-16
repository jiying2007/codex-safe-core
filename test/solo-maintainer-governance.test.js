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
  const repository={default_branch:'main',delete_branch_on_merge:true,allow_auto_merge:false,private:false,allow_merge_commit:false,allow_squash_merge:true,allow_rebase_merge:false};
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

test('Service keeps existing review requirements unless administrator explicitly aligns the solo policy',()=>{
  const {desiredRuleset,newRulesetTemplate}=require('../scripts/apply-repository-governance');
  const repository={name:'codex-review-service',default_branch:'main',delete_branch_on_merge:true,allow_auto_merge:false,allow_merge_commit:false,allow_squash_merge:true,allow_rebase_merge:false};
  const detail=newRulesetTemplate();
  const existing={
    required_approving_review_count:1,dismiss_stale_reviews_on_push:true,
    require_last_push_approval:true,require_code_owner_review:false,
    required_review_thread_resolution:true,required_reviewers:[],
    require_extra_approval_for_unattributed_changes:true
  };
  detail.rules.find(rule=>rule.type==='pull_request').parameters={...existing};
  const unchanged=desiredRuleset(repository,detail,{alignServiceReview:false});
  const unchangedPr=unchanged.rules.find(rule=>rule.type==='pull_request').parameters;
  for(const [field,value] of Object.entries(existing))assert.deepEqual(unchangedPr[field],value,field);
  const blocked=assess(unchanged,repository,{repositoryName:'codex-review-service'});
  assert.equal(blocked.ok,false,'source-binding alone must not silently change Service approval policy');
  for(const reason of ['unexpected-solo-approval-requirement','stale-review-dismissal-drift','last-push-approval-drift'])
    assert.ok(blocked.reasons.includes(reason),reason);

  const aligned=desiredRuleset(repository,detail,{alignServiceReview:true});
  const pr=aligned.rules.find(rule=>rule.type==='pull_request').parameters;
  assert.equal(pr.required_approving_review_count,0);
  assert.equal(pr.dismiss_stale_reviews_on_push,false);
  assert.equal(pr.require_last_push_approval,false);
  assert.equal(pr.require_code_owner_review,false);
  assert.equal(pr.required_review_thread_resolution,true,'retain actual conversation-resolution protection');
  assert.deepEqual(pr.required_reviewers,[],'never manufacture approving reviewers');
  assert.equal(pr.require_extra_approval_for_unattributed_changes,true,'Copilot setting is inert at zero required approvals');
  assert.deepEqual(aligned.rules.find(rule=>rule.type==='required_status_checks').parameters.required_status_checks,
    [{context:'CI Gate',integration_id:15368}]);
  assert.equal(assess(aligned,repository,{repositoryName:'codex-review-service'}).ok,true);
  assert.deepEqual(detail.rules.find(rule=>rule.type==='pull_request').parameters,existing,'original server evidence is never mutated');

  const core={...repository,name:'codex-safe-core'};
  const preserved=desiredRuleset(core,detail,{alignServiceReview:true});
  assert.equal(preserved.rules.find(rule=>rule.type==='pull_request').parameters.required_approving_review_count,1,
    'Service-only opt-in must not downgrade other repository protections');
  assert.equal(assess(preserved,core,{repositoryName:'codex-safe-core'}).ok,false);
});

test('an actual Service review-policy write requires a separate affirmative acknowledgement',()=>{
  const {spawnSync}=require('node:child_process');
  const script=path.join(root,'scripts','apply-repository-governance.js');
  const env={...process.env,GH_TOKEN:'fixture-do-not-use',GITHUB_TOKEN:''};
  const missing=spawnSync(process.execPath,[script,'--apply','--create-missing','--align-service-solo'],
    {cwd:root,env,encoding:'utf8',timeout:3000});
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/--acknowledge-service-review-policy-change/);
  assert.doesNotMatch(missing.stderr,/GitHub API|fetch failed/,'permission guard must fire before any network call');
  const stray=spawnSync(process.execPath,[script,'--acknowledge-service-review-policy-change'],
    {cwd:root,env,encoding:'utf8',timeout:3000});
  assert.notEqual(stray.status,0);
  assert.match(stray.stderr,/requires --align-service-solo/);
});

test('undeclared stricter review settings survive preparation and fail policy qualification',()=>{
  const {desiredRuleset,newRulesetTemplate}=require('../scripts/apply-repository-governance');
  for(const name of ['codex-review-service','codex-safe-core']){
    const repository={name,default_branch:'main',delete_branch_on_merge:true,allow_auto_merge:false,allow_merge_commit:false,allow_squash_merge:true,allow_rebase_merge:false};
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

test('a late seventh-repository preflight error cannot partially write the first six Rulesets',()=>{
  const {spawnSync}=require('node:child_process');
  const fixture=[
    "'use strict';",
    "process.argv.push('--apply','--create-missing','--align-service-solo','--acknowledge-service-review-policy-change');",
    "const {main}=require('./scripts/apply-repository-governance');",
    "let writes=0;const head='a'.repeat(40);",
    "globalThis.fetch=async(url,options={})=>{",
    " const p=new URL(url).pathname,n=p.split('/')[3],service=n==='codex-review-service';",
    " if(options.method!=='GET'){writes++;throw new Error('UNEXPECTED_SERVER_WRITE');}",
    " let data;",
    " if(p.endsWith('/rulesets/17'))data={id:17,name:'Codex Safe main protection',target:'branch',enforcement:'active',",
    "  conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},bypass_actors:[],rules:[",
    "    {type:'deletion'},{type:'non_fast_forward'},",
    "    {type:'pull_request',parameters:{required_approving_review_count:service?1:0,",
    "      dismiss_stale_reviews_on_push:service,require_last_push_approval:service,require_code_owner_review:false,",
    "      required_review_thread_resolution:false,required_reviewers:[],require_extra_approval_for_unattributed_changes:true}},",
    "    {type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,",
    "      required_status_checks:[{context:'CI Gate'}]}}]};",
    " else if(p.endsWith('/rulesets'))data=n==='codex-debug'?[]:[{id:17,name:'Codex Safe main protection'}];",
    " else if(p.endsWith('/branches/main'))data={commit:{sha:head}};",
    " else if(p.endsWith('/check-runs'))data={total_count:1,check_runs:[{name:'CI Gate',head_sha:head,",
    "  app:{id:15368,slug:'github-actions'},status:'completed',conclusion:n==='codex-debug'?'failure':'success'}]};",
    " else if(p.split('/').length===4)data={name:n,full_name:'jiying2007/'+n,default_branch:'main',",
    "   private:false,allow_squash_merge:true,allow_merge_commit:false,allow_rebase_merge:false,",
    "   delete_branch_on_merge:true,allow_auto_merge:false};",
    " else throw new Error('unhandled fixture URL: '+p);",
    " return Response.json(data);",
    "};",
    "main().then(()=>{console.error('unexpected governance success');process.exitCode=2;},error=>{",
    " if(!String(error.message).includes('codex-debug')||writes!==0){console.error(error.stack);process.exitCode=3;}",
    " else console.log('PREFLIGHT_DENIED_NO_WRITES');",
    "});"
  ].join('\n');
  const outcome=spawnSync(process.execPath,['-e',fixture],{
    cwd:root,encoding:'utf8',timeout:15000,
    env:{...process.env,GH_TOKEN:'fixture-do-not-use',GITHUB_TOKEN:''}
  });
  assert.equal(outcome.status,0,outcome.stderr||outcome.stdout);
  assert.match(outcome.stdout,/PREFLIGHT_DENIED_NO_WRITES/);
});

test('legacy gh CLI API adapter uses stored CLI auth without extracting or logging an invalid token',()=>{
  const {spawnSync}=require('node:child_process');
  const fixture=[
    "'use strict';",
    "process.argv.push('--gh-cli','--create-missing','--align-service-solo');",
    "const cp=require('node:child_process');let reads=0,writes=0;const head='a'.repeat(40);",
    "cp.spawnSync=(binary,args,options)=>{",
    " if(binary!=='gh'||args[0]!=='api'||args[1]!=='--method')throw Error('wrong gh invocation');",
    " if(options.shell!==false||options.env.GH_TOKEN!==undefined||options.env.GITHUB_TOKEN!==undefined||options.env.GH_HOST!=='github.com')throw Error('credential leaked to subprocess');",
    " const method=args[2],p=new URL('https://api.github.com'+args[3]).pathname,n=p.split('/')[3],service=n==='codex-review-service';",
    " if(method!=='GET'){writes++;throw Error('unexpected admin mutation');}reads++;",
    " let data;",
    " if(p.endsWith('/rulesets/17'))data={id:17,name:'Codex Safe main protection',target:'branch',enforcement:'active',",
    "  conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},bypass_actors:[],rules:[",
    "   {type:'deletion'},{type:'non_fast_forward'},",
    "   {type:'pull_request',parameters:{required_approving_review_count:service?1:0,",
    "     dismiss_stale_reviews_on_push:service,require_last_push_approval:service,require_code_owner_review:false,",
    "     required_review_thread_resolution:false,required_reviewers:[],require_extra_approval_for_unattributed_changes:true}},",
    "   {type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,",
    "     required_status_checks:[{context:'CI Gate'}]}}]};",
    " else if(p.endsWith('/rulesets'))data=n==='codex-debug'?[]:[{id:17,name:'Codex Safe main protection'}];",
    " else if(p.endsWith('/branches/main'))data={commit:{sha:head}};",
    " else if(p.endsWith('/check-runs'))data={total_count:1,check_runs:[{name:'CI Gate',head_sha:head,",
    "    app:{id:15368,slug:'github-actions'},status:'completed',conclusion:'success'}]};",
    " else if(p.split('/').length===4)data={name:n,full_name:'jiying2007/'+n,default_branch:'main',",
    "    private:false,allow_squash_merge:true,allow_merge_commit:false,allow_rebase_merge:false,",
    "    delete_branch_on_merge:true,allow_auto_merge:false};",
    " else throw Error('unhandled gh api fixture: '+p);",
    " return {status:0,stdout:JSON.stringify(data),stderr:''};",
    "};",
    "const {main}=require('./scripts/apply-repository-governance');",
    "main().then(()=>{if(reads<20||writes){console.error('bad read-only API inventory');process.exitCode=2;}",
    " else console.log('GH_API_READ_ONLY_PASS');},error=>{console.error(error.stack);process.exitCode=3;});"
  ].join('\n');
  const outcome=spawnSync(process.execPath,['-e',fixture],{
    cwd:root,encoding:'utf8',timeout:15000,
    env:{...process.env,GH_TOKEN:'unknown command "token" for "gh auth"\nUsage: gh auth <command>',GITHUB_TOKEN:'poisoned-token'}
  });
  assert.equal(outcome.status,0,outcome.stderr||outcome.stdout);
  assert.match(outcome.stdout,/PREFLIGHT PASS: 7 native repositories/);
  assert.match(outcome.stdout,/GH_API_READ_ONLY_PASS/);
  assert.match(outcome.stdout,/"auth": "gh-cli"/);
  assert.doesNotMatch(outcome.stdout,/poisoned-token|unknown command "token"/);
});
test('invalid legacy gh token command output fails safely before network calls',()=>{
  const {spawnSync}=require('node:child_process');
  const result=spawnSync(process.execPath,['scripts/apply-repository-governance.js','--create-missing','--align-service-solo'],{
    cwd:root,encoding:'utf8',timeout:3000,
    env:{...process.env,GH_TOKEN:'unknown command "token" for "gh auth"\nUsage: gh auth <command>',GITHUB_TOKEN:''}
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/contains line breaks/);
  assert.doesNotMatch(result.stderr,/Headers\.append|Bearer unknown/);
});

test('governance preserves exact Ruleset merge methods when public repo metadata hides settings',()=>{
  const {desiredRuleset,newRulesetTemplate}=require('../scripts/apply-repository-governance');
  const repo={name:'codex-safe-core',full_name:'jiying2007/codex-safe-core',
    default_branch:'main',private:false,allow_auto_merge:false,delete_branch_on_merge:true,
    allow_squash_merge:true};
  const native=newRulesetTemplate();
  const pr=native.rules.find(rule=>rule.type==='pull_request').parameters;
  pr.allowed_merge_methods=['squash'];
  const plan=desiredRuleset(repo,native,{repositoryName:repo.name});
  assert.deepEqual(plan.rules.find(rule=>rule.type==='pull_request').parameters.allowed_merge_methods,
    ['squash'],'do not expand native merge permissions to methods whose flags are unknown');
  assert.deepEqual(pr.allowed_merge_methods,['squash'],'never modify fetched server evidence');

  // Authenticated metadata can show more enabled methods; the pre-existing
  // native restriction must still be preserved rather than broadened.
  const complete={...repo,allow_merge_commit:true,allow_rebase_merge:true};
  assert.deepEqual(desiredRuleset(complete,native,{repositoryName:repo.name})
    .rules.find(rule=>rule.type==='pull_request').parameters.allowed_merge_methods,['squash']);

  const contradictory={...repo,allow_squash_merge:false};
  assert.throws(()=>desiredRuleset(contradictory,native,{repositoryName:repo.name}),
    /repository reports allow_squash_merge=false/);

  const duplicated=structuredClone(native);
  duplicated.rules.find(rule=>rule.type==='pull_request').parameters.allowed_merge_methods=['squash','squash'];
  assert.throws(()=>desiredRuleset(repo,duplicated,{repositoryName:repo.name}),/invalid or ambiguous/);
  const foreign=structuredClone(native);
  foreign.rules.find(rule=>rule.type==='pull_request').parameters.allowed_merge_methods=['fast-forward'];
  assert.throws(()=>desiredRuleset(repo,foreign,{repositoryName:repo.name}),/invalid or ambiguous/);
});

test('new Debug Ruleset requires observed merge-method settings instead of silently assuming none or all',()=>{
  const {desiredRuleset,newRulesetTemplate}=require('../scripts/apply-repository-governance');
  const hidden={name:'codex-debug',full_name:'jiying2007/codex-debug',default_branch:'main',
    private:false,allow_auto_merge:false,delete_branch_on_merge:false};
  assert.throws(()=>desiredRuleset(hidden,newRulesetTemplate(),{repositoryName:hidden.name}),
    error=>/unobservable/.test(error.message)&&/--gh-cli/.test(error.message));
  const allDisabled={...hidden,allow_merge_commit:false,allow_squash_merge:false,allow_rebase_merge:false};
  assert.throws(()=>desiredRuleset(allDisabled,newRulesetTemplate(),{repositoryName:hidden.name}),
    /explicitly reports all merge methods disabled/);
  const authenticated={...hidden,allow_merge_commit:true,allow_squash_merge:true,allow_rebase_merge:false};
  const plan=desiredRuleset(authenticated,newRulesetTemplate(),{repositoryName:hidden.name});
  assert.deepEqual(plan.rules.find(rule=>rule.type==='pull_request').parameters.allowed_merge_methods,
    ['merge','squash']);
});
