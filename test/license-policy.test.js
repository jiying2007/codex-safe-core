'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const script=path.resolve(__dirname,'../scripts/verify-package-licenses.js');

function fixture(license){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'codex-safe-license-'));
  const pkg=path.join(root,'node_modules','fixture');
  fs.mkdirSync(pkg,{recursive:true});
  fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'fixture',version:'1.0.0',license}));
  return root;
}
function verify(license){
  const root=fixture(license);
  try{return execFileSync(process.execPath,[script,root],{encoding:'utf8'});}finally{fs.rmSync(root,{recursive:true,force:true});}
}

test('SPDX OR permits a permissive alternative',()=>{
  assert.match(verify('(MIT OR GPL-3.0-or-later)'),/verified for 1 installed packages/);
});

test('GPL-only alternatives remain forbidden',()=>{
  assert.throws(()=>verify('GPL-2.0-only OR GPL-3.0-only'),/forbidden dependency license/);
});

test('AGPL-only remains forbidden',()=>{
  assert.throws(()=>verify('AGPL-3.0-only'),/forbidden dependency license/);
});

test('AND with GPL remains forbidden',()=>{
  assert.throws(()=>verify('MIT AND GPL-3.0-only'),/forbidden dependency license/);
});
