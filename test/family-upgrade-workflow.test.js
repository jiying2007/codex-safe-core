'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {canonicalCoreReleaseCompatibility}=require('../scripts/family-release-state');
const {CONSUMERS}=require('../scripts/family-release-state');
const {createGitHubClient,expectation,mergeUpgrade,validateUpgrade}=require('../scripts/family-upgrade-pr');
const {assess}=require('../scripts/verify-repository-ruleset');
const governance=require('../repository-governance-contract.json');
const registry=require('../family-registry.json');
const coreContract=require('../core-contract.json');

const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-upgrade.yml'),'utf8');
const familyWorkflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-ci.yml'),'utf8');
const freshnessWorkflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-freshness.yml'),'utf8');

const headSha='b'.repeat(40);
const tagSha='a'.repeat(40);
const runtimeDigest='1'.repeat(64);
const surfaceManifestDigest='2'.repeat(64);
function release(overrides={}){return{ready:true,tag:'v4.17.5',tagSha,immutable:true,reason:'exact-immutable-release',...overrides};}
function digests(overrides={}){return{ready:true,runtimeDigest,governanceDigest:'3'.repeat(64),surfaceManifestDigest,reason:'verified-core-digests',...overrides};}
function headRuntime(overrides={}){return{ready:true,runtimeDigest,surfaceManifestDigest,reason:'verified-core-head-runtime-digest',...overrides};}

test('Family Upgrade resumes an already-materialized open upgrade PR instead of skipping it',()=>{
  assert.match(workflow,/gh pr list --repo .* --head "\$branch" --state open/);
  assert.match(workflow,/existing upgrade PR #\$pr is already materialized; resuming transaction/);
  assert.match(workflow,/"\$repo" prepared "\$pr" "\$branch"/);
  assert.match(workflow,/git -C "\$dir" checkout main/);
  assert.match(workflow,/main runtime-equivalent; no product repin\/release required/);
});

test('Family Upgrade uses ephemeral bot authentication for Git and repin without changing its gates',()=>{
  assert.match(workflow,/GH_TOKEN: \$\{\{ secrets\.FAMILY_BOT_TOKEN \}\}/);
  assert.match(workflow,/git\(\) \{ node "\$FAMILY_GIT" git "\$@"; \}/);
  assert.match(workflow,/git clone --quiet --recurse-submodules "https:\/\/github\.com\/\$\{GITHUB_REPOSITORY_OWNER\}\/\$\{repo\}\.git"/);
  assert.equal((workflow.match(/node "\$FAMILY_GIT" repin "\$dir" "\$CORE_SHA"/g)||[]).length,2);
  assert.doesNotMatch(workflow,/x-access-token:|git config --global|node "\$ORCH"/);
  assert.match(workflow,/export GIT_AUTHOR_NAME='codex-safe-family-bot'/);
  assert.match(workflow,/export GIT_COMMITTER_EMAIL="\$GIT_AUTHOR_EMAIL"/);
  assert.match(workflow,/git -C "\$dir" push --force-with-lease origin "\$branch"/);
  assert.match(workflow,/node scripts\/family-upgrade-pr\.js validate/);
  assert.match(workflow,/node scripts\/family-upgrade-pr\.js merge/);
  assert.match(workflow,/persist-credentials: false/);
});

test('Family Upgrade polls Family release state once per attempt and retries only transient query failures',()=>{
  const releaseStateCalls=workflow.match(/node scripts\/family-release-state\.js/g)||[];
  assert.equal(releaseStateCalls.length,1);
  assert.doesNotMatch(workflow,/family-release-state\.js --repo/);
  assert.match(workflow,/for attempt in \{1\.\.60\}/);
  assert.match(workflow,/429\|5\[0-9\]\{2\}/);
  assert.match(workflow,/ECONNRESET\|ETIMEDOUT\|fetch failed/);
  assert.match(workflow,/transient Family release-state query failure/);
  assert.match(workflow,/Family consumers did not reach exact release \+ distribution \+ runtime readiness/);
});

test('Family Upgrade enumerates only active consumers in every transaction phase',()=>{const activeEnumerations=workflow.match(/require\('\.\/scripts\/family-release-state'\)\.CONSUMERS/g)||[];assert.equal(activeEnumerations.length,2);assert.doesNotMatch(workflow,/Object\.keys\(require\('\.\/family-registry\.json'\)\.consumers\)/);});

test('Family Upgrade newline-terminates readiness parser output for Bash read under set -e',()=>{
  assert.match(workflow,/process\.stdout\.write\([^\n]+\+'\\n'\)/);
});

test('canonical Core accepts an immutable ancestor release only when current main is runtime-equivalent',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime(),{headSha,isAncestor:true});
  assert.deepEqual(result,{ready:true,reason:'canonical-immutable-release-runtime-equivalent-main'});
});

