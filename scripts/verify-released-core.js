#!/usr/bin/env node
'use strict';

const https=require('node:https');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const contract=require('../core-contract.json');
const REPO='jiying2007/codex-safe-core';
function git(args){return execFileSync('git',args,{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim();}
function resolveRemoteTag(version){const tag=`v${version}`,url=`https://github.com/${REPO}.git`,text=execFileSync('git',['ls-remote',url,`refs/tags/${tag}`,`refs/tags/${tag}^{}`],{encoding:'utf8'}).trim(),lines=text.split(/\r?\n/).filter(Boolean).map(line=>line.split(/\s+/));const deref=lines.find(([,ref])=>ref===`refs/tags/${tag}^{}`),direct=lines.find(([,ref])=>ref===`refs/tags/${tag}`),resolved=String((deref||direct||[])[0]||'');if(!/^[0-9a-f]{40}$/.test(resolved))throw new Error(`Core release tag ${tag} is missing.`);return{tag,sha:resolved};}
function validateRelease(release,{tag,sha,expectedSha}){if(sha!==expectedSha)throw new Error(`Core ${tag} resolves to ${sha}, expected ${expectedSha}.`);if(!release||typeof release!=='object')throw new Error(`Core ${tag} release metadata missing.`);if(release.tag_name!==tag)throw new Error(`Core release tag mismatch: ${release.tag_name||'<missing>'}.`);if(release.draft||release.prerelease)throw new Error(`Core ${tag} must be a final release.`);if(release.immutable!==true)throw new Error(`Core ${tag} release is not immutable.`);return true;}
const MAX_RELEASE_BYTES=262144;
const MAX_TOTAL_MS=15000;
const MAX_BACKOFF_MS=2000;
const TRANSIENT_STATUS=new Set([403,429,500,502,503,504]);
function lookupError(tag,status,kind){
  const error=new Error('Core release metadata '+tag+' unavailable: HTTP '+status+' ('+kind+')');
  error.code='ECORELOOKUP';
  error.status=status;
  return error;
}
function retryDelay(headers={},attempt=0,now=Date.now()){
  const value=headers['retry-after']||headers['Retry-After'];
  if(value===undefined||value===null||value==='')return 150*(attempt+1);
  const raw=String(value).trim();
  let delay;
  if(/^(?:[0-9]+)(?:\.[0-9]+)?$/.test(raw))delay=Number(raw)*1000;
  else {
    const parsed=Date.parse(raw);
    if(Number.isNaN(parsed))return null;
    delay=Math.max(0,parsed-now);
  }
  if(!Number.isFinite(delay)||delay<0||delay>MAX_BACKOFF_MS)return null;
  return Math.ceil(delay);
}
function readReleaseJson(tag,{token='',timeoutMs=5000,signal}={}){
  return new Promise((resolve,reject)=>{
    let settled=false,bytes=0,body='';
    const done=(error,value)=>{
      if(settled)return;
      settled=true;
      if(error)reject(error);else resolve(value);
    };
    const headers={Accept:'application/vnd.github+json',
      'User-Agent':'codex-safe-family-guard','X-GitHub-Api-Version':'2022-11-28'};
    if(token)headers.Authorization='Bearer '+token;
    const request=https.get({hostname:'api.github.com',
      path:'/repos/'+REPO+'/releases/tags/'+encodeURIComponent(tag),
      headers,timeout:timeoutMs,signal},response=>{
      const status=response.statusCode;
      if(!Number.isInteger(status)||status<100||status>599){
        response.destroy();done(new Error('Invalid GitHub Core release HTTP status'));return;
      }
      response.setEncoding('utf8');
      response.on('data',chunk=>{
        bytes+=Buffer.byteLength(chunk,'utf8');
        if(bytes>MAX_RELEASE_BYTES){
          response.destroy();done(new Error('GitHub Core release metadata exceeds response budget'));
        }else body+=chunk;
      });
      response.on('error',error=>done(error));
      response.on('end',()=>done(null,{status,headers:response.headers,body}));
    });
    request.setTimeout(timeoutMs,()=>request.destroy(Object.assign(new Error('Core release metadata timeout'),{code:'ETIMEDOUT'})));
    request.on('error',error=>done(error));
  });
}
function waitRetry(ms,signal){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(Object.assign(new Error('Core release verification cancelled'),{code:'EABORT'}));return;}
    let timer;
    const abort=()=>{
      clearTimeout(timer);
      signal?.removeEventListener('abort',abort);
      reject(Object.assign(new Error('Core release verification cancelled'),{code:'EABORT'}));
    };
    timer=setTimeout(()=>{
      signal?.removeEventListener('abort',abort);
      resolve();
    },ms);
    signal?.addEventListener('abort',abort,{once:true});
  });
}
async function fetchRelease(tag,{token=process.env.CODEX_SAFE_FAMILY_READ_TOKEN||
  process.env.GITHUB_TOKEN||process.env.GH_TOKEN||'',
  transport=readReleaseJson,sleep=waitRetry,clock=Date.now,signal,
  totalMs=MAX_TOTAL_MS}={}){
  if(!/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(tag))throw new Error('Invalid exact Core release tag');
  if(typeof token!=='string'||token.length>4096||/[\u0000-\u001f\u007f]/.test(token))
    throw new Error('Invalid Core release read credential');
  if(!Number.isSafeInteger(totalMs)||totalMs<1||totalMs>MAX_TOTAL_MS)
    throw new Error('Invalid Core release metadata time budget');
  const deadline=clock()+totalMs;
  const identities=token?[token,'']:[''];
  let lastStatus=null;
  for(const identity of identities){
    for(let attempt=0;attempt<3;attempt++){
      if(signal?.aborted)throw Object.assign(new Error('Core release verification cancelled'),{code:'EABORT'});
      const remaining=deadline-clock();
      if(remaining<=0)throw new Error('Core release metadata lookup exceeded total deadline');
      let response;
      try{
        response=await transport(tag,{token:identity,timeoutMs:Math.min(5000,remaining),signal});
      }catch(error){
        if(signal?.aborted||error?.code==='ABORT_ERR'||error?.code==='EABORT')
          throw Object.assign(new Error('Core release verification cancelled'),{code:'EABORT'});
        if(attempt>=2)throw new Error('Core release metadata transport unavailable after bounded retries');
        const delay=150*(attempt+1);
        if(delay>=deadline-clock())throw new Error('Core release metadata retry deadline exceeded');
        await sleep(delay,signal);
        continue;
      }
      const status=response?.status;
      lastStatus=status;
      if(status===200){
        if(typeof response.body!=='string'||Buffer.byteLength(response.body,'utf8')>MAX_RELEASE_BYTES)
          throw new Error('Core release metadata response is missing or unbounded');
        try{return JSON.parse(response.body);}
        catch{throw new Error('Core release metadata returned invalid JSON');}
      }
      // A sibling repository GITHUB_TOKEN may not have read visibility into
      // a public Core release. Only then perform a read-only anonymous retry.
      if(identity&&[403,404].includes(status))break;
      if(status===404)throw lookupError(tag,status,'not-found');
      if(!TRANSIENT_STATUS.has(status))throw lookupError(tag,status,'non-retryable');
      if(attempt===2)throw lookupError(tag,status,'retries-exhausted');
      const delay=retryDelay(response.headers||{},attempt,clock());
      if(delay===null||delay>=deadline-clock())
        throw lookupError(tag,status,'retry-deferred');
      await sleep(delay,signal);
    }
  }
  throw lookupError(tag,lastStatus,'unavailable');
}
async function verify(expectedSha){const expected=String(expectedSha||git(['rev-parse','HEAD'])).trim();if(!/^[0-9a-f]{40}$/.test(expected))throw new Error('Expected Core SHA must be exact.');const resolved=resolveRemoteTag(contract.coreVersion),release=await fetchRelease(resolved.tag);validateRelease(release,{...resolved,expectedSha:expected});return{version:contract.coreVersion,tag:resolved.tag,sha:resolved.sha,immutable:true};}
async function main(){const result=await verify(process.argv[2]);process.stdout.write(`${JSON.stringify(result)}\n`);}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=2;});
module.exports={resolveRemoteTag,validateRelease,fetchRelease,readReleaseJson,retryDelay,verify};
