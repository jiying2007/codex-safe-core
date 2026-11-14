'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{compactFailureLog,classifyFailureDeterministically,buildDiagnosisEvidence,buildDiagnosisInputManifest,normalizeDiagnosisResult,createDiagnosisReceipt,validateDiagnosisReceipt,formatDiagnosisMarkdown}=require('../diagnosis-platform');

test('shared diagnostic redaction covers structured fields, URLs, headers and complete or truncated keys',()=>{
  const {redactDiagnosticText,boundUtf8Text}=require('../index');
  const secrets=['bearerCanary123','basicCanary456','queryCanary789','jsonCanary123','urlCanary456','pemCanary789','envCanary012'];
  const raw=[`Authorization: Bearer ${secrets[0]}`,`Proxy-Authorization: Basic ${secrets[1]}`,
    `https://example.test/?access_token=${secrets[2]}&page=2`,`{"client_secret":"${secrets[3]}"}`,
    `https://user:${secrets[4]}@example.test/repo`,`PASSWORD='${secrets[6]}'`,
    `-----BEGIN PRIVATE KEY-----\n${secrets[5]}\n-----END PRIVATE KEY-----`].join('\n');
  const clean=redactDiagnosticText(raw);
  for(const secret of secrets)assert.ok(!clean.includes(secret),secret);
  assert.match(clean,/page=2/);assert.match(clean,/example\.test\/repo/);
  assert.equal(redactDiagnosticText(clean),clean,'redacting twice must be stable');
  assert.doesNotMatch(redactDiagnosticText('-----BEGIN RSA PRIVATE KEY-----\nunclosedCanary'),/unclosedCanary/);
  assert.doesNotMatch(boundUtf8Text(redactDiagnosticText(raw),40),/bearerCanary/);
  assert.deepEqual(JSON.parse(redactDiagnosticText('{"client_secret":"jsonCanary123"}')),{client_secret:'[REDACTED]'});
  assert.equal(redactDiagnosticText('OPENAI_API_KEY=envCanary\nAWS_SECRET_ACCESS_KEY=awsCanary'),'OPENAI_API_KEY=[REDACTED]\nAWS_SECRET_ACCESS_KEY=[REDACTED]');
});
test('UTF-8 diagnostic byte limits never split a code point or silently accept invalid limits',()=>{
  const {boundUtf8Text}=require('../index');
  const input='a中😀z';
  for(let limit=0;limit<=Buffer.byteLength(input);limit++){
    const output=boundUtf8Text(input,limit);
    assert.ok(Buffer.byteLength(output)<=limit);
    assert.ok(input.startsWith(output));assert.ok(!output.includes('\ufffd'));
  }
  for(const bad of [-1,1.5,NaN,Infinity,'3'])assert.throws(()=>boundUtf8Text(input,bad),/byte limit/);
});
test('diagnosis manifest preserves raw paths and optionally binds exact delivered prompt bytes',()=>{
  const evidence=buildDiagnosisEvidence({log:'test failure',job:{commitSha:'abc123'}});
  const a=buildDiagnosisInputManifest({evidence,changedPaths:['x\\y.c'],deliveredPrompt:'prompt one'});
  const b=buildDiagnosisInputManifest({evidence,changedPaths:['x/y.c'],deliveredPrompt:'prompt one'});
  const c=buildDiagnosisInputManifest({evidence,changedPaths:['x\\y.c'],deliveredPrompt:'prompt two'});
  assert.notEqual(a.changedPathsDigest,b.changedPathsDigest);
  assert.notEqual(a.digest,c.digest);assert.equal(a.promptBound,true);
  assert.match(a.deliveredPromptDigest,/^[0-9a-f]{64}$/);
  const old=buildDiagnosisInputManifest({evidence});
  assert.equal(old.promptBound,false);assert.equal(old.deliveredPromptDigest,null);
});

test('failure log compaction prioritizes root-cause lines and redacts credentials',()=>{const log=['noise','noise','fatal error: foo.h: No such file or directory','authorization: bearer secret-value','tail'].join('\n');const compact=compactFailureLog(log,{maxBytes:4096});assert.match(compact.text,/fatal error/);assert.doesNotMatch(compact.text,/secret-value/);assert.match(compact.digest,/^[0-9a-f]{64}$/);});
test('deterministic failure classification recognizes compiler failures',()=>{const result=classifyFailureDeterministically('ld: error: undefined reference to foo');assert.equal(result.classification,'source');assert.ok(result.confidence>=0.75);});
test('diagnosis input manifest changes when model-visible inputs change',()=>{const evidence=buildDiagnosisEvidence({log:'Assertion failed',job:{commitSha:'abc123'}}),prior=classifyFailureDeterministically(evidence.log.text),a=buildDiagnosisInputManifest({evidence,deterministic:prior,changedPaths:['a.c'],artifactTexts:[{kind:'junit',name:'x',text:'one'}],model:'gpt'}),b=buildDiagnosisInputManifest({evidence,deterministic:prior,changedPaths:['b.c'],artifactTexts:[{kind:'junit',name:'x',text:'one'}],model:'gpt'}),c=buildDiagnosisInputManifest({evidence,deterministic:prior,changedPaths:['a.c'],artifactTexts:[{kind:'junit',name:'x',text:'two'}],model:'gpt'});assert.notEqual(a.digest,b.digest);assert.notEqual(a.digest,c.digest);});
test('diagnosis receipt v2 binds project pipeline job commit and full input manifest',()=>{const evidence=buildDiagnosisEvidence({log:'Assertion failed in test_audio',job:{projectId:1,pipelineId:2,jobId:3,commitSha:'abc123',jobName:'test'}});const prior=classifyFailureDeterministically(evidence.log.text);const inputManifest=buildDiagnosisInputManifest({evidence,deterministic:prior,changedPaths:['tests/audio.test.js'],model:'gpt'});const diagnosis=normalizeDiagnosisResult({classification:'test',rootCause:'test_audio assertion failed',confidence:0.91,primaryEvidence:['Assertion failed'],relatedFailures:[],affectedFiles:['tests/audio.test.js'],recommendedActions:['Fix the assertion precondition.'],retryRecommended:false},evidence);const receipt=createDiagnosisReceipt({evidence,inputManifest,diagnosis,model:'gpt',codexVersion:'1'});assert.equal(receipt.schemaVersion,2);assert.equal(receipt.subject.pipelineId,2);assert.equal(receipt.evidenceDigest,evidence.digest);assert.equal(receipt.inputManifestDigest,inputManifest.digest);assert.match(receipt.createdAt,/Z$/);const previousDisplayZone=process.env.CODEX_SAFE_DISPLAY_TIME_ZONE;process.env.CODEX_SAFE_DISPLAY_TIME_ZONE='Asia/Singapore';try{const markdown=formatDiagnosisMarkdown(diagnosis,evidence,receipt.createdAt);assert.match(markdown,/Diagnosis time:/);assert.match(markdown,/UTC\+08:00/);assert.doesNotMatch(markdown,/Diagnosis time \(UTC\)/);}finally{if(previousDisplayZone===undefined)delete process.env.CODEX_SAFE_DISPLAY_TIME_ZONE;else process.env.CODEX_SAFE_DISPLAY_TIME_ZONE=previousDisplayZone;}assert.throws(()=>validateDiagnosisReceipt({...receipt,createdAt:'2026-08-30T21:00:00.000'}),/canonical UTC ISO-8601/);assert.throws(()=>createDiagnosisReceipt({evidence,diagnosis,model:'gpt'}),/input manifest/);});
