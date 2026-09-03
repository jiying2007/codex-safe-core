'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {isNextPatch}=require('../scripts/verify-consumer-release-bump');
const {CURRENT_STATE_DOCS,syncCurrentIdentityText}=require('../scripts/repin-consumer');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'scripts','verify-consumer-release-bump.js'),'utf8');

test('release bump version relation is product-local and patch exact',()=>{
  assert.equal(isNextPatch('5.4.4','5.4.5'),true);
  assert.equal(isNextPatch('4.7.3','4.7.4'),true);
  assert.equal(isNextPatch('7.4.1','7.4.2'),true);
  assert.equal(isNextPatch('1.4.2','1.4.3'),true);
  assert.equal(isNextPatch('5.4.4','4.14.2'),false);
  assert.equal(isNextPatch('5.4.4','5.4.6'),false);
});

test('consumer verifier reads product identity from the caller workspace, never Core package identity',()=>{
  assert.match(source,/root=process\.cwd\(\)/);
  assert.match(source,/path\.join\(root,'package\.json'\)/);
  assert.match(source,/path\.join\(root,'product-contract\.json'\)/);
  assert.doesNotMatch(source,/require\(['"]\.\.\/package\.json['"]\)/);
});

test('consumer verifier enforces existing Service and Diagnose product aliases',()=>{
  assert.match(source,/\['serviceVersion','diagnoseVersion'\]/);
  assert.match(source,/product\[alias\]!==after/);
});

test('changelog validation follows canonical repin and is conditional on repository support',()=>{
  assert.match(source,/const changelogPath=path\.join\(root,'CHANGELOG\.md'\)/);
  assert.match(source,/fs\.existsSync\(changelogPath\)/);
  assert.match(source,/CHANGELOG must begin with product release/);
});

test('current identity synchronization covers Change exact-pin and family-alignment prose',()=>{
  const oldSha='a'.repeat(40),newSha='b'.repeat(40);
  const input='- Safe Core: `4.14.2` exact pin `'+oldSha+'`\nCodex Change Safe 5.4.4 pins Core 4.14.2.\nSafe Core：`4.14.2`\nCodex Change Safe 5.4.4 固定到 Core 4.14.2。';
  const out=syncCurrentIdentityText(input,{oldSha,newSha,oldVersion:'4.14.2',newVersion:'4.14.3',oldProductVersion:'5.4.4',newProductVersion:'5.4.5'});
  assert.match(out,/Safe Core: `4\.14\.3` exact pin `b{40}`/);
  assert.match(out,/Codex Change Safe 5\.4\.5 pins Core 4\.14\.3/);
  assert.match(out,/Safe Core：`4\.14\.3`/);
  assert.match(out,/Codex Change Safe 5\.4\.5 固定到 Core 4\.14\.3/);
});

test('Service compose is canonical current-state release identity',()=>{
  assert.ok(CURRENT_STATE_DOCS.includes('deploy/docker/compose.yaml'));
});
