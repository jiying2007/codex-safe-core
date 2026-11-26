'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{estimateRequestTokens,assertWithinTokenBudget}=require('../efficiency-planner');

test('preflight accepts exactly-at-budget and rejects one token below estimate',()=>{const input='abcdefgh',estimate=estimateRequestTokens(input,{estimatedOutputTokens:10,bytesPerToken:2});assert.doesNotThrow(()=>assertWithinTokenBudget(input,{maxTokens:estimate.totalTokens,estimatedOutputTokens:10,bytesPerToken:2}));assert.throws(()=>assertWithinTokenBudget(input,{maxTokens:estimate.totalTokens-1,estimatedOutputTokens:10,bytesPerToken:2}),error=>error.code==='ETOKENBUDGET');});

test('request context budget reserves prompt, output and safety tokens before context',()=>{
 const {planRequestContextBudget,assertWithinTokenBudget}=require('../efficiency-planner');
 const prefix='system prompt '.repeat(1000),suffix='\n--- CONTEXT ---\n';
 const plan=planRequestContextBudget({prefix,suffix,maxTokens:12000,estimatedOutputTokens:1000,reserveTokens:1500,bytesPerToken:2,maxContextBytes:1024*1024});
 assert.ok(plan.contextBytes>0);
 assert.ok(plan.fixedTokens+plan.estimatedOutputTokens+plan.reserveTokens<=plan.maxTokens);
 const context='x'.repeat(plan.contextBytes);
 const estimate=assertWithinTokenBudget(prefix+suffix+context,{maxTokens:plan.maxTokens,estimatedOutputTokens:plan.estimatedOutputTokens,bytesPerToken:plan.bytesPerToken});
 assert.ok(estimate.totalTokens<=plan.maxTokens);
});
test('request context budget fails closed when fixed prompt and reservations consume the budget',()=>{
 const {planRequestContextBudget}=require('../efficiency-planner');
 assert.throws(()=>planRequestContextBudget({prefix:'p'.repeat(2000),maxTokens:1000,estimatedOutputTokens:500,reserveTokens:100,bytesPerToken:2}),error=>error.code==='ETOKENBUDGET'&&error.budgetPlan.availableTokens<=0);
});
test('request context budget respects configured context cap and UTF-8 accounting',()=>{
 const {planRequestContextBudget,assertWithinTokenBudget}=require('../efficiency-planner');
 const prefix='你好'.repeat(100),plan=planRequestContextBudget({prefix,maxTokens:5000,estimatedOutputTokens:256,reserveTokens:256,bytesPerToken:2,maxContextBytes:2048});
 assert.equal(plan.contextBytes,2048);
 const context='汉'.repeat(Math.floor(plan.contextBytes/3));
 const estimate=assertWithinTokenBudget(prefix+context,{maxTokens:5000,estimatedOutputTokens:256,bytesPerToken:2});
 assert.ok(estimate.totalTokens<=5000);
});
