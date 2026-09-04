'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const core=require('../core-contract.json');
const registry=require('../family-registry.json');
const {readSnapshot}=require('../scripts/checkout-family-snapshot');
const {validateRelease}=require('../scripts/verify-released-core');
const {verify:verifyProductContract}=require('../scripts/verify-consumer-product-contract');
const {computeCoreDigests}=require('../scripts/core-digests');
const {bumpPatch}=require('../scripts/repin-consumer');
const {consumerHeadIsAligned,evaluateFreshness,manifestMatches,releaseIsExact}=require('../scripts/family-freshness');

function digest(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function git(args,cwd){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function productFixture(productId){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-safe-product-'));
  git(['init','-q'],dir);
  const pinnedRoot=path.join(dir,'src','codex-safe-core');fs.mkdirSync(pinnedRoot,{recursive:true});
  for(const file of ['core-contract.json','core-surface-manifest.json','codex-safe.schema.json'])fs.copyFileSync(path.join(__dirname,'..',file),path.join(pinnedRoot,file));
  git(['init','-q'],pinnedRoot);git(['add','.'],pinnedRoot);execFileSync('git',['-c','user.name=fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture Core'],{cwd:pinnedRoot});
  const pin=git(['rev-parse','HEAD'],pinnedRoot),digests=computeCoreDigests(pinnedRoot);
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:'9.9.9'}));
  fs.writeFileSync(path.join(dir,'product-contract.json'),JSON.stringify({
    productContractVersion:core.productContractVersion,productId,productVersion:'9.9.9',safeCoreVersion:core.coreVersion,
    safeCoreMajorVersion:core.safeCoreMajorVersion,safeContractVersion:core.safeContractVersion,policySchemaVersion:core.policySchemaVersion,
    safeCoreCommit:pin,safeCoreRuntimeDigest:digests.runtimeDigest,safeCoreGovernanceDigest:digests.governanceDigest,
    minimumNodeVersion:core.minimumNodeVersion,canonicalNodeVersion:core.canonicalNodeVersion,supportedNodeMajors:core.supportedNodeMajors
  }));
  // Keep the nested repository metadata: real submodule checkouts also have an independent Git directory.
  git(['update-index','--add','--cacheinfo',`160000,${pin},src/codex-safe-core`],dir);
  return{dir,pin,digests};
}
function release(version,sha){return{tag:`v${version}`,tagSha:sha,immutable:true,publishedAt:'2026-09-03T00:00:00Z',assets:[]};}
function distribution(){return{ready:true,channel:'github-release',reason:'release-is-distribution'};}
function alignedFamilyState(){const coreSha='a'.repeat(40),runtimeDigest='1'.repeat(64),governanceDigest='2'.repeat(64),coreState={version:core.coreVersion,sha:coreSha,releaseReady:true,digests:{ready:true,runtimeDigest,governanceDigest},release:release(core.coreVersion,coreSha),reason:'exact-immutable-release'},consumers={};for(const [index,name] of Object.keys(registry.consumers).entries()){const sha=String(index+1).repeat(40).slice(0,40),version=`1.${index}.0`;consumers[name]={sha,version,aligned:true,runtimeAligned:true,contractAligned:true,releaseReady:true,distributionReady:true,ready:true,corePin:{sha:'f'.repeat(40),version:'4.15.0',runtimeDigest,governanceDigest:'3'.repeat(64)},release:release(version,sha),distribution:distribution(),ciReceipt:{ready:true,receipt:{sourceSha:sha}},reason:'exact-release-distribution-runtime-compatible'};}return{core:coreState,consumers};}

