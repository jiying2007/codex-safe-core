'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {buildReviewEvidenceChunks,buildSemanticContext,splitUnifiedDiff}=require('../context-builder');
const {estimateRequestTokens,scoreEvidenceRisk,selectChunksWithinByteBudget}=require('../efficiency-planner');
const {buildImpactEvidenceGraph}=require('../quality-platform');

function largeDiff(targetBytes=4*1024*1024){
  const blocks=[];let bytes=0,index=0;
  while(bytes<targetBytes){
    const body=`diff --git a/src/file-${index}.js b/src/file-${index}.js\n--- a/src/file-${index}.js\n+++ b/src/file-${index}.js\n@@ -1,3 +1,4 @@\n-old ${'x'.repeat(512)}\n+import { helper } from './helper.js';\n+function changed_${index}(){ return helper(); }\n+new ${'y'.repeat(512)}\n context\n`;
    blocks.push(body);bytes+=Buffer.byteLength(body);index+=1;
  }
  return blocks.join('');
}

test('4 MiB evidence/context/impact/cost planning stays within broad regression budget',()=>{
  const diff=largeDiff(),before=process.memoryUsage().rss,started=performance.now();
  const evidence=buildReviewEvidenceChunks({diff,maxBytes:512*1024,maxChunks:8});
  const context=buildSemanticContext({diff,maxBytes:512*1024});
  const estimate=estimateRequestTokens(context.text,{estimatedOutputTokens:1024});
  const risk=scoreEvidenceRisk({paths:context.sourceFiles,text:context.text});
  const planned=selectChunksWithinByteBudget(evidence.chunks,1024*1024);
  const candidates=splitUnifiedDiff(diff).slice(0,64).map(block=>({path:block.path,content:block.text}));
  const impact=buildImpactEvidenceGraph({diff,candidates,maxNodes:32,maxEdges:96,maxBytes:128*1024});
  const elapsed=performance.now()-started,rssGrowth=Math.max(0,process.memoryUsage().rss-before);
  assert.ok(evidence.inputDiffBytes>=4*1024*1024);
  assert.ok(context.inputDiffBytes>=4*1024*1024);
  assert.ok(estimate.totalTokens>0);
  assert.ok(risk>=0);
  assert.ok(planned.bytes<=1024*1024);
  assert.ok(impact.nodes.length<=32);
  assert.ok(impact.bytes<=128*1024);
  assert.ok(elapsed<5000,`Core planning regressed to ${elapsed.toFixed(0)} ms`);
  assert.ok(rssGrowth<256*1024*1024,`Core planning RSS growth regressed to ${Math.round(rssGrowth/1024/1024)} MiB`);
});