test('canonical Core fails closed when immutable release ancestry is broken',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime(),{headSha,isAncestor:false});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-release-not-ancestor-of-main');
});

test('canonical Core fails closed on unversioned runtime drift',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime({runtimeDigest:'4'.repeat(64)}),{headSha,isAncestor:true});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-runtime-changed-without-version-bump');
});

test('canonical Core fails closed on unversioned runtime-surface drift',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime({surfaceManifestDigest:'5'.repeat(64)}),{headSha,isAncestor:true});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-surface-manifest-changed-without-version-bump');
});

test('Family Freshness dispatches receipt-backed validation and preserves periodic full audits',()=>{
  assert.match(freshnessWorkflow,/push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(freshnessWorkflow,/family-ci\.yml[^\n]*full_matrix=false/);
  assert.match(familyWorkflow,/schedule:\s*\n\s*- cron:/);
  assert.match(familyWorkflow,/github\.event_name == 'schedule' \|\| inputs\.full_matrix == true/);
  assert.match(familyWorkflow,/\["ubuntu-latest","windows-latest","macos-latest"\]/);
  assert.match(familyWorkflow,/Full audit - re-run every released consumer CI/);
  assert.match(familyWorkflow,/ciReceipt\?\.receiptDigest\|\|!s\.ciReceipt\?\.runId/);
});

test('production Family audits enumerate only frozen Snapshot consumers with Bash 3.2 portable loops',()=>{
  const enumerations=familyWorkflow.match(/Object\.keys\(require\('\.\/FAMILY_SNAPSHOT\.json'\)\.consumers\|\|\{\}\)/g)||[];
  const nonEmptyGuards=familyWorkflow.match(/test -n "\$repos"/g)||[];
  const readLoops=familyWorkflow.match(/while IFS= read -r repo/g)||[];
  assert.equal(enumerations.length,2);
  assert.equal(nonEmptyGuards.length,2);
  assert.equal(readLoops.length,2);
  assert.doesNotMatch(familyWorkflow,/\bmapfile\b|\breadarray\b/);
  assert.doesNotMatch(familyWorkflow,/Object\.keys\(require\('\.\/family-registry\.json'\)\.consumers\)/);
  assert.doesNotMatch(familyWorkflow,/family\/codex-debug/);
});

function upgradeFixture(count=2){
  const expected=expectation({CORE_SHA:'f'.repeat(40),CORE_VERSION:coreContract.coreVersion,GITHUB_REPOSITORY_OWNER:registry.owner});
  const state={schemaVersion:1,upgradeId:expected.upgradeId,phase:'prepared',entries:CONSUMERS.map((repository,index)=>({repository,status:index<count?'prepared':'skipped',prNumber:index<count?index+101:null,branch:expected.branch,headSha:null}))};
  const data=new Map(),calls=[],writes=[];
  for(const [index,entry]of state.entries.entries()){
    if(entry.status==='skipped')continue;
    const repo=`${registry.owner}/${entry.repository}`,sha=String(index+1).repeat(40),runId=index+501;
    data.set(entry.repository,{
      pr:{number:entry.prNumber,url:`https://github.com/${repo}/pull/${entry.prNumber}`,author:{login:'family-writer'},baseRefName:'main',headRefName:expected.branch,headRefOid:sha,headRepository:{nameWithOwner:repo},headRepositoryOwner:{login:registry.owner},isCrossRepository:false,isDraft:false,state:'OPEN',reviewDecision:'APPROVED',mergeStateStatus:'CLEAN',mergeable:'MERGEABLE'},
      reviews:[{id:index+901,state:'APPROVED',commit_id:sha,user:{login:'independent-reviewer'}}],
      requiredChecks:[{name:'CI Gate',bucket:'pass',state:'SUCCESS'}],
      gates:{total_count:1,check_runs:[{id:index+701,name:'CI Gate',head_sha:sha,status:'completed',conclusion:'success',app:{id:15368,slug:'github-actions'},details_url:`https://github.com/${repo}/actions/runs/${runId}/job/${index+701}`}]},
      run:{id:runId,head_sha:sha,repository:{full_name:repo},head_repository:{full_name:repo},event:'pull_request',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',pull_requests:[{number:entry.prNumber,head:{sha},base:{ref:'main'}}]},
      repository:{full_name:repo,default_branch:'main',delete_branch_on_merge:true},
      rulesets:[{id:index+801,name:governance.rulesetName,target:'branch',source_type:'Repository',source:repo,enforcement:'active',current_user_can_bypass:'never',conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},bypass_actors:[],rules:[{type:'deletion'},{type:'non_fast_forward'},{type:'pull_request',parameters:{required_approving_review_count:1,dismiss_stale_reviews_on_push:true,require_code_owner_review:false,require_last_push_approval:true}},{type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,required_status_checks:[{context:'CI Gate'}]}}]}]
    });
  }
  const fixture={expected,state,data,calls,writes,hook:()=>{}};
  const call=(method,entry,extra)=>{const event={method,repository:entry.repository,headSha:entry.headSha,...extra};calls.push(event);fixture.hook(event,data.get(entry.repository));return data.get(entry.repository);};
  fixture.client={
    pr:entry=>structuredClone(call('pr',entry).pr),
    checks:(entry,watch)=>{call(watch?'watch':'checks',entry);},
    requiredChecks:entry=>structuredClone(call('requiredChecks',entry).requiredChecks),
    reviews:entry=>structuredClone(call('reviews',entry).reviews),
    gates:entry=>structuredClone(call('gates',entry).gates),
    run:(entry,id)=>structuredClone(call('run',entry,{runId:id}).run),
    repository:entry=>structuredClone(call('repository',entry).repository),
    rulesets:entry=>structuredClone(call('rulesets',entry).rulesets),
    merge:entry=>{const value=call('merge',entry);value.pr.state='MERGED';value.pr.mergeCommit={oid:'d'.repeat(40)};value.pr.mergedAt='2026-10-25T00:00:00Z';}
  };
  fixture.validate=()=>validateUpgrade(state,expected,fixture.client);
  fixture.merge=validated=>mergeUpgrade(validated,expected,fixture.client,value=>writes.push(structuredClone(value)));
  return fixture;
}

