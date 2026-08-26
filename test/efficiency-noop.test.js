'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{usageShape,usageTotal}=require('../efficiency-planner');
test('missing usage remains zero and deterministic',()=>{const usage=usageShape();assert.equal(usageTotal(usage),0);assert.deepEqual(Object.values(usage),[0,0,0,0,0]);});
