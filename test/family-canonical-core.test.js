'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {canonicalCoreReleaseCompatibility}=require('../scripts/family-release-state');

const headSha='b'.repeat(40);
const tagSha='a'.repeat(40);
const runtimeDigest='1'.repeat(64);
const surfaceManifestDigest='2'.repeat(64);

function release(overrides={}){return{ready:true,tag:'v4.17.5',tagSha,immutable:true,reason:'exact-immutable-release',...overrides};}
function digests(overrides={}){return{ready:true,runtimeDigest,governanceDigest:'3'.repeat(64),surfaceManifestDigest,reason:'verified-core-digests',...overrides};}
function headRuntime(overrides={}){return{ready:true,runtimeDigest,surfaceManifestDigest,reason:'verified-core-head-runtime-digest',...overrides};}

test('canonical Core accepts an immutable ancestor release when current main is runtime-equivalent',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime(),{headSha,isAncestor:true});
  assert.deepEqual(result,{ready:true,reason:'canonical-immutable-release-runtime-equivalent-main'});
});

test('canonical Core fails closed when the immutable release is not an ancestor of current main',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime(),{headSha,isAncestor:false});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-release-not-ancestor-of-main');
});

test('canonical Core fails closed when runtime changes without a version bump',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime({runtimeDigest:'4'.repeat(64)}),{headSha,isAncestor:true});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-runtime-changed-without-version-bump');
});

test('canonical Core fails closed when runtime surface classification changes without a version bump',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime({surfaceManifestDigest:'5'.repeat(64)}),{headSha,isAncestor:true});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-surface-manifest-changed-without-version-bump');
});

test('Family Freshness evaluates Core main pushes and dispatches a full compatibility matrix',()=>{
  const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-freshness.yml'),'utf8');
  assert.match(workflow,/push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(workflow,/family-ci\.yml[^\n]*full_matrix=true/);
});
