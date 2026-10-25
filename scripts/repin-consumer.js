'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {computeCoreDigests}=require('./core-digests');
const {changelogBeginsWithRelease}=require('./verify-consumer-release-bump');
const {secureReadText,atomicWriteText}=require('../secure-local-file');

const MAX_REPIN_TEXT_BYTES=16*1024*1024;

const CURRENT_STATE_DOCS=[
  'README.md','README.zh-CN.md',
  'docs/GETTING_STARTED.md','docs/GETTING_STARTED.zh-CN.md',
  'SUPPORT.md','SECURITY.md','PUBLISHING.md','VERIFY_RELEASE.md',
  'docs/DEPLOYMENT.md','docs/DEPLOYMENT.zh-CN.md','OPERATIONS.md','ARCHITECTURE.md',
  'deploy/docker/compose.yaml'
];
const CURRENT_CONTRACT_TESTS=['test/input-manifest-contract.test.js'];

function isSha(value){return /^[0-9a-f]{40}$/i.test(String(value||''));}
function readRepositoryFile(file,{allowMissing=false}={}){
  let mode;
  const fsImpl={...fs,fstatSync(fd){const stat=fs.fstatSync(fd);mode=stat.mode&0o777;return stat;}};
  // Repository files may legitimately be group-writable or executable. Keep
  // their mode from the same descriptor used for the bounded, no-follow read.
  const text=secureReadText(file,{allowMissing,maxBytes:MAX_REPIN_TEXT_BYTES,requireOwner:false,rejectGroupOtherWrite:false,fsImpl});
  return text===null?null:{text,mode};
}
function writeRepositoryFile(file,text,previous){return atomicWriteText(file,text,{mode:previous.mode,maxBytes:MAX_REPIN_TEXT_BYTES});}
function updateRepositoryFile(file,mutate){
  const previous=readRepositoryFile(file,{allowMissing:true});
  if(previous===null)return false;
  const after=mutate(previous.text);
  if(after===previous.text)return false;
  writeRepositoryFile(file,after,previous);
  return true;
}
function readOptionalText(file){return readRepositoryFile(file,{allowMissing:true})?.text??null;}
function esc(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function replaceAll(text,from,to){return from&&from!==to?String(text).split(from).join(to):String(text);}
function bumpPatch(version){const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(version||''));if(!match)throw new Error(`product version must be MAJOR.MINOR.PATCH: ${version}`);return `${match[1]}.${match[2]}.${Number(match[3])+1}`;}
function shouldSkipRuntimeEquivalentRepin({coreChanged,runtimeChanged,exactPin=false}={}){return Boolean(coreChanged&&!runtimeChanged&&!exactPin);}
function syncProductVersionAliases(value,newProductVersion){for(const key of ['serviceVersion','diagnoseVersion'])if(key in value)value[key]=newProductVersion;return value;}
function syncVerifierText(text,{sha,version,runtimeDigest=''}){
  let out=String(text);
  out=out.replace(/const EXPECTED_CORE_COMMIT\s*=\s*['"][0-9a-f]{40}['"];?/i,`const EXPECTED_CORE_COMMIT = '${sha}';`).replace(/const expectedCore\s*=\s*['"][0-9a-f]{40}['"];?/i,`const expectedCore='${sha}';`).replace(/const core\s*=\s*['"][0-9a-f]{40}['"];?/i,`const core='${sha}';`).replace(/(assert\.(?:strictEqual|equal)\(expectedCore\s*,\s*['"])[0-9a-f]{40}(['"]\s*\))/,`$1${sha}$2`).replace(/(distribution-receipt\\\.yml@)[0-9a-f]{40}/g,`$1${sha}`);
  if(runtimeDigest)out=out.replace(/(safeCoreRuntimeDigest\s*,\s*['"])[0-9a-f]{64}(['"]\s*\))/,`$1${runtimeDigest}$2`);
  if(version)out=out.replace(/const safeCoreVersion\s*=\s*['"][0-9]+\.[0-9]+\.[0-9]+['"];?/i,`const safeCoreVersion='${version}';`).replace(/(contract\.safeCoreVersion\s*(?:!==|===|!=|==)\s*['"])[0-9]+\.[0-9]+\.[0-9]+(['"])/g,`$1${version}$2`);
  return out;
}
const FAMILY_READ_SECRET='CODEX_SAFE_FAMILY_READ_TOKEN';
const FAMILY_GUARD='jiying2007/codex-safe-core/.github/workflows/family-release-guard.yml';
function workflowEntries(lines,start=0,end=lines.length){
  const meaningful=[];
  for(let i=start;i<end;i++){
    if(!lines[i].trim()||lines[i].trimStart().startsWith('#'))continue;
    meaningful.push({line:i,indent:lines[i].length-lines[i].trimStart().length});
  }
  if(!meaningful.length)return[];
  const indent=meaningful.reduce((minimum,item)=>Math.min(minimum,item.indent),Infinity),entries=[];
  for(const item of meaningful.filter(value=>value.indent===indent)){
    const match=/^( *)(?:([A-Za-z_][A-Za-z0-9_-]*)|'([^']+)'|"([^"\\]+)"):[ \t]*(.*)$/.exec(lines[item.line]);
    if(!match)throw new Error('Family Release Guard repin requires unambiguous block-style YAML mappings.');
    if(entries.length)entries[entries.length-1].end=item.line;
    entries.push({...item,end,key:match[2]||match[3]||match[4],value:match[5]});
  }
  return entries;
}
function workflowEntry(entries,key){
  const matches=entries.filter(item=>item.key===key);
  if(matches.length>1)throw new Error(`Family Release Guard repin found duplicate ${key} keys.`);
  return matches[0];
}
function workflowChildren(lines,entry){
  if(!entry)return[];
  if(entry.value&&!entry.value.startsWith('#'))throw new Error(`Family Release Guard repin requires a block-style ${entry.key} mapping.`);
  return workflowEntries(lines,entry.line+1,entry.end);
}
function declaresFamilyReadSecret(text){
  if(text===null)return false;
  const lines=text.split(/\r?\n/);
  let entries=workflowEntries(lines);
  for(const key of ['on','workflow_call','secrets'])entries=workflowChildren(lines,workflowEntry(entries,key));
  return Boolean(workflowEntry(entries,FAMILY_READ_SECRET));
}
function targetFamilyGuard(root,sha){
  if(!isSha(sha))throw new Error('An exact target Core commit is required for Family secret wiring.');
  const sub=path.join(root,'src','codex-safe-core'),relative='.github/workflows/family-release-guard.yml';
  const git=args=>execFileSync('git',args,{cwd:sub,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:MAX_REPIN_TEXT_BYTES});
  const entry=git(['ls-tree',sha,'--',relative]).trim();
  if(entry&&!/^100(?:644|755) blob [0-9a-f]{40}\t\.github\/workflows\/family-release-guard\.yml$/.test(entry))throw new Error('Target Core Family Release Guard must be a tracked regular file.');
  const declared=entry?git(['show',`${sha}:${relative}`]):null;
  const current=readOptionalText(path.join(sub,relative));
  const normalizeEol=value=>value===null?null:value.replace(/\r\n/g,'\n');
  if(normalizeEol(current)!==normalizeEol(declared))throw new Error('Target Core Family Release Guard worktree differs from the exact commit; preserve and resolve that edit before repinning.');
  return declared;
}
function workflowScalarValue(value){const comment=value.search(/[ \t]#/);return(comment<0?value:value.slice(0,comment)).trim();}
function syncFamilyReadSecret(text,sha,supported){
  if(!text.includes(`${FAMILY_GUARD}@${sha}`))return text;
  const newline=text.includes('\r\n')?'\r\n':'\n',lines=text.split(/\r?\n/);
  const jobs=workflowChildren(lines,workflowEntry(workflowEntries(lines),'jobs'));
  for(const job of jobs.reverse()){
    const fields=workflowChildren(lines,job),uses=workflowEntry(fields,'uses');
    if(!uses)continue;
    const reference=workflowScalarValue(uses.value).replace(/^(['"])(.*)\1$/,'$2');
    if(reference!==`${FAMILY_GUARD}@${sha}`)continue;
    const inputs=workflowChildren(lines,workflowEntry(fields,'with'));
    if(workflowEntry(inputs,'secrets')||workflowEntry(inputs,FAMILY_READ_SECRET))throw new Error(`${FAMILY_READ_SECRET} belongs in the job-level secrets mapping, not with inputs.`);
    const secrets=workflowEntry(fields,'secrets');
    const mappings=workflowChildren(lines,secrets),existing=workflowEntry(mappings,FAMILY_READ_SECRET);
    if(existing){
      if(!supported)throw new Error(`Target Family Release Guard does not declare ${FAMILY_READ_SECRET}; remove the unsupported caller mapping before repinning.`);
      const expression=workflowScalarValue(existing.value);
      const binding=/^(['"]?)\$\{\{[ \t]*secrets\.([A-Za-z_][A-Za-z0-9_]*)[ \t]*\}\}\1$/.exec(expression);
      const continued=lines.slice(existing.line+1,existing.end).some(line=>line.trim()&&!line.trimStart().startsWith('#'));
      if(!binding||continued)throw new Error(`${FAMILY_READ_SECRET} requires a single-line explicit secrets.NAME expression; scalar blocks, anchors, aliases and dynamic expressions are not supported.`);
      if(binding[2].toUpperCase()==='FAMILY_BOT_TOKEN')throw new Error(`${FAMILY_READ_SECRET} must not use the Family write credential.`);
      continue;
    }
    if(!supported)continue;
    const indent=' '.repeat(secrets?.indent??uses.indent);
    if(secrets)lines.splice(secrets.line+1,0,`${' '.repeat(mappings[0]?.indent??secrets.indent+2)}${FAMILY_READ_SECRET}: \${{ secrets.${FAMILY_READ_SECRET} }}`);
    else lines.splice(uses.line+1,0,`${indent}secrets:`,`${indent}  ${FAMILY_READ_SECRET}: \${{ secrets.${FAMILY_READ_SECRET} }}`);
  }
  return lines.join(newline);
}
function planReusableWorkflowPins(root,sha){
  const dir=path.join(root,'.github','workflows');let names;
  try{names=fs.readdirSync(dir);}catch(error){if(error?.code==='ENOENT')return[];throw error;}
  // A same-SHA checkout can preserve local edits. Bind capability to the Git
  // object and reject drift; never infer support from an edited old callee.
  const supported=declaresFamilyReadSecret(targetFamilyGuard(root,sha));
  return names.filter(value=>/\.ya?ml$/i.test(value)).sort().map(name=>{
    const file=path.join(dir,name),previous=readRepositoryFile(file);
    const pinned=previous.text.replace(/(jiying2007\/codex-safe-core\/\.github\/workflows\/(?:family-release-guard|distribution-receipt)\.yml@)[0-9a-f]{40}/g,`$1${sha}`).replace(/(expected_core_sha:\s*)[0-9a-f]{40}/g,`$1${sha}`);
    return{file,previous,text:syncFamilyReadSecret(pinned,sha,supported)};
  });
}
function writeReusableWorkflowPlan(plan){for(const {file,previous,text}of plan)if(text!==previous.text)writeRepositoryFile(file,text,previous);}
function syncReusableWorkflowPins(root,sha){writeReusableWorkflowPlan(planReusableWorkflowPins(root,sha));}
function syncCurrentIdentityText(text,{oldSha,newSha,oldVersion,newVersion,oldProductVersion,newProductVersion}){
  let out=replaceAll(text,oldSha,newSha);
  if(oldVersion&&newVersion&&oldVersion!==newVersion){
    out=out.replace(new RegExp(`((?:Codex\\s+)?Safe Core\\s+v?)${esc(oldVersion)}\\b`,'g'),`$1${newVersion}`);
    out=out.replace(new RegExp('(Safe Core[:：]\\s*`?)'+esc(oldVersion)+'(`?)','g'),`$1${newVersion}$2`);
    out=out.replace(new RegExp('((?:pins|固定到) Core\\s+)'+esc(oldVersion)+'\\b','g'),`$1${newVersion}`);
    if(isSha(newSha))out=out.replace(new RegExp('(Safe Core[:：][^\\r\\n]*'+esc(newSha)+'`?\\s*/\\s*v?)'+esc(oldVersion)+'\\b','g'),`$1${newVersion}`);
  }
  if(oldProductVersion&&newProductVersion&&oldProductVersion!==newProductVersion)out=out.replace(new RegExp(`\\b${esc(oldProductVersion)}\\b`,'g'),newProductVersion);
  return out;
}
function syncContractTestText(text,{oldVersion,newVersion}){if(!oldVersion||!newVersion||oldVersion===newVersion)return String(text);return String(text).replace(new RegExp(`(contract\\.safeCoreVersion\\s*,\\s*['"])${esc(oldVersion)}(['"])`,'g'),`$1${newVersion}$2`);}
function updatePackageVersion(root,newProductVersion){
  const pkgPath=path.join(root,'package.json'),previousPackage=readRepositoryFile(pkgPath),pkg=JSON.parse(previousPackage.text);
  const lockPath=path.join(root,'package-lock.json'),previousLock=readRepositoryFile(lockPath,{allowMissing:true}),lock=previousLock===null?null:JSON.parse(previousLock.text);
  pkg.version=newProductVersion;writeRepositoryFile(pkgPath,JSON.stringify(pkg,null,2)+'\n',previousPackage);
  if(previousLock!==null){lock.version=newProductVersion;if(lock.packages?.[''])lock.packages[''].version=newProductVersion;writeRepositoryFile(lockPath,JSON.stringify(lock,null,2)+'\n',previousLock);}
}
function planChangelog(root,{newProductVersion,newCoreVersion,runtimeDigest,runtimeChanged=true}){
  const file=path.join(root,'CHANGELOG.md'),previous=readRepositoryFile(file,{allowMissing:true});
  if(previous===null||changelogBeginsWithRelease(previous.text,newProductVersion))return null;
  const text=previous.text.replace(/\r\n/g,'\n');
  if(text.split('\n').some(line=>changelogBeginsWithRelease(line,newProductVersion)))throw new Error(`CHANGELOG already contains release ${newProductVersion} below the current release; resolve its order before repinning.`);
  const reason=runtimeChanged?`the shipped Core runtime digest changed to \`${runtimeDigest}\``:`the exact Core pin changes while its runtime digest remains \`${runtimeDigest}\``;
  const entry=`## ${newProductVersion}\n\n- Repin to Codex Safe Core ${newCoreVersion} because ${reason}; publish a new immutable product release and required distribution evidence.\n- Refresh Product Contract v2 and generated/current-state Family identity for the exact Core pin.\n\n`,marker='# Changelog\n\n';
  return{file,previous,text:text.startsWith(marker)?marker+entry+text.slice(marker.length):entry+text};
}
function writeChangelogPlan(plan){if(plan)writeRepositoryFile(plan.file,plan.text,plan.previous);}
function prependChangelog(root,options){writeChangelogPlan(planChangelog(root,options));}
function repinConsumer(rootArg,shaArg,{bumpProduct=true,exactPin=false}={}){
  const root=path.resolve(rootArg||'.'),sha=String(shaArg||'').trim();if(!isSha(sha))throw new Error('exact 40-character Core SHA is required');
  const git=(args,cwd=root,stdio='inherit')=>execFileSync('git',args,{cwd,encoding:'utf8',stdio}),replaceFile=(relative,mutate)=>updateRepositoryFile(path.join(root,relative),mutate);
  if(!fs.existsSync(path.join(root,'.gitmodules')))throw new Error('consumer is missing .gitmodules');
  const productPath=path.join(root,'product-contract.json'),previousProduct=readRepositoryFile(productPath,{allowMissing:true}),oldProduct=previousProduct===null?null:JSON.parse(previousProduct.text),oldSha=isSha(oldProduct?.safeCoreCommit)?oldProduct.safeCoreCommit:null,oldVersion=typeof oldProduct?.safeCoreVersion==='string'?oldProduct.safeCoreVersion:null,oldRuntimeDigest=/^[0-9a-f]{64}$/i.test(String(oldProduct?.safeCoreRuntimeDigest||''))?String(oldProduct.safeCoreRuntimeDigest):'';
  const pkgPath=path.join(root,'package.json'),pkg=JSON.parse(readRepositoryFile(pkgPath).text),oldProductVersion=String(pkg.version||''),coreChanged=oldSha!==sha;
  const sub=path.join(root,'src','codex-safe-core');git(['submodule','update','--init','--recursive']);git(['fetch','origin',sha],sub);git(['checkout','--detach',sha],sub);
  const coreContract=JSON.parse(readRepositoryFile(path.join(sub,'core-contract.json')).text),newVersion=coreContract.coreVersion,newDigests=computeCoreDigests(sub),runtimeChanged=!oldRuntimeDigest||oldRuntimeDigest!==newDigests.runtimeDigest;
  if(shouldSkipRuntimeEquivalentRepin({coreChanged,runtimeChanged,exactPin})){
    if(oldSha)git(['checkout','--detach',oldSha],sub);
    console.log(`consumer runtime already matches Core ${newVersion}; governance-only repin skipped: ${root}`);
    return{sha:oldSha,requestedSha:sha,version:oldVersion,requestedVersion:newVersion,oldSha,oldVersion,oldProductVersion,newProductVersion:oldProductVersion,runtimeChanged:false,skipped:true,runtimeDigest:newDigests.runtimeDigest};
  }
  const releaseBearing=coreChanged&&bumpProduct;
  const newProductVersion=releaseBearing?bumpPatch(oldProductVersion):oldProductVersion;
  // Validate every caller before changing any consumer file. Individual writes
  // remain atomic; the preceding Git checkout is not a multi-file transaction.
  const workflowPlan=planReusableWorkflowPins(root,sha);
  const changelogPlan=releaseBearing?planChangelog(root,{newProductVersion,newCoreVersion:newVersion,runtimeDigest:newDigests.runtimeDigest,runtimeChanged}):null;
  replaceFile('.codex-safe.example.json',text=>{const value=JSON.parse(text);value.schemaVersion=coreContract.policySchemaVersion;if(typeof value.$schema==='string')value.$schema=value.$schema.replace(/(codex-safe-core\/)[0-9a-f]{40}(\/)/i,`$1${sha}$2`);return JSON.stringify(value,null,2)+'\n';});
  replaceFile('scripts/verify-manifest.js',text=>syncVerifierText(text,{sha,version:newVersion,runtimeDigest:newDigests.runtimeDigest}));replaceFile('scripts/release.test.js',text=>syncVerifierText(text,{sha,version:newVersion,runtimeDigest:newDigests.runtimeDigest}));writeReusableWorkflowPlan(workflowPlan);replaceFile('.github/workflows/family-release-guard.yml',text=>text.replace(/(codex-safe-core\/.github\/workflows\/family-release-guard\.yml@)[0-9a-f]{40}/i,`$1${sha}`).replace(/(expected_core_sha:\s*)[0-9a-f]{40}/i,`$1${sha}`));
  if(releaseBearing)updatePackageVersion(root,newProductVersion);
  if(oldProduct){const value={...oldProduct,productContractVersion:coreContract.productContractVersion,safeCoreCommit:sha,safeCoreVersion:newVersion,safeCoreRuntimeDigest:newDigests.runtimeDigest,safeCoreGovernanceDigest:newDigests.governanceDigest,safeCoreMajorVersion:coreContract.safeCoreMajorVersion,safeContractVersion:coreContract.safeContractVersion,policySchemaVersion:coreContract.policySchemaVersion,minimumNodeVersion:coreContract.minimumNodeVersion,canonicalNodeVersion:coreContract.canonicalNodeVersion,supportedNodeMajors:coreContract.supportedNodeMajors,productVersion:newProductVersion};for(const key of ['reviewReceiptVersion','commitReceiptVersion','diagnosisReceiptVersion','judgmentLifecycleVersion','findingClaimVersion','codexRuntimeVersion','providerContractVersion','modelRoutingContractVersion','modelRegistryVersion','modelLineageVersion','modelEconomicsVersion','tokenCalibrationStoreVersion'])if(key in oldProduct||key in coreContract)value[key]=coreContract[key];syncProductVersionAliases(value,newProductVersion);writeRepositoryFile(productPath,JSON.stringify(value,null,2)+'\n',previousProduct);}
  writeChangelogPlan(changelogPlan);
  const docsGenerator=path.join(root,'scripts','generate-contract-docs.js');if(fs.existsSync(docsGenerator))execFileSync(process.execPath,[docsGenerator],{cwd:root,stdio:'inherit'});
  for(const relative of CURRENT_STATE_DOCS)replaceFile(relative,text=>syncCurrentIdentityText(text,{oldSha,newSha:sha,oldVersion,newVersion,oldProductVersion,newProductVersion}));for(const relative of CURRENT_CONTRACT_TESTS)replaceFile(relative,text=>syncContractTestText(text,{oldVersion,newVersion}));
  console.log(`consumer repinned to ${sha} (Core ${newVersion}, runtime ${newDigests.runtimeDigest}, product ${oldProductVersion} -> ${newProductVersion}): ${root}`);return{sha,version:newVersion,oldSha,oldVersion,oldProductVersion,newProductVersion,runtimeChanged,skipped:false,runtimeDigest:newDigests.runtimeDigest,governanceDigest:newDigests.governanceDigest};
}
if(require.main===module){const args=process.argv.slice(2),exactPin=args.includes('--exact-pin'),noProductBump=args.includes('--no-product-bump'),values=args.filter(value=>!['--exact-pin','--no-product-bump'].includes(value));repinConsumer(values[0],values[1],{bumpProduct:!noProductBump,exactPin});}
module.exports={CURRENT_CONTRACT_TESTS,CURRENT_STATE_DOCS,bumpPatch,prependChangelog,readOptionalText,repinConsumer,shouldSkipRuntimeEquivalentRepin,syncContractTestText,syncCurrentIdentityText,syncProductVersionAliases,syncReusableWorkflowPins,syncVerifierText,updatePackageVersion};
