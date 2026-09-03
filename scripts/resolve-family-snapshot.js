#!/usr/bin/env node
'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const contract=require('../core-contract.json');
const registry=require('../family-registry.json');
const {CONSUMERS,collectFamilyState}=require('./family-release-state');

function sha(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function canonicalConsumer(state){
  return {
    sha:state.sha,
    version:state.version,
    release:{tag:state.release.tag,tagSha:state.release.tagSha,immutable:state.release.immutable,publishedAt:state.release.publishedAt,assets:state.release.assets.map(({name,size,digest})=>({name,size,digest}))},
    distribution:state.distribution
  };
}
async function createSnapshot({token=process.env.GITHUB_TOKEN}={}){
  const state=await collectFamilyState({token});
  if(!state.core.releaseReady)throw new Error(`Core release is not ready: ${state.core.reason}`);
  const consumers={};
  for(const name of CONSUMERS){
    const consumer=state.consumers[name];
    if(!consumer.ready)throw new Error(`${name} is not release/distribution ready: ${consumer.reason}`);
    consumers[name]=canonicalConsumer(consumer);
  }
  const payload={
    schemaVersion:Number(contract.familySnapshotVersion),
    registry:{schemaVersion:Number(registry.schemaVersion),digest:sha(JSON.stringify(registry))},
    core:{version:state.core.version,sha:state.core.sha,release:{tag:state.core.release.tag,tagSha:state.core.release.tagSha,immutable:state.core.release.immutable,publishedAt:state.core.release.publishedAt,assets:state.core.release.assets.map(({name,size,digest})=>({name,size,digest}))}},
    consumers
  };
  payload.snapshotDigest=sha(JSON.stringify(payload));
  return payload;
}
async function main(){
  const args=process.argv.slice(2),snapshot=await createSnapshot(),json=JSON.stringify(snapshot),outputIndex=args.indexOf('--github-output'),fileIndex=args.indexOf('--output');
  if(outputIndex>=0){const target=args[outputIndex+1]||process.env.GITHUB_OUTPUT;if(!target)throw new Error('--github-output requires a path or GITHUB_OUTPUT.');fs.appendFileSync(target,`snapshot=${json}\n`);}
  if(fileIndex>=0){const target=args[fileIndex+1];if(!target)throw new Error('--output requires a path.');fs.writeFileSync(path.resolve(target),`${JSON.stringify(snapshot,null,2)}\n`);}
  if(outputIndex<0&&fileIndex<0)process.stdout.write(`${JSON.stringify(snapshot,null,2)}\n`);
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
module.exports={CONSUMERS,canonicalConsumer,createSnapshot};
