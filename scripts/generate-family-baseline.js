'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const contract=require('../core-contract.json');
function git(args,cwd=path.resolve(__dirname,'..')){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
const root=path.resolve(__dirname,'..');
const familyDir=path.resolve(process.argv[2]||path.join(root,'family'));
const out=path.resolve(process.argv[3]||path.join(root,'FAMILY_BASELINE.json'));
const bomOut=path.resolve(process.argv[4]||path.join(path.dirname(out),'FAMILY_BOM.json'));
const names=['codex-commit','codex-review','codex-pr','codex-review-service'];
const coreSha=git(['rev-parse','HEAD']);
const consumers={};
for(const name of names){const cwd=path.join(familyDir,name);const sha=git(['rev-parse','HEAD'],cwd);const pin=git(['ls-files','--stage','src/codex-safe-core'],cwd).split(/\s+/)[1]||'';if(pin!==coreSha)throw new Error(`${name} pins ${pin||'<missing>'}, expected ${coreSha}`);const pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8'));consumers[name]={version:pkg.version||null,sha,corePin:pin};}
const payload={schemaVersion:2,familyBomVersion:1,core:{version:contract.coreVersion,sha:coreSha},protocols:{safeCore:contract.safeCoreMajorVersion,safeContract:contract.safeContractVersion,policy:contract.policySchemaVersion,reviewReceipt:contract.reviewReceiptVersion,commitReceipt:contract.commitReceiptVersion,reviewPrompt:contract.reviewPromptContractVersion,commitPrompt:contract.commitPromptContractVersion,prPrompt:contract.prPromptContractVersion},runtime:{supportedNodeMajors:contract.supportedNodeMajors,minimumNodeVersion:contract.minimumNodeVersion,canonicalNodeVersion:contract.canonicalNodeVersion},consumers};
const canonical=JSON.stringify(payload);payload.baselineDigest=crypto.createHash('sha256').update(canonical).digest('hex');
fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');fs.writeFileSync(bomOut,JSON.stringify(payload,null,2)+'\n');
console.log(out);console.log(bomOut);
