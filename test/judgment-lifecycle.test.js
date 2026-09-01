'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('..');

const subject={type:'git-index',headOid:'1'.repeat(40),indexFingerprint:'2'.repeat(64),stagedFileCount:1};
const base={subject,diffFingerprint:'3'.repeat(64),policyFingerprint:'4'.repeat(64),evidenceManifestDigest:'5'.repeat(64),reviewProfile:'standard',model:'gpt-test'};

test('review subject fingerprint changes with evidence, policy and model identity',()=>{
  const a=core.computeReviewSubjectFingerprint(base);
  const evidence=core.computeReviewSubjectFingerprint({...base,evidenceManifestDigest:'6'.repeat(64)});
  const policy=core.computeReviewSubjectFingerprint({...base,policyFingerprint:'7'.repeat(64)});
  const model=core.computeReviewSubjectFingerprint({...base,model:'gpt-other'});
  assert.match(a,/^[0-9a-f]{64}$/);
  assert.notEqual(a,evidence);
  assert.notEqual(a,policy);
  assert.notEqual(a,model);
});

test('only fresh inference may emit a new judgment receipt',()=>{
  assert.equal(core.shouldPersistJudgmentReceipt({executionMode:'fresh',inference:true}),true);
  assert.equal(core.shouldPersistJudgmentReceipt({executionMode:'replay',inference:false}),false);
  assert.equal(core.shouldPersistJudgmentReceipt({executionMode:'fresh',inference:false}),false);
});

test('delivery qualification is quality/coverage based, not merge readiness',()=>{
  assert.equal(core.reviewReceiptQualifiesForDelivery({coverageVerdict:'complete',mechanicalGate:'pass',qualityVerdict:'no_findings',readinessVerdict:'needs_evidence'}),true);
  assert.equal(core.reviewReceiptQualifiesForDelivery({coverageVerdict:'incomplete',mechanicalGate:'pass',qualityVerdict:'no_findings'}),false);
  assert.equal(core.reviewReceiptQualifiesForDelivery({coverageVerdict:'complete',mechanicalGate:'fail',qualityVerdict:'no_findings'}),false);
  assert.equal(core.reviewReceiptQualifiesForDelivery({coverageVerdict:'complete',mechanicalGate:'pass',qualityVerdict:'blocked'}),false);
});

test('receipt identity requires both subject and evidence digests',()=>{
  const receipt={reviewSubjectFingerprint:'a'.repeat(64),evidenceManifestDigest:'b'.repeat(64)};
  assert.equal(core.reviewReceiptMatchesIdentity(receipt,{reviewSubjectFingerprint:'a'.repeat(64),evidenceManifestDigest:'b'.repeat(64)}),true);
  assert.equal(core.reviewReceiptMatchesIdentity(receipt,{reviewSubjectFingerprint:'a'.repeat(64),evidenceManifestDigest:'c'.repeat(64)}),false);
});
