'use strict';

const MODEL_ECONOMICS_VERSION = 1;

function freeze(value){if(Array.isArray(value))return Object.freeze(value.map(freeze));if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,freeze(v)])));return value;}
function num(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0;}
function findingKey(finding={}){return String(finding.stableFindingId||finding.id||`${finding.file||''}|${finding.category||''}|${Number(finding.line)||0}|${finding.title||''}`);}
function sumUsage(records,key){return records.reduce((sum,item)=>sum+num(item?.usage?.[key]),0);}
function percentile(values,p){const sorted=values.map(num).sort((a,b)=>a-b);if(!sorted.length)return 0;const index=Math.min(sorted.length-1,Math.max(0,Math.ceil((sorted.length-1)*p)));return sorted[index];}

function buildModelEconomicsScorecard(records=[]){
  const values=Array.isArray(records)?records.filter(item=>item&&typeof item==='object'):[];
  const reviews=values.length;
  const inputTokens=sumUsage(values,'inputTokens'),cachedInputTokens=sumUsage(values,'cachedInputTokens'),cacheWriteInputTokens=sumUsage(values,'cacheWriteInputTokens'),outputTokens=sumUsage(values,'outputTokens'),reasoningOutputTokens=sumUsage(values,'reasoningOutputTokens');
  const totalTokens=inputTokens+outputTokens;
  const verifiedFindings=values.reduce((sum,item)=>sum+num(item.verifiedFindings),0);
  const falsePositives=values.reduce((sum,item)=>sum+num(item.falsePositives),0);
  const reviewedLines=values.reduce((sum,item)=>sum+num(item.reviewedLines),0);
  const coveredLines=values.reduce((sum,item)=>sum+num(item.coveredLines),0);
  const verifierCalls=values.reduce((sum,item)=>sum+num(item.verifierCalls),0);
  const adjudicatorCalls=values.reduce((sum,item)=>sum+num(item.adjudicatorCalls),0);
  const scoutCalls=values.reduce((sum,item)=>sum+num(item.scoutCalls),0);
  const latency=values.map(item=>num(item.latencyMs));
  const cost=values.reduce((sum,item)=>sum+num(item.cost),0);
  return freeze({
    version:MODEL_ECONOMICS_VERSION,reviews,
    usage:{inputTokens,cachedInputTokens,cacheWriteInputTokens,outputTokens,reasoningOutputTokens,totalTokens},
    verifiedFindings,falsePositives,reviewedLines,coveredLines,cost,
    tokensPerReview:reviews?totalTokens/reviews:0,
    tokensPerVerifiedFinding:verifiedFindings?totalTokens/verifiedFindings:0,
    costPerVerifiedFinding:verifiedFindings?cost/verifiedFindings:0,
    cachedInputRatio:inputTokens?cachedInputTokens/inputTokens:0,
    coverageRatio:reviewedLines?Math.min(1,coveredLines/reviewedLines):0,
    falsePositivesPer10kTokens:totalTokens?falsePositives*10000/totalTokens:0,
    verifierCallsPerReview:reviews?verifierCalls/reviews:0,
    adjudicatorCallsPerReview:reviews?adjudicatorCalls/reviews:0,
    scoutCallsPerReview:reviews?scoutCalls/reviews:0,
    latencyMs:{p50:percentile(latency,.5),p95:percentile(latency,.95)}
  });
}

function compareShadowReview({production={},candidate={}}={}){
  const productionFindings=Array.isArray(production.findings)?production.findings:[];
  const candidateFindings=Array.isArray(candidate.findings)?candidate.findings:[];
  const prod=new Map(productionFindings.map(item=>[findingKey(item),item]));
  const cand=new Map(candidateFindings.map(item=>[findingKey(item),item]));
  const intersection=[],productionOnly=[],candidateOnly=[];
  for(const key of prod.keys())(cand.has(key)?intersection:productionOnly).push(key);
  for(const key of cand.keys())if(!prod.has(key))candidateOnly.push(key);
  const usage=value=>({inputTokens:num(value?.usage?.inputTokens),cachedInputTokens:num(value?.usage?.cachedInputTokens),outputTokens:num(value?.usage?.outputTokens),reasoningOutputTokens:num(value?.usage?.reasoningOutputTokens)});
  return freeze({
    version:MODEL_ECONOMICS_VERSION,
    intersection:intersection.sort(),productionOnly:productionOnly.sort(),candidateOnly:candidateOnly.sort(),
    production:{findings:productionFindings.length,usage:usage(production),latencyMs:num(production.latencyMs),cost:num(production.cost)},
    candidate:{findings:candidateFindings.length,usage:usage(candidate),latencyMs:num(candidate.latencyMs),cost:num(candidate.cost)}
  });
}

function qualityConstrainedPromotion({baseline={},candidate={},limits={}}={}){
  const reasons=[];
  const maxRecallDrop=num(limits.maxRecallDrop),maxFalsePositiveIncrease=num(limits.maxFalsePositiveIncrease),maxCriticalRecallDrop=num(limits.maxCriticalRecallDrop);
  const recallDrop=Math.max(0,num(baseline.recall)-num(candidate.recall));
  const fpIncrease=Math.max(0,num(candidate.falsePositiveRate)-num(baseline.falsePositiveRate));
  const criticalDrop=Math.max(0,num(baseline.criticalRecall)-num(candidate.criticalRecall));
  if(recallDrop>maxRecallDrop)reasons.push(`recall_drop:${recallDrop}`);
  if(fpIncrease>maxFalsePositiveIncrease)reasons.push(`false_positive_increase:${fpIncrease}`);
  if(criticalDrop>maxCriticalRecallDrop)reasons.push(`critical_recall_drop:${criticalDrop}`);
  return freeze({approved:reasons.length===0,reasons,recallDrop,falsePositiveIncrease:fpIncrease,criticalRecallDrop:criticalDrop});
}

module.exports={MODEL_ECONOMICS_VERSION,buildModelEconomicsScorecard,compareShadowReview,qualityConstrainedPromotion};
