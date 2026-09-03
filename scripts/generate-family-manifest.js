'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const contract=require('../core-contract.json');
const registry=require('../family-registry.json');
const {CONSUMERS}=require('./resolve-family-snapshot');

function git(args,cwd=path.resolve(__dirname,'..')){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fileSha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function digest(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function protocolMap(){return Object.freeze(Object.fromEntries(Object.entries(contract).filter(([key,value])=>key!=='coreVersion'&&/Version$/.test(key)&&Number.isInteger(value)).sort(([a],[b])=>a.localeCompare(b))));}
function readSnapshot(file){if(!file)throw new Error('Family Manifest v4 requires a release-aware snapshot.');const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));const canonical={schemaVersion:snapshot.schemaVersion,registry:snapshot.registry,core:snapshot.core,consumers:snapshot.consumers};if(digest(JSON.stringify(canonical))!==snapshot.snapshotDigest)throw new Error('Family snapshot digest mismatch.');if(Number(snapshot.schemaVersion)!==Number(contract.familySnapshotVersion))throw new Error('Family snapshot version mismatch.');return snapshot;}

const root=path.resolve(__dirname,'..');
const familyDir=path.resolve(process.argv[2]||path.join(root,'family'));
const out=path.resolve(process.argv[3]||path.join(root,'FAMILY_MANIFEST.json'));
const snapshot=readSnapshot(path.resolve(process.argv[4]||'FAMILY_SNAPSHOT.json'));
const coreSha=git(['rev-parse','HEAD']);
if(snapshot.core?.sha!==coreSha)throw new Error(`Snapshot Core ${snapshot.core?.sha||'<missing>'} != ${coreSha}`);
if(snapshot.core?.release?.tagSha!==coreSha||snapshot.core?.release?.immutable!==true)throw new Error('Snapshot Core release is not exact immutable.');
const registryDigest=digest(JSON.stringify(registry));
if(snapshot.registry?.digest!==registryDigest)throw new Error('Family registry digest drift.');
const consumers={};

for(const name of CONSUMERS){
  const cwd=path.join(familyDir,name),sha=git(['rev-parse','HEAD'],cwd),pin=git(['ls-files','--stage','src/codex-safe-core'],cwd).split(/\s+/)[1]||'',recorded=snapshot.consumers?.[name];
  if(pin!==coreSha)throw new Error(`${name} pins ${pin||'<missing>'}, expected ${coreSha}`);
  if(!recorded||recorded.sha!==sha)throw new Error(`${name} snapshot drift: ${sha} != ${recorded?.sha||'<missing>'}`);
  if(recorded.release?.tagSha!==sha||recorded.release?.immutable!==true)throw new Error(`${name} release is not exact immutable.`);
  if(!recorded.distribution?.ready)throw new Error(`${name} distribution is not verified.`);
  const pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8')),lockPath=path.join(cwd,'package-lock.json'),productPath=path.join(cwd,'product-contract.json');
  if(!fs.existsSync(productPath))throw new Error(`${name} must contain product-contract.json for Family Manifest v4.`);
  const productContract=JSON.parse(fs.readFileSync(productPath,'utf8'));
  if(productContract.productVersion!==pkg.version||recorded.version!==pkg.version)throw new Error(`${name} product/release/package version drift.`);
  if(productContract.productId!==registry.consumers[name]?.productId)throw new Error(`${name} registry product identity drift.`);
  if(productContract.safeCoreCommit!==coreSha||productContract.safeCoreVersion!==contract.coreVersion)throw new Error(`${name} product contract Core drift.`);
  consumers[name]={
    productId:productContract.productId,
    version:pkg.version,
    sha,
    corePin:pin,
    release:recorded.release,
    distribution:recorded.distribution,
    packageLockSha256:fs.existsSync(lockPath)?fileSha(lockPath):null,
    productContractSha256:fileSha(productPath)
  };
}

const coreContractPath=path.join(root,'core-contract.json');
const payload={
  schemaVersion:Number(contract.familyManifestVersion),
  registry:{schemaVersion:Number(registry.schemaVersion),digest:registryDigest},
  snapshot:{schemaVersion:snapshot.schemaVersion,digest:snapshot.snapshotDigest},
  core:{version:contract.coreVersion,sha:coreSha,release:snapshot.core.release,coreContractSha256:fileSha(coreContractPath),packageLockSha256:fs.existsSync(path.join(root,'package-lock.json'))?fileSha(path.join(root,'package-lock.json')):null},
  protocols:protocolMap(),
  protocolFingerprint:digest(JSON.stringify(protocolMap())),
  runtime:{supportedNodeMajors:contract.supportedNodeMajors,minimumNodeVersion:contract.minimumNodeVersion,canonicalNodeVersion:contract.canonicalNodeVersion},
  consumers
};
const canonical=JSON.stringify(payload);payload.manifestDigest=digest(canonical);fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');console.log(out);
