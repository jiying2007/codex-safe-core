#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const contract=require('../core-contract.json');
const {CONSUMERS}=require('./resolve-family-snapshot');

const OWNER='jiying2007';
const CORE_REPO='codex-safe-core';
const API='https://api.github.com';

function isSha(value){return /^[0-9a-f]{40}$/.test(String(value||''));}
function releaseIsExact(release,{tag,headSha,tagSha}){
  if(!release||release.tag_name!==tag) return false;
  if(release.draft||release.prerelease||release.immutable!==true) return false;
  return isSha(headSha)&&headSha===tagSha;
}
function consumerHeadIsAligned(state,core){
  if(!state||!core||!isSha(state.sha)||!isSha(core.sha)||!state.version) return false;
  if(state.corePin?.type!=='submodule'||state.corePin.sha!==core.sha) return false;
  const product=state.productContract;
  if(!product||product.safeCoreCommit!==core.sha||product.safeCoreVersion!==core.version) return false;
  return product.productVersion===state.version;
}
function manifestMatches(manifest,{core,consumers}){
  if(!manifest||Number(manifest.schemaVersion)!==Number(contract.familyManifestVersion||3)) return false;
  if(manifest.core?.version!==core.version||manifest.core?.sha!==core.sha) return false;
  for(const name of CONSUMERS){
    const current=consumers[name],recorded=manifest.consumers?.[name];
    if(!current||!recorded||recorded.sha!==current.sha||recorded.version!==current.version) return false;
  }
  return true;
}
function evaluateFreshness({core,consumers,manifest}){
  const reasons=[];
  if(!core?.releaseReady) reasons.push(`core:${core?.reason||'release-not-ready'}`);
  for(const name of CONSUMERS){
    const state=consumers?.[name];
    if(!state?.aligned) reasons.push(`${name}:${state?.reason||'core-alignment-incomplete'}`);
  }
  if(reasons.length) return {ready:false,dispatch:false,reason:reasons.join(',')};
  if(manifestMatches(manifest,{core,consumers})) return {ready:true,dispatch:false,reason:'family-manifest-current'};
  return {ready:true,dispatch:true,reason:manifest?'family-manifest-stale':'family-manifest-missing'};
}
function headers(token){return {'accept':'application/vnd.github+json','user-agent':'codex-safe-family-freshness',...(token?{'authorization':`Bearer ${token}`}:{})};}
async function githubJson(pathname,{token=process.env.GITHUB_TOKEN,allow404=false}={}){
  const response=await fetch(`${API}${pathname}`,{headers:headers(token)});
  if(allow404&&response.status===404) return null;
  if(!response.ok) throw new Error(`GitHub API ${pathname} failed: ${response.status}`);
  return response.json();
}
async function rawJson(repo,sha,file){
  const response=await fetch(`https://raw.githubusercontent.com/${OWNER}/${repo}/${sha}/${file}`,{headers:{'user-agent':'codex-safe-family-freshness'}});
  if(!response.ok) throw new Error(`Unable to read ${repo}/${file}@${sha}: ${response.status}`);
  return response.json();
}
async function resolveTagCommit(repo,tag,token=process.env.GITHUB_TOKEN){
  const ref=await githubJson(`/repos/${OWNER}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,{token,allow404:true});
  if(!ref) return null;
  let object=ref.object;
  for(let depth=0;depth<4&&object?.type==='tag';depth++){
    const annotated=await githubJson(`/repos/${OWNER}/${repo}/git/tags/${object.sha}`,{token});
    object=annotated.object;
  }
  return object?.type==='commit'&&isSha(object.sha)?object.sha:null;
}
async function inspectReleasedCore({token=process.env.GITHUB_TOKEN}={}){
  const commit=await githubJson(`/repos/${OWNER}/${CORE_REPO}/commits/main`,{token});
  const sha=commit.sha;
  if(!isSha(sha)) throw new Error(`${CORE_REPO} main did not resolve to an exact SHA.`);
  const pkg=await rawJson(CORE_REPO,sha,'package.json');
  const version=String(pkg.version||'');
  if(!version) return {sha,version:null,releaseReady:false,reason:'missing-version'};
  if(version!==contract.coreVersion) return {sha,version,releaseReady:false,reason:'version-contract-drift'};
  const tag=`v${version}`;
  const [release,tagSha]=await Promise.all([
    githubJson(`/repos/${OWNER}/${CORE_REPO}/releases/tags/${encodeURIComponent(tag)}`,{token,allow404:true}),
    resolveTagCommit(CORE_REPO,tag,token)
  ]);
  const releaseReady=releaseIsExact(release,{tag,headSha:sha,tagSha});
  return {sha,version,releaseReady,reason:releaseReady?'exact-immutable-release':'main-not-exact-immutable-release'};
}
async function inspectConsumerHead(repo,core,{token=process.env.GITHUB_TOKEN}={}){
  const commit=await githubJson(`/repos/${OWNER}/${repo}/commits/main`,{token});
  const sha=commit.sha;
  if(!isSha(sha)) throw new Error(`${repo} main did not resolve to an exact SHA.`);
  const [pkg,productContract,corePin]=await Promise.all([
    rawJson(repo,sha,'package.json'),
    rawJson(repo,sha,'product-contract.json'),
    githubJson(`/repos/${OWNER}/${repo}/contents/src/codex-safe-core?ref=${encodeURIComponent(sha)}`,{token})
  ]);
  const state={sha,version:String(pkg.version||''),productContract,corePin};
  const aligned=consumerHeadIsAligned(state,core);
  return {sha,stateVersion:state.version,version:state.version,aligned,reason:aligned?'exact-core-alignment':'core-alignment-incomplete',corePinSha:corePin?.sha||null,productCoreVersion:productContract?.safeCoreVersion||null,productCoreCommit:productContract?.safeCoreCommit||null};
}
async function latestFamilyManifest(core,{token=process.env.GITHUB_TOKEN}={}){
  const releases=await githubJson(`/repos/${OWNER}/${CORE_REPO}/releases?per_page=100`,{token});
  const prefix=`family-manifest-v${core.version}-`;
  const release=releases.find(item=>item?.tag_name?.startsWith(prefix)&&item.draft===false&&item.prerelease===false&&item.immutable===true&&item.target_commitish===core.sha);
  if(!release) return null;
  const asset=(release.assets||[]).find(item=>item.name==='FAMILY_MANIFEST.json');
  if(!asset?.browser_download_url) return null;
  const response=await fetch(asset.browser_download_url,{headers:headers(token),redirect:'follow'});
  if(!response.ok) throw new Error(`Unable to download ${release.tag_name}/FAMILY_MANIFEST.json: ${response.status}`);
  return response.json();
}
async function collectState({token=process.env.GITHUB_TOKEN}={}){
  const core=await inspectReleasedCore({token});
  const consumers={};
  for(const name of CONSUMERS) consumers[name]=await inspectConsumerHead(name,core,{token});
  const manifest=core.releaseReady?await latestFamilyManifest(core,{token}):null;
  const decision=evaluateFreshness({core,consumers,manifest});
  return {schemaVersion:1,core,consumers,manifestDigest:manifest?.manifestDigest||null,...decision};
}
async function main(){
  const state=await collectState();
  const json=JSON.stringify(state);
  const args=process.argv.slice(2),index=args.indexOf('--github-output');
  if(index>=0){
    const target=args[index+1]||process.env.GITHUB_OUTPUT;
    if(!target) throw new Error('--github-output requires a path or GITHUB_OUTPUT.');
    fs.appendFileSync(target,`dispatch=${state.dispatch?'true':'false'}\nreason=${state.reason}\ndecision=${json}\n`);
  }else process.stdout.write(`${JSON.stringify(state,null,2)}\n`);
}
if(require.main===module) main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
module.exports={collectState,consumerHeadIsAligned,evaluateFreshness,inspectConsumerHead,inspectReleasedCore,latestFamilyManifest,manifestMatches,releaseIsExact,resolveTagCommit};
