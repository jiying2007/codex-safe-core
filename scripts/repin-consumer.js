'use strict';
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'.'),sha=String(process.argv[3]||'').trim();if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('exact 40-character Core SHA is required');
function git(args,cwd=root){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:'inherit'});}
function replaceFile(relative,mutate){const file=path.join(root,relative);if(!fs.existsSync(file))return;const before=fs.readFileSync(file,'utf8'),after=mutate(before);if(after!==before)fs.writeFileSync(file,after);}
const sub=path.join(root,'src','codex-safe-core');if(!fs.existsSync(path.join(root,'.gitmodules')))throw new Error('consumer is missing .gitmodules');git(['submodule','update','--init','--recursive']);git(['fetch','origin',sha],sub);git(['checkout','--detach',sha],sub);
const example=path.join(root,'.codex-safe.example.json');if(fs.existsSync(example)){const v=JSON.parse(fs.readFileSync(example,'utf8'));if(typeof v.$schema==='string')v.$schema=v.$schema.replace(/(codex-safe-core\/)[0-9a-f]{40}(\/)/i,`$1${sha}$2`);fs.writeFileSync(example,JSON.stringify(v,null,2)+'\n');}
replaceFile('scripts/verify-manifest.js',text=>text.replace(/const EXPECTED_CORE_COMMIT = '[0-9a-f]{40}';/i,`const EXPECTED_CORE_COMMIT = '${sha}';`));
replaceFile('scripts/release.test.js',text=>text.replace(/const expectedCore='[0-9a-f]{40}';/i,`const expectedCore='${sha}';`));
replaceFile('.github/workflows/family-release-guard.yml',text=>text.replace(/(codex-safe-core\/.github\/workflows\/family-release-guard\.yml@)[0-9a-f]{40}/i,`$1${sha}`).replace(/(expected_core_sha:\s*)[0-9a-f]{40}/i,`$1${sha}`));
const product=path.join(root,'product-contract.json');if(fs.existsSync(product)){const v=JSON.parse(fs.readFileSync(product,'utf8'));if('safeCoreCommit'in v)v.safeCoreCommit=sha;fs.writeFileSync(product,JSON.stringify(v,null,2)+'\n');}
const docsGenerator=path.join(root,'scripts','generate-contract-docs.js');if(fs.existsSync(docsGenerator))execFileSync(process.execPath,[docsGenerator],{cwd:root,stdio:'inherit'});
console.log(`consumer repinned to ${sha}: ${root}`);
