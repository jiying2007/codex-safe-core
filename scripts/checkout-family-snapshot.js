#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {CONSUMERS}=require('./resolve-family-snapshot');
const OWNER='jiying2007';
function git(args,cwd){return execFileSync('git',args,{cwd,stdio:['ignore','pipe','inherit'],encoding:'utf8'}).trim();}
function readSnapshot(file){const value=JSON.parse(fs.readFileSync(file,'utf8'));if(!value||typeof value!=='object'||!value.consumers)throw new Error('Invalid Family snapshot.');if(!/^[0-9a-f]{64}$/.test(String(value.snapshotDigest||'')))throw new Error('Family snapshot digest missing.');return value;}
function checkoutSnapshot(snapshot,outDir){fs.mkdirSync(outDir,{recursive:true});for(const name of CONSUMERS){const expected=String(snapshot.consumers?.[name]?.sha||'');if(!/^[0-9a-f]{40}$/.test(expected))throw new Error(`${name} snapshot SHA invalid.`);const dest=path.join(outDir,name);if(fs.existsSync(dest))fs.rmSync(dest,{recursive:true,force:true});git(['clone','--quiet','--no-checkout',`https://github.com/${OWNER}/${name}.git`,dest],process.cwd());git(['checkout','--quiet','--detach',expected],dest);git(['submodule','update','--init','--recursive'],dest);const actual=git(['rev-parse','HEAD'],dest);if(actual!==expected)throw new Error(`${name} checkout drift: ${actual} != ${expected}`);}}
function main(){const snapshotFile=path.resolve(process.argv[2]||'FAMILY_SNAPSHOT.json'),outDir=path.resolve(process.argv[3]||'family'),snapshot=readSnapshot(snapshotFile);checkoutSnapshot(snapshot,outDir);process.stdout.write(`${snapshot.snapshotDigest}\n`);}
if(require.main===module)main();
module.exports={readSnapshot,checkoutSnapshot};