test('Family validation freezes every identity before all-checks waits and commits no partial validation',()=>{
  const f=upgradeFixture(),before=structuredClone(f.state),validated=f.validate();
  assert.deepEqual(f.calls.slice(0,4).map(call=>call.method),['pr','pr','watch','watch']);
  assert.equal(validated.phase,'validated');assert.equal(validated.entries.filter(entry=>entry.status==='validated').length,2);
  assert.deepEqual(f.state,before);assert.equal(f.calls.some(call=>call.method==='merge'),false);
  assert.deepEqual(validated.entries[0].validation,{checkRunId:701,workflowRunId:501,reviewIds:[901]});
});

test('checked head A cannot authorize head B after a checks wait',()=>{
  const f=upgradeFixture(),before=structuredClone(f.state);
  f.hook=(event,value)=>{if(event.method==='watch')value.pr.headRefOid='e'.repeat(40);};
  assert.throws(f.validate,/head changed/);assert.deepEqual(f.state,before);
  assert.equal(f.calls.some(call=>call.method==='merge'),false);
});

for(const [label,mutate]of [
  ['no independent approval',value=>{value.pr.reviewDecision='REVIEW_REQUIRED';}],
  ['blocked merge state',value=>{value.pr.mergeStateStatus='BLOCKED';}],
  ['unknown merge state',value=>{value.pr.mergeStateStatus='UNKNOWN';}],
  ['approval for an older head',value=>{value.reviews[0].commit_id='e'.repeat(40);}],
  ['dismissed approval',value=>{value.reviews[0].state='DISMISSED';}],
  ['author self-approval',value=>{value.reviews[0].user.login=value.pr.author.login;}]
])test(`Family validation rejects ${label} even with a successful CI Gate`,()=>{
  const f=upgradeFixture();mutate([...f.data.values()][1]);
  assert.throws(f.validate,/approval|merge state/);assert.equal(f.calls.some(call=>call.method==='merge'),false);
});

for(const [label,mutate]of [
  ['same-named fork branch',value=>{value.pr.isCrossRepository=true;value.pr.headRepository.nameWithOwner='outsider/codex-review';}],
  ['wrong repository URL',value=>{value.pr.url='https://github.com/outsider/codex-review/pull/101';}],
  ['different base',value=>{value.pr.baseRefName='develop';}],
  ['different Family branch',value=>{value.pr.headRefName='family-other';}],
  ['draft PR',value=>{value.pr.isDraft=true;}],
  ['closed PR',value=>{value.pr.state='CLOSED';}],
  ['missing author identity',value=>{delete value.pr.author;}]
])test(`Family freeze rejects ${label} before starting any checks wait`,()=>{
  const f=upgradeFixture();mutate([...f.data.values()][1]);
  assert.throws(f.validate,/Family Upgrade/);assert.equal(f.calls.some(call=>call.method==='watch'||call.method==='merge'),false);
});

