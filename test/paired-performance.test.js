'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {selectBaseline,describeSource,collectPairedSamples,sampleProcess,buildPairReport,verifyPairReport}=require('../scripts/paired-performance-snapshot');
const identities={baseline:{sha:'a'.repeat(40),version:'4.18.4',repository:'jiying2007/codex-safe-core',tag:'v4.18.4',immutable:true,releaseAttestationVerified:true,ancestorVerified:true},candidate:{sha:'b'.repeat(40),version:'4.18.5'}};
const execution={harnessSha256:'c'.repeat(64),orchestratorSha256:'d'.repeat(64)};
const measurement={elapsedMs:100,rssGrowthBytes:1000,evidenceChunks:8,evidenceInputBytes:4194330,contextInputBytes:4194330,impactNodes:32,impactBytes:39340,estimatedTokens:497856,risk:2,plannedBytes:1046730,phaseTimingsMs:{impactGraph:20}};
const release=(tag,sha,date,extra={})=>({tag_name:tag,sha,published_at:date,immutable:true,draft:false,prerelease:false,html_url:`https://github.com/jiying2007/codex-safe-core/releases/tag/${tag}`,...extra});

test('baseline resolves the newest distinct final immutable release, never an arbitrary branch',()=>{
  const records=[release('v4.18.4',identities.baseline.sha,'2026-11-13'),release('v4.18.5',identities.candidate.sha,'2026-11-14'),release('codex-safe-performance-v4.18.5','c'.repeat(40),'2026-11-15')];
  const resolve=tag=>records.find(r=>r.tag_name===tag).sha;
  assert.deepEqual(selectBaseline(records,identities.candidate.sha,resolve,()=>true),{repository:'jiying2007/codex-safe-core',tag:'v4.18.4',sha:identities.baseline.sha,immutable:true});
  assert.throws(()=>selectBaseline(records.map(r=>({...r,immutable:false})),identities.candidate.sha,resolve,()=>true),/not immutable/);
  assert.throws(()=>selectBaseline(records.map(r=>({...r,html_url:r.html_url.replace('jiying2007','other')})),identities.candidate.sha,resolve,()=>true),/repository mismatch/);
  assert.throws(()=>selectBaseline(records,'main',resolve,()=>true),/exact/);
  assert.throws(()=>selectBaseline([],identities.candidate.sha,resolve,()=>true),/no distinct/);
  assert.throws(()=>selectBaseline(records,identities.candidate.sha,()=> 'branch',()=>true),/exact/);
});

test('the two sources alternate within each pair and retain all raw observations',()=>{
  const calls=[];
  const samples=collectPairedSamples((side,index)=>{calls.push([side,index]);return{...measurement,elapsedMs:100+index};},3);
  assert.deepEqual(calls,[['baseline',0],['candidate',0],['candidate',1],['baseline',1],['baseline',2],['candidate',2]]);
  assert.equal(samples.complete,true);assert.equal(samples.observations.length,6);
  assert.deepEqual(samples.samples.baseline.map(s=>s.elapsedMs),[100,101,102]);
  assert.throws(()=>collectPairedSamples(()=>measurement,4),/odd and bounded/);
});

test('a newer release outside candidate ancestry does not hide the newest eligible baseline',()=>{
  const records=[release('v4.18.6','e'.repeat(40),'2026-11-15'),release('v4.18.4',identities.baseline.sha,'2026-11-13')];
  const result=selectBaseline(records,identities.candidate.sha,tag=>records.find(r=>r.tag_name===tag).sha,sha=>sha===identities.baseline.sha);
  assert.equal(result.sha,identities.baseline.sha);
});

test('a failed or malformed child retains the earlier samples without retrying or inventing zero',()=>{
  let calls=0;
  const samples=collectPairedSamples(()=>{if(++calls===3)throw new Error('child timed out');return measurement;});
  assert.equal(calls,3);assert.equal(samples.complete,false);assert.equal(samples.observations.length,3);
  assert.equal(samples.observations[2].status,'failed');assert.match(samples.observations[2].error,/timed out/);
  const report=buildPairReport(samples,identities,execution);
  assert.equal(report.ok,false);assert.equal(report.comparison.reason,'measurement_failed');
  assert.equal(report.candidate,undefined);assert.throws(()=>verifyPairReport(report,identities.candidate.sha),/did not qualify/);
  assert.equal(collectPairedSamples(()=>({...measurement,elapsedMs:NaN})).complete,false);
});

