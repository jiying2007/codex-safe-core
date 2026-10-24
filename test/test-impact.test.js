'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{buildTestImpactMap,formatTestImpactEvidence}=require('../test-impact');

test('test impact ranks explicit and same-stem tests',()=>{const result=buildTestImpactMap({changedPaths:['src/audio/aec.c'],signals:{symbols:['aec_process'],modules:[]},candidates:[{id:'test_aec',path:'tests/audio/aec_test.c',relatedPaths:['src/audio/aec.c']},{id:'test_other',path:'tests/net/socket_test.c',content:'aec_process();'}]});assert.equal(result.recommendedTests[0].id,'test_aec');assert.ok(result.recommendedTests[0].score>result.recommendedTests[1].score);assert.match(result.digest,/^[0-9a-f]{64}$/);});
test('test impact evidence is bounded and deterministic',()=>{const result=buildTestImpactMap({changedPaths:['src/a.c'],candidates:[{id:'a',path:'tests/a_test.c',relatedPaths:['src/a.c']}]});const formatted=formatTestImpactEvidence(result);assert.equal(formatted.included,1);assert.match(formatted.text,/TEST IMPACT EVIDENCE/);});

test('explicit test relationships do not alias actual a/ and b/ directories', () => {
  const result = buildTestImpactMap({ changedPaths: ['a/driver.c'], minScore: 100, candidates: [
    { id: 'a', path: 'tests/test_a.c', relatedPaths: ['a/driver.c'] },
    { id: 'b', path: 'tests/test_b.c', relatedPaths: ['b/driver.c'] }
  ] });
  assert.deepEqual(result.changedPaths, ['a/driver.c']);
  assert.deepEqual(result.recommendedTests.map(test => test.id), ['a']);
});