for(const [label,mutate]of [
  ['missing gate',value=>{value.gates={total_count:0,check_runs:[]};}],
  ['failed gate',value=>{value.gates.check_runs[0].conclusion='failure';}],
  ['skipped gate',value=>{value.gates.check_runs[0].conclusion='skipped';}],
  ['old-head gate',value=>{value.gates.check_runs[0].head_sha='e'.repeat(40);}],
  ['same-named non-Actions gate',value=>{value.gates.check_runs[0].app={id:42,slug:'other-app'};}],
  ['foreign workflow',value=>{value.run.repository.full_name='outsider/codex-review';}],
  ['wrong workflow path',value=>{value.run.path='.github/workflows/pretend.yml';}],
  ['wrong PR association',value=>{value.run.pull_requests[0].number=999;}],
  ['missing required contexts',value=>{value.requiredChecks=[];}],
  ['neutral required context',value=>{value.requiredChecks[0].state='NEUTRAL';}],
  ['pending required context',value=>{value.requiredChecks[0].state='PENDING';value.requiredChecks[0].bucket='pending';}]
])test(`Family readiness rejects ${label}`,()=>{
  const f=upgradeFixture();mutate([...f.data.values()][0]);
  assert.throws(f.validate,/Family Upgrade/);assert.equal(f.calls.some(call=>call.method==='merge'),false);
});

test('the PR head binds CI metadata while a different synthetic merge checkout remains valid',()=>{
  const f=upgradeFixture();for(const value of f.data.values())value.run.head_commit={id:'e'.repeat(40)};
  assert.equal(f.validate().phase,'validated');
});

test('every PR must still be approved in the Phase 2 batch barrier before the first merge',()=>{
  const f=upgradeFixture(),validated=f.validate();f.calls.length=0;
  [...f.data.values()][1].pr.reviewDecision='REVIEW_REQUIRED';
  assert.throws(()=>f.merge(validated),/approval/);assert.equal(f.calls.some(call=>call.method==='merge'),false);assert.deepEqual(f.writes,[]);
});

for(const bypass of ['always','pull_requests_only',undefined,'unknown'])test(`automatic merge refuses bypass capability ${String(bypass)}`,()=>{
  const f=upgradeFixture(),validated=f.validate();f.calls.length=0;
  [...f.data.values()][1].rulesets[0].current_user_can_bypass=bypass;
  assert.throws(()=>f.merge(validated),/bypass/);assert.equal(f.calls.some(call=>call.method==='merge'),false);
});

for(const [label,mutate]of [
  ['excluded main',value=>{value.rulesets[0].conditions.ref_name.exclude=['refs/heads/main'];}],
  ['different default branch',value=>{value.repository.default_branch='develop';}],
  ['tag ruleset',value=>{value.rulesets[0].target='tag';}],
  ['disabled ruleset',value=>{value.rulesets[0].enforcement='disabled';}]
])test(`canonical governance and the merge barrier reject ${label}`,()=>{
  const f=upgradeFixture(),validated=f.validate(),value=[...f.data.values()][0];mutate(value);
  assert.equal(assess(value.rulesets[0],value.repository).ok,false);
  assert.throws(()=>f.merge(validated),/protection|default branch/);assert.equal(f.calls.some(call=>call.method==='merge'),false);
});

test('head changes after the batch barrier are rejected again immediately before merge',()=>{
  const f=upgradeFixture(),validated=f.validate(),first=validated.entries[0].repository;f.calls.length=0;
  let reads=0;f.hook=(event,value)=>{if(event.method==='pr'&&event.repository===first&&++reads===3)value.pr.headRefOid='e'.repeat(40);};
  assert.throws(()=>f.merge(validated),/head changed/);assert.equal(f.calls.some(call=>call.method==='merge'),false);
});

test('a newly observable write-actor bypass is rejected immediately before merge',()=>{
  const f=upgradeFixture(),validated=f.validate(),first=validated.entries[0].repository;f.calls.length=0;
  let reads=0;f.hook=(event,value)=>{if(event.method==='rulesets'&&event.repository===first&&++reads===2)value.rulesets[0].current_user_can_bypass='pull_requests_only';};
  assert.throws(()=>f.merge(validated),/bypass/);assert.equal(f.calls.some(call=>call.method==='merge'),false);
});

