'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildReviewRiskEvidence,buildFunctionImpactEvidence}=require('../review-evidence-v2');
const fixture=require('../quality/embedded-review-structural-fixtures.json');

test('synthetic embedded regressions cover positive review hints and clean negative controls',()=>{
 assert.equal(fixture.schemaVersion,1);
 assert.equal(fixture.freshModelExecution,false);
 assert.ok(fixture.cases.length>=8);
 const ids=new Set();
 for(const c of fixture.cases){
   assert.equal(ids.has(c.id),false);ids.add(c.id);
   const risk=buildReviewRiskEvidence({diff:c.diff});
   assert.deepEqual(risk.signals.map(x=>x.ruleId),c.expectedRisk,c.id);
   const functionEvidence=buildFunctionImpactEvidence({diff:c.diff,candidates:c.candidates||[]});
   if(c.expectedChangedFunction){
     assert.equal(functionEvidence.seeds[0]?.name,c.expectedChangedFunction,c.id);
   }else assert.equal(functionEvidence.seeds.length,0,c.id);
   if(c.expectedIncomplete)assert.equal(functionEvidence.complete,false,c.id);
 }
});
