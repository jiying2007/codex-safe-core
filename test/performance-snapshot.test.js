'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{median,percentile95,summarizeSamples,buildSnapshot}=require('../scripts/write-performance-snapshot');
const{compareSnapshots,describeComparability}=require('../scripts/compare-performance-snapshot');
const base={elapsedMs:100,rssGrowthBytes:1000,evidenceChunks:8,evidenceInputBytes:4194330,contextInputBytes:4194330,impactNodes:32,impactBytes:39340,estimatedTokens:497856,risk:2,plannedBytes:1046730};
test('performance snapshots use a stable odd-sample median',()=>{assert.equal(median([180,120,150,140,160,130,170]),150);const samples=[90,100,110,95,105,120,80].map((elapsedMs,index)=>({...base,elapsedMs,rssGrowthBytes:1000+index*10}));const out=summarizeSamples(samples);assert.equal(out.elapsedMs,100);assert.equal(out.rssGrowthBytes,1030);assert.equal(out.elapsedP95Ms,120);assert.equal(out.rssP95Bytes,1060);});
test('performance samples fail closed on structural drift',()=>{const samples=Array.from({length:7},()=>({...base}));samples[3]={...samples[3],plannedBytes:123};assert.throws(()=>summarizeSamples(samples),/structural drift/);});
test('schema v3 migration does not compare median against legacy single sample',()=>{const current={schemaVersion:3,metrics:{elapsedMs:180,rssGrowthBytes:1000},budgets:{elapsedMs:5000,rssGrowthBytes:100000}},legacy={schemaVersion:2,metrics:{elapsedMs:140,rssGrowthBytes:1000}};assert.deepEqual(compareSnapshots(current,legacy),{ok:true,migration:true,reason:'legacy_single_sample_baseline',result:null});});
test('schema v3 keeps median-to-median relative regression gate',()=>{const current={schemaVersion:3,metrics:{elapsedMs:112,rssGrowthBytes:1000},budgets:{elapsedMs:5000,rssGrowthBytes:100000}},baseline={schemaVersion:3,metrics:{elapsedMs:100,rssGrowthBytes:1000}};assert.equal(compareSnapshots(current,baseline).ok,false);});

test('performance attribution reports bounded per-phase medians without changing the latency gate',()=>{
 const phases=['reviewChunks','semanticContext','estimateTokens','scoreRisk','selectBudget','candidatePreparation','impactGraph'];
 const samples=Array.from({length:7},(_,index)=>({...base,elapsedMs:100+index,rssGrowthBytes:1000+index,phaseTimingsMs:Object.fromEntries(phases.map((phase,i)=>[phase,10+i+index]))}));
 const metrics=summarizeSamples(samples);
 assert.equal(metrics.elapsedMs,103);
 assert.equal(metrics.phaseMediansMs.semanticContext,14);assert.equal(metrics.phaseP95Ms.semanticContext,17);assert.equal(metrics.elapsedP95Ms,106);assert.equal(metrics.rssP95Bytes,1006);
 assert.deepEqual(Object.keys(metrics.phaseMediansMs).sort(),phases.sort());
 const current={schemaVersion:3,metrics,budgets:{elapsedMs:5000,rssGrowthBytes:100000}};
 const prior={schemaVersion:3,metrics:{elapsedMs:90,rssGrowthBytes:1000}};
 assert.equal(compareSnapshots(current,prior).ok,false,'existing ten-percent relative limit must remain active');
});

test('performance snapshot retains per-process phase samples and exact workload/runner identity',()=>{
 const samples=Array.from({length:7},(_,i)=>({...base,elapsedMs:101+i,rssGrowthBytes:1000+i,phaseTimingsMs:{impactGraph:21+i,semanticContext:6+i}}));
 const snapshot=buildSnapshot(samples);
 assert.equal(snapshot.schemaVersion,3);
 assert.equal(snapshot.sampling.count,7);
 assert.deepEqual(snapshot.sampling.samples,samples.map(s=>({elapsedMs:s.elapsedMs,rssGrowthBytes:s.rssGrowthBytes,phaseTimingsMs:s.phaseTimingsMs})));
 assert.deepEqual(snapshot.sampling.elapsedMs,samples.map(s=>s.elapsedMs));
 assert.equal(snapshot.environment.arch,process.arch);
 assert.ok(snapshot.environment.logicalCpus>=1);
 assert.match(snapshot.workload.inputSha256,/^[0-9a-f]{64}$/);
 assert.equal(snapshot.metrics.elapsedMs,104);assert.equal(snapshot.metrics.elapsedP95Ms,107);assert.equal(snapshot.metrics.rssP95Bytes,1006);assert.match(snapshot.sampling.p95Estimator,/nearest-rank/);
});

