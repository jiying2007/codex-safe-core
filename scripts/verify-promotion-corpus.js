#!/usr/bin/env node
'use strict';

const { buildPromotionCorpus } = require('../promotion-corpus');

function fail(message){const error=new Error(`Promotion corpus contract failed: ${message}`);error.code='EPROMOTIONCORPUS';throw error;}
const corpus=buildPromotionCorpus(),cases=corpus.cases;
if(cases.length<80)fail(`requires at least 80 cases, found ${cases.length}`);
const ids=new Set(),partitions=new Map(),categories=new Set(),profiles=new Set(),sizes=new Set();let clean=0,real=0,critical=0;
for(const item of cases){
  if(!item.id||ids.has(item.id))fail(`duplicate or missing id: ${item.id}`);ids.add(item.id);
  partitions.set(item.partition,(partitions.get(item.partition)||0)+1);
  profiles.add(item.profilePack);sizes.add(item.repoSizeBucket);
  if(item.sourceKind==='clean-negative'){clean++;if(item.expected.length)fail(`${item.id} clean negative has findings`);}
  if(item.sourceKind==='real-regression')real++;
  for(const finding of item.expected){categories.add(finding.category);if(finding.severity==='critical')critical++;}
}
for(const name of ['dev','holdout','real-regression'])if(!partitions.has(name))fail(`missing partition ${name}`);
for(const category of ['security','concurrency','resource','correctness','test'])if(!categories.has(category))fail(`missing category ${category}`);
for(const profile of ['general','backend','security','cpp','embedded-linux','embedded-mcu','driver','kernel','realtime'])if(!profiles.has(profile))fail(`missing profile ${profile}`);
for(const size of ['small','medium','large'])if(!sizes.has(size))fail(`missing repo size ${size}`);
if(clean<10)fail('requires at least 10 clean negatives');
if(real<10)fail('requires at least 10 real regressions');
if(critical<12)fail('requires at least 12 critical cases');
console.log(JSON.stringify({ok:true,cases:cases.length,partitions:Object.fromEntries(partitions),cleanNegatives:clean,realRegressions:real,criticalCases:critical,categories:[...categories].sort(),profiles:[...profiles].sort(),repoSizes:[...sizes].sort()},null,2));
