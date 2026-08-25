'use strict';
const fs=require('node:fs');
const path=require('node:path');
const manifest=require('../core-ownership-manifest.json');
const familyDir=path.resolve(process.argv[2]||path.join(__dirname,'..','family'));
const repos=['codex-commit','codex-review','codex-pr','codex-review-service'];
function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','src/codex-safe-core'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(/\.(?:js|cjs|mjs|ts)$/.test(e.name))out.push(p);}return out;}
for(const repo of repos){const root=path.join(familyDir,repo);for(const file of walk(root)){const text=fs.readFileSync(file,'utf8');for(const symbol of manifest.consumerForbiddenImplementations){const declaration=new RegExp(`(?:function|const|let|var|class)\\s+${symbol.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`);if(declaration.test(text))throw new Error(`${repo} reimplements Core-owned symbol ${symbol}: ${path.relative(root,file)}`);}}}
console.log(`Consumer ownership boundary verified across ${repos.length} repositories.`);
