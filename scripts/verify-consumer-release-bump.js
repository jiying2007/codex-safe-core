#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

function git(args){return execFileSync('git',args,{encoding:'utf8'}).trim();}
function parse(version){const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(version||''));if(!m)throw new Error(`Expected MAJOR.MINOR.PATCH version, got ${version||'<missing>'}`);return m.slice(1).map(Number);}
function isNextPatch(before,after){const a=parse(before),b=parse(after);return a[0]===b[0]&&a[1]===b[1]&&b[2]===a[2]+1;}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function changelogBeginsWithRelease(text,version){
  const normalized=String(text||'').replace(/\r\n/g,'\n');
  const expected=`## ${version}`;
  if(normalized.startsWith('# Changelog\n\n'))return normalized.slice('# Changelog\n\n'.length).startsWith(expected);
  return normalized.startsWith(expected);
}
function verify({baseRef=process.env.GITHUB_BASE_REF,root=process.cwd()}={}){
  root=path.resolve(root);
  if(!baseRef)return {changed:false,reason:'no-base-ref'};
  git(['fetch','--quiet','origin',baseRef]);
  const base=`origin/${baseRef}`;
  const changed=git(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).includes('src/codex-safe-core');
  if(!changed)return {changed:false,reason:'core-pin-unchanged'};
  const before=JSON.parse(git(['show',`${base}:package.json`])).version;
  const after=readJson(path.join(root,'package.json')).version;
  if(!isNextPatch(before,after))throw new Error(`Core gitlink changed, so product version must advance by exactly one patch: ${before} -> ${after}`);
  const product=readJson(path.join(root,'product-contract.json'));
  if(product.productVersion!==after)throw new Error(`product-contract productVersion ${product.productVersion} != package ${after}`);
  for(const alias of ['serviceVersion','diagnoseVersion'])if(alias in product&&product[alias]!==after)throw new Error(`${alias} ${product[alias]} != package ${after}`);
  const changelogPath=path.join(root,'CHANGELOG.md');
  if(fs.existsSync(changelogPath)){
    const changelog=fs.readFileSync(changelogPath,'utf8');
    if(!changelogBeginsWithRelease(changelog,after))throw new Error(`CHANGELOG must begin with product release ${after} after a Core repin.`);
  }
  return {changed:true,before,after};
}
if(require.main===module){try{console.log(JSON.stringify(verify()));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={changelogBeginsWithRelease,isNextPatch,parse,readJson,verify};
