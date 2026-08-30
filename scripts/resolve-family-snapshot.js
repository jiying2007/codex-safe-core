#!/usr/bin/env node
'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const contract=require('../core-contract.json');

const OWNER='jiying2007';
const CONSUMERS=Object.freeze(['codex-commit','codex-review','codex-review-service','codex-diagnose']);
function git(args,cwd=path.resolve(__dirname,'..')){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function sha(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function resolveHead(name){const url=`https://github.com/${OWNER}/${name}.git`,output=git(['ls-remote','--heads',url,'refs/heads/main']);const commit=String(output).trim().split(/\s+/)[0]||'';if(!/^[0-9a-f]{40}$/.test(commit))throw new Error(`Unable to resolve ${name} main head.`);return commit;}
function createSnapshot(){const coreSha=git(['rev-parse','HEAD']);const consumers={};for(const name of CONSUMERS)consumers[name]={sha:resolveHead(name)};const payload={schemaVersion:Number(contract.familySnapshotVersion||1),core:{version:contract.coreVersion,sha:coreSha},consumers};payload.snapshotDigest=sha(JSON.stringify(payload));return payload;}
function main(){const args=process.argv.slice(2),snapshot=createSnapshot(),json=JSON.stringify(snapshot),outputIndex=args.indexOf('--github-output'),fileIndex=args.indexOf('--output');if(outputIndex>=0){const target=args[outputIndex+1]||process.env.GITHUB_OUTPUT;if(!target)throw new Error('--github-output requires a path or GITHUB_OUTPUT.');fs.appendFileSync(target,`snapshot=${json}\n`);}if(fileIndex>=0){const target=args[fileIndex+1];if(!target)throw new Error('--output requires a path.');fs.writeFileSync(path.resolve(target),`${JSON.stringify(snapshot,null,2)}\n`);}if(outputIndex<0&&fileIndex<0)process.stdout.write(`${JSON.stringify(snapshot,null,2)}\n`);}
if(require.main===module)main();
module.exports={CONSUMERS,createSnapshot,resolveHead};
