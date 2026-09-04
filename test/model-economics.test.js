'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {buildModelEconomicsScorecard,compareShadowReview,qualityConstrainedPromotion}=require('../model-economics');

test('scorecard combines quality and token economics',()=>{
  const score=buildModelEconomicsScorecard([
    {usage:{inputTokens:1000,cachedInputTokens:500,outputTokens:100,reasoningOutputTokens:20},verifiedFindings:2,falsePositives:1,reviewedLines:100,coveredLines:90,verifierCalls:1,adjudicatorCalls:0,scoutCalls:1,latencyMs:1000,cost:0.1},
    {usage:{inputTokens:500,cachedInputTokens:250,outputTokens:50,reasoningOutputTokens:10},verifiedFindings:1,falsePositives:0,reviewedLines:50,coveredLines:50,verifierCalls:0,adjudicatorCalls:1,scoutCalls:0,latencyMs:2000,cost:0.05}
  ]);
  assert.equal(score.reviews,2);
  assert.equal(score.usage.totalTokens,1650);
  assert.equal(score.cachedInputRatio,0.5);
  assert.equal(score.tokensPerVerifiedFinding,550);
  assert.equal(score.coverageRatio,140/150);
  assert.equal(score.latencyMs.p95,2000);
});

test('shadow comparison never changes production verdict and exposes differences',()=>{
  const result=compareShadowReview({
    production:{findings:[{id:'a'},{id:'b'}],usage:{inputTokens:100},latencyMs:10},
    candidate:{findings:[{id:'b'},{id:'c'}],usage:{inputTokens:80},latencyMs:8}
  });
  assert.deepEqual(result.intersection,['b']);
  assert.deepEqual(result.productionOnly,['a']);
  assert.deepEqual(result.candidateOnly,['c']);
});

test('promotion fails when quality regression exceeds budget even if candidate is cheaper',()=>{
  const result=qualityConstrainedPromotion({
    baseline:{recall:0.95,falsePositiveRate:0.05,criticalRecall:1},
    candidate:{recall:0.9,falsePositiveRate:0.04,criticalRecall:0.9},
    limits:{maxRecallDrop:0.02,maxFalsePositiveIncrease:0.02,maxCriticalRecallDrop:0}
  });
  assert.equal(result.approved,false);
  assert.ok(result.reasons.some(reason=>reason.startsWith('recall_drop:')));
  assert.ok(result.reasons.some(reason=>reason.startsWith('critical_recall_drop:')));
});
