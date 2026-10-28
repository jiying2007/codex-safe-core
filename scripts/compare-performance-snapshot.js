#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {comparePerformanceSnapshot}=require('../quality-platform');
function validMetrics(metrics){
  return Boolean(metrics&&typeof metrics==='object'&&
    Number.isFinite(metrics.elapsedMs)&&metrics.elapsedMs>0&&
    Number.isFinite(metrics.rssGrowthBytes)&&metrics.rssGrowthBytes>=0);
}
function compareSnapshots(current,baseline){
  const currentSchema=Number(current?.schemaVersion),baselineSchema=Number(baseline?.schemaVersion);
  if(![2,3].includes(currentSchema)||![2,3].includes(baselineSchema))return{ok:false,migration:false,reason:'unsupported_schema'};
  const currentMetrics=current.metrics||{},baselineMetrics=baseline.metrics||{};
  const elapsedLimit=Number(current.budgets?.elapsedMs??5000),rssLimit=Number(current.budgets?.rssGrowthBytes??256*1024*1024);
  if(!validMetrics(currentMetrics)||!Number.isFinite(elapsedLimit)||elapsedLimit<=0||
     !Number.isFinite(rssLimit)||rssLimit<=0||currentMetrics.elapsedMs>=elapsedLimit||
     currentMetrics.rssGrowthBytes>=rssLimit)return{ok:false,migration:false,reason:'broad_budget'};
  if(!validMetrics(baselineMetrics))return{ok:false,migration:false,reason:'invalid_baseline_metrics'};
  if(currentSchema>=3&&baselineSchema===2)return{ok:true,migration:true,reason:'legacy_single_sample_baseline',result:null};
  if(currentSchema!==baselineSchema)return{ok:false,migration:false,reason:'incompatible_schema'};
  const result=comparePerformanceSnapshot(
    {latencyMs:currentMetrics.elapsedMs,rssBytes:currentMetrics.rssGrowthBytes},
    {latencyMs:baselineMetrics.elapsedMs,rssBytes:baselineMetrics.rssGrowthBytes},
    {latencyRegressionPct:10,rssRegressionPct:10,artifactRegressionPct:5});
  return{ok:result.ok,migration:false,reason:result.ok?'within_regression_budget':'regression',result};
}
// A cross-runner comparison is still subject to the strict performance gate.
// Surface missing or different execution conditions instead of claiming code causality.
function describeComparability(current,baseline){
  const fields=[
    ['node',current.node,baseline.node],
    ['platform',current.platform,baseline.platform],
    ['arch',current.environment?.arch,baseline.environment?.arch],
    ['osRelease',current.environment?.osRelease,baseline.environment?.osRelease],
    ['cpuModel',current.environment?.cpuModel,baseline.environment?.cpuModel],
    ['logicalCpus',current.environment?.logicalCpus,baseline.environment?.logicalCpus],
    ['workloadSha256',current.workload?.inputSha256,baseline.workload?.inputSha256]
  ];
  const missing=fields.filter(([,a,b])=>a==null||b==null||a===''||b==='').map(([key])=>key);
  const mismatched=fields.filter(([,a,b])=>a!=null&&b!=null&&a!==''&&b!==''&&String(a)!==String(b)).map(([key])=>key);
  return {status:mismatched.length?'different':missing.length?'unverified':'matched',missing,mismatched};
}
function main(){const[currentFile,baselineFile]=process.argv.slice(2);if(!currentFile||!baselineFile)throw new Error('Usage: node scripts/compare-performance-snapshot.js CURRENT BASELINE');const current=JSON.parse(fs.readFileSync(currentFile,'utf8')),baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8')),comparison=compareSnapshots(current,baseline),payload={ok:comparison.ok,comparison,comparability:describeComparability(current,baseline),current:current.metrics,baseline:baseline.metrics};(comparison.ok?process.stdout:process.stderr).write(`${JSON.stringify(payload,null,2)}\n`);if(!comparison.ok)process.exit(1);}
if(require.main===module)main();
module.exports={compareSnapshots,describeComparability};
