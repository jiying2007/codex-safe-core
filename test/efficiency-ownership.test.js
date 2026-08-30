'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../core-ownership-manifest.json');
const core=require('../index');

test('efficiency primitives are Core-owned and publicly exported',()=>{
  for(const capability of ['token-usage-normalization','token-preflight-estimation','token-estimator-calibration','risk-aware-budgeting','model-routing-primitives','token-reservation-ledger'])assert.ok(manifest.coreOwned.includes(capability));
  for(const name of ['extractCodexUsage','estimateRequestTokens','assertWithinTokenBudget','TokenEstimatorCalibration','scoreEvidenceRisk','adaptiveBudget','selectModel','selectChunksWithinByteBudget','TokenBudgetLedger'])assert.equal(typeof core[name],'function');
});
