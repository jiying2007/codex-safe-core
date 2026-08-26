'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../index');

test('efficiency result envelopes remain deterministic plain data',()=>{const usage=core.usageShape({input_tokens:1,output_tokens:2}),estimate=core.estimateRequestTokens('abc',{estimatedOutputTokens:3}),plan=core.selectChunksWithinByteBudget([{index:0,bytes:10,paths:['a.js'],text:'+a'}],10);assert.deepEqual(Object.keys(usage),['inputTokens','cachedInputTokens','cacheWriteInputTokens','outputTokens','reasoningOutputTokens']);assert.deepEqual(Object.keys(estimate),['inputTokens','outputTokens','totalTokens','bytes']);assert.equal(plan.complete,true);assert.equal(plan.chunks.length,1);assert.equal(plan.omitted.length,0);});
