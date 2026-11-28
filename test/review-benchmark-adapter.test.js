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

test('real pinned embedded ReviewBench label projection imports through the existing adapter',()=>{
 const fixture=require('../quality/reviewbench-embedded-development.json');
 assert.equal(fixture.partition,'development');
 assert.equal(fixture.holdout,false);
 assert.equal(fixture.freshModelExecution,false);
 assert.equal(fixture.qualificationAuthority,false);
 assert.equal(new Set(fixture.records.map(r=>r.pr.repo)).size,2);
 const result=normalizeExternalReviewCorpus({format:'reviewbench-golden',sourceRevision:fixture.sourceRevision,records:fixture.records});
 assert.equal(result.eligibleCases,2);
 const labels=result.corpus.cases.flatMap(c=>c.expected);
 assert.equal(labels.length,13);
 assert.equal(labels.filter(x=>x.severity==='high').length,1);
 assert.equal(labels.filter(x=>x.severity==='critical').length,0);
 assert.ok(labels.some(x=>x.sourceCategory==='api-architecture'&&x.category==='api'));
 assert.ok(labels.some(x=>x.sourceCategory==='testing'&&x.category==='test'));
 for(const row of result.corpus.cases){
   assert.match(row.provenance.base,/^[a-f0-9]{40}$/);
   assert.match(row.provenance.head,/^[a-f0-9]{40}$/);
 }
});
test('ReviewBench reliability crosswalk preserves original category and rejects unmapped labels',()=>{
 const r={pr_key:'fixture',pr:{repo:'owner/repo',base,head},findings:[{file:'src/main.c',start_line:2,end_line:2,category:'reliability',severity:'high',tp_fp:'tp',scope:'introduced-by-pr'}]};
 const x=normalizeExternalReviewCorpus({format:'reviewbench-golden',sourceRevision:rev,records:[r]});
 assert.equal(x.corpus.cases[0].expected[0].category,'robustness');
 assert.equal(x.corpus.cases[0].expected[0].sourceCategory,'reliability');
 assert.throws(()=>normalizeExternalReviewCorpus({format:'reviewbench-golden',sourceRevision:rev,records:[{...r,findings:[{...r.findings[0],category:'unmapped-category'}]}]}),/Unsupported/);
});

test('external benchmark snapshots are provenance-bound and cannot qualify model competition',()=>{
 const {verifyExternalReviewBenchmarks}=require('../scripts/verify-external-review-benchmarks');
 const result=verifyExternalReviewBenchmarks();
 assert.equal(result.reviewBench.prs,25);
 assert.equal(result.reviewBench.positiveFindings,308);
 assert.equal(result.reviewBench.highRiskCaseGroups,12);
 assert.equal(result.cloudae.prs,16);
 assert.equal(result.cloudae.rootCauseGroups,6);
 assert.equal(result.cloudae.highRiskRootCauseGroups,5);
 assert.equal(result.embedded.prs,2);
 assert.equal(result.uniquePullRequests,43);
 assert.equal(result.distinctRepositories,40);
 assert.equal(result.candidateGroupingUnits,33);
 assert.equal(result.highRiskCandidateGroups,18);
 assert.equal(result.positiveFindingCount,341);
 assert.equal(result.cleanNegativeCases,0);
 assert.equal(result.holdoutCases,0);
 assert.equal(result.independenceVerified,false);
 assert.equal(result.freshModelExecution,false);
 assert.equal(result.competitionQualified,false);
 assert.ok(result.blockers.includes('clean_negative_cases_missing'));
 assert.ok(result.blockers.includes('independent_holdout_missing'));
});
