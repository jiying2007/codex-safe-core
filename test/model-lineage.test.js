'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createModelLineagePin,compareModelLineagePin,createModelFailoverEvent}=require('../model-lineage');

function selection(model='model-a',provider='relay'){return{resolvedProvider:provider,resolvedModel:model,resolvedModelRevision:'rev-1',revisionPinStrength:'exact',registryRevision:'registry-v1',qualificationId:'qual-1',role:'reviewer',mode:'balanced'};}

test('lineage pin matches exact provider/model/routing identity',()=>{
  const pin=createModelLineagePin({lineageId:'lineage-1',routingPolicyRevision:'routing-v1',selection:selection()});
  const result=compareModelLineagePin(pin,selection(),{routingPolicyRevision:'routing-v1'});
  assert.equal(result.matches,true);
});

test('model or policy switch is explicit mismatch',()=>{
  const pin=createModelLineagePin({lineageId:'lineage-1',routingPolicyRevision:'routing-v1',selection:selection()});
  const result=compareModelLineagePin(pin,selection('model-b'),{routingPolicyRevision:'routing-v2'});
  assert.equal(result.matches,false);
  assert.ok(result.mismatches.includes('model'));
  assert.ok(result.mismatches.includes('routingPolicyRevision'));
});

test('failover event records cross-provider switch explicitly',()=>{
  const event=createModelFailoverEvent({lineageId:'lineage-1',from:selection(),to:selection('model-b','public'),reason:'primary unavailable',at:'2026-09-04T00:00:00.000Z'});
  assert.equal(event.type,'MODEL_FAILOVER');
  assert.equal(event.crossProvider,true);
  assert.equal(event.from.provider,'relay');
  assert.equal(event.to.provider,'public');
});
