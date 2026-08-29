'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const contract=require('../core-contract.json');

function git(args,cwd=path.resolve(__dirname,'..')){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fileSha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

const root=path.resolve(__dirname,'..');
const familyDir=path.resolve(process.argv[2]||path.join(root,'family'));
const out=path.resolve(process.argv[3]||path.join(root,'FAMILY_MANIFEST.json'));
const names=['codex-commit','codex-review','codex-review-service','codex-diagnose'];
const coreSha=git(['rev-parse','HEAD']);
const consumers={};

for(const name of names){
  const cwd=path.join(familyDir,name);
  const sha=git(['rev-parse','HEAD'],cwd);
  const pin=git(['ls-files','--stage','src/codex-safe-core'],cwd).split(/\s+/)[1]||'';
  if(pin!==coreSha)throw new Error(`${name} pins ${pin||'<missing>'}, expected ${coreSha}`);
  const pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8'));
  const lockPath=path.join(cwd,'package-lock.json');
  const productPath=path.join(cwd,'product-contract.json');
  consumers[name]={
    version:pkg.version||null,
    sha,
    corePin:pin,
    packageLockSha256:fs.existsSync(lockPath)?fileSha(lockPath):null,
    productContractSha256:fs.existsSync(productPath)?fileSha(productPath):null
  };
}

const payload={
  schemaVersion:Number(contract.familyManifestVersion||2),
  core:{
    version:contract.coreVersion,
    sha:coreSha,
    packageLockSha256:fs.existsSync(path.join(root,'package-lock.json'))?fileSha(path.join(root,'package-lock.json')):null
  },
  protocols:{
    safeCore:contract.safeCoreMajorVersion,
    safeContract:contract.safeContractVersion,
    policy:contract.policySchemaVersion,
    reviewReceipt:contract.reviewReceiptVersion,
    commitReceipt:contract.commitReceiptVersion,
    diagnosisReceipt:contract.diagnosisReceiptVersion,
    reviewPrompt:contract.reviewPromptContractVersion,
    commitPrompt:contract.commitPromptContractVersion,
    diagnosePrompt:contract.diagnosePromptContractVersion,
    qualityPlatform:contract.qualityPlatformVersion,
    reviewProfile:contract.reviewProfileVersion,
    profilePack:contract.profilePackVersion,
    impactEvidence:contract.impactEvidenceVersion,
    testImpact:contract.testImpactVersion,
    analyzerFinding:contract.analyzerFindingVersion,
    patchProposal:contract.patchProposalVersion,
    diagnosisContract:contract.diagnosisContractVersion
  },
  runtime:{
    supportedNodeMajors:contract.supportedNodeMajors,
    minimumNodeVersion:contract.minimumNodeVersion,
    canonicalNodeVersion:contract.canonicalNodeVersion
  },
  consumers
};
const canonical=JSON.stringify(payload);
payload.manifestDigest=crypto.createHash('sha256').update(canonical).digest('hex');
fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
console.log(out);
