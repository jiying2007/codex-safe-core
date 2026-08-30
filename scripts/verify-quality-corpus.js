'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function read(file){return JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}
function fail(message){const error=new Error(`Quality corpus contract failed: ${message}`);error.code='EQUALITYCORPUS';throw error;}
function unique(values,label){const seen=new Set();for(const value of values){if(seen.has(value))fail(`duplicate ${label}: ${value}`);seen.add(value);}return seen;}

const review=read('quality/corpus.json');
const reviewResults=read('quality/recorded-results.json');
const diagnose=read('quality/diagnosis-corpus.json');
const diagnoseResults=read('quality/diagnosis-recorded-results.json');

if(Number(review.schemaVersion)<3)fail('Review corpus schema must be >=3.');
if(Number(diagnose.schemaVersion)<2)fail('Diagnosis corpus schema must be >=2.');
if(!Array.isArray(review.cases)||review.cases.length<24)fail('Review corpus must contain at least 24 labeled cases.');
if(!Array.isArray(diagnose.cases)||diagnose.cases.length<16)fail('Diagnosis corpus must contain at least 16 labeled cases.');

const reviewIds=unique(review.cases.map(item=>String(item.id||'')),'Review case id');
const reviewResultIds=unique((reviewResults.results||[]).map(item=>String(item.id||'')),'Review result id');
if(reviewIds.size!==reviewResultIds.size||[...reviewIds].some(id=>!reviewResultIds.has(id)))fail('Review recorded results must exactly cover the labeled corpus.');
const categories=new Set();let clean=0,mutations=0;
for(const item of review.cases){
  if(!item.id||!item.description||!item.sourceKind)fail(`Review case ${item.id||'<missing>'} lacks provenance metadata.`);
  if(item.sourceKind==='synthetic-mutation')mutations++;
  const expected=Array.isArray(item.expected)?item.expected:[];
  if(!expected.length)clean++;
  for(const finding of expected){if(finding.category)categories.add(finding.category);}
}
for(const category of ['security','concurrency','resource','correctness','test'])if(!categories.has(category))fail(`Review corpus lacks ${category} coverage.`);
if(clean<3)fail('Review corpus must contain at least three clean negative cases.');
if(mutations<10)fail('Review corpus must contain at least ten explicit synthetic mutation cases.');

const diagnoseIds=unique(diagnose.cases.map(item=>String(item.id||'')),'Diagnosis case id');
const diagnoseResultIds=unique((diagnoseResults.results||[]).map(item=>String(item.id||'')),'Diagnosis result id');
if(diagnoseIds.size!==diagnoseResultIds.size||[...diagnoseIds].some(id=>!diagnoseResultIds.has(id)))fail('Diagnosis recorded results must exactly cover the labeled corpus.');
const classifications=new Set();let uncertain=0,diagnoseMutations=0;
for(const item of diagnose.cases){
  if(!item.id||!item.description||!item.sourceKind)fail(`Diagnosis case ${item.id||'<missing>'} lacks provenance metadata.`);
  const classification=String(item.expected?.classification||'');
  classifications.add(classification);
  if(classification==='unknown')uncertain++;
  if(item.sourceKind==='synthetic-mutation')diagnoseMutations++;
}
for(const classification of ['source','test','dependency','infra','flaky','unknown'])if(!classifications.has(classification))fail(`Diagnosis corpus lacks ${classification} coverage.`);
if(uncertain<2)fail('Diagnosis corpus must preserve at least two insufficient-evidence/unknown cases.');
if(diagnoseMutations<7)fail('Diagnosis corpus must contain at least seven explicit synthetic mutation cases.');

console.log(JSON.stringify({ok:true,reviewCases:review.cases.length,reviewCleanNegatives:clean,reviewSyntheticMutations:mutations,diagnosisCases:diagnose.cases.length,diagnosisUnknownCases:uncertain,diagnosisSyntheticMutations:diagnoseMutations},null,2));
