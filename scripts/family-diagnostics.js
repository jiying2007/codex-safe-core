'use strict';
const fs=require('node:fs');const path=require('node:path');const {execFileSync,spawnSync}=require('node:child_process');
const root=process.cwd();
function json(p){return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;}
function git(args,cwd=root){try{return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return null;}}
const pkg=json(path.join(root,'package.json'))||{};const embedded=path.join(root,'src','codex-safe-core');const coreRoot=fs.existsSync(path.join(embedded,'core-contract.json'))?embedded:root;const contract=json(path.join(coreRoot,'core-contract.json'))||{};
const codex=spawnSync(process.env.CODEX_PATH||'codex',['--version'],{encoding:'utf8',timeout:5000,windowsHide:true});
const out={schemaVersion:1,product:pkg.name||path.basename(root),productVersion:pkg.version||null,sourceSha:git(['rev-parse','HEAD']),coreSha:coreRoot===root?git(['rev-parse','HEAD']):git(['ls-files','--stage','src/codex-safe-core'])?.split(/\s+/)[1]||null,coreVersion:contract.coreVersion||null,safeContractVersion:contract.safeContractVersion||null,policySchemaVersion:contract.policySchemaVersion||null,node:process.version,platform:process.platform,arch:process.arch,codexCli:codex.status===0?String(codex.stdout||codex.stderr).trim():null,codexProbeStatus:codex.status===0?'available':'unavailable'};
process.stdout.write(JSON.stringify(out,null,2)+'\n');