test('performance comparison accepts valid zero RSS but fails closed on missing metrics',()=>{
 const current={schemaVersion:3,metrics:{elapsedMs:100,rssGrowthBytes:0},budgets:{elapsedMs:5000,rssGrowthBytes:1000000}};
 const baseline={schemaVersion:3,metrics:{elapsedMs:100,rssGrowthBytes:0}};
 assert.equal(compareSnapshots(current,baseline).ok,true);
 assert.deepEqual(compareSnapshots({...current,metrics:{elapsedMs:100}},baseline).reason,'broad_budget');
 assert.deepEqual(compareSnapshots({...current,metrics:{elapsedMs:0,rssGrowthBytes:0}},baseline).reason,'broad_budget');
 assert.equal(compareSnapshots({...current,metrics:{elapsedMs:112,rssGrowthBytes:0}},baseline).ok,false,'ten-percent gate stays strict');
});

test('cross-runner comparisons classify mismatched and unknown hardware without changing the gate',()=>{
 const env={node:'v22.22.2',platform:'linux',environment:{arch:'x64',osRelease:'6.1',cpuModel:'test-cpu',logicalCpus:4},workload:{inputSha256:'a'.repeat(64)}};
 assert.deepEqual(describeComparability(env,{...env,environment:{...env.environment}}),{status:'matched',missing:[],mismatched:[]});
 const different=describeComparability(env,{...env,environment:{...env.environment,cpuModel:'another-cpu'}});
 assert.equal(different.status,'different');assert.deepEqual(different.mismatched,['cpuModel']);
 const legacy=describeComparability(env,{node:'v22.22.2',platform:'linux',workload:{}});
 assert.equal(legacy.status,'unverified');assert.ok(legacy.missing.includes('workloadSha256'));
});


test('seven-sample p95 is the observed maximum, not a reliability SLO estimate',()=>{
  assert.equal(percentile95([9,1,5,3,7,4,6]),9);
  assert.throws(()=>percentile95([1,NaN,3]),/finite samples/);
  assert.throws(()=>percentile95([]),/finite samples/);
});
test('performance samples reject invalid time, missing RSS and partial phase measurements',()=>{
  const clean=Array.from({length:7},(_,i)=>({...base,elapsedMs:100+i,rssGrowthBytes:i,phaseTimingsMs:{impactGraph:7+i}}));
  assert.equal(summarizeSamples(clean).elapsedP95Ms,106);
  const badTime=clean.map(x=>({...x}));badTime[3].elapsedMs=NaN;
  assert.throws(()=>summarizeSamples(badTime),/invalid latency or RSS/);
  const badRss=clean.map(x=>({...x}));delete badRss[2].rssGrowthBytes;
  assert.throws(()=>summarizeSamples(badRss),/invalid latency or RSS/);
  const badPhase=clean.map(x=>({...x}));badPhase[1].phaseTimingsMs={};
  assert.throws(()=>summarizeSamples(badPhase),/incomplete or invalid/);
  const invalidStructure=clean.map(x=>({...x}));invalidStructure[0].plannedBytes=-1;
  assert.throws(()=>summarizeSamples(invalidStructure),/invalid structural field/);
});
test('corrupt or missing baseline metrics cannot silently pass the 10-percent gate',()=>{
  const current={schemaVersion:3,metrics:{elapsedMs:100,rssGrowthBytes:0},budgets:{elapsedMs:5000,rssGrowthBytes:1000000}};
  const good={schemaVersion:3,metrics:{elapsedMs:100,rssGrowthBytes:0}};
  assert.equal(compareSnapshots(current,good).ok,true);
  for(const metrics of [{elapsedMs:100},{rssGrowthBytes:0},{elapsedMs:0,rssGrowthBytes:0},
    {elapsedMs:NaN,rssGrowthBytes:0},{elapsedMs:100,rssGrowthBytes:-1},
    {elapsedMs:'100',rssGrowthBytes:0}]){
    const result=compareSnapshots(current,{schemaVersion:3,metrics});
    assert.equal(result.ok,false,JSON.stringify(metrics));
    assert.equal(result.reason,'invalid_baseline_metrics');
  }
  assert.equal(compareSnapshots(current,{schemaVersion:0,metrics:good.metrics}).reason,'unsupported_schema');
  assert.equal(compareSnapshots(current,{schemaVersion:2,metrics:good.metrics}).reason,'legacy_single_sample_baseline');
  assert.equal(compareSnapshots({...current,schemaVersion:2},good).reason,'incompatible_schema');
});
