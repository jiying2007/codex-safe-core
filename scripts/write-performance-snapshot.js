'use strict';
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const {buildReviewEvidenceChunks,buildSemanticContext,splitUnifiedDiff}=require('../context-builder');
const {estimateRequestTokens,scoreEvidenceRisk,selectChunksWithinByteBudget}=require('../efficiency-planner');
const {buildImpactEvidenceGraph}=require('../quality-platform');
const SAMPLE_COUNT=7;
const STRUCTURAL_KEYS=Object.freeze(['evidenceChunks','evidenceInputBytes','contextInputBytes','impactNodes','impactBytes','estimatedTokens','risk','plannedBytes']);
function largeDiff(targetBytes=4*1024*1024){const blocks=[];let bytes=0,index=0;while(bytes<targetBytes){const body=`diff --git a/src/file-${index}.js b/src/file-${index}.js\n--- a/src/file-${index}.js\n+++ b/src/file-${index}.js\n@@ -1,3 +1,4 @@\n-old ${'x'.repeat(512)}\n+import { helper } from './helper.js';\n+function changed_${index}(){ return helper(); }\n+new ${'y'.repeat(512)}\n context\n`;blocks.push(body);bytes+=Buffer.byteLength(body);index++;}return blocks.join('');}
function median(values){const sorted=values.map(Number).sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);if(!sorted.length)throw new Error('median requires samples');return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
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
function summarizeSamples(samples){if(samples.length<3||samples.length%2===0)throw new Error('performance sampling requires an odd sample count >= 3');const first=samples[0];for(const sample of samples)for(const key of STRUCTURAL_KEYS)if(sample[key]!==first[key])throw new Error(`performance sample structural drift for ${key}`);const phases=first.phaseTimingsMs&&typeof first.phaseTimingsMs==='object'?Object.keys(first.phaseTimingsMs).sort():[];
  const validPhases=phases.length>0&&samples.every(sample=>sample.phaseTimingsMs&&typeof sample.phaseTimingsMs==='object'&&Object.keys(sample.phaseTimingsMs).sort().join('|')===phases.join('|')&&phases.every(key=>Number.isFinite(sample.phaseTimingsMs[key])&&sample.phaseTimingsMs[key]>=0));
  const phaseMediansMs=validPhases?Object.fromEntries(phases.map(key=>[key,Number(median(samples.map(sample=>sample.phaseTimingsMs[key])).toFixed(3))])):undefined;
  return{...Object.fromEntries(STRUCTURAL_KEYS.map(key=>[key,first[key]])),elapsedMs:Number(median(samples.map(s=>s.elapsedMs)).toFixed(3)),rssGrowthBytes:Math.round(median(samples.map(s=>s.rssGrowthBytes))),...(phaseMediansMs?{phaseMediansMs}:{})};}
function collectSamples(count=SAMPLE_COUNT){const samples=[];for(let i=0;i<count;i++){const result=spawnSync(process.execPath,[__filename,'--single-sample'],{encoding:'utf8',env:process.env,maxBuffer:1024*1024});if(result.status!==0)throw new Error(result.stderr||result.stdout||`performance sample ${i+1} failed`);const line=result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);samples.push(JSON.parse(line));}return samples;}
function buildSnapshot(samples=collectSamples()){const metrics=summarizeSamples(samples),out={schemaVersion:3,coreVersion:require('../core-contract.json').coreVersion,coreSha:process.env.GITHUB_SHA||null,node:process.version,platform:process.platform,workload:{inputDiffBytes:metrics.evidenceInputBytes,maxEvidenceBytes:512*1024,maxChunks:8,maxImpactBytes:128*1024},sampling:{method:'median-isolated-process',count:samples.length,elapsedMs:samples.map(s=>s.elapsedMs),rssGrowthBytes:samples.map(s=>s.rssGrowthBytes)},metrics,budgets:{elapsedMs:5000,rssGrowthBytes:256*1024*1024},recordedAt:new Date().toISOString()};if(metrics.elapsedMs>=out.budgets.elapsedMs||metrics.rssGrowthBytes>=out.budgets.rssGrowthBytes)throw new Error('performance snapshot exceeds broad regression budget');return out;}
function main(){if(process.argv.includes('--single-sample')){process.stdout.write(`${JSON.stringify(measure())}\n`);return;}const out=buildSnapshot(),file=process.argv[2]||'PERFORMANCE_SNAPSHOT.json';fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out.metrics));}
if(require.main===module)main();
module.exports={SAMPLE_COUNT,STRUCTURAL_KEYS,largeDiff,median,measure,summarizeSamples,collectSamples,buildSnapshot};
