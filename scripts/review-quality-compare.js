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
 const validId=id=>typeof id==='string'&&id.length>0&&id.length<=512&&!/[\r\n\0]/.test(id);
 const ids=cases.map(x=>x?.id);
 if(new Set(ids).size!==ids.length||ids.some(id=>!validId(id)))throw new Error('Duplicate/empty or invalid corpus case ID');
 for(const item of cases){
   if(!Array.isArray(item.expected))throw new Error('Missing ground truth is not a clean negative case');
 }
 if(!Array.isArray(results)||results.length!==ids.length)throw new Error(label+': result count differs from corpus');
 const actual=results.map(x=>x?.id);
 if(new Set(actual).size!==actual.length||actual.some(id=>!validId(id))||
    actual.some(id=>!ids.includes(id)))throw new Error(label+': duplicate/foreign result case');
 const tokens=value=>Number.isSafeInteger(value)&&value>=0;
 let total=0;
 for(const r of results){
   if(!Array.isArray(r.findings)||!r.usage||r.usage.known===false||!tokens(r.usage.inputTokens)||
      !tokens(r.usage.outputTokens))throw new Error(label+': incomplete real usage/findings');
   total+=r.usage.inputTokens+r.usage.outputTokens;
   if(!Number.isSafeInteger(total))throw new Error(label+': unsafe aggregate token total');
 }
}
// Use the existing matcher, not a second interpretation of path/line/rule
// identity. Track individual high-risk labels so gaining a different label
// cannot cancel losing one that the baseline already detected.
function compareHighRiskLabels(cases,baseline,candidate){
 const before=new Map(baseline.map(r=>[r.id,r])),after=new Map(candidate.map(r=>[r.id,r]));
 let expected=0,baselineDetected=0,candidateDetected=0;
 const lost=[],gained=[];
 for(const item of cases){
   const baselineFindings=before.get(item.id).findings.filter(f=>f?.validLine!==false);
   const candidateFindings=after.get(item.id).findings.filter(f=>f?.validLine!==false);
   const labels=item.expected;
   for(let index=0;index<labels.length;index++){
     const label=labels[index];
     if(!['critical','high'].includes(label?.severity))continue;
     expected++;
     const single=[{id:item.id,expected:[label]}];
     const detected=findings=>evaluateQualityResults(single,[{id:item.id,findings}]).truePositive===1;
     const old=detected(baselineFindings),next=detected(candidateFindings);
     if(old)baselineDetected++;
     if(next)candidateDetected++;
     const identity={caseId:item.id,expectedIndex:index,file:label.file,line:label.line,category:label.category,severity:label.severity,ruleId:label.ruleId||null};
     if(old&&!next)lost.push(identity);
     if(!old&&next)gained.push(identity);
   }
 }
 return Object.freeze({expected,baselineDetected,candidateDetected,
   baselineRecall:expected?baselineDetected/expected:null,
   candidateRecall:expected?candidateDetected/expected:null,
   lost:Object.freeze(lost),gained:Object.freeze(gained),noKnownHighRiskRegression:lost.length===0&&expected>0});
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
   const p95DurationMs=comparable?[...latencies].sort((a,b)=>a-b)[Math.ceil(latencies.length*0.95)-1]:null;
   return Object.freeze({...quality,averageLatencyMs:avgMs,p95DurationMs});
 };
 const before=stats(baseline.results),after=stats(candidate.results);
 const highRiskLabels=compareHighRiskLabels(corpus.cases,baseline.results,candidate.results);
 return Object.freeze({schemaVersion:1,kind:'offline-evidence-comparison',
   freshModelExecution:false,productionQualified:false,highRiskLabels,model:baseline.model,provider:baseline.provider,
   budgetClass:baseline.budgetClass,corpusDigest:datasetDigest,baseline:before,candidate:after,
   delta:{recall:after.recall-before.recall,precision:after.precision-before.precision,
     criticalRecall:after.criticalRecall-before.criticalRecall,
     falsePositivePerReview:after.falsePositivePerReview-before.falsePositivePerReview,
     totalTokens:after.totalTokens-before.totalTokens,
     p95DurationMs:before.p95DurationMs===null||after.p95DurationMs===null?null:after.p95DurationMs-before.p95DurationMs,
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
