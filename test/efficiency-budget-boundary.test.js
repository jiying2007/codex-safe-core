'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{estimateRequestTokens,assertWithinTokenBudget}=require('../efficiency-planner');

test('preflight accepts exactly-at-budget and rejects one token below estimate',()=>{const input='abcdefgh',estimate=estimateRequestTokens(input,{estimatedOutputTokens:10,bytesPerToken:2});assert.doesNotThrow(()=>assertWithinTokenBudget(input,{maxTokens:estimate.totalTokens,estimatedOutputTokens:10,bytesPerToken:2}));assert.throws(()=>assertWithinTokenBudget(input,{maxTokens:estimate.totalTokens-1,estimatedOutputTokens:10,bytesPerToken:2}),error=>error.code==='ETOKENBUDGET');});
