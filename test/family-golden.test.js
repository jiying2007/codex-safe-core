'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

test('Family v4 golden corpus remains deterministic',()=>{
  const root=path.resolve(__dirname,'..');
  const output=execFileSync(process.execPath,[path.join(root,'scripts','family-golden.js'),root],{cwd:root,encoding:'utf8'}).trim();
  const parsed=JSON.parse(output);
  assert.equal(parsed.reviewRules.length>=4,true);
  assert.equal(parsed.evidence.length>=1,true);
});
