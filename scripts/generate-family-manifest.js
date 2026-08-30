'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const contract=require('../core-contract.json');
const {CONSUMERS}=require('./resolve-family-snapshot');

function git(args,cwd=path.resolve(__dirname,'..')){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fileSha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function digest(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function protocolMap(){return Object.freeze(Object.fromEntries(Object.entries(contract).filter(([key,value])=>key!=='coreVersion'&&/Version$/.test(key)&&Number.isInteger(value)).sort(([a],[b])=>a.localeCompare(b))));}
function readSnapshot(file){if(!file)return null;const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));const canonical={schemaVersion:snapshot.schemaVersion,core:snapshot.core,consumers:snapshot.consumers};if(digest(JSON.stringify(canonical))!==snapshot.snapshotDigest)throw new Error('Family snapshot digest mismatch.');return snapshot;}

const root=path.resolve(__dirname,'..');
const familyDir=path.resolve(process.argv[2]||path.join(root,'family'));
const out=path.resolve(process.argv[3]||path.join(root,'FAMILY_MANIFEST.json'));
const snapshot=readSnapshot(process.argv[4]?path.resolve(process.argv[4]):null);
const coreSha=git(['rev-parse','HEAD']);
if(snapshot&&snapshot.core?.sha!==coreSha)throw new Error(`Snapshot Core ${snapshot.core?.sha||'<missing>'} != ${coreSha}`);
const consumers={};

for(const name of CONSUMERS){
  const cwd=path.join(familyDir,name),sha=git(['rev-parse','HEAD'],cwd),pin=git(['ls-files','--stage','src/codex-safe-core'],cwd).split(/\s+/)[1]||'';
  if(pin!==coreSha)throw new Error(`${name} pins ${pin||'<missing>'}, expected ${coreSha}`);
  if(snapshot&&snapshot.consumers?.[name]?.sha!==sha)throw new Error(`${name} snapshot drift: ${sha} != ${snapshot.consumers?.[name]?.sha||'<missing>'}`);
  const pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8')),lockPath=path.join(cwd,'package-lock.json'),productPath=path.join(cwd,'product-contract.json');
  if(!fs.existsSync(productPath))throw new Error(`${name} must contain product-contract.json for Family Manifest v3.`);
  const productContract=JSON.parse(fs.readFileSync(productPath,'utf8'));
  if(productContract.productVersion!==pkg.version)throw new Error(`${name} product contract/package version drift.`);
  if(productContract.safeCoreCommit!==coreSha||productContract.safeCoreVersion!==contract.coreVersion)throw new Error(`${name} product contract Core drift.`);
  consumers[name]={productId:productContract.productId,version:pkg.version||null,sha,corePin:pin,packageLockSha256:fs.existsSync(lockPath)?fileSha(lockPath):null,productContractSha256:fileSha(productPath)};
}

const coreContractPath=path.join(root,'core-contract.json');
const payload={
  schemaVersion:Number(contract.familyManifestVersion||3),
  snapshot:{schemaVersion:snapshot?.schemaVersion??Number(contract.familySnapshotVersion||1),digest:snapshot?.snapshotDigest||null},
  core:{version:contract.coreVersion,sha:coreSha,coreContractSha256:fileSha(coreContractPath),packageLockSha256:fs.existsSync(path.join(root,'package-lock.json'))?fileSha(path.join(root,'package-lock.json')):null},
  protocols:protocolMap(),
  protocolFingerprint:digest(JSON.stringify(protocolMap())),
  runtime:{supportedNodeMajors:contract.supportedNodeMajors,minimumNodeVersion:contract.minimumNodeVersion,canonicalNodeVersion:contract.canonicalNodeVersion},
  consumers
};
const canonical=JSON.stringify(payload);payload.manifestDigest=digest(canonical);fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');console.log(out);
