'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {buildFunctionImpactEvidence,buildReviewRiskEvidence,selectChunkStructuralEvidence,verifyFindingEvidence,parseChangedLines}=require('../review-evidence-v2');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const diff=[
 'diff --git a/src/motor.c b/src/motor.c',
 '--- a/src/motor.c','+++ b/src/motor.c',
 '@@ -3 +3 @@',
 '-int motor_update(int rpm) { return rpm; }',
 '+int motor_update(int rpm) { return rpm * 2; }',
 'diff --git a/src/irq.c b/src/irq.c','--- a/src/irq.c','+++ b/src/irq.c',
 '@@ -8 +8 @@','-old_irq();','+mutex_lock(&motor_lock);'
].join('\n');

test('function impact records exact declaration and lexical call sites without claiming resolution',()=>{
 const candidates=[
  {path:'src/controller.c',content:'void control(void) {\n  motor_update(2);\n}\n'},
  {path:'include/motor.h',content:'int motor_update(int rpm);'},
  {path:'docs/readme.md',content:'motor_update(2)'}];
 const graph=buildFunctionImpactEvidence({diff,candidates});
 assert.equal(graph.version,1);
 assert.equal(graph.kind,'lexical_function_impact');
 assert.equal(graph.seeds.length,1);
 assert.deepEqual(graph.seeds.map(x=>({name:x.name,path:x.path,line:x.line})),[
   {name:'motor_update',path:'src/motor.c',line:3}]);
 assert.equal(graph.edges.length,1);
 assert.equal(graph.edges[0].kind,'lexical_call_candidate');
 assert.equal(graph.edges[0].from.path,'src/controller.c');
 assert.equal(graph.edges[0].from.line,2);
 assert.equal(graph.edges[0].from.function,'control');
 assert.equal(graph.edges[0].verifiedResolution,false);
 assert.equal(graph.confidence,'heuristic_only');
 assert.equal(graph.complete,true);
 assert.deepEqual(buildFunctionImpactEvidence({diff,candidates}),graph);
});

test('structural analysis never silently loses provenance on oversized/unavailable sources',()=>{
 const limited=buildFunctionImpactEvidence({diff,candidates:[
   {path:'src/oversized.c',content:'x'.repeat(100000)},
   {path:'src/missing.c',content:null},
   {path:'src/controller.c',content:'motor_update(2);\n'}
 ],maxEdges:1});
 assert.equal(limited.complete,false);
 assert.ok(limited.reasons.includes('candidate_file_oversized'));
 assert.ok(limited.reasons.includes('candidate_text_missing'));
 assert.ok(limited.edges.every(x=>x.verifiedResolution===false));
 const giant=buildFunctionImpactEvidence({diff:'x'.repeat(3*1024*1024)});
 assert.equal(giant.complete,false);
 assert.ok(giant.reasons.includes('diff_byte_limit'));
});

test('risk parser uses genuine changed-line old/new coordinates and never auto-finds a defect',()=>{
 const result=buildReviewRiskEvidence({diff});
 assert.equal(result.signals.length,1);
 const risk=result.signals[0];
 assert.equal(risk.ruleId,'irq-blocking');
 assert.equal(risk.path,'src/irq.c');assert.equal(risk.line,8);
 assert.equal(risk.disposition,'review_hint_not_defect');
 assert.ok(!JSON.stringify(result).includes('motor_lock'));
 const c=[diff,'diff --git a/firmware/ota.c b/firmware/ota.c','--- a/firmware/ota.c',
   '+++ b/firmware/ota.c','@@ -0,0 +1,1 @@','+flash_erase(0);'].join('\n');
 assert.ok(buildReviewRiskEvidence({diff:c}).signals.some(x=>x.ruleId==='ota-flash-write'));
});

