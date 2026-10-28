'use strict';
const fs=require('node:fs');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const {buildReviewEvidenceChunks,buildSemanticContext,splitUnifiedDiff}=require('../context-builder');
const {estimateRequestTokens,scoreEvidenceRisk,selectChunksWithinByteBudget}=require('../efficiency-planner');
const {buildImpactEvidenceGraph}=require('../quality-platform');
const SAMPLE_COUNT=7;
const STRUCTURAL_KEYS=Object.freeze(['evidenceChunks','evidenceInputBytes','contextInputBytes','impactNodes','impactBytes','estimatedTokens','risk','plannedBytes']);
function largeDiff(targetBytes=4*1024*1024){const blocks=[];let bytes=0,index=0;while(bytes<targetBytes){const body=`diff --git a/src/file-${index}.js b/src/file-${index}.js\n--- a/src/file-${index}.js\n+++ b/src/file-${index}.js\n@@ -1,3 +1,4 @@\n-old ${'x'.repeat(512)}\n+import { helper } from './helper.js';\n+function changed_${index}(){ return helper(); }\n+new ${'y'.repeat(512)}\n context\n`;blocks.push(body);bytes+=Buffer.byteLength(body);index++;}return blocks.join('');}
function median(values){const sorted=values.map(Number).sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);if(!sorted.length)throw new Error('median requires samples');return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
function percentile95(values){
  if(!Array.isArray(values)||!values.length||values.some(value=>!Number.isFinite(value)))throw new Error('p95 requires finite samples');
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.ceil(sorted.length*0.95)-1]; // nearest rank; seven samples yield their maximum
}
function measure(){
  const diff=largeDiff(),before=process.memoryUsage().rss,started=performance.now(),phaseTimingsMs={};
  const phase=(name,run)=>{
    const begin=performance.now(),value=run();
    phaseTimingsMs[name]=Number((performance.now()-begin).toFixed(3));
    return value;
  };
  const evidence=phase('reviewChunks',()=>buildReviewEvidenceChunks({diff,maxBytes:512*1024,maxChunks:8}));
  const context=phase('semanticContext',()=>buildSemanticContext({diff,maxBytes:512*1024}));
  const estimate=phase('estimateTokens',()=>estimateRequestTokens(context.text,{estimatedOutputTokens:1024}));
  const risk=phase('scoreRisk',()=>scoreEvidenceRisk({paths:context.sourceFiles,text:context.text}));
  const planned=phase('selectBudget',()=>selectChunksWithinByteBudget(evidence.chunks,1024*1024));
  const candidates=phase('candidatePreparation',()=>splitUnifiedDiff(diff).slice(0,64).map(block=>({path:block.path,content:block.text})));
  const impact=phase('impactGraph',()=>buildImpactEvidenceGraph({diff,candidates,maxNodes:32,maxEdges:96,maxBytes:128*1024}));
  return {
    elapsedMs:Number((performance.now()-started).toFixed(3)),
    rssGrowthBytes:Math.max(0,process.memoryUsage().rss-before),
    evidenceChunks:evidence.chunks?.length||0,evidenceInputBytes:evidence.inputDiffBytes,
    contextInputBytes:context.inputDiffBytes,impactNodes:impact.nodes.length,impactBytes:impact.bytes,
    estimatedTokens:estimate.totalTokens,risk,plannedBytes:planned.bytes,phaseTimingsMs
  };
}
function summarizeSamples(samples){
  if(!Array.isArray(samples)||samples.length<3||samples.length%2===0)throw new Error('performance sampling requires an odd sample count >= 3');
  const first=samples[0];
  for(const sample of samples){
    if(!sample||!Number.isFinite(sample.elapsedMs)||sample.elapsedMs<=0||!Number.isFinite(sample.rssGrowthBytes)||sample.rssGrowthBytes<0)throw new Error('performance sample has invalid latency or RSS');
    for(const key of STRUCTURAL_KEYS)if(!Number.isFinite(sample[key])||sample[key]<0)throw new Error(`performance sample has invalid structural field ${key}`);
    for(const key of STRUCTURAL_KEYS)if(sample[key]!==first[key])throw new Error(`performance sample structural drift for ${key}`);
  }
  const phases=first.phaseTimingsMs&&typeof first.phaseTimingsMs==='object'?Object.keys(first.phaseTimingsMs).sort():[];
  const anyPhases=samples.some(sample=>sample.phaseTimingsMs!=null);
  const validPhases=phases.length>0&&samples.every(sample=>sample.phaseTimingsMs&&typeof sample.phaseTimingsMs==='object'&&Object.keys(sample.phaseTimingsMs).sort().join('|')===phases.join('|')&&phases.every(key=>Number.isFinite(sample.phaseTimingsMs[key])&&sample.phaseTimingsMs[key]>=0));
  if(anyPhases&&!validPhases)throw new Error('performance phase samples are incomplete or invalid');
  return{
    ...Object.fromEntries(STRUCTURAL_KEYS.map(key=>[key,first[key]])),
    elapsedMs:Number(median(samples.map(sample=>sample.elapsedMs)).toFixed(3)),
    elapsedP95Ms:Number(percentile95(samples.map(sample=>sample.elapsedMs)).toFixed(3)),
    rssGrowthBytes:Math.round(median(samples.map(sample=>sample.rssGrowthBytes))),
    rssP95Bytes:Math.round(percentile95(samples.map(sample=>sample.rssGrowthBytes))),
    ...(validPhases?{
      phaseMediansMs:Object.fromEntries(phases.map(key=>[key,Number(median(samples.map(sample=>sample.phaseTimingsMs[key])).toFixed(3))])),
      phaseP95Ms:Object.fromEntries(phases.map(key=>[key,Number(percentile95(samples.map(sample=>sample.phaseTimingsMs[key])).toFixed(3))]))
    }:{})
  };
}
function collectSamples(count=SAMPLE_COUNT){const samples=[];for(let i=0;i<count;i++){const result=spawnSync(process.execPath,[__filename,'--single-sample'],{encoding:'utf8',env:process.env,maxBuffer:1024*1024});if(result.status!==0)throw new Error(result.stderr||result.stdout||`performance sample ${i+1} failed`);const line=result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);samples.push(JSON.parse(line));}return samples;}
function buildSnapshot(samples=collectSamples()){const cpus=os.cpus();const metrics=summarizeSamples(samples),out={schemaVersion:3,coreVersion:require('../core-contract.json').coreVersion,coreSha:process.env.GITHUB_SHA||null,node:process.version,platform:process.platform,environment:{arch:process.arch,osRelease:os.release(),cpuModel:cpus[0]?.model||null,logicalCpus:cpus.length},workload:{inputDiffBytes:metrics.evidenceInputBytes,inputSha256:crypto.createHash('sha256').update(largeDiff(),'utf8').digest('hex'),maxEvidenceBytes:512*1024,maxChunks:8,maxImpactBytes:128*1024},sampling:{method:'median-isolated-process',p95Estimator:'nearest-rank (max of seven; diagnostic only)',count:samples.length,elapsedMs:samples.map(s=>s.elapsedMs),rssGrowthBytes:samples.map(s=>s.rssGrowthBytes),samples:samples.map(s=>({elapsedMs:s.elapsedMs,rssGrowthBytes:s.rssGrowthBytes,phaseTimingsMs:s.phaseTimingsMs||{}}))},metrics,budgets:{elapsedMs:5000,rssGrowthBytes:256*1024*1024},recordedAt:new Date().toISOString()};if(metrics.elapsedMs>=out.budgets.elapsedMs||metrics.rssGrowthBytes>=out.budgets.rssGrowthBytes)throw new Error('performance snapshot exceeds broad regression budget');return out;}
function main(){if(process.argv.includes('--single-sample')){process.stdout.write(`${JSON.stringify(measure())}\n`);return;}const out=buildSnapshot(),file=process.argv[2]||'PERFORMANCE_SNAPSHOT.json';fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out.metrics));}
if(require.main===module)main();
module.exports={SAMPLE_COUNT,STRUCTURAL_KEYS,largeDiff,median,percentile95,measure,summarizeSamples,collectSamples,buildSnapshot};
