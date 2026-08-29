'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const contract=require('../core-contract.json');
const pkg=require('../package.json');

test('Core v4 efficiency line preserves active protocol identities while allowing feature releases',()=>{
  const [major,minor]=String(contract.coreVersion).split('.').map(Number);
  assert.equal(major,4);
  assert.ok(minor>=3,'efficiency planner requires Core 4.3 or newer');
  assert.equal(pkg.version,contract.coreVersion);
  assert.equal(contract.safeCoreMajorVersion,4);
  assert.equal(contract.safeContractVersion,2);
  assert.equal(contract.policySchemaVersion,3);
  assert.equal(contract.reviewReceiptVersion,4);
  assert.equal(contract.commitReceiptVersion,4);
  assert.equal(contract.reviewPromptContractVersion,1);
  assert.equal(contract.commitPromptContractVersion,1);
  assert.equal(Object.prototype.hasOwnProperty.call(contract,'prPromptContractVersion'),false);
});
