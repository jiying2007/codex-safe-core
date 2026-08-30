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
function fetchRelease(tag){return new Promise((resolve,reject)=>{const request=https.get({hostname:'api.github.com',path:`/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`,headers:{Accept:'application/vnd.github+json','User-Agent':'codex-safe-family-guard','X-GitHub-Api-Version':'2022-11-28'}},response=>{let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('end',()=>{if(response.statusCode!==200)return reject(new Error(`GitHub release lookup failed for ${tag}: HTTP ${response.statusCode}`));try{resolve(JSON.parse(body));}catch(error){reject(new Error(`GitHub release lookup returned invalid JSON for ${tag}: ${error.message}`));}});});request.setTimeout(10000,()=>request.destroy(new Error(`GitHub release lookup timed out for ${tag}.`)));request.on('error',reject);});}
async function verify(expectedSha){const expected=String(expectedSha||git(['rev-parse','HEAD'])).trim();if(!/^[0-9a-f]{40}$/.test(expected))throw new Error('Expected Core SHA must be exact.');const resolved=resolveRemoteTag(contract.coreVersion),release=await fetchRelease(resolved.tag);validateRelease(release,{...resolved,expectedSha:expected});return{version:contract.coreVersion,tag:resolved.tag,sha:resolved.sha,immutable:true};}
async function main(){const result=await verify(process.argv[2]);process.stdout.write(`${JSON.stringify(result)}\n`);}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=2;});
module.exports={resolveRemoteTag,validateRelease,fetchRelease,verify};
