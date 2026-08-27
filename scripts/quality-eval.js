#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {evaluateQualityResults,assertQualityGate}=require('../quality-platform');
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),resultIndex=args.indexOf('--results'),baselineIndex=args.indexOf('--baseline');
const resultsFile=path.resolve(resultIndex>=0&&args[resultIndex+1]?args[resultIndex+1]:path.join(root,'quality/recorded-results.json'));
const baselineFile=path.resolve(baselineIndex>=0&&args[baselineIndex+1]?args[baselineIndex+1]:path.join(root,'quality/baseline.json'));
const corpus=read(path.join(root,'quality/corpus.json')).cases,results=read(resultsFile).results,baseline=read(baselineFile),metrics=evaluateQualityResults(corpus,results);
assertQualityGate(metrics,{baseline,minCriticalRecall:1,minRecall:0.95,minPrecision:0.8,maxFalsePositivePerReview:0.5,maxRecallRegression:0,maxPrecisionRegression:0.02,maxTokenRegression:0.15});
process.stdout.write(`${JSON.stringify({ok:true,resultsFile,metrics},null,2)}\n`);