test('same-side exact changed-line ranges verify anchors and fail closed for incompatible source',()=>{
 const findings=[
  {file:'src/motor.c',side:'new',line:3,endLine:3},
  {file:'src/motor.c',side:'old',line:3,endLine:3},
  {file:'src/motor.c',side:'new',line:10},
  {file:'src/motor.c',side:'new',line:3,expectedLineDigest:hash('wrong text')},
  {file:'src/irq.c',side:'new',line:8,expectedLineText:'mutex_lock(&motor_lock);'},
  {file:'src/irq.c',side:'new',line:8,expectedLineText:'mutex_unlock(&motor_lock);'},
 ];
 const result=verifyFindingEvidence({diff,findings});
 assert.deepEqual(result.results.map(x=>x.status),[
   'anchor_verified','anchor_verified','insufficient_evidence','evidence_conflict','anchor_verified','evidence_conflict'
 ]);
 assert.equal(result.verifiedAnchorCount,3);
 assert.equal(result.conflicts,2);
 assert.equal(result.incomplete,1);
 assert.equal(result.automaticallyRemoved,0);
 assert.equal(result.findings.length,findings.length);
 assert.ok(result.results.every(x=>x.semanticDefectVerified===false&&x.automaticallyRemoved===false));
 const changed=parseChangedLines(diff);
 assert.deepEqual(changed.lines.filter(x=>x.path==='src/motor.c').map(x=>x.side),['old','new']);
});

test('genuine +++ and --- source changed lines are not mistaken for file headers',()=>{
 const special=['diff --git a/src/count.c b/src/count.c','--- a/src/count.c',
   '+++ b/src/count.c','@@ -5 +5 @@','---counter','+++counter'].join('\n');
 const parsed=parseChangedLines(special);
 assert.equal(parsed.lines.length,2);
 assert.deepEqual(parsed.lines.map(x=>x.text),['--counter','++counter']);
 const evidence=verifyFindingEvidence({diff:special,findings:[
  {file:'src/count.c',side:'old',line:5},{file:'src/count.c',side:'new',line:5}
 ]});
 assert.equal(evidence.verifiedAnchorCount,2);
});

test('bound checks reject unsafe bounds and preserve partial-evidence failure states',()=>{
 assert.throws(()=>verifyFindingEvidence({diff,findings:[],maxFindings:0}),/bound/);
 assert.throws(()=>buildReviewRiskEvidence({diff,maxSignals:1000}),/bound/);
 assert.throws(()=>buildFunctionImpactEvidence({diff,maxSymbols:0}),/bound/);
 const oversized=buildReviewRiskEvidence({diff:diff.repeat(200000)});
 assert.equal(oversized.complete,false);
 assert.ok(oversized.reasons.includes('diff_byte_limit'));
});


test('inconsistent hunk counts and order invalidate every Finding anchor, not only the bad row',()=>{
 const header='diff --git a/src/count.c b/src/count.c\n--- a/src/count.c\n+++ b/src/count.c\n';
 const good='@@ -1 +1 @@\n-old\n+new';
 const malformed=[
   good+'\n+injected',
   '@@ -1,2 +1,2 @@\n-old\n+new',
   good+'\n@@ -1 +1 @@\n-old2\n+new2',
   '@@ -9007199254740995 +1 @@\n-old\n+new',
   '@@ -nope +1 @@\n-old\n+new',
   '@@ -1 +1 @@\n\\ No newline at end of file\n-old\n+new'
 ];
 for(const fragment of malformed){
   const diffText=header+fragment;
   const parsed=parseChangedLines(diffText);
   assert.equal(parsed.complete,false,fragment);
   assert.equal(parsed.lines.length,0,fragment);
   const proof=verifyFindingEvidence({diff:diffText,findings:[
     {file:'src/count.c',side:'new',line:1,category:'security'}]});
   assert.equal(proof.verifiedAnchorCount,0,fragment);
   assert.equal(proof.results[0].status,'insufficient_evidence',fragment);
   assert.equal(proof.automaticallyRemoved,0);
 }
 const mixed=header+good+'\n'+
   'diff --git a/src/other.c b/src/other.c\n--- a/src/other.c\n+++ b/src/other.c\n'+
   '@@ -2 +2 @@\n-old2\n+new2\n+excess';
 const mixedProof=verifyFindingEvidence({diff:mixed,findings:[
   {file:'src/count.c',side:'new',line:1}]});
 assert.equal(mixedProof.complete,false);
 assert.equal(mixedProof.verifiedAnchorCount,0);
});

