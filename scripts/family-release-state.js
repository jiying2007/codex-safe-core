#!/usr/bin/env node
'use strict';

const crypto=require('node:crypto');
const contract=require('../core-contract.json');
const registry=require('../family-registry.json');
const {canonical,contractProjection,isRuntimeFile}=require('./core-digests');

const API='https://api.github.com';
const OWNER=registry.owner;
const CORE_REPO=registry.core.repository;
function lifecycleOf(spec){const value=String(spec?.lifecycle||'active');if(!['active','development','retired'].includes(value))throw new Error(`Unsupported Family consumer lifecycle: ${value}`);return value;}
const ALL_CONSUMERS=Object.freeze(Object.keys(registry.consumers));
const CONSUMERS=Object.freeze(Object.entries(registry.consumers).filter(([,spec])=>lifecycleOf(spec)==='active').map(([name])=>name));
const DEVELOPMENT_CONSUMERS=Object.freeze(Object.entries(registry.consumers).filter(([,spec])=>lifecycleOf(spec)==='development').map(([name])=>name));
const CORE_URL=`https://github.com/${OWNER}/${CORE_REPO}.git`;

function isSha(value){return /^[0-9a-f]{40}$/.test(String(value||''));}
function isDigest(value){return /^[0-9a-f]{64}$/.test(String(value||''));}
function sha(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function headers(token){return {'accept':'application/vnd.github+json','user-agent':'codex-safe-family-release-state',...(token?{'authorization':`Bearer ${token}`}:{})};}
async function githubJson(pathname,{token=process.env.GITHUB_TOKEN,allow404=false}={}){const response=await fetch(`${API}${pathname}`,{headers:headers(token)});if(allow404&&response.status===404)return null;if(!response.ok)throw new Error(`GitHub API ${pathname} failed: ${response.status}`);return response.json();}
async function rawJson(repo,shaValue,file){const response=await fetch(`https://raw.githubusercontent.com/${OWNER}/${repo}/${shaValue}/${file}`,{headers:{'user-agent':'codex-safe-family-release-state'}});if(!response.ok)throw new Error(`Unable to read ${repo}/${file}@${shaValue}: ${response.status}`);return response.json();}
async function resolveTagCommit(repo,tag,token=process.env.GITHUB_TOKEN){const ref=await githubJson(`/repos/${OWNER}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,{token,allow404:true});if(!ref)return null;let object=ref.object;for(let depth=0;depth<4&&object?.type==='tag';depth++){const annotated=await githubJson(`/repos/${OWNER}/${repo}/git/tags/${object.sha}`,{token});object=annotated.object;}return object?.type==='commit'&&isSha(object.sha)?object.sha:null;}
function releaseAssets(release){return (release?.assets||[]).map(asset=>({name:asset.name,size:Number(asset.size||0),digest:asset.digest||null,url:asset.browser_download_url||null})).sort((a,b)=>a.name.localeCompare(b.name));}
function exactImmutableRelease(release,{tag,sha:sourceSha,tagSha}){return Boolean(release&&release.tag_name===tag&&!release.draft&&!release.prerelease&&release.immutable===true&&isSha(sourceSha)&&tagSha===sourceSha);}
async function inspectRelease(repo,version,sourceSha,{token=process.env.GITHUB_TOKEN}={}){const tag=`v${version}`;const[release,tagSha]=await Promise.all([githubJson(`/repos/${OWNER}/${repo}/releases/tags/${encodeURIComponent(tag)}`,{token,allow404:true}),resolveTagCommit(repo,tag,token)]);const ready=exactImmutableRelease(release,{tag,sha:sourceSha,tagSha});return{ready,tag,tagSha,immutable:release?.immutable===true,publishedAt:release?.published_at||null,assets:releaseAssets(release),releaseId:release?.id||null,reason:ready?'exact-immutable-release':'main-not-exact-immutable-release'};}
async function downloadJson(url,token){const response=await fetch(url,{headers:headers(token),redirect:'follow'});if(!response.ok)throw new Error(`Unable to download JSON evidence: ${response.status}`);return response.json();}
async function downloadText(url,token){const response=await fetch(url,{headers:headers(token),redirect:'follow'});if(!response.ok)throw new Error(`Unable to download distribution metadata: ${response.status}`);return(await response.text()).trim();}
async function inspectCoreDigests(release,{token=process.env.GITHUB_TOKEN}={}){const asset=release?.assets?.find(item=>item.name==='CORE_DIGESTS.json');if(!release?.ready||!asset?.url)return{ready:false,runtimeDigest:null,governanceDigest:null,assetDigest:asset?.digest||null,reason:'core-digest-asset-missing'};const value=await downloadJson(asset.url,token),ready=Number(value?.schemaVersion)===Number(contract.coreDigestContractVersion)&&isDigest(value?.runtimeDigest)&&isDigest(value?.governanceDigest);return{ready,runtimeDigest:ready?value.runtimeDigest:null,governanceDigest:ready?value.governanceDigest:null,assetDigest:asset.digest||null,surfaceManifestDigest:ready&&isDigest(value.surfaceManifestDigest)?value.surfaceManifestDigest:null,reason:ready?'verified-core-digests':'core-digest-asset-invalid'};}
async function inspectCoreRuntimeAtSha(sourceSha,{token=process.env.GITHUB_TOKEN}={}){
  if(!isSha(sourceSha))return{ready:false,runtimeDigest:null,surfaceManifestDigest:null,reason:'core-head-sha-invalid'};
  const[manifest,currentContract,tree]=await Promise.all([
    rawJson(CORE_REPO,sourceSha,'core-surface-manifest.json'),
    rawJson(CORE_REPO,sourceSha,'core-contract.json'),
    githubJson(`/repos/${OWNER}/${CORE_REPO}/git/trees/${sourceSha}?recursive=1`,{token})
  ]);
  if(Number(manifest?.schemaVersion)!==1)return{ready:false,runtimeDigest:null,surfaceManifestDigest:null,reason:'core-surface-manifest-invalid'};
  if(tree?.truncated===true)return{ready:false,runtimeDigest:null,surfaceManifestDigest:null,reason:'core-tree-truncated'};
  const runtimeEntries=(tree?.tree||[])
    .filter(item=>item?.type==='blob'&&typeof item.path==='string'&&item.path!=='core-contract.json'&&isRuntimeFile(item.path,manifest))
    .map(item=>[item.path,item.sha])
    .sort((a,b)=>a[0].localeCompare(b[0]));
  runtimeEntries.push(['core-contract.runtime',sha(JSON.stringify(contractProjection(currentContract,manifest.runtimeContractKeys||[])))]);
  const runtimeDigest=sha(JSON.stringify(runtimeEntries));
  const surfaceManifestDigest=sha(JSON.stringify(canonical(manifest)));
  return{ready:isDigest(runtimeDigest)&&isDigest(surfaceManifestDigest),runtimeDigest,surfaceManifestDigest,runtimeEntries:runtimeEntries.length,reason:'verified-core-head-runtime-digest'};
}
function canonicalCoreReleaseCompatibility(release,digests,headRuntime,{headSha,isAncestor}={}){
  if(!release?.ready)return{ready:false,reason:release?.reason||'canonical-core-release-not-ready'};
  if(!digests?.ready)return{ready:false,reason:digests?.reason||'canonical-core-digests-not-ready'};
  if(!isSha(headSha)||!isSha(release.tagSha))return{ready:false,reason:'canonical-core-sha-invalid'};
  if(isAncestor!==true)return{ready:false,reason:'core-release-not-ancestor-of-main'};
  if(!headRuntime?.ready||!isDigest(headRuntime.runtimeDigest)||!isDigest(headRuntime.surfaceManifestDigest))return{ready:false,reason:headRuntime?.reason||'core-head-runtime-unverified'};
  if(!isDigest(digests.surfaceManifestDigest)||headRuntime.surfaceManifestDigest!==digests.surfaceManifestDigest)return{ready:false,reason:'core-surface-manifest-changed-without-version-bump'};
  if(headRuntime.runtimeDigest!==digests.runtimeDigest)return{ready:false,reason:'core-runtime-changed-without-version-bump'};
  return{ready:true,reason:'canonical-immutable-release-runtime-equivalent-main'};
}
function ciRunMatchesReceipt(receipt,run,sourceSha){if(!receipt||!run||!isSha(sourceSha))return false;const receiptAttempt=Math.max(1,Number(receipt?.ci?.runAttempt)||1),runAttempt=Math.max(1,Number(run.run_attempt)||1);if(String(receipt?.ci?.runId||'')!==String(run.id||''))return false;if(run.status!=='completed'||run.conclusion!=='success'||run.head_sha!==sourceSha||runAttempt!==receiptAttempt)return false;const workflow=String(receipt?.ci?.workflow||'').trim();if(workflow&&String(run.name||'').trim()&&workflow!==String(run.name).trim())return false;return true;}
async function inspectConsumerCiReceipt(repo,version,sourceSha,release,productContract,pinnedCoreDigests,{token=process.env.GITHUB_TOKEN}={}){const asset=release?.assets?.find(item=>item.name==='CONSUMER_CI_RECEIPT.json');if(!release?.ready||!asset?.url)return{ready:false,assetDigest:asset?.digest||null,reason:'consumer-ci-receipt-missing'};let receipt;try{receipt=await downloadJson(asset.url,token);}catch(error){return{ready:false,assetDigest:asset.digest||null,reason:'consumer-ci-receipt-unreadable',error:error.message};}const copy={...receipt};delete copy.receiptDigest;const digestValid=isDigest(receipt?.receiptDigest)&&receipt.receiptDigest===sha(JSON.stringify(copy));const structurallyValid=Boolean(Number(receipt?.schemaVersion)===Number(contract.consumerCiReceiptVersion)&&receipt?.productId===productContract?.productId&&receipt?.productVersion===version&&receipt?.sourceSha===sourceSha&&receipt?.corePin?.sha===productContract?.safeCoreCommit&&receipt?.corePin?.runtimeDigest===pinnedCoreDigests?.runtimeDigest&&receipt?.corePin?.governanceDigest===pinnedCoreDigests?.governanceDigest&&receipt?.ci?.conclusion==='success'&&String(receipt?.ci?.runId||'')&&digestValid);if(!structurallyValid)return{ready:false,assetDigest:asset.digest||null,reason:'consumer-ci-receipt-invalid'};let run;try{run=await githubJson(`/repos/${OWNER}/${repo}/actions/runs/${encodeURIComponent(String(receipt.ci.runId))}`,{token});}catch(error){return{ready:false,assetDigest:asset.digest||null,receiptDigest:receipt.receiptDigest,reason:'consumer-ci-run-unreadable',error:error.message};}if(!ciRunMatchesReceipt(receipt,run,sourceSha))return{ready:false,assetDigest:asset.digest||null,receiptDigest:receipt.receiptDigest,reason:'consumer-ci-run-not-successful'};return{ready:true,assetDigest:asset.digest||null,receiptDigest:receipt.receiptDigest,runId:String(receipt.ci.runId),workflow:String(receipt.ci.workflow||''),runAttempt:Number(receipt.ci.runAttempt||1),suites:Array.isArray(receipt.suites)?receipt.suites:[],reason:'verified-consumer-ci-receipt-and-run'};}
async function inspectDistribution(repo,version,sourceSha,release,{token=process.env.GITHUB_TOKEN}={}){const spec=registry.consumers[repo]?.distribution||{channel:'github-release',required:true};if(spec.channel==='github-release')return{ready:release.ready,channel:spec.channel,reason:release.ready?'release-is-distribution':'release-not-ready'};if(spec.channel==='ghcr'){const asset=release.assets.find(item=>item.name===spec.releaseAsset);if(!release.ready||!asset?.url)return{ready:false,channel:spec.channel,reason:'oci-digest-asset-missing'};const locator=await downloadText(asset.url,token),ready=new RegExp(`^ghcr\\.io/${OWNER}/${repo}:[^@\\s]+@sha256:[0-9a-f]{64}$`,'i').test(locator);return{ready,channel:spec.channel,locator:ready?locator:null,receiptTag:release.tag,reason:ready?'oci-digest-published':'oci-digest-invalid'};}if(spec.channel==='vscode-marketplace'){const releases=await githubJson(`/repos/${OWNER}/${repo}/releases?per_page=100`,{token}),prefix=`${spec.receiptPrefix}${version}-`,candidates=releases.filter(item=>item?.tag_name?.startsWith(prefix)&&item.immutable===true&&!item.draft&&!item.prerelease).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0));for(const candidate of candidates){const tagSha=await resolveTagCommit(repo,candidate.tag_name,token);if(tagSha!==sourceSha)continue;const asset=(candidate.assets||[]).find(item=>item.name==='DISTRIBUTION_RECEIPT.json');if(!asset?.browser_download_url)continue;const receipt=await downloadJson(asset.browser_download_url,token);if(Number(receipt.schemaVersion)!==Number(contract.distributionReceiptVersion))continue;if(receipt.channel!=='vscode-marketplace'||receipt.productVersion!==version||receipt.sourceSha!==sourceSha||receipt.releaseTag!==release.tag)continue;return{ready:true,channel:spec.channel,receiptTag:candidate.tag_name,receiptDigest:asset.digest||null,publishedAt:candidate.published_at||null,reason:'verified-distribution-receipt'};}return{ready:false,channel:spec.channel,reason:'distribution-receipt-missing'};}return{ready:false,channel:spec.channel,reason:'unsupported-distribution-channel'};}
async function inspectCore({token=process.env.GITHUB_TOKEN}={}){
  const commit=await githubJson(`/repos/${OWNER}/${CORE_REPO}/commits/main`,{token}),headSha=commit.sha;
  if(!isSha(headSha))throw new Error(`${CORE_REPO} main did not resolve to an exact SHA.`);
  const pkg=await rawJson(CORE_REPO,headSha,'package.json'),version=String(pkg.version||''),contractAligned=version===contract.coreVersion;
  const exactRelease=await inspectRelease(CORE_REPO,version,headSha,{token});
  if(exactRelease.ready){
    const digests=await inspectCoreDigests(exactRelease,{token}),releaseReady=contractAligned&&digests.ready;
    return{sha:headSha,headSha,version,releaseReady,release:exactRelease,digests,reason:!contractAligned?'version-contract-drift':digests.reason};
  }
  const tagSha=exactRelease.tagSha;
  if(!isSha(tagSha))return{sha:headSha,headSha,version,releaseReady:false,release:exactRelease,digests:{ready:false,runtimeDigest:null,governanceDigest:null,reason:'core-release-tag-missing'},reason:!contractAligned?'version-contract-drift':exactRelease.reason};
  const canonicalRelease=await inspectRelease(CORE_REPO,version,tagSha,{token});
  const digests=await inspectCoreDigests(canonicalRelease,{token});
  let isAncestor=false;
  if(canonicalRelease.ready){
    const comparison=await githubJson(`/repos/${OWNER}/${CORE_REPO}/compare/${tagSha}...${headSha}`,{token});
    isAncestor=comparison?.merge_base_commit?.sha===tagSha;
  }
  const headRuntime=await inspectCoreRuntimeAtSha(headSha,{token});
  const compatibility=canonicalCoreReleaseCompatibility(canonicalRelease,digests,headRuntime,{headSha,isAncestor});
  const releaseReady=contractAligned&&compatibility.ready;
  const release={...canonicalRelease,reason:compatibility.reason};
  return{
    sha:releaseReady?tagSha:headSha,
    headSha,
    version,
    releaseReady,
    release,
    digests,
    headRuntime:{runtimeDigest:headRuntime.runtimeDigest||null,surfaceManifestDigest:headRuntime.surfaceManifestDigest||null,reason:headRuntime.reason},
    reason:!contractAligned?'version-contract-drift':compatibility.reason
  };
}
async function inspectConsumer(repo,core,{token=process.env.GITHUB_TOKEN}={}){const commit=await githubJson(`/repos/${OWNER}/${repo}/commits/main`,{token}),sourceSha=commit.sha;if(!isSha(sourceSha))throw new Error(`${repo} main did not resolve to an exact SHA.`);const[pkg,productContract,corePin]=await Promise.all([rawJson(repo,sourceSha,'package.json'),rawJson(repo,sourceSha,'product-contract.json'),githubJson(`/repos/${OWNER}/${repo}/contents/src/codex-safe-core?ref=${encodeURIComponent(sourceSha)}`,{token})]);const version=String(pkg.version||''),expectedProductId=registry.consumers[repo]?.productId,pinSha=corePin?.sha||'',pinValid=corePin?.type==='submodule'&&isSha(pinSha)&&corePin?.submodule_git_url===CORE_URL;let pinnedCoreContract=null,pinnedCoreRelease={ready:false,assets:[],reason:'core-pin-invalid'},pinnedCoreDigests={ready:false,reason:'core-pin-invalid'};if(pinValid){pinnedCoreContract=await rawJson(CORE_REPO,pinSha,'core-contract.json');pinnedCoreRelease=await inspectRelease(CORE_REPO,String(pinnedCoreContract.coreVersion||''),pinSha,{token});pinnedCoreDigests=await inspectCoreDigests(pinnedCoreRelease,{token});}const contractAligned=Boolean(version&&pinValid&&productContract?.productContractVersion===contract.productContractVersion&&productContract?.productId===expectedProductId&&productContract?.productVersion===version&&productContract?.safeCoreCommit===pinSha&&productContract?.safeCoreVersion===pinnedCoreContract?.coreVersion&&productContract?.safeCoreRuntimeDigest===pinnedCoreDigests.runtimeDigest&&productContract?.safeCoreGovernanceDigest===pinnedCoreDigests.governanceDigest&&productContract?.safeCoreMajorVersion===pinnedCoreContract?.safeCoreMajorVersion&&productContract?.safeContractVersion===pinnedCoreContract?.safeContractVersion&&productContract?.policySchemaVersion===pinnedCoreContract?.policySchemaVersion);const runtimeAligned=Boolean(contractAligned&&core?.digests?.ready&&pinnedCoreDigests.ready&&pinnedCoreDigests.runtimeDigest===core.digests.runtimeDigest),aligned=contractAligned&&runtimeAligned,release=await inspectRelease(repo,version,sourceSha,{token}),ciReceipt=await inspectConsumerCiReceipt(repo,version,sourceSha,release,productContract,pinnedCoreDigests,{token}),requiredAssets=registry.consumers[repo]?.release?.requiredAssets||[],releaseAssetsReady=requiredAssets.every(name=>release.assets.some(asset=>asset.name===name)),distribution=await inspectDistribution(repo,version,sourceSha,release,{token}),releaseReady=aligned&&release.ready&&releaseAssetsReady&&ciReceipt.ready,ready=releaseReady&&(!registry.consumers[repo]?.distribution?.required||distribution.ready);return{sha:sourceSha,version,aligned,runtimeAligned,contractAligned,ciReceiptReady:ciReceipt.ready,releaseReady,distributionReady:distribution.ready,ready,corePin:{sha:pinSha,version:pinnedCoreContract?.coreVersion||null,runtimeDigest:pinnedCoreDigests.runtimeDigest||null,governanceDigest:pinnedCoreDigests.governanceDigest||null,releaseReady:pinnedCoreRelease.ready===true,digestReady:pinnedCoreDigests.ready===true},release,ciReceipt,distribution,reason:!pinValid?'core-pin-invalid':!pinnedCoreRelease.ready?'pinned-core-release-not-exact':!pinnedCoreDigests.ready?pinnedCoreDigests.reason:!contractAligned?'product-contract-v2-incomplete':!runtimeAligned?'core-runtime-digest-stale':!release.ready?'consumer-release-not-exact':!releaseAssetsReady?'required-release-asset-missing':!ciReceipt.ready?ciReceipt.reason:!distribution.ready?'distribution-not-ready':'exact-release-ci-distribution-runtime-compatible'};}
async function collectFamilyState({token=process.env.GITHUB_TOKEN}={}){const core=await inspectCore({token});const pairs=await Promise.all(CONSUMERS.map(async repo=>[repo,await inspectConsumer(repo,core,{token})]));return{schemaVersion:2,registryVersion:registry.schemaVersion,core,consumers:Object.fromEntries(pairs),developmentConsumers:DEVELOPMENT_CONSUMERS};}
async function main(){const args=process.argv.slice(2),repoIndex=args.indexOf('--repo'),state=await collectFamilyState();if(repoIndex>=0){const repo=args[repoIndex+1];if(!CONSUMERS.includes(repo))throw new Error(`Unknown active Family consumer: ${repo}`);process.stdout.write(`${JSON.stringify(state.consumers[repo],null,2)}\n`);return;}process.stdout.write(`${JSON.stringify(state,null,2)}\n`);}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
module.exports={ALL_CONSUMERS,CONSUMERS,DEVELOPMENT_CONSUMERS,CORE_REPO,CORE_URL,OWNER,lifecycleOf,canonicalCoreReleaseCompatibility,ciRunMatchesReceipt,collectFamilyState,exactImmutableRelease,githubJson,inspectConsumer,inspectConsumerCiReceipt,inspectCore,inspectCoreDigests,inspectCoreRuntimeAtSha,inspectDistribution,inspectRelease,isDigest,isSha,releaseAssets,resolveTagCommit};
