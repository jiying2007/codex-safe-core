'use strict';
const fs=require('node:fs');
const path=require('node:path');
const manifest=require('../core-ownership-manifest.json');
const familyDir=path.resolve(process.argv[2]||path.join(__dirname,'..','family'));
const repos=['codex-commit','codex-review','codex-review-service'];
function walk(root,dir=root,out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    const relative=path.relative(root,p).split(path.sep).join('/');
    if(e.isDirectory()&&(e.name==='node_modules'||e.name==='.git'||relative==='src/codex-safe-core'||relative.startsWith('src/codex-safe-core/')))continue;
    if(e.isDirectory())walk(root,p,out);
    else if(/\.(?:js|cjs|mjs|ts)$/.test(e.name))out.push(p);
  }
  return out;
}
for(const repo of repos){const root=path.join(familyDir,repo);for(const file of walk(root)){const text=fs.readFileSync(file,'utf8');for(const symbol of manifest.consumerForbiddenImplementations){const declaration=new RegExp(`(?:function|const|let|var|class)\\s+${symbol.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`);if(declaration.test(text))throw new Error(`${repo} reimplements Core-owned symbol ${symbol}: ${path.relative(root,file)}`);}}}
console.log(`Consumer ownership boundary verified across ${repos.length} active repositories.`);