test('valid separated, insertion, deletion and no-newline hunks retain exact old/new provenance',()=>{
 const diffText=[
  'diff --git a/src/good.c b/src/good.c',
  '--- a/src/good.c','+++ b/src/good.c',
  '@@ -1 +1 @@','-old','+new',
  '@@ -5 +5 @@','-old-five','+new-five',
  'diff --git a/src/added.c b/src/added.c',
  '--- /dev/null','+++ b/src/added.c',
  '@@ -0,0 +1,2 @@','+line one','+line two',
  'diff --git a/src/deleted.c b/src/deleted.c',
  '--- a/src/deleted.c','+++ /dev/null',
  '@@ -3,2 +2,0 @@','-deleted 3','-deleted 4',
  '\\ No newline at end of file'
 ].join('\n');
 const parsed=parseChangedLines(diffText);
 assert.equal(parsed.complete,true,parsed.reasons.join(','));
 assert.equal(parsed.lines.length,8);
 const proof=verifyFindingEvidence({diff:diffText,findings:[
  {file:'src/good.c',side:'new',line:1},
  {file:'src/good.c',side:'new',line:5},
  {file:'src/added.c',side:'new',line:2},
  {file:'src/deleted.c',side:'old',line:4}
 ]});
 assert.equal(proof.verifiedAnchorCount,4);
 assert.equal(proof.complete,true);
});

test('same-spelling C declarations in separate files preserve separate candidate identities',()=>{
 const one=(file,line)=>`diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -${line} +${line} @@\n-static int init(void) { return 0; }\n+static int init(void) { return 1; }`;
 const a=one('src/first.c',3),b=one('src/second.c',7);
 const graph=buildFunctionImpactEvidence({diff:a+'\n'+b,candidates:[{path:'src/caller.c',content:'void caller(void) {\n  init();\n}\n'}]});
 assert.equal(graph.seeds.length,2);
 assert.notEqual(graph.seeds[0].identity,graph.seeds[1].identity);
 assert.equal(graph.edges.length,2);
 assert.ok(graph.edges.every(edge=>edge.verifiedResolution===false));
 for(const [chunk,path] of [[a,'src/first.c'],[b,'src/second.c']]){
   const selected=selectChunkStructuralEvidence({diff:chunk,functionImpact:graph});
   assert.equal(selected.complete,true);
   assert.equal(selected.seeds.length,1);
   assert.equal(selected.seeds[0].path,path);
   assert.equal(selected.edges.length,1);
   assert.equal(selected.edges[0].to.path,path);
 }
});
test('structural hints are scoped to exact delivered hunk coordinates and content',()=>{
 const header='diff --git a/src/irq.c b/src/irq.c\n--- a/src/irq.c\n+++ b/src/irq.c\n';
 const first='@@ -3 +3 @@\n-old\n+mutex_lock(&first);',second='@@ -9 +9 @@\n-old\n+mutex_lock(&second);';
 const full=header+first+'\n'+second,risk=buildReviewRiskEvidence({diff:full});
 assert.equal(risk.signals.length,2);
 for(const [part,line] of [[first,3],[second,9]]){
   const selected=selectChunkStructuralEvidence({diff:header+part,risk});
   assert.equal(selected.complete,true);
   assert.deepEqual(selected.risk.map(h=>h.line),[line]);
 }
 const changed=selectChunkStructuralEvidence({diff:header+first.replace('&first','&other'),risk});
 assert.equal(changed.complete,false);
 assert.deepEqual(changed.risk,[]);
 assert.ok(changed.reasons.includes('risk_text_digest_mismatch'));
 const capped=selectChunkStructuralEvidence({diff:full,risk,maxRisk:1});
 assert.equal(capped.truncated,true);
 assert.equal(capped.risk.length,1);
 assert.ok(capped.reasons.includes('chunk_risk_limit'));
 const malformed=selectChunkStructuralEvidence({diff:full+'\n+extra',risk});
 assert.equal(malformed.complete,false);
 assert.deepEqual(malformed.risk,[]);
 const oldSide=selectChunkStructuralEvidence({diff:header+'@@ -3 +3 @@\n-mutex_lock(&first);\n+safe_call();',risk});
 assert.equal(oldSide.risk.length,0);
 assert.equal(oldSide.complete,false);
});
