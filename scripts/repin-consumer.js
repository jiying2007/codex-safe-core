'use strict';
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'.'),sha=String(process.argv[3]||'').trim();if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('exact 40-character Core SHA is required');
function git(args,cwd=root){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:'inherit'});}
const sub=path.join(root,'src','codex-safe-core');if(!fs.existsSync(path.join(root,'.gitmodules')))throw new Error('consumer is missing .gitmodules');git(['submodule','update','--init','--recursive']);git(['fetch','origin',sha],sub);git(['checkout','--detach',sha],sub);
const example=path.join(root,'.codex-safe.example.json');if(fs.existsSync(example)){const v=JSON.parse(fs.readFileSync(example,'utf8'));if(typeof v.$schema==='string')v.$schema=v.$schema.replace(/(codex-safe-core\/)[0-9a-f]{40}(\/)/i,`$1${sha}$2`);fs.writeFileSync(example,JSON.stringify(v,null,2)+'\n');}
const verifier=path.join(root,'scripts','verify-manifest.js');if(fs.existsSync(verifier)){let text=fs.readFileSync(verifier,'utf8');text=text.replace(/const EXPECTED_CORE_COMMIT = '[0-9a-f]{40}';/i,`const EXPECTED_CORE_COMMIT = '${sha}';`);fs.writeFileSync(verifier,text);}
const product=path.join(root,'product-contract.json');if(fs.existsSync(product)){const v=JSON.parse(fs.readFileSync(product,'utf8'));if('safeCoreCommit'in v)v.safeCoreCommit=sha;fs.writeFileSync(product,JSON.stringify(v,null,2)+'\n');}
console.log(`consumer repinned to ${sha}: ${root}`);
