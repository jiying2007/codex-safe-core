'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(process.argv[2]||path.resolve(__dirname,'..'));const manifest=require('../family-non-goals.json');
function walk(p){if(!fs.existsSync(p))return[];const s=fs.statSync(p);if(s.isFile())return[p];return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.name==='.git'||e.name==='node_modules'?[]:walk(path.join(p,e.name)));}
const pkgPath=path.join(root,'package.json');if(fs.existsSync(pkgPath)){const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));if(path.basename(root)==='codex-safe-core'||fs.existsSync(path.join(root,'core-contract.json'))){if(manifest.core.forbidRuntimeDependencies&&pkg.dependencies&&Object.keys(pkg.dependencies).length)throw new Error('Core must not acquire runtime dependencies');}}
const gitmodules=path.join(root,'.gitmodules');if(fs.existsSync(gitmodules)&&manifest.core.forbidBranchTrackingSubmodule&&/\bbranch\s*=/.test(fs.readFileSync(gitmodules,'utf8')))throw new Error('Core consumers must not branch-track the submodule');
for(const legacy of manifest.family.forbiddenLegacyPolicyFiles)if(fs.existsSync(path.join(root,legacy)))throw new Error(`legacy policy file must not return: ${legacy}`);
if(fs.existsSync(path.join(root,'core-contract.json'))){for(const domain of manifest.core.forbiddenRuntimeDomains){for(const file of walk(root).filter(f=>f.includes(`${path.sep}src${path.sep}`)||path.dirname(f)===root)){if(new RegExp(`(^|[-_.])${domain}([-_.]|$)`,'i').test(path.basename(file)))throw new Error(`Core must not own ${domain} runtime domain: ${path.relative(root,file)}`);}}}
console.log(`family non-goals verified for ${root}`);
