'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const CURRENT_STATE_DOCS=[
  'README.md','README.zh-CN.md',
  'docs/GETTING_STARTED.md','docs/GETTING_STARTED.zh-CN.md',
  'SUPPORT.md','SECURITY.md','PUBLISHING.md','VERIFY_RELEASE.md',
  'docs/DEPLOYMENT.md','docs/OPERATIONS.md','ARCHITECTURE.md'
];
const CURRENT_CONTRACT_TESTS=['test/input-manifest-contract.test.js'];

function isSha(value){return /^[0-9a-f]{40}$/i.test(String(value||''));}
function esc(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function replaceAll(text,from,to){return from&&from!==to?String(text).split(from).join(to):String(text);}
function syncVerifierText(text,{sha,version}){
  let out=String(text);
  out=out
    .replace(/const EXPECTED_CORE_COMMIT\s*=\s*['"][0-9a-f]{40}['"];?/i,`const EXPECTED_CORE_COMMIT = '${sha}';`)
    .replace(/const expectedCore\s*=\s*['"][0-9a-f]{40}['"];?/i,`const expectedCore='${sha}';`)
    .replace(/const core\s*=\s*['"][0-9a-f]{40}['"];?/i,`const core='${sha}';`);
  if(version) out=out.replace(/const safeCoreVersion\s*=\s*['"][0-9]+\.[0-9]+\.[0-9]+['"];?/i,`const safeCoreVersion='${version}';`);
  return out;
}
function syncCurrentIdentityText(text,{oldSha,newSha,oldVersion,newVersion}){
  let out=replaceAll(text,oldSha,newSha);
  if(oldVersion&&newVersion&&oldVersion!==newVersion){
    const version=esc(oldVersion);
    out=out.replace(new RegExp(`((?:Codex\\s+)?Safe Core\\s+v?)${version}\\b`,'g'),`$1${newVersion}`);
  }
  return out;
}
function syncContractTestText(text,{oldVersion,newVersion}){
  if(!oldVersion||!newVersion||oldVersion===newVersion)return String(text);
  return String(text).replace(new RegExp(`(contract\\.safeCoreVersion\\s*,\\s*['"])${esc(oldVersion)}(['"])`,'g'),`$1${newVersion}$2`);
}
function repinConsumer(rootArg,shaArg){
  const root=path.resolve(rootArg||'.'),sha=String(shaArg||'').trim();
  if(!isSha(sha))throw new Error('exact 40-character Core SHA is required');
  const git=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:'inherit'});
  const replaceFile=(relative,mutate)=>{const file=path.join(root,relative);if(!fs.existsSync(file))return;const before=fs.readFileSync(file,'utf8'),after=mutate(before);if(after!==before)fs.writeFileSync(file,after);};
  if(!fs.existsSync(path.join(root,'.gitmodules')))throw new Error('consumer is missing .gitmodules');

  const productPath=path.join(root,'product-contract.json');
  const oldProduct=fs.existsSync(productPath)?JSON.parse(fs.readFileSync(productPath,'utf8')):null;
  const oldSha=isSha(oldProduct?.safeCoreCommit)?oldProduct.safeCoreCommit:null;
  const oldVersion=typeof oldProduct?.safeCoreVersion==='string'?oldProduct.safeCoreVersion:null;

  const sub=path.join(root,'src','codex-safe-core');
  git(['submodule','update','--init','--recursive']);
  git(['fetch','origin',sha],sub);
  git(['checkout','--detach',sha],sub);
  const coreContract=JSON.parse(fs.readFileSync(path.join(sub,'core-contract.json'),'utf8'));
  const newVersion=coreContract.coreVersion;

  const example=path.join(root,'.codex-safe.example.json');
  if(fs.existsSync(example)){
    const value=JSON.parse(fs.readFileSync(example,'utf8'));
    value.schemaVersion=coreContract.policySchemaVersion;
    if(typeof value.$schema==='string')value.$schema=value.$schema.replace(/(codex-safe-core\/)[0-9a-f]{40}(\/)/i,`$1${sha}$2`);
    fs.writeFileSync(example,JSON.stringify(value,null,2)+'\n');
  }

  replaceFile('scripts/verify-manifest.js',text=>syncVerifierText(text,{sha,version:newVersion}));
  replaceFile('scripts/release.test.js',text=>syncVerifierText(text,{sha,version:newVersion}));
  replaceFile('.github/workflows/family-release-guard.yml',text=>text
    .replace(/(codex-safe-core\/.github\/workflows\/family-release-guard\.yml@)[0-9a-f]{40}/i,`$1${sha}`)
    .replace(/(expected_core_sha:\s*)[0-9a-f]{40}/i,`$1${sha}`));

  if(oldProduct){
    const value={...oldProduct};
    const sync={safeCoreCommit:sha,safeCoreVersion:newVersion,safeCoreMajorVersion:coreContract.safeCoreMajorVersion,safeContractVersion:coreContract.safeContractVersion,policySchemaVersion:coreContract.policySchemaVersion,minimumNodeVersion:coreContract.minimumNodeVersion,canonicalNodeVersion:coreContract.canonicalNodeVersion,supportedNodeMajors:coreContract.supportedNodeMajors};
    for(const[key,v]of Object.entries(sync))if(key in value)value[key]=v;
    fs.writeFileSync(productPath,JSON.stringify(value,null,2)+'\n');
  }

  const docsGenerator=path.join(root,'scripts','generate-contract-docs.js');
  if(fs.existsSync(docsGenerator))execFileSync(process.execPath,[docsGenerator],{cwd:root,stdio:'inherit'});

  for(const relative of CURRENT_STATE_DOCS)replaceFile(relative,text=>syncCurrentIdentityText(text,{oldSha,newSha:sha,oldVersion,newVersion}));
  for(const relative of CURRENT_CONTRACT_TESTS)replaceFile(relative,text=>syncContractTestText(text,{oldVersion,newVersion}));

  console.log(`consumer repinned to ${sha} (Core ${newVersion}, Policy Schema ${coreContract.policySchemaVersion}): ${root}`);
  return {sha,version:newVersion,oldSha,oldVersion};
}

if(require.main===module)repinConsumer(process.argv[2],process.argv[3]);
module.exports={CURRENT_CONTRACT_TESTS,CURRENT_STATE_DOCS,repinConsumer,syncContractTestText,syncCurrentIdentityText,syncVerifierText};
