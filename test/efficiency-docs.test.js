'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pkg=require('../package.json');
const contract=require('../core-contract.json');
const root=path.resolve(__dirname,'..');
function esc(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

test('bilingual efficiency contract ships with current Core identity',()=>{for(const file of['docs/EFFICIENCY_CONTRACT.md','docs/EFFICIENCY_CONTRACT.zh-CN.md']){assert.ok(pkg.files.includes(file));const text=fs.readFileSync(path.join(root,file),'utf8');assert.match(text,new RegExp(`Core v?${esc(contract.coreVersion)}`,'i'));assert.match(text,/budget|预算/i);assert.match(text,/usage|Token/i);assert.match(text,/calibrat|校准/i);}});
