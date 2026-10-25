#!/usr/bin/env node
'use strict';

const {execFileSync}=require('node:child_process');
const {secureReadText,atomicWriteText}=require('../secure-local-file');
const coreContract=require('../core-contract.json');
const governance=require('../repository-governance-contract.json');
const registry=require('../family-registry.json');
const {CONSUMERS}=require('./family-release-state');
const {assess}=require('./verify-repository-ruleset');

const SHA=/^[0-9a-f]{40}$/;
const PR_FIELDS='number,url,author,baseRefName,headRefName,headRefOid,headRepository,headRepositoryOwner,isCrossRepository,isDraft,state,reviewDecision,mergeStateStatus,mergeable,mergeCommit,mergedAt';
const ACTIONS_APP_ID=15368;
function requireValue(ok,message){if(!ok)throw new Error(`Family Upgrade: ${message}`);}
function expectation(source=process.env){
  const coreSha=String(source.CORE_SHA||''),coreVersion=String(source.CORE_VERSION||'');
  requireValue(SHA.test(coreSha),'an exact released Core SHA is required');
  requireValue(coreVersion===coreContract.coreVersion,'Core version must match this orchestrator');
  requireValue(source.GITHUB_REPOSITORY_OWNER===registry.owner,'repository owner must be canonical');
  const upgradeId=`v${coreVersion}-${coreSha.slice(0,12)}`;
  return{owner:registry.owner,upgradeId,branch:`family-${upgradeId}`};
}
function validateState(input,expected,phase){
  const state=structuredClone(input);
  requireValue(state?.schemaVersion===1&&state.upgradeId===expected.upgradeId,'transaction identity does not match the released Core');
  requireValue(Array.isArray(state.entries)&&state.entries.length===CONSUMERS.length,'transaction must enumerate every active consumer exactly once');
  const seen=new Set();
  for(const entry of state.entries){
    requireValue(CONSUMERS.includes(entry.repository)&&!seen.has(entry.repository),'unexpected or duplicate consumer');seen.add(entry.repository);
    requireValue(entry.branch===expected.branch,'unexpected Family upgrade branch');
    requireValue((phase==='validate'?['prepared','skipped']:['validated','merged','skipped']).includes(entry.status),'unexpected transaction entry state');
    if(entry.status==='skipped'){requireValue(entry.prNumber===null&&entry.headSha===null,'skipped consumer cannot carry a PR');continue;}
    requireValue(Number.isSafeInteger(entry.prNumber)&&entry.prNumber>0,'invalid consumer PR number');
    if(phase==='merge')requireValue(SHA.test(entry.headSha),'merge requires a previously frozen head');
    if(entry.status==='merged')requireValue(SHA.test(entry.mergeCommitSha),'merged state requires an observed merge commit');
  }
  requireValue(phase==='validate'?state.phase==='prepared':['validated','merging','merged'].includes(state.phase),'unexpected transaction phase');
  return state;
}
function assertIdentity(pr,entry,expected,{merged=false}={}){
  const repo=`${expected.owner}/${entry.repository}`;
  requireValue(pr?.number===entry.prNumber&&pr.url===`https://github.com/${repo}/pull/${entry.prNumber}`,'PR repository/number does not match the transaction');
  requireValue(pr.baseRefName===governance.defaultBranch&&pr.headRefName===expected.branch,'PR base or Family branch changed');
  requireValue(pr.isCrossRepository===false&&pr.headRepository?.nameWithOwner===repo&&pr.headRepositoryOwner?.login===expected.owner,'fork or noncanonical PR head repository');
  requireValue(typeof pr.author?.login==='string'&&pr.author.login.length>0,'PR author identity is missing');
  requireValue(pr.state===(merged?'MERGED':'OPEN')&&pr.isDraft===false,'PR must be open and ready, or an observed completed merge');
  requireValue(SHA.test(pr.headRefOid)&&(!entry.headSha||pr.headRefOid===entry.headSha),'PR head changed after it was frozen');
  return pr;
}
function assertApproval(pr,reviews,head){
  requireValue(pr.reviewDecision==='APPROVED'&&pr.mergeStateStatus==='CLEAN'&&pr.mergeable==='MERGEABLE','independent approval and ordinary clean merge state are required');
  requireValue(Array.isArray(reviews),'review evidence is missing');
  const latest=new Map();
  for(const review of reviews){
    if(!['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(review?.state))continue;
    const login=review.user?.login;
    requireValue(typeof login==='string'&&login.length>0&&Number.isSafeInteger(review.id),'malformed review evidence');
    const previous=latest.get(login);
    if(!previous||review.id>previous.id)latest.set(login,review);
  }
  const approved=[...latest.values()].filter(review=>review.state==='APPROVED'&&review.commit_id===head&&review.user.login!==pr.author?.login);
  requireValue(approved.length>=governance.pullRequest.minimumApprovals,'current frozen head has no independent approval');
  return approved.map(review=>review.id);
}
function assertRequiredChecks(checks){
  requireValue(Array.isArray(checks)&&checks.length>0,'required checks are missing');
  requireValue(checks.every(check=>check?.bucket==='pass'&&check.state==='SUCCESS'),'every required check must explicitly succeed');
  for(const context of governance.requiredStatusChecks.contexts)requireValue(checks.some(check=>check.name===context),`required ${context} is missing`);
}
function assertGate(report,entry,expected,readRun){
  requireValue(Array.isArray(report?.check_runs)&&report.total_count===report.check_runs.length,'CI Gate check evidence is incomplete');
  const gates=report.check_runs.filter(check=>check.name==='CI Gate');
  requireValue(gates.length===1,'exactly one latest CI Gate is required');
  const gate=gates[0],repo=`${expected.owner}/${entry.repository}`;
  requireValue(gate.head_sha===entry.headSha&&gate.status==='completed'&&gate.conclusion==='success','CI Gate must succeed for the frozen PR head');
  requireValue(gate.app?.id===ACTIONS_APP_ID&&gate.app.slug==='github-actions','CI Gate must be produced by GitHub Actions');
  const prefix=`https://github.com/${repo}/actions/runs/`;
  requireValue(typeof gate.details_url==='string'&&gate.details_url.startsWith(prefix),'CI Gate run is outside the canonical repository');
  const suffix=gate.details_url.slice(prefix.length),match=/^([1-9][0-9]*)\/job\/([1-9][0-9]*)$/.exec(suffix);
  requireValue(match&&Number.isSafeInteger(Number(match[1])),'CI Gate run identity is malformed');
  const run=readRun(Number(match[1]));
  // Check runs and workflow-run metadata bind the PR head. The runner may
  // correctly check out refs/pull/N/merge, which is a different Git commit.
  requireValue(run?.id===Number(match[1])&&run.head_sha===entry.headSha&&run.repository?.full_name===repo&&run.head_repository?.full_name===repo,'CI workflow run does not bind the frozen PR head/repository');
  requireValue(run.event==='pull_request'&&run.path==='.github/workflows/ci.yml'&&run.status==='completed'&&run.conclusion==='success','CI Gate is not a completed successful canonical PR workflow');
  requireValue(Array.isArray(run.pull_requests)&&run.pull_requests.some(pr=>pr.number===entry.prNumber&&pr.head?.sha===entry.headSha&&pr.base?.ref===governance.defaultBranch),'CI workflow run is not associated with the expected PR');
  return{checkRunId:gate.id,workflowRunId:run.id};
}
function assertOrdinaryProtection(repository,rulesets,entry,expected){
  const repo=`${expected.owner}/${entry.repository}`;
  requireValue(repository?.full_name===repo&&repository.default_branch===governance.defaultBranch,'canonical main must be the protected default branch');
  requireValue(Array.isArray(rulesets),'ruleset evidence is missing');
  const applicable=rulesets.filter(detail=>detail?.target==='branch'&&detail.source_type==='Repository'&&detail.source===repo&&Array.isArray(detail.conditions?.ref_name?.exclude)&&detail.conditions.ref_name.exclude.length===0&&assess(detail,repository).ok);
  requireValue(applicable.length>0,'canonical main protection is not demonstrably applicable');
  // This optional response field is evaluated for the SAME GH_TOKEN used by
  // merge. Missing/unknown is not "never". Do not retry this read anonymously.
  requireValue(applicable.some(detail=>detail.current_user_can_bypass==='never'),'merge credential may bypass protection or its bypass capability is unobservable; preparation may continue but automated merge is refused');
}
function ready(entry,expected,client,{ordinary=false}={}){
  const before=assertIdentity(client.pr(entry),entry,expected);
  // Keep the existing all-checks gate as well as explicit required-context
  // checks. Neutral/skipped required contexts cannot authorize a merge.
  client.checks(entry,false);
  assertRequiredChecks(client.requiredChecks(entry));
  const reviewIds=assertApproval(before,client.reviews(entry),entry.headSha);
  const gate=assertGate(client.gates(entry),entry,expected,id=>client.run(entry,id));
  if(ordinary)assertOrdinaryProtection(client.repository(entry),client.rulesets(entry),entry,expected);
  const after=assertIdentity(client.pr(entry),entry,expected);
  assertApproval(after,client.reviews(entry),entry.headSha);
  return{...gate,reviewIds};
}
function validateUpgrade(input,expected,client){
  const state=validateState(input,expected,'validate'),pending=state.entries.filter(entry=>entry.status==='prepared');
  // Freeze every PR identity/head before waiting for any CI. No state is
  // marked validated until all frozen PRs pass the final batch barrier.
  for(const entry of pending)entry.headSha=assertIdentity(client.pr(entry),entry,expected).headRefOid;
  for(const entry of pending)client.checks(entry,true);
  for(const entry of pending)entry.validation=ready(entry,expected,client);
  for(const entry of pending)entry.status='validated';
  state.phase='validated';return state;
}
function observedMerge(entry,expected,client){
  const pr=assertIdentity(client.pr(entry),entry,expected,{merged:true});
  requireValue(SHA.test(pr.mergeCommit?.oid)&&typeof pr.mergedAt==='string'&&Number.isFinite(Date.parse(pr.mergedAt)),'merge completion is not observable');
  return{mergeCommitSha:pr.mergeCommit.oid,mergedAt:pr.mergedAt};
}
function mergeUpgrade(input,expected,client,persist=()=>{}){
  const state=validateState(input,expected,'merge'),pending=state.entries.filter(entry=>entry.status==='validated');
  // A resumed transaction must verify the previously recorded merged prefix.
  for(const entry of state.entries.filter(value=>value.status==='merged'))requireValue(observedMerge(entry,expected,client).mergeCommitSha===entry.mergeCommitSha,'recorded merge commit changed');
  for(const entry of pending)ready(entry,expected,client,{ordinary:true});
  for(const entry of pending){
    ready(entry,expected,client,{ordinary:true});
    let commandError;
    try{client.merge(entry);}catch(error){commandError=error;}
    let observed;
    try{observed=observedMerge(entry,expected,client);}catch(error){throw commandError||error;}
    Object.assign(entry,observed,{status:'merged'});state.phase='merging';persist(structuredClone(state));
    // A command may fail after the server merged (for example branch cleanup).
    // Persist that observed fact, then stop; never invent a rollback or merge.
    if(commandError)throw commandError;
  }
  state.phase='merged';persist(structuredClone(state));return state;
}
function createGitHubClient(expected,{source=process.env,execute=execFileSync}={}){
  requireValue(typeof source.GH_TOKEN==='string'&&source.GH_TOKEN.length>0,'the existing write GH_TOKEN is required');
  const env={...source,GH_HOST:'github.com',GH_PROMPT_DISABLED:'1'};
  delete env.GITHUB_TOKEN;delete env.GH_ENTERPRISE_TOKEN;delete env.GITHUB_ENTERPRISE_TOKEN;
  const command=(args,{watch=false}={})=>execute('gh',args,{env,encoding:'utf8',maxBuffer:8*1024*1024,timeout:watch?0:30000,stdio:watch?'inherit':['ignore','pipe','pipe']});
  const json=args=>JSON.parse(command(args)),repo=entry=>`${expected.owner}/${entry.repository}`;
  const api=(endpoint,{pages=false}={})=>json(['api','--hostname','github.com',...(pages?['--paginate','--slurp']:[]),endpoint]);
  const paged=endpoint=>{const pages=api(endpoint,{pages:true});requireValue(Array.isArray(pages)&&pages.every(Array.isArray),'malformed paginated API evidence');return pages.flat();};
  return{
    pr:entry=>json(['pr','view',String(entry.prNumber),'--repo',repo(entry),'--json',PR_FIELDS]),
    checks:(entry,watch)=>command(['pr','checks',String(entry.prNumber),'--repo',repo(entry),...(watch?['--watch','--fail-fast']:[])],{watch}),
    requiredChecks:entry=>json(['pr','checks',String(entry.prNumber),'--repo',repo(entry),'--required','--json','name,state,bucket']),
    reviews:entry=>paged(`repos/${repo(entry)}/pulls/${entry.prNumber}/reviews?per_page=100`),
    gates:entry=>api(`repos/${repo(entry)}/commits/${entry.headSha}/check-runs?check_name=CI%20Gate&filter=latest&per_page=100`),
    run:(entry,id)=>api(`repos/${repo(entry)}/actions/runs/${id}`),
    repository:entry=>api(`repos/${repo(entry)}`),
    rulesets:entry=>paged(`repos/${repo(entry)}/rulesets?includes_parents=true&per_page=100`).filter(rule=>rule.name===governance.rulesetName&&rule.enforcement==='active').map(rule=>{requireValue(Number.isSafeInteger(rule.id)&&rule.id>0,'invalid canonical ruleset id');return api(`repos/${repo(entry)}/rulesets/${rule.id}`);}),
    merge:entry=>command(['pr','merge',String(entry.prNumber),'--repo',repo(entry),'--squash','--delete-branch','--match-head-commit',entry.headSha])
  };
}
function main(){
  const mode=process.argv[2],file=process.argv[3]||'FAMILY_UPGRADE_STATE.json';
  requireValue(['validate','merge'].includes(mode)&&process.argv.length<=4,'expected validate or merge and an optional transaction file');
  const expected=expectation(),client=createGitHubClient(expected),input=JSON.parse(secureReadText(file,{maxBytes:1024*1024}));
  const persist=state=>atomicWriteText(file,JSON.stringify(state,null,2)+'\n');
  if(mode==='validate')persist(validateUpgrade(input,expected,client));else mergeUpgrade(input,expected,client,persist);
}
if(require.main===module){try{main();}catch(error){console.error(error.message||String(error));process.exitCode=1;}}
module.exports={assertApproval,assertGate,assertIdentity,assertOrdinaryProtection,assertRequiredChecks,createGitHubClient,expectation,mergeUpgrade,validateState,validateUpgrade};
