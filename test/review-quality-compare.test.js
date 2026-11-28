'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {compareQualityRuns}=require('../scripts/review-quality-compare');
const cases=[{id:'bug',expected:[{file:'src/motor.c',line:3,category:'correctness',severity:'critical'}]},
 {id:'clean',expected:[]}];
const digest=crypto.createHash('sha256').update(JSON.stringify(cases)).digest('hex');
const corpus={cases};
const identity={model:'test-model',provider:'mock-offline',budgetClass:'1000-tokens',corpusDigest:digest};
const baseResults=[
 {id:'bug',findings:[],usage:{inputTokens:100,outputTokens:10},durationMs:30},
 {id:'clean',findings:[],usage:{inputTokens:90,outputTokens:10},durationMs:10}
];
const candidateResults=[
 {id:'bug',findings:[{file:'src/motor.c',line:3,category:'correctness'}],
   usage:{inputTokens:100,outputTokens:20},durationMs:45},
 {id:'clean',findings:[],usage:{inputTokens:90,outputTokens:10},durationMs:15}
];
test('offline precision/recall/time/token comparison uses one exact model and corpus identity',()=>{
 const result=compareQualityRuns(corpus,{...identity,results:baseResults},{...identity,results:candidateResults});
 assert.equal(result.schemaVersion,1);
 assert.equal(result.freshModelExecution,false);
 assert.equal(result.corpusDigest,digest);
 assert.equal(result.delta.recall,1);
 assert.equal(result.candidate.precision,1);
 assert.equal(result.candidate.criticalRecall,1);
 assert.equal(result.delta.totalTokens,10);
 assert.equal(result.delta.averageLatencyMs,10);
});
test('benchmark refuses missing results, fabricated unknown usage or incomparable identities',()=>{
 const baseline={...identity,results:baseResults},candidate={...identity,results:candidateResults};
 assert.throws(()=>compareQualityRuns(corpus,baseline,{...candidate,model:'another-model'}),/Incomparable/);
 assert.throws(()=>compareQualityRuns(corpus,baseline,{...candidate,corpusDigest:'0'.repeat(64)}),/digest mismatch/);
 assert.throws(()=>compareQualityRuns(corpus,baseline,{...candidate,results:candidateResults.slice(0,1)}),/result count/);
 assert.throws(()=>compareQualityRuns(corpus,baseline,{...candidate,results:[
   {...candidateResults[0],usage:null},candidateResults[1]]}),/incomplete real usage/);
 assert.throws(()=>compareQualityRuns({cases:[cases[0],cases[0]]},baseline,candidate),/Duplicate/);
});

test('offline comparison cannot coerce unknown usage or missing ground truth to zero',()=>{
 const baseline={...identity,results:baseResults},candidate={...identity,results:candidateResults};
 for(const value of [null,'100',true,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
   const usage={inputTokens:value,outputTokens:10};
   assert.throws(()=>compareQualityRuns(corpus,baseline,{...candidate,results:[{...candidateResults[0],usage},candidateResults[1]]}),/incomplete real usage/);
 }
 assert.throws(()=>compareQualityRuns(corpus,baseline,{...candidate,results:[{...candidateResults[0],usage:{known:false,inputTokens:0,outputTokens:0}},candidateResults[1]]}),/incomplete real usage/);
 const missing={cases:[{id:'bug'},cases[1]]};
 assert.throws(()=>compareQualityRuns(missing,baseline,candidate),/ground truth/);
 assert.throws(()=>compareQualityRuns({cases:[{expected:[]},cases[1]]},baseline,candidate),/invalid corpus case ID/);
});
test('equal aggregate high-risk recall cannot hide a lost baseline defect',()=>{
 const expected=[{file:'src/motor.c',line:3,category:'correctness',severity:'high'},{file:'src/motor.c',line:9,category:'concurrency',severity:'high'}];
 const c={cases:[{id:'bug',expected}]};
 const id={...identity,corpusDigest:crypto.createHash('sha256').update(JSON.stringify(c.cases)).digest('hex')};
 const run=(label,durationMs,validLine=true)=>({...id,results:[{id:'bug',findings:[{...label,validLine}],usage:{inputTokens:100,outputTokens:10},durationMs}]});
 const report=compareQualityRuns(c,run(expected[0],30),run(expected[1],45));
 assert.equal(report.delta.recall,0);
 assert.equal(report.highRiskLabels.baselineRecall,0.5);
 assert.equal(report.highRiskLabels.candidateRecall,0.5);
 assert.equal(report.highRiskLabels.lost[0].expectedIndex,0);
 assert.equal(report.highRiskLabels.gained[0].expectedIndex,1);
 assert.equal(report.highRiskLabels.noKnownHighRiskRegression,false);
 assert.equal(report.delta.p95DurationMs,15);
 assert.equal(report.productionQualified,false);
 const invalid=compareQualityRuns(c,run(expected[0],30),run(expected[0],45,false));
 assert.equal(invalid.highRiskLabels.lost.length,1);
 assert.equal(invalid.highRiskLabels.noKnownHighRiskRegression,false);
 const preserved=compareQualityRuns(c,run(expected[0],30),run(expected[0],15));
 assert.equal(preserved.highRiskLabels.lost.length,0);
 assert.equal(preserved.highRiskLabels.noKnownHighRiskRegression,true);
});
