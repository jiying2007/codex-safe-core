'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {canonicalCoreReleaseCompatibility}=require('../scripts/family-release-state');

const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-upgrade.yml'),'utf8');
const familyWorkflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-ci.yml'),'utf8');
const freshnessWorkflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-freshness.yml'),'utf8');

const headSha='b'.repeat(40);
const tagSha='a'.repeat(40);
const runtimeDigest='1'.repeat(64);
const surfaceManifestDigest='2'.repeat(64);
function release(overrides={}){return{ready:true,tag:'v4.17.5',tagSha,immutable:true,reason:'exact-immutable-release',...overrides};}
function digests(overrides={}){return{ready:true,runtimeDigest,governanceDigest:'3'.repeat(64),surfaceManifestDigest,reason:'verified-core-digests',...overrides};}
function headRuntime(overrides={}){return{ready:true,runtimeDigest,surfaceManifestDigest,reason:'verified-core-head-runtime-digest',...overrides};}

test('Family Upgrade resumes an already-materialized open upgrade PR instead of skipping it',()=>{
  assert.match(workflow,/gh pr list --repo .* --head "\$branch" --state open/);
  assert.match(workflow,/existing upgrade PR #\$pr is already materialized; resuming transaction/);
  assert.match(workflow,/"\$repo" prepared "\$pr" "\$branch"/);
  assert.match(workflow,/git -C "\$dir" checkout main/);
  assert.match(workflow,/main runtime-equivalent; no product repin\/release required/);
});

test('Family Upgrade polls Family release state once per attempt and retries only transient query failures',()=>{
  const releaseStateCalls=workflow.match(/node scripts\/family-release-state\.js/g)||[];
  assert.equal(releaseStateCalls.length,1);
  assert.doesNotMatch(workflow,/family-release-state\.js --repo/);
  assert.match(workflow,/for attempt in \{1\.\.60\}/);
  assert.match(workflow,/429\|5\[0-9\]\{2\}/);
  assert.match(workflow,/ECONNRESET\|ETIMEDOUT\|fetch failed/);
  assert.match(workflow,/transient Family release-state query failure/);
  assert.match(workflow,/Family consumers did not reach exact release \+ distribution \+ runtime readiness/);
});

test('Family Upgrade enumerates only active consumers in every transaction phase',()=>{const activeEnumerations=workflow.match(/require\('\.\/scripts\/family-release-state'\)\.CONSUMERS/g)||[];assert.equal(activeEnumerations.length,2);assert.doesNotMatch(workflow,/Object\.keys\(require\('\.\/family-registry\.json'\)\.consumers\)/);});

test('Family Upgrade newline-terminates readiness parser output for Bash read under set -e',()=>{
  assert.match(workflow,/process\.stdout\.write\([^\n]+\+'\\n'\)/);
});

test('canonical Core accepts an immutable ancestor release only when current main is runtime-equivalent',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime(),{headSha,isAncestor:true});
  assert.deepEqual(result,{ready:true,reason:'canonical-immutable-release-runtime-equivalent-main'});
});

test('canonical Core fails closed when immutable release ancestry is broken',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime(),{headSha,isAncestor:false});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-release-not-ancestor-of-main');
});

test('canonical Core fails closed on unversioned runtime drift',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime({runtimeDigest:'4'.repeat(64)}),{headSha,isAncestor:true});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-runtime-changed-without-version-bump');
});

test('canonical Core fails closed on unversioned runtime-surface drift',()=>{
  const result=canonicalCoreReleaseCompatibility(release(),digests(),headRuntime({surfaceManifestDigest:'5'.repeat(64)}),{headSha,isAncestor:true});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'core-surface-manifest-changed-without-version-bump');
});

test('Family Freshness evaluates Core main pushes and dispatches the full compatibility matrix',()=>{
  assert.match(freshnessWorkflow,/push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(freshnessWorkflow,/family-ci\.yml[^\n]*full_matrix=true/);
});

test('production Family audits enumerate only frozen Snapshot consumers with Bash 3.2 portable loops',()=>{
  const enumerations=familyWorkflow.match(/Object\.keys\(require\('\.\/FAMILY_SNAPSHOT\.json'\)\.consumers\|\|\{\}\)/g)||[];
  const nonEmptyGuards=familyWorkflow.match(/test -n "\$repos"/g)||[];
  const readLoops=familyWorkflow.match(/while IFS= read -r repo/g)||[];
  assert.equal(enumerations.length,2);
  assert.equal(nonEmptyGuards.length,2);
  assert.equal(readLoops.length,2);
  assert.doesNotMatch(familyWorkflow,/\bmapfile\b|\breadarray\b/);
  assert.doesNotMatch(familyWorkflow,/Object\.keys\(require\('\.\/family-registry\.json'\)\.consumers\)/);
  assert.doesNotMatch(familyWorkflow,/family\/codex-debug/);
});