test('paired qualification preserves absolute and relative budgets and source identities',()=>{
  const collect=elapsed=>collectPairedSamples(side=>({...measurement,elapsedMs:side==='candidate'?elapsed:100}));
  const pass=buildPairReport(collect(105),identities,execution);
  assert.equal(verifyPairReport(pass,identities.candidate.sha),true);
  assert.equal(pass.candidate.coreSha,identities.candidate.sha);assert.equal(pass.baseline.coreVersion,'4.18.4');
  assert.equal(pass.freshModelEvaluation,'not_run');
  const regression=buildPairReport(collect(112),identities,execution);
  assert.equal(regression.comparison.reason,'regression');assert.equal(regression.sampling.observations.length,14);
  assert.throws(()=>verifyPairReport(regression,identities.candidate.sha),/did not qualify/);
  assert.equal(buildPairReport(collect(6000),identities,execution).comparison.reason,'broad_budget');
  assert.throws(()=>verifyPairReport({...pass,sampling:{...pass.sampling,observations:pass.sampling.observations.slice(1)}},identities.candidate.sha),/incomplete/);
  assert.throws(()=>verifyPairReport({...pass,candidate:{...pass.candidate,coreSha:'c'.repeat(40)}},identities.candidate.sha),/expected commit/);
});

test('source identity rejects dirty or mismatched real checkouts',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'performance-source-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  git('init','-q');git('config','user.name','Performance fixture');git('config','user.email','fixture@example.invalid');git('config','commit.gpgsign','false');
  fs.writeFileSync(path.join(root,'core-contract.json'),JSON.stringify({coreVersion:'4.18.5'}));git('add','.');git('commit','-qm','Fixture');
  const sha=git('rev-parse','HEAD');assert.deepEqual(describeSource(root,sha),{sha,version:'4.18.5'});
  assert.throws(()=>describeSource(root,'f'.repeat(40)),/does not match/);
  fs.appendFileSync(path.join(root,'core-contract.json'),'\n');assert.throws(()=>describeSource(root,sha),/tracked changes/);
});

test('paired qualification rejects forged raw evidence, historical migration and unbound releases',()=>{
  const good=buildPairReport(collectPairedSamples(()=>({...measurement})),identities,execution);
  const mutations=[
    value=>{value.baseline.schemaVersion=2;value.baseline.node='other';value.baseline.environment={};},
    value=>{value.sampling.observations=value.sampling.observations.map(()=>({pair:1,side:'baseline',status:'success',measurement:{...measurement,elapsedMs:NaN}}));},
    value=>{for(const observation of value.sampling.observations)if(observation.side==='candidate')observation.measurement.elapsedMs=60000;},
    value=>{value.candidate.budgets.elapsedMs=100000;},
    value=>{delete value.identities.baseline.releaseAttestationVerified;},
    value=>{value.identities.baseline.repository='other/repo';},
    value=>{value.execution.harnessSha256='unknown';},
    value=>{value.candidate.metrics.elapsedMs=1;},
    value=>{value.candidate.sampling.elapsedMs[0]=1;},
    value=>{value.comparison={ok:true,migration:true,reason:'legacy_single_sample_baseline',result:null};}
  ];
  for(const mutate of mutations){const changed=structuredClone(good);mutate(changed);assert.throws(()=>verifyPairReport(changed,identities.candidate.sha));}
  assert.throws(()=>verifyPairReport(good,'e'.repeat(40)),/expected commit/);
  assert.throws(()=>verifyPairReport(good),/expected commit/);
});

test('isolated measurement loads the selected runtime with the common harness',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'performance-runtime-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'context-builder.js'),`exports.buildReviewEvidenceChunks=({diff})=>({chunks:[],inputDiffBytes:Buffer.byteLength(diff)}); exports.buildSemanticContext=({diff})=>({text:'selected runtime',sourceFiles:[],inputDiffBytes:Buffer.byteLength(diff)}); exports.splitUnifiedDiff=()=>[];`);
  fs.writeFileSync(path.join(root,'efficiency-planner.js'),`exports.estimateRequestTokens=()=>({totalTokens:123}); exports.scoreEvidenceRisk=()=>0; exports.selectChunksWithinByteBudget=()=>({bytes:0});`);
  fs.writeFileSync(path.join(root,'quality-platform.js'),`exports.buildImpactEvidenceGraph=()=>({nodes:[],bytes:0});`);
  const measured=sampleProcess(root);
  assert.equal(measured.estimatedTokens,123);assert.ok(measured.evidenceInputBytes>=4*1024*1024);
  fs.writeFileSync(path.join(root,'quality-platform.js'),`throw new Error('selected runtime failed');`);
  assert.throws(()=>sampleProcess(root),error=>{assert.match(error.message,/selected runtime failed/);assert.match(error.diagnostic.stderr,/selected runtime failed/);assert.equal(error.diagnostic.exitCode,1);return true;});
});
