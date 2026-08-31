'use strict';
const fs=require('node:fs');
const path=require('node:path');
const CONTRACT=require('../family-ui-contract.json');
function validatePackage(pkg,productId,contract=CONTRACT){
  const expected=(contract.primarySequence||[]).find(x=>x.productId===productId);
  if(!expected)return [];
  const errors=[];
  const items=pkg.contributes?.menus?.['scm/title']||[];
  if(items.length!==1)errors.push(`${productId} must contribute exactly one primary scm/title command; found ${items.length}`);
  const item=items[0];
  if(item){
    if(item.command!==expected.command)errors.push(`${productId} primary scm/title command must be ${expected.command}, got ${item.command}`);
    if(item.group!==expected.group)errors.push(`${productId} primary scm/title group must be ${expected.group}, got ${item.group}`);
    const when=String(item.when||'');
    for(const term of contract.requiredWhenTerms||[])if(!when.includes(term))errors.push(`${productId} primary scm/title when clause must include ${term}`);
  }
  for(const forbidden of contract.forbiddenPrimaryCommands||[])if(items.some(x=>x.command===forbidden))errors.push(`${forbidden} must not appear in scm/title`);
  return errors;
}
function verify(root=process.cwd(),productId){
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  if(!productId){const pc=JSON.parse(fs.readFileSync(path.join(root,'product-contract.json'),'utf8'));productId=pc.productId;}
  const errors=validatePackage(pkg,productId);
  if(errors.length){const error=new Error(errors.join('\n'));error.code='FAMILY_UI_CONTRACT';throw error;}
  return {productId,applicable:(CONTRACT.primarySequence||[]).some(x=>x.productId===productId)};
}
if(require.main===module){try{const result=verify(process.argv[2]||process.cwd(),process.argv[3]);console.log(result.applicable?`Family SCM UI contract verified for ${result.productId}`:`Family SCM UI contract not applicable to ${result.productId}`);}catch(error){console.error(error.message);process.exit(2);}}
module.exports={CONTRACT,validatePackage,verify};
