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
