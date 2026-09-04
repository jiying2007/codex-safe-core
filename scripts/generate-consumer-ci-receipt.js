#!/usr/bin/env node
'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const contract=require('../core-contract.json');
const {computeCoreDigests}=require('./core-digests');

function digest(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function git(args,cwd){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function normalizeSuites(value){
  const raw=Array.isArray(value)?value:String(value||'').split(',');
  const suites=[...new Set(raw.map(item=>String(item||'').trim()).filter(Boolean))];
  if(!suites.length)return['ci'];
  if(suites.length>32||suites.some(item=>item.length>128||/[\r\n\0]/.test(item)))throw new Error('Consumer CI Receipt suites are invalid.');
  return suites;
}
function buildReceipt(root=process.cwd(),input={}){
  const product=JSON.parse(fs.readFileSync(path.join(root,'product-contract.json'),'utf8'));
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const sourceSha=String(input.sourceSha||git(['rev-parse','HEAD'],root));
  if(!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error('Consumer CI Receipt requires an exact source SHA.');
  if(product.productVersion!==pkg.version)throw new Error('Consumer CI Receipt product/package version drift.');
  const pin=git(['ls-files','--stage','src/codex-safe-core'],root).split(/\s+/)[1]||'';
  if(pin!==product.safeCoreCommit)throw new Error('Consumer CI Receipt Core pin drift.');
  const coreRoot=path.join(root,'src','codex-safe-core'),coreDigests=computeCoreDigests(coreRoot);
  if(product.safeCoreRuntimeDigest!==coreDigests.runtimeDigest||product.safeCoreGovernanceDigest!==coreDigests.governanceDigest)throw new Error('Consumer CI Receipt Product Contract digest drift.');
  const payload={
    schemaVersion:Number(contract.consumerCiReceiptVersion),
    productId:product.productId,
    productVersion:product.productVersion,
    sourceSha,
    corePin:{sha:pin,version:product.safeCoreVersion,runtimeDigest:coreDigests.runtimeDigest,governanceDigest:coreDigests.governanceDigest},
    ci:{workflow:String(input.workflow||process.env.CI_WORKFLOW_NAME||'CI'),runId:String(input.runId||process.env.CI_RUN_ID||''),runAttempt:Math.max(1,Number(input.runAttempt||process.env.CI_RUN_ATTEMPT)||1),event:String(input.event||process.env.CI_EVENT||''),conclusion:'success'},
    suites:normalizeSuites(input.suites??process.env.CI_SUITES),
    node:{minimum:product.minimumNodeVersion,canonical:product.canonicalNodeVersion,supportedMajors:product.supportedNodeMajors}
  };
  if(!payload.ci.runId)throw new Error('Consumer CI Receipt requires the successful CI run id.');
  payload.receiptDigest=digest(JSON.stringify(payload));
  return Object.freeze(payload);
}
function main(){
  const args=process.argv.slice(2),outputIndex=args.indexOf('--output'),target=outputIndex>=0?args[outputIndex+1]:'CONSUMER_CI_RECEIPT.json';
  if(!target)throw new Error('--output requires a path.');
  const receipt=buildReceipt(process.cwd(),{sourceSha:process.env.CI_SOURCE_SHA,workflow:process.env.CI_WORKFLOW_NAME,runId:process.env.CI_RUN_ID,runAttempt:process.env.CI_RUN_ATTEMPT,event:process.env.CI_EVENT,suites:process.env.CI_SUITES});
  fs.writeFileSync(path.resolve(target),JSON.stringify(receipt,null,2)+'\n');
  process.stdout.write(`${path.resolve(target)}\n`);
}
if(require.main===module){try{main();}catch(error){console.error(error.stack||error.message||String(error));process.exitCode=2;}}
module.exports={buildReceipt,digest,normalizeSuites};
