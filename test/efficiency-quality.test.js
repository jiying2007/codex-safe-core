'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{adaptiveBudget,selectChunksWithinByteBudget,assertWithinTokenBudget}=require('../efficiency-planner');

test('adaptive optimization never exceeds the caller cap',()=>{for(const cap of[1,16,1024,65536])for(const risk of[0,3,4,7,8,20])assert.ok(adaptiveBudget(cap,risk,{min:16384})<=cap);});
test('bounded chunk planning reports every omission instead of hiding coverage loss',()=>{const source=Array.from({length:4},(_,index)=>({index,bytes:1000,paths:[`src/${index}.js`],text:`+ change ${index}`})),plan=selectChunksWithinByteBudget(source,2000);assert.equal(plan.chunks.length+plan.omitted.length,source.length);assert.equal(plan.complete,false);assert.equal(plan.omitted.length,2);});
test('zero token budget means unlimited while a positive budget fails closed',()=>{assert.doesNotThrow(()=>assertWithinTokenBudget('x'.repeat(10000),{maxTokens:0}));assert.throws(()=>assertWithinTokenBudget('x'.repeat(10000),{maxTokens:100}),error=>error.code==='ETOKENBUDGET');});
