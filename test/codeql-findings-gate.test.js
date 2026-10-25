'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {inspectSarif,inspectDirectory}=require('../scripts/codeql-findings-gate');
function report(severity='7.5',level='warning'){
  return{version:'2.1.0',runs:[{tool:{driver:{name:'CodeQL',rules:[{id:'js/test',properties:{'security-severity':severity},defaultConfiguration:{level}}]}},invocations:[{executionSuccessful:true}],results:[{ruleId:'js/test',ruleIndex:0,level,locations:[{physicalLocation:{artifactLocation:{uri:'source.js'},region:{startLine:7}}}]}]}]};
}
function packReport(severity='7.5'){
  const value=report(severity),run=value.runs[0];
  run.tool.extensions=[{name:'codeql/javascript-queries',rules:run.tool.driver.rules}];
  run.tool.driver.rules=[];
  run.results[0].rule={id:'js/test',index:0,toolComponent:{index:0}};
  return value;
}
test('CodeQL Action query-pack SARIF accepts clean analysis and blocks high findings',()=>{
  const clean=packReport();clean.runs[0].results=[];
  assert.equal(inspectSarif(clean).ok,true);
  delete clean.runs[0].tool.driver.rules;
  assert.equal(inspectSarif(clean).ok,true);
  assert.equal(inspectSarif(packReport('7.5')).ok,false);
  assert.equal(inspectSarif(packReport('6.9')).ok,true);
});
test('query-pack findings bind to their referenced component without driver fallback',()=>{
  const packed=packReport();
  packed.runs[0].tool.driver.rules=report('1.0').runs[0].tool.driver.rules;
  assert.equal(inspectSarif(packed).ok,false);
  const named=packReport();named.runs[0].results[0].rule.toolComponent={name:'codeql/javascript-queries'};
  assert.equal(inspectSarif(named).ok,false);
  for(const index of [-1,0.5,1,'0']){
    const invalid=packReport();invalid.runs[0].results[0].rule.toolComponent.index=index;
    assert.throws(()=>inspectSarif(invalid),/invalid query pack/);
  }
  const wrongName=packReport();wrongName.runs[0].results[0].rule.toolComponent.name='other-pack';
  assert.throws(()=>inspectSarif(wrongName),/component identity mismatch/);
  const wrongId=packReport();wrongId.runs[0].results[0].rule.id='other-query';
  assert.throws(()=>inspectSarif(wrongId),/query identity mismatch/);
  const wrongIndex=packReport();wrongIndex.runs[0].results[0].rule.index=1;
  assert.throws(()=>inspectSarif(wrongIndex),/query identity mismatch/);
  const noReference=packReport();delete noReference.runs[0].results[0].rule;
  assert.throws(()=>inspectSarif(noReference),/no unambiguous matching query definition/);
  const duplicate=packReport();duplicate.runs[0].tool.extensions[0].rules.unshift(report('1.0').runs[0].tool.driver.rules[0]);
  duplicate.runs[0].results[0].ruleIndex=1;duplicate.runs[0].results[0].rule.index=1;
  assert.throws(()=>inspectSarif(duplicate),/no unambiguous matching query definition/);
});
test('high and critical findings fail the actual CI gate even when analysis succeeded',()=>{
  for(const severity of ['7.0','8.9','9.0','10.0']){
    const result=inspectSarif(report(severity));assert.equal(result.ok,false);assert.equal(result.blocking[0].line,7);
  }
  assert.equal(inspectSarif(report('6.9')).ok,true);
  const clean=report();clean.runs[0].results=[];assert.equal(inspectSarif(clean).ok,true);
});
test('error-level quality findings block and suppression or baseline labels do not bypass the gate',()=>{
  const quality=report(undefined,'error');delete quality.runs[0].tool.driver.rules[0].properties['security-severity'];assert.equal(inspectSarif(quality).ok,false);
  const suppressed=report();suppressed.runs[0].results[0].suppressions=[{status:'accepted',kind:'external'}];suppressed.runs[0].results[0].baselineState='unchanged';assert.equal(inspectSarif(suppressed).ok,false);
});
test('missing reports, failed analyses, malformed severity and unresolved rules fail closed',()=>{
  for(const value of [{},{version:'2.1.0',runs:[]}])assert.throws(()=>inspectSarif(value));
  const failed=report();failed.runs[0].invocations[0].executionSuccessful=false;assert.throws(()=>inspectSarif(failed));
  const unknown=report();unknown.runs[0].results[0].ruleId='other';assert.throws(()=>inspectSarif(unknown));
  const mismatch=report();mismatch.runs[0].results[0].ruleIndex=2;assert.throws(()=>inspectSarif(mismatch));
  for(const severity of ['','n/a','11','-1'])assert.throws(()=>inspectSarif(report(severity)));
});
test('on-disk analyzer output is required and every report contributes to the verdict',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codeql-gate-'));
  try{
    assert.throws(()=>inspectDirectory(dir));
    fs.writeFileSync(path.join(dir,'javascript.sarif'),JSON.stringify(report('5.0')));
    assert.equal(inspectDirectory(dir).ok,true);
    fs.writeFileSync(path.join(dir,'other.sarif'),JSON.stringify(report('9.5')));
    assert.equal(inspectDirectory(dir).ok,false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
