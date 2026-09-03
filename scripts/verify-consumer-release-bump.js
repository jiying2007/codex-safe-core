#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

function git(args){return execFileSync('git',args,{encoding:'utf8'}).trim();}
function parse(version){const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(version||''));if(!m)throw new Error(`Expected MAJOR.MINOR.PATCH version, got ${version||'<missing>'}`);return m.slice(1).map(Number);}
function isNextPatch(before,after){const a=parse(before),b=parse(after);return a[0]===b[0]&&a[1]===b[1]&&b[2]===a[2]+1;}
function verify({baseRef=process.env.GITHUB_BASE_REF}={}){
  const pkg=require('../package.json');
  if(!baseRef)return {changed:false,reason:'no-base-ref'};
  git(['fetch','--quiet','origin',baseRef]);
  const base=`origin/${baseRef}`;
  const changed=git(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).includes('src/codex-safe-core');
  if(!changed)return {changed:false,reason:'core-pin-unchanged'};
  const before=JSON.parse(git(['show',`${base}:package.json`])).version;
  const after=pkg.version;
  if(!isNextPatch(before,after))throw new Error(`Core gitlink changed, so product version must advance by exactly one patch: ${before} -> ${after}`);
  const product=JSON.parse(fs.readFileSync('product-contract.json','utf8'));
  if(product.productVersion!==after)throw new Error(`product-contract productVersion ${product.productVersion} != package ${after}`);
  if('serviceVersion' in product&&product.serviceVersion!==after)throw new Error(`serviceVersion ${product.serviceVersion} != package ${after}`);
  const changelog=fs.readFileSync('CHANGELOG.md','utf8').replace(/\r\n/g,'\n');
  if(!changelog.startsWith(`# Changelog\n\n## ${after}`))throw new Error(`CHANGELOG must begin with product release ${after} after a Core repin.`);
  return {changed:true,before,after};
}
if(require.main===module){try{console.log(JSON.stringify(verify()));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={isNextPatch,parse,verify};
