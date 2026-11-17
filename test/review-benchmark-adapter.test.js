'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeExternalReviewCorpus}=require('../review-benchmark-adapter');
const rev='a'.repeat(40),base='b'.repeat(40),head='c'.repeat(40);
test('ReviewBench golden record imports only adjudicated introduced-by-PR true positives',()=>{
 const golden=[{pr_key:'ROCm_TransferBench_256-1cfd8bd9',
   pr:{repo:'https://github.com/ROCm/TransferBench',base,head},
   findings:[
     {file:'src/c.c',start_line:12,end_line:13,category:'correctness',severity:'high',
       tp_fp:'tp',scope:'introduced-by-pr'},
     {file:'src/c.c',start_line:15,end_line:15,category:'correctness',severity:'medium',
       tp_fp:'fp',scope:'introduced-by-pr'},
     {file:'src/c.c',start_line:21,end_line:21,category:'security',severity:'high',
       tp_fp:'tp',scope:'pre-existing'}
   ]}];
 const x=normalizeExternalReviewCorpus({format:'reviewbench-golden',records:golden,sourceRevision:rev});
 assert.equal(x.eligibleCases,1);assert.equal(x.corpus.cases.length,1);
 assert.equal(x.corpus.cases[0].expected.length,1);
 assert.deepEqual(x.corpus.cases[0].expected[0],{
   file:'src/c.c',line:12,endLine:13,category:'correctness',severity:'high'
 });
 assert.equal(x.freshModelExecution,false);
 assert.equal(x.corpus.cases[0].provenance.groundTruth,'reviewbench-labelled-tp');
});
test('AACR reference comments never silently become adjudicated defects',()=>{
 const records=[{instance_id:'requests-5711',repo:'psf/requests',base_commit:base,head_commit:head,
   reference_comments:[{path:'setup.py',text:'Review comment',side:'right',start_line:46,end_line:46}]}];
 assert.throws(()=>normalizeExternalReviewCorpus({
   format:'aacr-review-instances',records,sourceRevision:rev
 }),/No verified external positives/);
 const approved=normalizeExternalReviewCorpus({format:'aacr-review-instances',
   records,sourceRevision:rev,approval:{'requests-5711':{approved:true,expected:[{
    file:'setup.py',line:46,category:'correctness',severity:'high'
   }]}}});
 assert.equal(approved.corpus.cases[0].expected[0].line,46);
 assert.equal(approved.corpus.cases[0].provenance.groundTruth,'human-approved-aacr-defect');
});
test('unlabeled PR, duplicated ID, invalid path or unknown category cannot fake quality',()=>{
 const records=[
 {pr_key:'A',pr:{repo:'owner/repo',base,head},findings:[]},
 {pr_key:'B',pr:{repo:'owner/repo',base,head},findings:[{
   file:'src/b.c',start_line:5,end_line:5,category:'correctness',severity:'critical',
   tp_fp:'tp',scope:'introduced-by-pr'
 }]}];
 const x=normalizeExternalReviewCorpus({format:'reviewbench-golden',records,sourceRevision:rev});
 assert.equal(x.corpus.cases.length,1);
 assert.deepEqual(x.excluded,[{id:'A',reason:'no_verified_positive_ground_truth'}]);
 assert.throws(()=>normalizeExternalReviewCorpus({
   format:'reviewbench-golden',records:[records[1],records[1]],sourceRevision:rev
 }),/Duplicate/);
 const bad={...records[1],pr_key:'C',findings:[{...records[1].findings[0],file:'../escape.c'}]};
 assert.throws(()=>normalizeExternalReviewCorpus({
   format:'reviewbench-golden',records:[bad],sourceRevision:rev
 }),/Unscoped/);
 assert.throws(()=>normalizeExternalReviewCorpus({
   format:'reviewbench-golden',records,sourceRevision:'main'
 }),/revision/);
});
