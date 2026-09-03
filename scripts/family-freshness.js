#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const contract=require('../core-contract.json');
const registry=require('../family-registry.json');
const {CONSUMERS,CORE_REPO,CORE_URL,OWNER,collectFamilyState,exactImmutableRelease,githubJson}=require('./family-release-state');

function isSha(value){return /^[0-9a-f]{40}$/.test(String(value||''));}
function releaseIsExact(release,{tag,headSha,tagSha}){return exactImmutableRelease(release,{tag,sha:headSha,tagSha});}
function consumerHeadIsAligned(state,core){
  if(!state||!core||!isSha(state.sha)||!isSha(core.sha)||!state.version)return false;
  if(state.corePin?.type!=='submodule'||state.corePin.sha!==core.sha||state.corePin.submodule_git_url!==CORE_URL)return false;
  const product=state.productContract;
  if(!product||Number(product.productContractVersion)!==Number(contract.productContractVersion))return false;
  return product.safeCoreCommit===core.sha&&product.safeCoreVersion===core.version&&product.productVersion===state.version;
}
function distributionIdentity(value){return value?.receiptTag||value?.locator||value?.channel||null;}
function manifestMatches(manifest,{core,consumers}){
  if(!manifest||Number(manifest.schemaVersion)!==Number(contract.familyManifestVersion))return false;
  if(manifest.core?.version!==core.version||manifest.core?.sha!==core.sha||manifest.core?.release?.tagSha!==core.release?.tagSha)return false;
  for(const name of CONSUMERS){
    const current=consumers[name],recorded=manifest.consumers?.[name];
    if(!current||!recorded)return false;
    if(recorded.sha!==current.sha||recorded.version!==current.version)return false;
    if(recorded.release?.tag!==current.release?.tag||recorded.release?.tagSha!==current.release?.tagSha||recorded.release?.immutable!==true)return false;
    if(recorded.distribution?.channel!==current.distribution?.channel||distributionIdentity(recorded.distribution)!==distributionIdentity(current.distribution))return false;
  }
  return true;
}
function evaluateFreshness({core,consumers,manifest,validationActive=false}){
  const reasons=[];
  if(!core?.releaseReady)reasons.push(`core:${core?.reason||'release-not-ready'}`);
  for(const name of CONSUMERS){const state=consumers?.[name];if(!state?.ready)reasons.push(`${name}:${state?.reason||'release-or-distribution-not-ready'}`);}
  if(reasons.length)return {ready:false,dispatch:false,reason:reasons.join(',')};
  if(manifestMatches(manifest,{core,consumers}))return {ready:true,dispatch:false,reason:'family-manifest-current'};
  if(validationActive)return {ready:true,dispatch:false,reason:'family-validation-active'};
  return {ready:true,dispatch:true,reason:manifest?'family-manifest-stale':'family-manifest-missing'};
}
async function latestFamilyManifest(core,{token=process.env.GITHUB_TOKEN}={}){
  const releases=await githubJson(`/repos/${OWNER}/${CORE_REPO}/releases?per_page=100`,{token});
  const prefix=`family-manifest-v${core.version}-`;
  const candidates=releases.filter(item=>item?.tag_name?.startsWith(prefix)&&item.draft===false&&item.prerelease===false&&item.immutable===true)
    .sort((a,b)=>Date.parse(b.published_at||b.updated_at||0)-Date.parse(a.published_at||a.updated_at||0));
  for(const release of candidates){
    const asset=(release.assets||[]).find(item=>item.name==='FAMILY_MANIFEST.json');
    if(!asset?.browser_download_url)continue;
    const response=await fetch(asset.browser_download_url,{headers:{'accept':'application/vnd.github+json','user-agent':'codex-safe-family-freshness',...(token?{'authorization':`Bearer ${token}`}:{})},redirect:'follow'});
    if(!response.ok)continue;
    const manifest=await response.json();
    if(manifest.core?.sha===core.sha)return manifest;
  }
  return null;
}
async function familyValidationActive(core,{token=process.env.GITHUB_TOKEN}={}){
  const data=await githubJson(`/repos/${OWNER}/${CORE_REPO}/actions/workflows/family-ci.yml/runs?branch=main&per_page=10`,{token});
  return (data.workflow_runs||[]).some(run=>run.head_sha===core.sha&&(run.status==='queued'||run.status==='in_progress'));
}
async function collectState({token=process.env.GITHUB_TOKEN}={}){
  const family=await collectFamilyState({token}),core=family.core,consumers=family.consumers;
  const manifest=core.releaseReady?await latestFamilyManifest(core,{token}):null;
  let decision=evaluateFreshness({core,consumers,manifest});
  if(decision.dispatch)decision=evaluateFreshness({core,consumers,manifest,validationActive:await familyValidationActive(core,{token})});
  return {schemaVersion:Number(contract.familyStatusVersion),registryVersion:Number(registry.schemaVersion),core,consumers,manifestDigest:manifest?.manifestDigest||null,...decision};
}
async function main(){
  const state=await collectState(),json=JSON.stringify(state),args=process.argv.slice(2),index=args.indexOf('--github-output');
  if(index>=0){const target=args[index+1]||process.env.GITHUB_OUTPUT;if(!target)throw new Error('--github-output requires a path or GITHUB_OUTPUT.');fs.appendFileSync(target,`dispatch=${state.dispatch?'true':'false'}\nreason=${state.reason}\ndecision=${json}\n`);}else process.stdout.write(`${JSON.stringify(state,null,2)}\n`);
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
module.exports={collectState,consumerHeadIsAligned,evaluateFreshness,familyValidationActive,latestFamilyManifest,manifestMatches,releaseIsExact};
