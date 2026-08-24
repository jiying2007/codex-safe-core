'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const repoRoot=path.resolve(__dirname,'..');
const fixture=JSON.parse(fs.readFileSync(path.join(repoRoot,'test','fixtures','family-golden.json'),'utf8'));

function canonical(value){return JSON.stringify(value,Object.keys(value||{}).sort());}
function evaluate(coreRoot){
  const context=require(path.resolve(coreRoot,'context-builder.js'));
  const rules=require(path.resolve(coreRoot,'review-rules.js'));
  const result={reviewRules:[],evidence:[]};
  for(const item of fixture.reviewRules){
    const out=rules.evaluateReviewRules(item.changedPaths,item.rules);
    const actualRules=out.violations.map(value=>value.rule);
    assert.deepEqual(actualRules,item.expectedRules,`${item.name}: rule output drift`);
    if(item.expectedChangedPaths)assert.deepEqual([...out.changedPaths],item.expectedChangedPaths,`${item.name}: path normalization drift`);
    result.reviewRules.push({name:item.name,rules:actualRules,changedPaths:[...out.changedPaths]});
  }
  for(const item of fixture.evidence){
    const out=context.buildReviewEvidenceChunks({diff:item.diff,maxBytes:item.maxBytes,maxChunks:item.maxChunks});
    const chunkPaths=[...new Set(out.chunks.flatMap(chunk=>chunk.paths))];
    assert.deepEqual(chunkPaths,item.expectedChunkPaths,`${item.name}: chunk paths drift`);
    assert.deepEqual(out.excluded.map(value=>({path:value.path,kind:value.kind})),item.expectedExcluded,`${item.name}: exclusions drift`);
    assert.equal(out.complete,item.expectedComplete,`${item.name}: completeness drift`);
    result.evidence.push({name:item.name,chunkPaths,excluded:out.excluded.map(value=>({path:value.path,kind:value.kind})),complete:out.complete,coverageGaps:[...out.coverageGaps]});
  }
  return result;
}

const roots=process.argv.slice(2);
if(!roots.length)roots.push(repoRoot);
const baseline=evaluate(roots[0]);
for(const root of roots.slice(1))assert.equal(canonical(evaluate(root)),canonical(baseline),`Family golden behavior drift: ${root}`);
process.stdout.write(`${JSON.stringify(baseline)}\n`);
