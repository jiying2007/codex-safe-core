'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {buildSegmentedModelEconomics,qualityConstrainedPromotion}=require('../model-economics');

test('economics is segmented by routing and repository dimensions',()=>{
  const result=buildSegmentedModelEconomics([
    {mode:'balanced',role:'reviewer',provider:'relay',model:'a',profilePack:'embedded-linux',repoSizeBucket:'large',usage:{inputTokens:100,outputTokens:10},verifiedFindings:1},
    {mode:'fast',role:'scout',provider:'relay',model:'b',profilePack:'general',repoSizeBucket:'small',usage:{inputTokens:20,outputTokens:2},verifiedFindings:0}
  ]);
  assert.equal(result.segments.length,2);
  assert.ok(result.segments.some(item=>item.segment.profilePack==='embedded-linux'&&item.scorecard.usage.totalTokens===110));
});

test('promotion rejects perfect but undersized candidate samples',()=>{
  const result=qualityConstrainedPromotion({baseline:{recall:1,falsePositiveRate:0,criticalRecall:1},candidate:{recall:1,falsePositiveRate:0,criticalRecall:1,samples:24,criticalSamples:6},limits:{maxRecallDrop:0,maxFalsePositiveIncrease:0,maxCriticalRecallDrop:0,minimumSamples:80,minimumCriticalSamples:12}});
  assert.equal(result.approved,false);
  assert.ok(result.reasons.some(reason=>reason.startsWith('insufficient_samples:')));
  assert.ok(result.reasons.some(reason=>reason.startsWith('insufficient_critical_samples:')));
});