test('successful ordinary merges record each observed completion without claiming atomicity',()=>{
  const f=upgradeFixture(),validated=f.validate(),result=f.merge(validated);
  assert.equal(result.phase,'merged');assert.equal(f.writes.length,3);
  assert.equal(f.writes[0].entries[0].status,'merged');assert.equal(f.writes[0].entries[1].status,'validated');
  assert.equal(f.writes[1].entries[1].status,'merged');assert.equal(f.writes[2].phase,'merged');
  assert.equal(f.calls.filter(call=>call.method==='merge').length,2);
  assert.match(workflow,/Preserve observed transaction state after success or failure/);
  assert.match(workflow,/always\(\) && steps\.prepare\.outcome == 'success'/);
  assert.match(workflow,/name: family-upgrade-result-\$\{\{ inputs\.core_sha \}\}-\$\{\{ github\.run_attempt \}\}/);
});

test('a later rejected merge retains only the actually merged prefix',()=>{
  const f=upgradeFixture(),validated=f.validate(),second=validated.entries[1].repository;
  f.hook=event=>{if(event.method==='merge'&&event.repository===second)throw new Error('server rejected changed approval');};
  assert.throws(()=>f.merge(validated),/server rejected/);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].phase,'merging');
  assert.equal(f.writes[0].entries[0].status,'merged');assert.equal(f.writes[0].entries[1].status,'validated');
});

test('an accepted-but-unmerged command cannot produce merged transaction state',()=>{
  const f=upgradeFixture(),validated=f.validate();f.client.merge=entry=>{f.calls.push({method:'merge',repository:entry.repository});};
  assert.throws(()=>f.merge(validated),/observed completed merge/);assert.deepEqual(f.writes,[]);
});

test('a failed command after a real merge records the observed completion and stops',()=>{
  const f=upgradeFixture(),validated=f.validate();
  f.client.merge=entry=>{const value=f.data.get(entry.repository);value.pr.state='MERGED';value.pr.mergeCommit={oid:'d'.repeat(40)};value.pr.mergedAt='2026-10-25T00:00:00Z';throw new Error('branch cleanup failed after merge');};
  assert.throws(()=>f.merge(validated),/branch cleanup failed/);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].entries[0].status,'merged');assert.equal(f.writes[0].entries[1].status,'validated');
});

test('a merged PR retargeted away from canonical main is never recorded as successful',()=>{
  const f=upgradeFixture(),validated=f.validate(),merge=f.client.merge;
  f.client.merge=entry=>{merge(entry);f.data.get(entry.repository).pr.baseRefName='develop';};
  assert.throws(()=>f.merge(validated),/base or Family branch/);assert.deepEqual(f.writes,[]);
});

test('GitHub reads and merges retain the same write token, all-checks wait, and exact-head lease',()=>{
  const f=upgradeFixture(),calls=[],source={GH_TOKEN:'fixture-write',GITHUB_TOKEN:'fixture-other',CODEX_SAFE_FAMILY_READ_TOKEN:'fixture-read'};
  const client=createGitHubClient(f.expected,{source,execute:(command,args,options)=>{calls.push({command,args,options});if(args[0]==='api'&&args.includes('--paginate'))return JSON.stringify([[{name:governance.rulesetName,enforcement:'active',id:9}]]);return '{}';}});
  const entry={...f.state.entries[0],headSha:'1'.repeat(40)};
  client.checks(entry,true);client.rulesets(entry);client.merge(entry);
  assert.deepEqual(calls[0].args,['pr','checks','101','--repo',`${registry.owner}/${entry.repository}`,'--watch','--fail-fast']);
  assert.deepEqual(calls.at(-1).args,['pr','merge','101','--repo',`${registry.owner}/${entry.repository}`,'--squash','--delete-branch','--match-head-commit',entry.headSha]);
  for(const call of calls){assert.equal(call.command,'gh');assert.equal(call.options.env.GH_TOKEN,'fixture-write');assert.equal(call.options.env.GITHUB_TOKEN,undefined);assert.equal(call.options.env.GH_HOST,'github.com');assert.equal(call.args.includes('--admin'),false);assert.equal(call.args.includes('review'),false);}
  assert.throws(()=>createGitHubClient(f.expected,{source:{CODEX_SAFE_FAMILY_READ_TOKEN:'fixture-read'}}),/write GH_TOKEN/);
});