test('Family contract versions are runtime-aware and release-aware',()=>{assert.equal(core.familyRegistryVersion,1);assert.equal(core.familySnapshotVersion,3);assert.equal(core.familyManifestVersion,5);assert.equal(core.familyStatusVersion,1);assert.equal(core.distributionReceiptVersion,1);assert.equal(core.productContractVersion,2);assert.equal(core.consumerCiReceiptVersion,1);assert.equal(core.coreDigestContractVersion,1);assert.equal(core.repositoryGovernanceContractVersion,1);assert.equal(registry.schemaVersion,core.familyRegistryVersion);});
test('atomic Family snapshot v3 digest fails closed on mutation',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-safe-snapshot-')),file=path.join(dir,'snapshot.json'),base={schemaVersion:core.familySnapshotVersion,registry:{schemaVersion:registry.schemaVersion,digest:digest(JSON.stringify(registry))},core:{version:core.coreVersion,sha:'a'.repeat(40),runtimeDigest:'1'.repeat(64),governanceDigest:'2'.repeat(64),release:release(core.coreVersion,'a'.repeat(40))},consumers:{'codex-commit':{sha:'b'.repeat(40),version:'1.0.0',corePin:{sha:'c'.repeat(40),version:'4.15.0',runtimeDigest:'1'.repeat(64),governanceDigest:'3'.repeat(64)},release:release('1.0.0','b'.repeat(40)),distribution:distribution(),ciReceipt:{schemaVersion:core.consumerCiReceiptVersion,digest:'4'.repeat(64)}}}};const value={...base,snapshotDigest:digest(JSON.stringify(base))};fs.writeFileSync(file,JSON.stringify(value));assert.equal(readSnapshot(file).snapshotDigest,value.snapshotDigest);value.core.sha='c'.repeat(40);fs.writeFileSync(file,JSON.stringify(value));assert.throws(()=>readSnapshot(file),/digest/i);fs.rmSync(dir,{recursive:true,force:true});});
test('released Core validator requires exact immutable final release',()=>{assert.equal(validateRelease({tag_name:`v${core.coreVersion}`,draft:false,prerelease:false,immutable:true},{tag:`v${core.coreVersion}`,sha:'a'.repeat(40),expectedSha:'a'.repeat(40)}),true);assert.throws(()=>validateRelease({tag_name:`v${core.coreVersion}`,draft:false,prerelease:false,immutable:false},{tag:`v${core.coreVersion}`,sha:'a'.repeat(40),expectedSha:'a'.repeat(40)}),/not immutable/);});
test('consumer Product Contract v2 binds package identity, exact Core gitlink and Core digests',()=>{const {dir,pin,digests}=productFixture('codex-review-safe');const result=verifyProductContract(dir,pin,'codex-review-safe');assert.equal(result.safeCoreCommit,pin);assert.equal(result.safeCoreRuntimeDigest,digests.runtimeDigest);assert.equal(result.safeCoreGovernanceDigest,digests.governanceDigest);fs.rmSync(dir,{recursive:true,force:true});});
test('consumer Product Contract v2 accepts the active Change product',()=>{const {dir,pin}=productFixture('codex-change-safe');assert.equal(verifyProductContract(dir,pin,'codex-change-safe').productId,'codex-change-safe');fs.rmSync(dir,{recursive:true,force:true});});
test('Core repin product version uses mandatory patch bump',()=>{assert.equal(bumpPatch('4.7.2'),'4.7.3');assert.equal(bumpPatch('7.4.1'),'7.4.2');assert.throws(()=>bumpPatch('4.7'),/MAJOR\.MINOR\.PATCH/);});
test('Family freshness accepts only exact immutable release/tag/main identity',()=>{const sha='a'.repeat(40),tag='v1.2.3';assert.equal(releaseIsExact({tag_name:tag,draft:false,prerelease:false,immutable:true},{tag,headSha:sha,tagSha:sha}),true);assert.equal(releaseIsExact({tag_name:tag,draft:false,prerelease:false,immutable:false},{tag,headSha:sha,tagSha:sha}),false);assert.equal(releaseIsExact({tag_name:tag,draft:false,prerelease:false,immutable:true},{tag,headSha:sha,tagSha:'b'.repeat(40)}),false);});
test('consumer Core runtime alignment alone is insufficient for Family freshness without release evidence',()=>{const coreState={version:'4.16.0',sha:'a'.repeat(40),digests:{runtimeDigest:'1'.repeat(64)}},state={sha:'b'.repeat(40),version:'7.5.1',aligned:true,runtimeAligned:true,contractAligned:true,corePin:{sha:'c'.repeat(40),runtimeDigest:'1'.repeat(64)}};assert.equal(consumerHeadIsAligned(state,coreState),true);const family=alignedFamilyState();family.consumers['codex-review-service']={...family.consumers['codex-review-service'],aligned:true,releaseReady:false,distributionReady:false,ready:false,reason:'consumer-release-not-exact'};const decision=evaluateFreshness({...family,manifest:null});assert.equal(decision.ready,false);assert.equal(decision.dispatch,false);assert.match(decision.reason,/consumer-release-not-exact/);});
test('Family freshness blocks when distribution receipt is missing',()=>{const state=alignedFamilyState();state.consumers['codex-review']={...state.consumers['codex-review'],distributionReady:false,ready:false,reason:'distribution-not-ready'};const decision=evaluateFreshness({...state,manifest:null});assert.equal(decision.ready,false);assert.match(decision.reason,/distribution-not-ready/);});
test('Family freshness suppresses duplicate dispatch while authoritative validation is active',()=>{const state=alignedFamilyState(),decision=evaluateFreshness({...state,manifest:null,validationActive:true});assert.equal(decision.ready,true);assert.equal(decision.dispatch,false);assert.equal(decision.reason,'family-validation-active');});
test('Family Manifest v5 identity includes exact release, pinned Core, CI and distribution evidence',()=>{const state=alignedFamilyState(),manifest={schemaVersion:core.familyManifestVersion,core:{version:state.core.version,sha:state.core.sha,runtimeDigest:state.core.digests.runtimeDigest,governanceDigest:state.core.digests.governanceDigest,release:structuredClone(state.core.release)},consumers:Object.fromEntries(Object.entries(state.consumers).map(([name,value])=>[name,{sha:value.sha,version:value.version,corePin:structuredClone(value.corePin),release:structuredClone(value.release),distribution:structuredClone(value.distribution),ciReceipt:structuredClone(value.ciReceipt?.receipt||{})}]))};assert.equal(manifestMatches(manifest,state),true);manifest.consumers['codex-review'].release.tagSha='f'.repeat(40);assert.equal(manifestMatches(manifest,state),false);});
test('Family freshness workflow is same-repository, credential-minimal and CI-lightweight',()=>{const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-freshness.yml'),'utf8');assert.match(workflow,/actions:\s*write/);assert.match(workflow,/contents:\s*read/);assert.match(workflow,/family-ci\.yml/);assert.match(workflow,/17,47 \* \* \* \*/);assert.doesNotMatch(workflow,/FAMILY_BOT_TOKEN/);assert.doesNotMatch(workflow,/npm run ci/);});
