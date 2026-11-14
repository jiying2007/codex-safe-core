#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const {execFileSync,spawnSync}=require('node:child_process');
const {SAMPLE_COUNT,buildSnapshot,summarizeSamples}=require('./write-performance-snapshot');
const {compareSnapshots}=require('./compare-performance-snapshot');
const ROOT=path.resolve(__dirname,'..');
const HARNESS=path.join(__dirname,'write-performance-snapshot.js');
const REPOSITORY='jiying2007/codex-safe-core';
const SHA=/^[0-9a-f]{40}$/;
function requireValue(ok,message){if(!ok)throw new Error(message);}
function command(program,args,cwd=ROOT){return execFileSync(program,args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024,timeout:30000,stdio:['ignore','pipe','pipe']}).trim();}
function selectBaseline(releases,candidateSha,resolveTag,isAncestor){
  requireValue(SHA.test(candidateSha),'candidate SHA must be exact');
  requireValue(Array.isArray(releases),'release inventory is missing');
  requireValue(typeof isAncestor==='function','baseline ancestry verification is required');
  const formal=releases.filter(r=>r&&!r.draft&&!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name||''))
    .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
  for(const release of formal){
    requireValue(Number.isFinite(Date.parse(release.published_at)),'release date is invalid');
    const sha=resolveTag(release.tag_name);
    requireValue(SHA.test(sha),'baseline tag must resolve to an exact commit');
    if(sha===candidateSha||!isAncestor(sha))continue;
    requireValue(release.immutable===true,'newest distinct baseline release is not immutable');
    requireValue(release.html_url===`https://github.com/${REPOSITORY}/releases/tag/${release.tag_name}`,'baseline release repository mismatch');
    return{repository:REPOSITORY,tag:release.tag_name,sha,immutable:true};
  }
  throw new Error('no distinct immutable released baseline is available');
}
function describeSource(root,expectedSha){
  requireValue(SHA.test(expectedSha),'source SHA must be exact');
  requireValue(path.resolve(command('git',['rev-parse','--show-toplevel'],root))===path.resolve(root),'source must be a repository root');
  requireValue(command('git',['rev-parse','HEAD'],root)===expectedSha,'source checkout does not match expected SHA');
  requireValue(command('git',['status','--porcelain','--untracked-files=no'],root)==='','source checkout has tracked changes');
  const contract=JSON.parse(fs.readFileSync(path.join(root,'core-contract.json'),'utf8'));
  requireValue(/^\d+\.\d+\.\d+$/.test(contract.coreVersion),'source Core version is invalid');
  return{sha:expectedSha,version:contract.coreVersion};
}
function collectPairedSamples(sample,count=SAMPLE_COUNT){
  requireValue(Number.isSafeInteger(count)&&count>=3&&count<=21&&count%2===1,'pair count must be odd and bounded');
  const observations=[],samples={baseline:[],candidate:[]};
  for(let pair=0;pair<count;pair++){
    // Alternate the first side to reduce systematic warm-up/order effects.
    for(const side of pair%2===0?['baseline','candidate']:['candidate','baseline']){
      try{
        const measurement=sample(side,pair);
        requireValue(measurement&&Number.isFinite(measurement.elapsedMs)&&measurement.elapsedMs>0&&Number.isFinite(measurement.rssGrowthBytes)&&measurement.rssGrowthBytes>=0,'sample has invalid measurements');
        samples[side].push(measurement);
        observations.push({pair:pair+1,side,status:'success',measurement});
      }catch(error){
        observations.push({pair:pair+1,side,status:'failed',error:String(error.message||error).slice(0,4000),...(error.diagnostic?{diagnostic:error.diagnostic}:{})});
        return{complete:false,count,observations,samples};
      }
    }
  }
  return{complete:true,count,observations,samples};
}
function sampleProcess(root){
  const result=spawnSync(process.execPath,[HARNESS,'--single-sample','--runtime-root',root],{
    cwd:ROOT,encoding:'utf8',maxBuffer:1024*1024,timeout:30000,killSignal:'SIGKILL',env:process.env
  });
  try{
    requireValue(!result.error&&result.status===0,`sample failed: ${result.error?.message||result.stderr||`exit ${result.status}, signal ${result.signal}`}`);
    return JSON.parse(result.stdout.trim());
  }catch(error){
    // This trusted deterministic harness has no provider credentials. Retain
    // bounded child diagnostics; no failed observation enters the median.
    error.diagnostic={exitCode:result.status,signal:result.signal||null,stdout:String(result.stdout||'').slice(0,16384),stderr:String(result.stderr||'').slice(0,16384)};
    throw error;
  }
}
function buildPairReport(collection,identities,execution){
  const report={schemaVersion:1,kind:'paired-core-performance',evidenceClass:'deterministic-microbenchmark',freshModelEvaluation:'not_run',
    execution,identities,sampling:{method:'alternating-isolated-process-pairs',count:collection.count,observations:collection.observations},ok:false};
  if(!collection.complete)return{...report,comparison:{ok:false,reason:'measurement_failed',result:null}};
  try{
    const baseline=buildSnapshot(collection.samples.baseline,identities.baseline),candidate=buildSnapshot(collection.samples.candidate,identities.candidate);
    const comparison=compareSnapshots(candidate,baseline);
    return{...report,baseline,candidate,comparison,ok:comparison.ok};
  }catch(error){return{...report,comparison:{ok:false,reason:'invalid_measurements',result:null,error:String(error.message||error).slice(0,4000)}};}
}
function verifyPairReport(report,expectedCandidateSha){
  requireValue(report?.kind==='paired-core-performance'&&report.schemaVersion===1,'paired report schema is invalid');
  requireValue(report.ok===true&&report.comparison?.ok===true,'paired measurement did not qualify');
  requireValue(SHA.test(expectedCandidateSha||'')&&report.candidate?.coreSha===expectedCandidateSha,'paired candidate does not match the expected commit');
  requireValue(report.baseline?.schemaVersion===3&&report.candidate?.schemaVersion===3,'paired measurements require schema 3 on both sides');
  requireValue(report.comparison.migration===false&&report.comparison.reason==='within_regression_budget','historical migration is not a paired comparison');
  requireValue(/^[0-9a-f]{64}$/.test(report.execution?.harnessSha256||'')&&/^[0-9a-f]{64}$/.test(report.execution?.orchestratorSha256||''),'measurement harness identity is missing');
  const observations=report.sampling?.observations;
  requireValue(report.sampling?.method==='alternating-isolated-process-pairs'&&report.sampling?.count===SAMPLE_COUNT&&Array.isArray(observations)&&observations.length===SAMPLE_COUNT*2,'paired observations are incomplete');
  const samples={baseline:[],candidate:[]};
  for(let index=0;index<observations.length;index++){
    const pair=Math.floor(index/2),side=(pair%2===0?['baseline','candidate']:['candidate','baseline'])[index%2],observed=observations[index];
    requireValue(observed?.status==='success'&&observed.pair===pair+1&&observed.side===side,'paired observation order or status is invalid');
    samples[side].push(observed.measurement);
  }
  requireValue(report.baseline?.coreSha===report.identities?.baseline?.sha&&report.candidate?.coreSha===report.identities?.candidate?.sha,'paired source identity changed');
  requireValue(SHA.test(report.candidate?.coreSha||'')&&SHA.test(report.baseline?.coreSha||'')&&report.candidate.coreSha!==report.baseline.coreSha,'paired sources must be distinct exact commits');
  const release=report.identities.baseline;
  requireValue(release.repository===REPOSITORY&&release.tag===`v${release.version}`&&release.immutable===true&&release.releaseAttestationVerified===true&&release.ancestorVerified===true,'verified baseline release identity is missing');
  for(const side of ['baseline','candidate']){
    const snapshot=report[side],measurements=samples[side];
    requireValue(isDeepStrictEqual(snapshot.budgets,{elapsedMs:5000,rssGrowthBytes:256*1024*1024}),'paired absolute budgets changed');
    requireValue(isDeepStrictEqual(snapshot.metrics,summarizeSamples(measurements)),'paired aggregate does not match its raw observations');
    requireValue(snapshot.coreVersion===report.identities[side].version,'paired version identity changed');
    requireValue(snapshot.sampling?.count===SAMPLE_COUNT&&isDeepStrictEqual(snapshot.sampling.elapsedMs,measurements.map(m=>m.elapsedMs))&&isDeepStrictEqual(snapshot.sampling.rssGrowthBytes,measurements.map(m=>m.rssGrowthBytes)),'snapshot sampling does not match raw observations');
  }
  const comparison=compareSnapshots(report.candidate,report.baseline);
  requireValue(comparison.ok&&comparison.migration===false&&comparison.reason==='within_regression_budget'&&isDeepStrictEqual(comparison,report.comparison),'paired snapshots do not meet comparison budgets');
  return true;
}
function resolveBaseline(directory,output){
  const candidateSha=command('git',['rev-parse','HEAD']);
  const pages=JSON.parse(command('gh',['api','--paginate','--slurp',`repos/${REPOSITORY}/releases?per_page=100`]));
  requireValue(Array.isArray(pages)&&pages.every(Array.isArray),'release inventory is incomplete');
  const baseline=selectBaseline(pages.flat(),candidateSha,tag=>{
    command('git',['fetch','--no-tags','origin',`refs/tags/${tag}`]);
    return command('git',['rev-parse','FETCH_HEAD^{commit}']);
  },sha=>{
    const result=spawnSync('git',['merge-base','--is-ancestor',sha,candidateSha],{cwd:ROOT,encoding:'utf8',timeout:30000,killSignal:'SIGKILL'});
    requireValue(!result.error&&[0,1].includes(result.status),'baseline ancestry lookup failed');
    return result.status===0;
  });
  command('gh',['release','verify',baseline.tag,'--repo',REPOSITORY]);
  command('git',['merge-base','--is-ancestor',baseline.sha,candidateSha]);
  requireValue(!fs.existsSync(directory),'baseline destination must not already exist');
  command('git',['worktree','add','--detach',directory,baseline.sha]);
  describeSource(directory,baseline.sha);
  fs.writeFileSync(output,JSON.stringify({...baseline,candidateSha,releaseAttestationVerified:true,ancestorVerified:true},null,2)+'\n');
}
function measurePair(directory,identityFile,output){
  const baselineRecord=JSON.parse(fs.readFileSync(identityFile,'utf8'));
  const {repository,tag,immutable,releaseAttestationVerified,ancestorVerified}=baselineRecord;
  const identities={baseline:{...describeSource(directory,baselineRecord.sha),repository,tag,immutable,releaseAttestationVerified,ancestorVerified},candidate:describeSource(ROOT,baselineRecord.candidateSha)};
  const execution={node:process.execPath,harnessSha256:crypto.createHash('sha256').update(fs.readFileSync(HARNESS)).digest('hex'),
    orchestratorSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    workflowRunId:process.env.GITHUB_RUN_ID||null,workflowRunAttempt:process.env.GITHUB_RUN_ATTEMPT||null,recordedAt:new Date().toISOString()};
  const collection=collectPairedSamples(side=>sampleProcess(side==='baseline'?directory:ROOT));
  let report=buildPairReport(collection,identities,execution);
  try{describeSource(directory,baselineRecord.sha);describeSource(ROOT,baselineRecord.candidateSha);}catch(error){report={...report,ok:false,comparison:{ok:false,reason:'source_changed',result:null,error:error.message}};}
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,reason:report.comparison.reason,baseline:report.baseline?.metrics,candidate:report.candidate?.metrics}));
  // Raw output is preserved before the following workflow step qualifies it.
}
function main(){
  const [mode,directoryOrFile,identityFile,output]=process.argv.slice(2);
  if(mode==='resolve'&&directoryOrFile&&identityFile&&!output)return resolveBaseline(path.resolve(directoryOrFile),identityFile);
  if(mode==='measure'&&directoryOrFile&&identityFile&&output)return measurePair(path.resolve(directoryOrFile),identityFile,output);
  if(mode==='verify'&&directoryOrFile&&identityFile&&!output)return verifyPairReport(JSON.parse(fs.readFileSync(directoryOrFile,'utf8')),identityFile);
  throw new Error('Usage: paired-performance-snapshot.js resolve BASELINE_DIR IDENTITY_FILE | measure BASELINE_DIR IDENTITY_FILE REPORT | verify REPORT EXPECTED_CANDIDATE_SHA');
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={selectBaseline,describeSource,collectPairedSamples,sampleProcess,buildPairReport,verifyPairReport};
