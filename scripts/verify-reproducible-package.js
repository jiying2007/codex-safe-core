'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'codex-safe-pack-'));
function pack(dir){fs.mkdirSync(dir,{recursive:true});const raw=execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',dir],{cwd:root,encoding:'utf8'});const file=JSON.parse(raw)[0].filename;return path.join(dir,file);}
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
try{const first=pack(path.join(tmp,'a')),second=pack(path.join(tmp,'b'));const a=digest(first),b=digest(second);if(a!==b)throw new Error(`npm package is not reproducible: ${a} != ${b}`);console.log(`Reproducible package verified: ${a}`);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
