'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]||'.');
const forbidden=/(^|\b)(AGPL|GPL)(?:-|\b)/i;
const seen=[];

function licenseExpression(pkg){
  if(typeof pkg.license==='string')return pkg.license.trim();
  if(Array.isArray(pkg.licenses))return pkg.licenses.map(item=>typeof item==='string'?item:item?.type).filter(Boolean).join(' OR ');
  return '';
}
function stripOuterParens(value){
  let text=String(value||'').trim();
  while(text.startsWith('(')&&text.endsWith(')'))text=text.slice(1,-1).trim();
  return text;
}
function isForbiddenExpression(expression){
  const text=stripOuterParens(expression);
  if(!forbidden.test(text))return false;
  const alternatives=text.split(/\s+OR\s+/i).map(stripOuterParens).filter(Boolean);
  if(alternatives.length>1)return alternatives.every(isForbiddenExpression);
  return forbidden.test(text);
}
function visit(dir){
  if(!fs.existsSync(dir))return;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(!e.isDirectory()||e.name.startsWith('.'))continue;
    const p=path.join(dir,e.name);
    if(e.name.startsWith('@')){visit(p);continue;}
    const pkg=path.join(p,'package.json');
    if(!fs.existsSync(pkg))continue;
    const v=JSON.parse(fs.readFileSync(pkg,'utf8'));
    const license=licenseExpression(v);
    if(isForbiddenExpression(license))throw new Error(`forbidden dependency license ${license}: ${v.name||e.name}@${v.version||'?'}`);
    seen.push(v.name||e.name);
  }
}
visit(path.join(root,'node_modules'));
console.log(`dependency license policy verified for ${seen.length} installed packages`);
