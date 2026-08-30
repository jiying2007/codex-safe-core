#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const core=require('../core-contract.json');

function git(args,cwd){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function verify(root=process.cwd(),expectedCoreSha='',expectedProduct=''){
  const contractPath=path.join(root,'product-contract.json');
  assert.ok(fs.existsSync(contractPath),'product-contract.json is required for every active consumer');
  const contract=JSON.parse(fs.readFileSync(contractPath,'utf8')),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(contract.productContractVersion,Number(core.productContractVersion||1));
  assert.match(String(contract.productId||''),/^codex-(?:commit-safe|review-safe|review-service|diagnose)$/);
  if(expectedProduct)assert.equal(contract.productId,expectedProduct);
  assert.equal(contract.productVersion,pkg.version);
  assert.equal(contract.safeCoreVersion,core.coreVersion);
  assert.equal(contract.safeCoreMajorVersion,core.safeCoreMajorVersion);
  assert.equal(contract.safeContractVersion,core.safeContractVersion);
  assert.equal(contract.policySchemaVersion,core.policySchemaVersion);
  assert.equal(contract.minimumNodeVersion,core.minimumNodeVersion);
  assert.equal(contract.canonicalNodeVersion,core.canonicalNodeVersion);
  assert.deepEqual(contract.supportedNodeMajors,core.supportedNodeMajors);
  const pin=git(['ls-files','--stage','src/codex-safe-core'],root).split(/\s+/)[1]||'';
  assert.match(pin,/^[0-9a-f]{40}$/);
  assert.equal(contract.safeCoreCommit,pin);
  if(expectedCoreSha)assert.equal(pin,expectedCoreSha);
  return Object.freeze({productId:contract.productId,productVersion:contract.productVersion,safeCoreVersion:contract.safeCoreVersion,safeCoreCommit:pin});
}
function main(){const result=verify(process.cwd(),String(process.argv[2]||''),String(process.argv[3]||''));process.stdout.write(`${JSON.stringify(result)}\n`);}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=2;}}
module.exports={verify};
