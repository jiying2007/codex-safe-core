'use strict';

const MODEL_ECONOMICS_VERSION = 1;
const DEFAULT_SEGMENT_DIMENSIONS=Object.freeze(['mode','role','provider','model','profilePack','repoSizeBucket']);
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
  const verifiedFindings=values.reduce((sum,item)=>sum+num(item.verifiedFindings),0),falsePositives=values.reduce((sum,item)=>sum+num(item.falsePositives),0),reviewedLines=values.reduce((sum,item)=>sum+num(item.reviewedLines),0),coveredLines=values.reduce((sum,item)=>sum+num(item.coveredLines),0),verifierCalls=values.reduce((sum,item)=>sum+num(item.verifierCalls),0),adjudicatorCalls=values.reduce((sum,item)=>sum+num(item.adjudicatorCalls),0),scoutCalls=values.reduce((sum,item)=>sum+num(item.scoutCalls),0),latency=values.map(item=>num(item.latencyMs)),cost=values.reduce((sum,item)=>sum+num(item.cost),0);
  return freeze({version:MODEL_ECONOMICS_VERSION,reviews,usage:{inputTokens,cachedInputTokens,cacheWriteInputTokens,outputTokens,reasoningOutputTokens,totalTokens},verifiedFindings,falsePositives,reviewedLines,coveredLines,cost,tokensPerReview:reviews?totalTokens/reviews:0,tokensPerVerifiedFinding:verifiedFindings?totalTokens/verifiedFindings:0,costPerVerifiedFinding:verifiedFindings?cost/verifiedFindings:0,cachedInputRatio:inputTokens?cachedInputTokens/inputTokens:0,coverageRatio:reviewedLines?Math.min(1,coveredLines/reviewedLines):0,falsePositivesPer10kTokens:totalTokens?falsePositives*10000/totalTokens:0,verifierCallsPerReview:reviews?verifierCalls/reviews:0,adjudicatorCallsPerReview:reviews?adjudicatorCalls/reviews:0,scoutCallsPerReview:reviews?scoutCalls/reviews:0,latencyMs:{p50:percentile(latency,.5),p95:percentile(latency,.95)}});
}
function segmentIdentity(record={},dimensions=DEFAULT_SEGMENT_DIMENSIONS){const values={};for(const key of dimensions)values[key]=String(record?.[key]??record?.modelEvidence?.[key]??'unknown');return values;}
function buildSegmentedModelEconomics(records=[],dimensions=DEFAULT_SEGMENT_DIMENSIONS){
  const dims=Array.isArray(dimensions)&&dimensions.length?[...new Set(dimensions.map(String))]:[...DEFAULT_SEGMENT_DIMENSIONS],groups=new Map();
  for(const record of Array.isArray(records)?records:[]){if(!record||typeof record!=='object')continue;const segment=segmentIdentity(record,dims),key=JSON.stringify(segment);if(!groups.has(key))groups.set(key,{segment,records:[]});groups.get(key).records.push(record);}
  return freeze({version:MODEL_ECONOMICS_VERSION,dimensions:dims,segments:[...groups.values()].map(group=>({segment:group.segment,scorecard:buildModelEconomicsScorecard(group.records)})).sort((a,b)=>JSON.stringify(a.segment).localeCompare(JSON.stringify(b.segment)))});
}
function compareShadowReview({production={},candidate={}}={}){
  const productionFindings=Array.isArray(production.findings)?production.findings:[],candidateFindings=Array.isArray(candidate.findings)?candidate.findings:[],prod=new Map(productionFindings.map(item=>[findingKey(item),item])),cand=new Map(candidateFindings.map(item=>[findingKey(item),item])),intersection=[],productionOnly=[],candidateOnly=[];
  for(const key of prod.keys())(cand.has(key)?intersection:productionOnly).push(key);for(const key of cand.keys())if(!prod.has(key))candidateOnly.push(key);
  const usage=value=>({inputTokens:num(value?.usage?.inputTokens),cachedInputTokens:num(value?.usage?.cachedInputTokens),outputTokens:num(value?.usage?.outputTokens),reasoningOutputTokens:num(value?.usage?.reasoningOutputTokens)});
  return freeze({version:MODEL_ECONOMICS_VERSION,intersection:intersection.sort(),productionOnly:productionOnly.sort(),candidateOnly:candidateOnly.sort(),production:{findings:productionFindings.length,usage:usage(production),latencyMs:num(production.latencyMs),cost:num(production.cost)},candidate:{findings:candidateFindings.length,usage:usage(candidate),latencyMs:num(candidate.latencyMs),cost:num(candidate.cost)}});
}
function qualityConstrainedPromotion({baseline={},candidate={},limits={}}={}){
  const reasons=[];
  const maxRecallDrop=num(limits.maxRecallDrop),maxFalsePositiveIncrease=num(limits.maxFalsePositiveIncrease),maxCriticalRecallDrop=num(limits.maxCriticalRecallDrop),minimumSamples=Math.max(0,Math.floor(Number(limits.minimumSamples)||0)),minimumCriticalSamples=Math.max(0,Math.floor(Number(limits.minimumCriticalSamples)||0));
  const samples=Math.max(0,Math.floor(Number(candidate.samples)||0)),criticalSamples=Math.max(0,Math.floor(Number(candidate.criticalSamples)||0));
  const recallDrop=Math.max(0,num(baseline.recall)-num(candidate.recall)),fpIncrease=Math.max(0,num(candidate.falsePositiveRate)-num(baseline.falsePositiveRate)),criticalDrop=Math.max(0,num(baseline.criticalRecall)-num(candidate.criticalRecall));
  if(minimumSamples&&samples<minimumSamples)reasons.push(`insufficient_samples:${samples}<${minimumSamples}`);
  if(minimumCriticalSamples&&criticalSamples<minimumCriticalSamples)reasons.push(`insufficient_critical_samples:${criticalSamples}<${minimumCriticalSamples}`);
  if(recallDrop>maxRecallDrop)reasons.push(`recall_drop:${recallDrop}`);if(fpIncrease>maxFalsePositiveIncrease)reasons.push(`false_positive_increase:${fpIncrease}`);if(criticalDrop>maxCriticalRecallDrop)reasons.push(`critical_recall_drop:${criticalDrop}`);
  return freeze({approved:reasons.length===0,reasons,samples,criticalSamples,recallDrop,falsePositiveIncrease:fpIncrease,criticalRecallDrop:criticalDrop});
}
module.exports={MODEL_ECONOMICS_VERSION,DEFAULT_SEGMENT_DIMENSIONS,buildModelEconomicsScorecard,buildSegmentedModelEconomics,compareShadowReview,qualityConstrainedPromotion,segmentIdentity};
