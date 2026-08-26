'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../index');

test('public Core surface can plan a bounded low-risk request end to end',()=>{const risk=core.scoreEvidenceRisk({paths:['docs/a.md'],text:'+ docs'}),budget=core.adaptiveBudget(65536,risk,{min:4096}),model=core.selectModel({model:'strong',fastModel:'fast',riskScore:risk}),estimate=core.assertWithinTokenBudget('x'.repeat(1000),{maxTokens:5000,estimatedOutputTokens:128});assert.ok(budget<=65536);assert.equal(model,'fast');assert.ok(estimate.totalTokens<=5000);});
