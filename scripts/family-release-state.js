#!/usr/bin/env node
'use strict';

const contract=require('../core-contract.json');
const registry=require('../family-registry.json');

const API='https://api.github.com';
const OWNER=registry.owner;
const CORE_REPO=registry.core.repository;
const CONSUMERS=Object.freeze(Object.keys(registry.consumers));
const CORE_URL=`https://github.com/${OWNER}/${CORE_REPO}.git`;

function isSha(value){return /^[0-9a-f]{40}$/.test(String(value||''));}
function isDigest(value){return /^[0-9a-f]{64}$/.test(String(value||''));}
function headers(token){return {'accept':'application/vnd.github+json','user-agent':'codex-safe-family-release-state',...(token?{'authorization':`Bearer ${token}`}:{})};}
async function githubJson(pathname,{token=process.env.GITHUB_TOKEN,allow404=false}={}){const response=await fetch(`${API}${pathname}`,{headers:headers(token)});if(allow404&&response.status===404)return null;if(!response.ok)throw new Error(`GitHub API ${pathname} failed: ${response.status}`);return response.json();}
async function rawJson(repo,sha,file){const response=await fetch(`https://raw.githubusercontent.com/${OWNER}/${repo}/${sha}/${file}`,{headers:{'user-agent':'codex-safe-family-release-state'}});if(!response.ok)throw new Error(`Unable to read ${repo}/${file}@${sha}: ${response.status}`);return response.json();}
async function resolveTagCommit(repo,tag,token=process.env.GITHUB_TOKEN){const ref=await githubJson(`/repos/${OWNER}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,{token,allow404:true});if(!ref)return null;let object=ref.object;for(let depth=0;depth<4&&object?.type==='tag';depth++){const annotated=await githubJson(`/repos/${OWNER}/${repo}/git/tags/${object.sha}`,{token});object=annotated.object;}return object?.type==='commit'&&isSha(object.sha)?object.sha:null;}
function releaseAssets(release){return (release?.assets||[]).map(asset=>({name:asset.name,size:Number(asset.size||0),digest:asset.digest||null,url:asset.browser_download_url||null})).sort((a,b)=>a.name.localeCompare(b.name));}
function exactImmutableRelease(release,{tag,sha,tagSha}){return Boolean(release&&release.tag_name===tag&&!release.draft&&!release.prerelease&&release.immutable===true&&isSha(sha)&&tagSha===sha);}
async function inspectRelease(repo,version,sha,{token=process.env.GITHUB_TOKEN}={}){const tag=`v${version}`;const[release,tagSha]=await Promise.all([githubJson(`/repos/${OWNER}/${repo}/releases/tags/${encodeURIComponent(tag)}`,{token,allow404:true}),resolveTagCommit(repo,tag,token)]);const ready=exactImmutableRelease(release,{tag,sha,tagSha});return{ready,tag,tagSha,immutable:release?.immutable===true,publishedAt:release?.published_at||null,assets:releaseAssets(release),releaseId:release?.id||null,reason:ready?'exact-immutable-release':'main-not-exact-immutable-release'};}
async function downloadJson(url,token){const response=await fetch(url,{headers:headers(token),redirect:'follow'});if(!response.ok)throw new Error(`Unable to download JSON evidence: ${response.status}`);return response.json();}
async function downloadText(url,token){const response=await fetch(url,{headers:headers(token),redirect:'follow'});if(!response.ok)throw new Error(`Unable to download distribution metadata: ${response.status}`);return(await response.text()).trim();}
async function inspectCoreDigests(release,{token=process.env.GITHUB_TOKEN}={}){
  const asset=release?.assets?.find(item=>item.name==='CORE_DIGESTS.json');
  if(!release?.ready||!asset?.url)return{ready:false,runtimeDigest:null,governanceDigest:null,assetDigest:asset?.digest||null,reason:'core-digest-asset-missing'};
  const value=await downloadJson(asset.url,token),ready=Number(value?.schemaVersion)===Number(contract.coreDigestContractVersion)&&isDigest(value?.runtimeDigest)&&isDigest(value?.governanceDigest);
  return{ready,runtimeDigest:ready?value.runtimeDigest:null,governanceDigest:ready?value.governanceDigest:null,assetDigest:asset.digest||null,surfaceManifestDigest:ready&&isDigest(value.surfaceManifestDigest)?value.surfaceManifestDigest:null,reason:ready?'verified-core-digests':'core-digest-asset-invalid'};
}
async function inspectDistribution(repo,version,sha,release,{token=process.env.GITHUB_TOKEN}={}){
  const spec=registry.consumers[repo]?.distribution||{channel:'github-release',required:true};
  if(spec.channel==='github-release')return{ready:release.ready,channel:spec.channel,reason:release.ready?'release-is-distribution':'release-not-ready'};
  if(spec.channel==='ghcr'){const asset=release.assets.find(item=>item.name===spec.releaseAsset);if(!release.ready||!asset?.url)return{ready:false,channel:spec.channel,reason:'oci-digest-asset-missing'};const locator=await downloadText(asset.url,token),ready=new RegExp(`^ghcr\\.io/${OWNER}/${repo}:[^@\\s]+@sha256:[0-9a-f]{64}$`,'i').test(locator);return{ready,channel:spec.channel,locator:ready?locator:null,receiptTag:release.tag,reason:ready?'oci-digest-published':'oci-digest-invalid'};}
  if(spec.channel==='vscode-marketplace'){const releases=await githubJson(`/repos/${OWNER}/${repo}/releases?per_page=100`,{token}),prefix=`${spec.receiptPrefix}${version}-`,candidates=releases.filter(item=>item?.tag_name?.startsWith(prefix)&&item.immutable===true&&!item.draft&&!item.prerelease).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0));for(const candidate of candidates){const tagSha=await resolveTagCommit(repo,candidate.tag_name,token);if(tagSha!==sha)continue;const asset=(candidate.assets||[]).find(item=>item.name==='DISTRIBUTION_RECEIPT.json');if(!asset?.browser_download_url)continue;const receipt=await downloadJson(asset.browser_download_url,token);if(Number(receipt.schemaVersion)!==Number(contract.distributionReceiptVersion))continue;if(receipt.channel!=='vscode-marketplace'||receipt.productVersion!==version||receipt.sourceSha!==sha||receipt.releaseTag!==release.tag)continue;return{ready:true,channel:spec.channel,receiptTag:candidate.tag_name,receiptDigest:asset.digest||null,publishedAt:candidate.published_at||null,reason:'verified-distribution-receipt'};}return{ready:false,channel:spec.channel,reason:'distribution-receipt-missing'};}
  return{ready:false,channel:spec.channel,reason:'unsupported-distribution-channel'};
}
async function inspectCore({token=process.env.GITHUB_TOKEN}={}){
  const commit=await githubJson(`/repos/${OWNER}/${CORE_REPO}/commits/main`,{token}),sha=commit.sha;if(!isSha(sha))throw new Error(`${CORE_REPO} main did not resolve to an exact SHA.`);
  const pkg=await rawJson(CORE_REPO,sha,'package.json'),version=String(pkg.version||''),release=await inspectRelease(CORE_REPO,version,sha,{token}),contractAligned=version===contract.coreVersion,digests=await inspectCoreDigests(release,{token}),releaseReady=release.ready&&contractAligned&&digests.ready;
  return{sha,version,releaseReady,release,digests,reason:!contractAligned?'version-contract-drift':!release.ready?release.reason:digests.reason};
}
async function inspectConsumer(repo,core,{token=process.env.GITHUB_TOKEN}={}){
  const commit=await githubJson(`/repos/${OWNER}/${repo}/commits/main`,{token}),sha=commit.sha;if(!isSha(sha))throw new Error(`${repo} main did not resolve to an exact SHA.`);
  const[pkg,productContract,corePin]=await Promise.all([rawJson(repo,sha,'package.json'),rawJson(repo,sha,'product-contract.json'),githubJson(`/repos/${OWNER}/${repo}/contents/src/codex-safe-core?ref=${encodeURIComponent(sha)}`,{token})]);
  const version=String(pkg.version||''),expectedProductId=registry.consumers[repo]?.productId,pinSha=corePin?.sha||'',pinValid=corePin?.type==='submodule'&&isSha(pinSha)&&corePin?.submodule_git_url===CORE_URL;
  let pinnedCoreContract=null,pinnedCoreRelease={ready:false,assets:[],reason:'core-pin-invalid'},pinnedCoreDigests={ready:false,reason:'core-pin-invalid'};
  if(pinValid){
    pinnedCoreContract=await rawJson(CORE_REPO,pinSha,'core-contract.json');
    pinnedCoreRelease=await inspectRelease(CORE_REPO,String(pinnedCoreContract.coreVersion||''),pinSha,{token});
    pinnedCoreDigests=await inspectCoreDigests(pinnedCoreRelease,{token});
  }
  const contractAligned=Boolean(version&&pinValid&&productContract?.productContractVersion===contract.productContractVersion&&productContract?.productId===expectedProductId&&productContract?.productVersion===version&&productContract?.safeCoreCommit===pinSha&&productContract?.safeCoreVersion===pinnedCoreContract?.coreVersion&&productContract?.safeCoreRuntimeDigest===pinnedCoreDigests.runtimeDigest&&productContract?.safeCoreGovernanceDigest===pinnedCoreDigests.governanceDigest&&productContract?.safeCoreMajorVersion===pinnedCoreContract?.safeCoreMajorVersion&&productContract?.safeContractVersion===pinnedCoreContract?.safeContractVersion&&productContract?.policySchemaVersion===pinnedCoreContract?.policySchemaVersion);
  const runtimeAligned=Boolean(contractAligned&&core?.digests?.ready&&pinnedCoreDigests.ready&&pinnedCoreDigests.runtimeDigest===core.digests.runtimeDigest);
  const aligned=contractAligned&&runtimeAligned;
  const release=await inspectRelease(repo,version,sha,{token}),requiredAssets=registry.consumers[repo]?.release?.requiredAssets||[],releaseAssetsReady=requiredAssets.every(name=>release.assets.some(asset=>asset.name===name)),distribution=await inspectDistribution(repo,version,sha,release,{token}),releaseReady=aligned&&release.ready&&releaseAssetsReady,ready=releaseReady&&(!registry.consumers[repo]?.distribution?.required||distribution.ready);
  return{sha,version,aligned,runtimeAligned,contractAligned,releaseReady,distributionReady:distribution.ready,ready,corePin:{sha:pinSha,version:pinnedCoreContract?.coreVersion||null,runtimeDigest:pinnedCoreDigests.runtimeDigest||null,governanceDigest:pinnedCoreDigests.governanceDigest||null,releaseReady:pinnedCoreRelease.ready===true,digestReady:pinnedCoreDigests.ready===true},release,distribution,reason:!pinValid?'core-pin-invalid':!pinnedCoreRelease.ready?'pinned-core-release-not-exact':!pinnedCoreDigests.ready?pinnedCoreDigests.reason:!contractAligned?'product-contract-v2-incomplete':!runtimeAligned?'core-runtime-digest-stale':!release.ready?'consumer-release-not-exact':!releaseAssetsReady?'required-release-asset-missing':!distribution.ready?'distribution-not-ready':'exact-release-distribution-runtime-compatible'};
}
async function collectFamilyState({token=process.env.GITHUB_TOKEN}={}){
  const core=await inspectCore({token});
  const pairs=await Promise.all(CONSUMERS.map(async repo=>[repo,await inspectConsumer(repo,core,{token})]));
  return{schemaVersion:2,registryVersion:registry.schemaVersion,core,consumers:Object.fromEntries(pairs)};
}
async function main(){const args=process.argv.slice(2),repoIndex=args.indexOf('--repo'),state=await collectFamilyState();if(repoIndex>=0){const repo=args[repoIndex+1];if(!CONSUMERS.includes(repo))throw new Error(`Unknown Family consumer: ${repo}`);process.stdout.write(`${JSON.stringify(state.consumers[repo],null,2)}\n`);return;}process.stdout.write(`${JSON.stringify(state,null,2)}\n`);}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
module.exports={CONSUMERS,CORE_REPO,CORE_URL,OWNER,collectFamilyState,exactImmutableRelease,githubJson,inspectConsumer,inspectCore,inspectCoreDigests,inspectDistribution,inspectRelease,isDigest,isSha,releaseAssets,resolveTagCommit};
