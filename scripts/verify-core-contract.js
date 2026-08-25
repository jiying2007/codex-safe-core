'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const contract=require('../core-contract.json');
const pkg=require('../package.json');
const safe=require('../safe-contract');
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function esc(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
assert.equal(pkg.version,contract.coreVersion);
assert.equal(pkg.engines.node,`>=${contract.minimumNodeVersion} <23 || >=${contract.canonicalNodeVersion} <25`);
assert.deepEqual(contract.supportedNodeMajors,[22,24]);
assert.equal(safe.SAFE_CORE_VERSION,contract.safeCoreMajorVersion);
assert.equal(safe.SAFE_CONTRACT_VERSION,contract.safeContractVersion);
assert.equal(safe.CURRENT_POLICY_SCHEMA_VERSION,contract.policySchemaVersion);
assert.equal(safe.REVIEW_RECEIPT_SCHEMA_VERSION,contract.reviewReceiptVersion);
assert.equal(safe.COMMIT_RECEIPT_SCHEMA_VERSION,contract.commitReceiptVersion);
assert.equal(safe.REVIEW_PROMPT_CONTRACT_VERSION,contract.reviewPromptContractVersion);
assert.equal(safe.COMMIT_PROMPT_CONTRACT_VERSION,contract.commitPromptContractVersion);
assert.equal(safe.PR_PROMPT_CONTRACT_VERSION,contract.prPromptContractVersion);
assert.match(safe.SAFE_CONTRACT_DIGEST,/^[0-9a-f]{64}$/);
const expected=crypto.createHash('sha256').update(JSON.stringify(safe.SAFE_CONTRACT_MANIFEST)).digest('hex');
assert.equal(safe.SAFE_CONTRACT_DIGEST,expected);
for(const file of ['README.md','README.zh-CN.md','ARCHITECTURE.md','SECURITY.md','docs/CONSUMER_GUIDE.md','docs/CONSUMER_GUIDE.zh-CN.md']){
  const text=read(file);
  assert.match(text,new RegExp(`Safe Core[^\n]{0,30}(?:v)?${contract.safeCoreMajorVersion}`, 'i'),`${file} Core major drift`);
  assert.match(text,new RegExp(`Safe Contract[^\n]{0,30}(?:v)?${contract.safeContractVersion}`, 'i'),`${file} Safe Contract drift`);
  assert.doesNotMatch(text,/Review Receipt v3|Commit Receipt v3|Safe Core v3/,`${file} stale v3 protocol facts`);
}
const ci=read('.github/workflows/ci.yml');
assert.match(ci,new RegExp(esc(contract.minimumNodeVersion)));
assert.match(ci,new RegExp(esc(contract.canonicalNodeVersion)));
console.log(`Core contract verified: ${contract.coreVersion}, Safe Contract ${contract.safeContractVersion}, Node ${pkg.engines.node}, digest ${safe.SAFE_CONTRACT_DIGEST}.`);
