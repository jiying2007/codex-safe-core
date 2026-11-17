'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
 planSemanticReviewGroups,resolveFileReviewRules,buildReviewPlanPreview,auditReviewClaims
}=require('../review-optimization');

test('semantic planner groups C header implementation tests and changed includes without extra model calls',()=>{
 const source=[
   {path:'src/motor.c',diffText:'@@ -1 +1 @@\n-old\n+#include "motor.h"'},
   {path:'include/motor.h',diffText:'@@ -1 +1 @@\n-old\n+int motor_run(void);'},
   {path:'test/motor_test.c',diffText:'@@ -1 +1 @@\n-old\n+assert(motor_run()==0);'},
   {path:'src/unrelated.c',diffText:'@@ -1 +1 @@\n-old\n+do_something();'}
 ];
 const p=planSemanticReviewGroups(source);
 assert.equal(p.inputFiles,4);
 assert.equal(p.scheduledFiles,4);
 assert.equal(p.complete,true);
 assert.deepEqual(p.groups[0].paths,['src/motor.c','include/motor.h','test/motor_test.c']);
 assert.deepEqual(p.groups[1].paths,['src/unrelated.c']);
 assert.deepEqual(planSemanticReviewGroups(source),p,'planning must be byte-for-byte deterministic');
});

test('groups never silently drop files on byte/file limit, and do not cross generic main names',()=>{
 const items=[
  {path:'a/main.c',bytes:3000},
  {path:'b/main.h',bytes:3000},
  ...Array.from({length:7},(_,i)=>({path:'src/driver.c'+i,bytes:3000,diffText:'+ #include "driver.h"'})),
  {path:'include/driver.h',bytes:3000},
  {path:'big/large.bin',bytes:25000}
 ];
 const planned=planSemanticReviewGroups(items,{maxFilesPerGroup:3,maxGroupBytes:4096});
 assert.equal(planned.scheduledFiles,items.length);
 assert.deepEqual(planned.groups.flatMap(g=>g.paths).sort(),items.map(i=>i.path).sort());
 assert.ok(planned.groups.every(g=>g.paths.length<=3));
 assert.ok(planned.groups.some(g=>g.oversized&&g.paths[0]==='big/large.bin'));
 const singles=planSemanticReviewGroups(items,{maxFilesPerGroup:1,maxGroupBytes:4096});
 assert.equal(singles.groups.length,items.length);
 assert.notEqual(planned.groups.find(g=>g.paths.includes('a/main.c')).id,
   planned.groups.find(g=>g.paths.includes('b/main.h')).id);
});

test('rule matching is file-specific, immutable and bounded (not inherited repository instructions)',()=>{
 const motor=resolveFileReviewRules('src/foc/motor.c');
 assert.ok(motor.ruleIds.includes('motor-control'));
 assert.ok(motor.ruleIds.includes('source-lifetime'));
 assert.ok(motor.ruleIds.length<=4);
 const boot=resolveFileReviewRules('app/ota/bootloader.c');
 assert.ok(boot.ruleIds.includes('ota-rollback'));
 const workflow=resolveFileReviewRules('.github/workflows/ci.yml');
 assert.ok(workflow.ruleIds.includes('ci-supply-chain'));
 const testing=resolveFileReviewRules('tests/motor_test.c');
 assert.ok(testing.ruleIds.includes('test-regression'));
 assert.ok(resolveFileReviewRules('i18n/message_zh.properties').ruleIds.includes('locale-parity'));
 const a=resolveFileReviewRules('src/motor.c');
 assert.ok(Object.isFrozen(a));
 assert.ok(Object.isFrozen(a.checks));
 assert.notDeepEqual(resolveFileReviewRules('src/motor.c').ruleIds,
   resolveFileReviewRules('src/auth/user.js').ruleIds);
 assert.throws(()=>resolveFileReviewRules('../escape.c'),/Invalid review file path/);
 assert.throws(()=>resolveFileReviewRules('a.c',{maxRules:0}),/Invalid file-rule limit/);
});

test('model-free preview preserves file exclusions, actual chunk selection and gap reasons',()=>{
 const files=[
  {path:'src/motor.c',coverageState:'reviewed_text'},
  {path:'test/motor_test.c',coverageState:'reviewed_text'},
  {path:'vendor/lib.js',coverageState:'policy_excluded',skipped:true,skippedReason:'generated_file'},
  {path:'src/large.c',coverageState:'reviewed_text'}
 ];
 const groups=planSemanticReviewGroups(files.map(f=>({path:f.path}))).groups;
 const preview=buildReviewPlanPreview({
   files,groups,chunks:[{paths:['src/motor.c','test/motor_test.c']}],
   coverageGaps:['src/large.c:chunk_limit']
 });
 assert.equal(preview.modelCalls,0);
 assert.equal(preview.fileCount,4);
 assert.equal(preview.reviewableFiles,3);
 assert.equal(preview.plannedFiles,2);
 assert.equal(preview.unplannedFiles,1);
 assert.equal(preview.complete,false);
 assert.equal(preview.items.find(f=>f.path==='vendor/lib.js').reason,'generated_file');
 assert.deepEqual(preview.coverageGaps,['src/large.c:chunk_limit']);
});

test('conservative fact audit only warns on literal proof and never silently removes risky claims',()=>{
 const claims=[
 {category:'correctness',file:'src/a.c',claimedAbsentLiteral:'if (!ptr)'},
 {category:'concurrency',file:'src/a.c',claimedAbsentLiteral:'if (!ptr)'},
 {category:'correctness',file:'src/other.c',claimedAbsentLiteral:'if (!ptr)'},
 {category:'correctness',file:'src/a.c',claimedAbsentLiteral:'unknownLiteral'},
 ];
 const review=auditReviewClaims(claims,{evidenceByPath:{'src/a.c':'+if (!ptr) return;\n-other'}});
 assert.equal(review.automaticallyRemoved,0);
 assert.deepEqual(review.findings,claims);
 assert.deepEqual(review.warnings.map(x=>x.index),[0]);
 assert.equal(review.warnings[0].disposition,'review_required_not_removed');
 assert.ok(Object.isFrozen(review));
});
