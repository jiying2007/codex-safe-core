'use strict';

const spec = require('./quality/promotion-corpus-spec.json');
const REAL_CATEGORIES = Object.freeze(['resource','resource','correctness','correctness','resource','correctness','security','security','correctness','security']);
const REAL_SEVERITIES = Object.freeze(['high','high','high','high','high','high','critical','high','high','high']);

function syntheticCase(partition, index) {
  const template = spec.templates[index % spec.templates.length];
  const n = partition === 'dev' ? index + 1 : Number(spec.syntheticPerPartition) + index + 1;
  return Object.freeze({
    id: `promotion-${partition}-${String(n).padStart(2,'0')}`,
    partition,
    description: template.description,
    sourceKind: 'synthetic-mutation',
    profilePack: spec.profilePacks[index % spec.profilePacks.length],
    repoSizeBucket: spec.repoSizeBuckets[index % spec.repoSizeBuckets.length],
    expected: Object.freeze([{ severity: template.severity, category: template.category, file: template.file.replace('{n}', String(n)), line: 10 + (index % 80) }])
  });
}
function buildPromotionCorpus() {
  if (Number(spec.schemaVersion) !== 1) throw new Error('Unsupported promotion corpus spec schema.');
  const cases = [];
  for (const partition of ['dev','holdout']) for (let index=0; index<Number(spec.syntheticPerPartition); index++) cases.push(syntheticCase(partition,index));
  spec.realRegressions.forEach((description,index)=>cases.push(Object.freeze({id:`promotion-real-${String(index+1).padStart(2,'0')}`,partition:'real-regression',description,sourceKind:'real-regression',profilePack:spec.profilePacks[index%spec.profilePacks.length],repoSizeBucket:spec.repoSizeBuckets[(index+2)%spec.repoSizeBuckets.length],expected:Object.freeze([{severity:REAL_SEVERITIES[index],category:REAL_CATEGORIES[index],file:`regressions/case_${index+1}.js`,line:20+index}])})));
  spec.cleanNegatives.forEach((description,index)=>cases.push(Object.freeze({id:`promotion-clean-${String(index+1).padStart(2,'0')}`,partition:index%2?'holdout':'dev',description,sourceKind:'clean-negative',profilePack:spec.profilePacks[index%spec.profilePacks.length],repoSizeBucket:spec.repoSizeBuckets[index%spec.repoSizeBuckets.length],expected:Object.freeze([])})));
  return Object.freeze({schemaVersion:1,cases:Object.freeze(cases)});
}
module.exports={buildPromotionCorpus};
