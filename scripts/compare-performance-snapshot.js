#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const {comparePerformanceSnapshot}=require('../quality-platform');

const [currentFile,baselineFile]=process.argv.slice(2);
if(!currentFile||!baselineFile)throw new Error('Usage: node scripts/compare-performance-snapshot.js CURRENT BASELINE');
const current=JSON.parse(fs.readFileSync(currentFile,'utf8'));
const baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
const result=comparePerformanceSnapshot({
  latencyMs:Number(current.metrics?.elapsedMs||0),
  rssBytes:Number(current.metrics?.rssGrowthBytes||0)
},{
  latencyMs:Number(baseline.metrics?.elapsedMs||0),
  rssBytes:Number(baseline.metrics?.rssGrowthBytes||0)
},{
  latencyRegressionPct:10,
  rssRegressionPct:10,
  artifactRegressionPct:5
});
if(!result.ok){
  process.stderr.write(`${JSON.stringify({ok:false,result,current:current.metrics,baseline:baseline.metrics},null,2)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ok:true,result,current:current.metrics,baseline:baseline.metrics},null,2)}\n`);
