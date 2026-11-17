#!/usr/bin/env node
'use strict';
// Offline scorer only. Raw AACR-Bench sources must first be lawfully normalized
// to Core's explicit case/result schema; this script never calls a model.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {evaluateQualityResults}=require('../quality-platform');
const sha=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
function readJson(file){
 const bytes=fs.readFileSync(file);
 if(bytes.length>8*1024*1024)throw new Error('Quality input exceeds 8 MiB');
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function checkIds(cases,results,label){
 const ids=cases.map(x=>String(x.id));
 if(new Set(ids).size!==ids.length||ids.some(id=>!id))throw new Error('Duplicate/empty corpus case ID');
 if(!Array.isArray(results)||results.length!==ids.length)throw new Error(label+': result count differs from corpus');
 const actual=results.map(x=>String(x.id));
 if(new Set(actual).size!==actual.length||actual.some(id=>!id)||
    actual.some(id=>!ids.includes(id)))throw new Error(label+': duplicate/foreign result case');
 for(const r of results){
   if(!Array.isArray(r.findings)||!r.usage||!Number.isFinite(Number(r.usage.inputTokens))||
      !Number.isFinite(Number(r.usage.outputTokens))||Number(r.usage.inputTokens)<0||
      Number(r.usage.outputTokens)<0)throw new Error(label+': incomplete real usage/findings');
 }
}
function compareQualityRuns(corpus,baseline,candidate){
 if(!Array.isArray(corpus?.cases)||!corpus.cases.length)throw new Error('Corpus must contain nonempty cases');
 if(!Array.isArray(baseline?.results)||!Array.isArray(candidate?.results))throw new Error('Results must be arrays');
 checkIds(corpus.cases,baseline.results,'baseline');checkIds(corpus.cases,candidate.results,'candidate');
 const datasetDigest=sha(corpus.cases);
 for(const [name,run] of [['baseline',baseline],['candidate',candidate]]){
   if(run.corpusDigest!==datasetDigest)throw new Error(name+': corpus digest mismatch');
   if(!run.model||!run.budgetClass||!run.provider)throw new Error(name+': missing identity metadata');
 }
 if(baseline.model!==candidate.model||baseline.provider!==candidate.provider||
    baseline.budgetClass!==candidate.budgetClass)
   throw new Error('Incomparable model/provider/budget identities');
 const stats=results=>{
   const quality=evaluateQualityResults(corpus.cases,results);
   const latencies=results.map(x=>x.durationMs);
   const comparable=latencies.every(x=>Number.isFinite(x)&&x>=0);
   const avgMs=comparable?latencies.reduce((a,b)=>a+b,0)/latencies.length:null;
   return Object.freeze({...quality,averageLatencyMs:avgMs});
 };
 const before=stats(baseline.results),after=stats(candidate.results);
 return Object.freeze({schemaVersion:1,kind:'offline-evidence-comparison',
   freshModelExecution:false,model:baseline.model,provider:baseline.provider,
   budgetClass:baseline.budgetClass,corpusDigest,baseline:before,candidate:after,
   delta:{recall:after.recall-before.recall,precision:after.precision-before.precision,
     criticalRecall:after.criticalRecall-before.criticalRecall,
     falsePositivePerReview:after.falsePositivePerReview-before.falsePositivePerReview,
     totalTokens:after.totalTokens-before.totalTokens,
     averageLatencyMs:before.averageLatencyMs===null||after.averageLatencyMs===null?null:
       after.averageLatencyMs-before.averageLatencyMs}});
}
function main(argv=process.argv.slice(2)){
 const take=name=>{const i=argv.indexOf(name);if(i<0||!argv[i+1])throw new Error('Required '+name+' <file>');return path.resolve(argv[i+1]);};
 const result=compareQualityRuns(readJson(take('--corpus')),readJson(take('--baseline')),readJson(take('--candidate')));
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(require.main===module){try{main();}catch(error){console.error(String(error?.message||error));process.exitCode=2;}}
module.exports={compareQualityRuns,main};
