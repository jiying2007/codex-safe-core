'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const core=require('../core-contract.json');
const {readSnapshot}=require('../scripts/checkout-family-snapshot');
const {validateRelease}=require('../scripts/verify-released-core');
const {verify:verifyProductContract}=require('../scripts/verify-consumer-product-contract');

function digest(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
test('atomic Family snapshot digest fails closed on mutation',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-safe-snapshot-')),file=path.join(dir,'snapshot.json'),base={schemaVersion:core.familySnapshotVersion,core:{version:core.coreVersion,sha:'a'.repeat(40)},consumers:{'codex-commit':{sha:'b'.repeat(40)}}};const value={...base,snapshotDigest:digest(JSON.stringify(base))};fs.writeFileSync(file,JSON.stringify(value));assert.equal(readSnapshot(file).snapshotDigest,value.snapshotDigest);value.core.sha='c'.repeat(40);fs.writeFileSync(file,JSON.stringify(value));assert.throws(()=>readSnapshot(file),/digest/i);fs.rmSync(dir,{recursive:true,force:true});});
test('released Core validator requires exact immutable final release',()=>{assert.equal(validateRelease({tag_name:`v${core.coreVersion}`,draft:false,prerelease:false,immutable:true},{tag:`v${core.coreVersion}`,sha:'a'.repeat(40),expectedSha:'a'.repeat(40)}),true);assert.throws(()=>validateRelease({tag_name:`v${core.coreVersion}`,draft:false,prerelease:false,immutable:false},{tag:`v${core.coreVersion}`,sha:'a'.repeat(40),expectedSha:'a'.repeat(40)}),/not immutable/);assert.throws(()=>validateRelease({tag_name:`v${core.coreVersion}`,draft:false,prerelease:false,immutable:true},{tag:`v${core.coreVersion}`,sha:'b'.repeat(40),expectedSha:'a'.repeat(40)}),/expected/);});
test('consumer Product Contract v1 binds package identity and Core gitlink',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-safe-product-')),pin='d'.repeat(40);execFileSync('git',['init','-q'],{cwd:dir});fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:'9.9.9'}));fs.writeFileSync(path.join(dir,'product-contract.json'),JSON.stringify({productContractVersion:core.productContractVersion,productId:'codex-review-safe',productVersion:'9.9.9',safeCoreVersion:core.coreVersion,safeCoreMajorVersion:core.safeCoreMajorVersion,safeContractVersion:core.safeContractVersion,policySchemaVersion:core.policySchemaVersion,safeCoreCommit:pin,minimumNodeVersion:core.minimumNodeVersion,canonicalNodeVersion:core.canonicalNodeVersion,supportedNodeMajors:core.supportedNodeMajors}));execFileSync('git',['update-index','--add','--cacheinfo',`160000,${pin},src/codex-safe-core`],{cwd:dir});assert.equal(verifyProductContract(dir,pin,'codex-review-safe').safeCoreCommit,pin);fs.rmSync(dir,{recursive:true,force:true});});
