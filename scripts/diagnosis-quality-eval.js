#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {evaluateDiagnosisResults,assertDiagnosisQualityGate}=require('../diagnosis-quality');
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),resultIndex=args.indexOf('--results'),baselineIndex=args.indexOf('--baseline');
const resultsFile=path.resolve(resultIndex>=0&&args[resultIndex+1]?args[resultIndex+1]:path.join(root,'quality/diagnosis-recorded-results.json'));
const baselineFile=path.resolve(baselineIndex>=0&&args[baselineIndex+1]?args[baselineIndex+1]:path.join(root,'quality/diagnosis-baseline.json'));
const corpus=read(path.join(root,'quality/diagnosis-corpus.json')).cases,results=read(resultsFile).results,baseline=read(baselineFile),metrics=evaluateDiagnosisResults(corpus,results);
assertDiagnosisQualityGate(metrics,{baseline,minClassificationAccuracy:0.9,minRootCauseTop1Accuracy:0.85,minAffectedFileRecall:0.9,minRetryAccuracy:0.9,minEvidenceValidityRate:1,maxConfidenceCalibrationError:0.2,maxAccuracyRegression:0.02,maxTokenRegression:0.15});
process.stdout.write(`${JSON.stringify({ok:true,resultsFile,metrics},null,2)}\n`);
