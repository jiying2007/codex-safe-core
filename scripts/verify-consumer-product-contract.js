#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const currentCore=require('../core-contract.json');
const {computeCoreDigests}=require('./core-digests');

function git(args,cwd){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function verify(root=process.cwd(),expectedCoreSha='',expectedProduct='',{allowRuntimeEquivalent=false,currentCoreRoot=path.resolve(__dirname,'..')}={}){
  const contractPath=path.join(root,'product-contract.json');
  assert.ok(fs.existsSync(contractPath),'product-contract.json is required for every active consumer');
  const contract=JSON.parse(fs.readFileSync(contractPath,'utf8')),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const pinnedRoot=path.join(root,'src','codex-safe-core');
  assert.ok(fs.existsSync(path.join(pinnedRoot,'core-contract.json')),'consumer pinned Core checkout is required');
  const pinnedCore=JSON.parse(fs.readFileSync(path.join(pinnedRoot,'core-contract.json'),'utf8'));
  assert.equal(contract.productContractVersion,Number(pinnedCore.productContractVersion||1));
  assert.equal(contract.productContractVersion,Number(currentCore.productContractVersion||1));
  assert.match(String(contract.productId||''),/^codex-(?:commit-safe|review-safe|review-service|diagnose|debug-safe|change-safe)$/);
  if(expectedProduct)assert.equal(contract.productId,expectedProduct);
  assert.equal(contract.productVersion,pkg.version);
  assert.equal(contract.safeCoreVersion,pinnedCore.coreVersion);
  assert.equal(contract.safeCoreMajorVersion,pinnedCore.safeCoreMajorVersion);
  assert.equal(contract.safeContractVersion,pinnedCore.safeContractVersion);
  assert.equal(contract.policySchemaVersion,pinnedCore.policySchemaVersion);
  assert.equal(contract.minimumNodeVersion,pinnedCore.minimumNodeVersion);
  assert.equal(contract.canonicalNodeVersion,pinnedCore.canonicalNodeVersion);
  assert.deepEqual(contract.supportedNodeMajors,pinnedCore.supportedNodeMajors);
  const pin=git(['ls-files','--stage','src/codex-safe-core'],root).split(/\s+/)[1]||'';
  assert.match(pin,/^[0-9a-f]{40}$/);
  assert.equal(contract.safeCoreCommit,pin);
  const pinnedDigests=computeCoreDigests(pinnedRoot);
  assert.match(String(contract.safeCoreRuntimeDigest||''),/^[0-9a-f]{64}$/);
  assert.match(String(contract.safeCoreGovernanceDigest||''),/^[0-9a-f]{64}$/);
  assert.equal(contract.safeCoreRuntimeDigest,pinnedDigests.runtimeDigest);
  assert.equal(contract.safeCoreGovernanceDigest,pinnedDigests.governanceDigest);
  if(expectedCoreSha&&!allowRuntimeEquivalent)assert.equal(pin,expectedCoreSha);
  if(allowRuntimeEquivalent){
    const currentDigests=computeCoreDigests(currentCoreRoot);
    assert.equal(pinnedDigests.runtimeDigest,currentDigests.runtimeDigest,'consumer pinned Core runtimeDigest is stale');
  }
  return Object.freeze({productId:contract.productId,productVersion:contract.productVersion,safeCoreVersion:contract.safeCoreVersion,safeCoreCommit:pin,safeCoreRuntimeDigest:pinnedDigests.runtimeDigest,safeCoreGovernanceDigest:pinnedDigests.governanceDigest,runtimeEquivalent:allowRuntimeEquivalent?true:(expectedCoreSha?pin===expectedCoreSha:true)});
}
function main(){
  const args=process.argv.slice(2),runtimeEquivalent=args.includes('--runtime-compatible'),values=args.filter(value=>value!=='--runtime-compatible');
  const result=verify(process.cwd(),String(values[0]||''),String(values[1]||''),{allowRuntimeEquivalent:runtimeEquivalent});
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=2;}}
module.exports={verify};
