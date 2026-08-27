'use strict';
const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const {buildReviewEvidenceChunks,buildSemanticContext,splitUnifiedDiff}=require('../context-builder');
const {estimateRequestTokens,scoreEvidenceRisk,selectChunksWithinByteBudget}=require('../efficiency-planner');
const {buildImpactEvidenceGraph}=require('../quality-platform');

function largeDiff(targetBytes=4*1024*1024){
  const blocks=[];let bytes=0,index=0;
  while(bytes<targetBytes){
    const body=`diff --git a/src/file-${index}.js b/src/file-${index}.js\n--- a/src/file-${index}.js\n+++ b/src/file-${index}.js\n@@ -1,3 +1,4 @@\n-old ${'x'.repeat(512)}\n+import { helper } from './helper.js';\n+function changed_${index}(){ return helper(); }\n+new ${'y'.repeat(512)}\n context\n`;
    blocks.push(body);bytes+=Buffer.byteLength(body);index++;
  }
  return blocks.join('');
}
const diff=largeDiff(),before=process.memoryUsage().rss,started=performance.now();
const evidence=buildReviewEvidenceChunks({diff,maxBytes:512*1024,maxChunks:8});
const context=buildSemanticContext({diff,maxBytes:512*1024});
const estimate=estimateRequestTokens(context.text,{estimatedOutputTokens:1024});
const risk=scoreEvidenceRisk({paths:context.sourceFiles,text:context.text});
const planned=selectChunksWithinByteBudget(evidence.chunks,1024*1024);
const candidates=splitUnifiedDiff(diff).slice(0,64).map(block=>({path:block.path,content:block.text}));
const impact=buildImpactEvidenceGraph({diff,candidates,maxNodes:32,maxEdges:96,maxBytes:128*1024});
const elapsed=performance.now()-started,rssGrowth=Math.max(0,process.memoryUsage().rss-before);
const out={
  schemaVersion:2,coreVersion:require('../core-contract.json').coreVersion,coreSha:process.env.GITHUB_SHA||null,node:process.version,platform:process.platform,
  workload:{inputDiffBytes:Buffer.byteLength(diff),maxEvidenceBytes:512*1024,maxChunks:8,maxImpactBytes:128*1024},
  metrics:{elapsedMs:Number(elapsed.toFixed(3)),rssGrowthBytes:rssGrowth,evidenceChunks:evidence.chunks?.length||0,evidenceInputBytes:evidence.inputDiffBytes,contextInputBytes:context.inputDiffBytes,impactNodes:impact.nodes.length,impactBytes:impact.bytes,estimatedTokens:estimate.totalTokens,risk,plannedBytes:planned.bytes},
  budgets:{elapsedMs:5000,rssGrowthBytes:256*1024*1024},recordedAt:new Date().toISOString()
};
if(elapsed>=out.budgets.elapsedMs||rssGrowth>=out.budgets.rssGrowthBytes)throw new Error('performance snapshot exceeds broad regression budget');
fs.writeFileSync(process.argv[2]||'PERFORMANCE_SNAPSHOT.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.metrics));
