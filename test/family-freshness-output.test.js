'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {CONSUMERS}=require('../scripts/family-release-state');
const {latestFamilyManifest}=require('../scripts/family-freshness');

const root=path.resolve(__dirname,'..'),script=path.join(root,'scripts','family-freshness.js');
function cliFixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'family-freshness-cli-'));
  const preload=path.join(dir,'preload.cjs'),output=path.join(dir,'github-output');
  fs.writeFileSync(preload,`'use strict';\nconst family=require(${JSON.stringify(path.join(root,'scripts','family-release-state.js'))});\nfamily.collectFamilyState=async()=>{if(process.env.FRESHNESS_FIXTURE_FAIL==='1')throw new Error('fixture evidence unavailable');return JSON.parse(process.env.FRESHNESS_FIXTURE_STATE);};\nfamily.githubJson=async()=>[];\n`);
  return{dir,output,run(state,args,extra={}){
    const env={...process.env,GITHUB_OUTPUT:output,FRESHNESS_FIXTURE_STATE:JSON.stringify(state),...extra};
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath,['--require',preload,script,...args],{cwd:root,encoding:'utf8',timeout:10000,env});
  }};
}
function familyState(ready){return{core:{releaseReady:ready,reason:'fixture-state\ndispatch=true\ndecision=forged\r\n',metadata:{note:'remote-looking value\nwith another line'}},consumers:Object.fromEntries(CONSUMERS.map(name=>[name,{ready,reason:'fixture-consumer'}]))};}

test('freshness CLI writes only one boolean Actions output and reports full JSON on stdout',()=>{
  const fixture=cliFixture();
  try{
    for(const ready of [false,true])for(const explicit of [false,true]){
      fs.writeFileSync(fixture.output,'previous=value\n');
      const result=fixture.run(familyState(ready),explicit?['--github-output',fixture.output]:['--github-output']);
      assert.equal(result.status,0,result.stderr);
      assert.equal(fs.readFileSync(fixture.output,'utf8'),`previous=value\ndispatch=${ready}\n`);
      const state=JSON.parse(result.stdout);
      assert.equal(state.dispatch,ready);
      assert.equal(state.core.metadata.note,'remote-looking value\nwith another line');
      assert.equal(state.core.reason,familyState(ready).core.reason);
      assert.equal(typeof state.reason,'string');
    }
    const report=fixture.run(familyState(false),[]);
    assert.equal(report.status,0,report.stderr);assert.equal(JSON.parse(report.stdout).dispatch,false);
  }finally{fs.rmSync(fixture.dir,{recursive:true,force:true});}
});

test('freshness CLI leaves Actions output unchanged when evidence cannot be read',()=>{
  const fixture=cliFixture();
  try{
    fs.writeFileSync(fixture.output,'previous=value\n');
    const result=fixture.run(familyState(false),['--github-output'],{FRESHNESS_FIXTURE_FAIL:'1'});
    assert.equal(result.status,1);assert.match(result.stderr,/fixture evidence unavailable/);
    assert.equal(result.stdout,'');assert.equal(fs.readFileSync(fixture.output,'utf8'),'previous=value\n');
    const missing=fixture.run(familyState(false),['--github-output'],{GITHUB_OUTPUT:''});
    assert.equal(missing.status,1);assert.match(missing.stderr,/requires a path or GITHUB_OUTPUT/);
  }finally{fs.rmSync(fixture.dir,{recursive:true,force:true});}
});

function manifestFixture(){
  const core={version:'4.18.2',sha:'a'.repeat(40),digests:{runtimeDigest:'1'.repeat(64),governanceDigest:'2'.repeat(64)}};
  const manifest={schemaVersion:5,core:{sha:core.sha,runtimeDigest:core.digests.runtimeDigest,governanceDigest:core.digests.governanceDigest},manifestDigest:'3'.repeat(64)};
  const api='https://api.github.com/repos/jiying2007/codex-safe-core/releases/assets/1';
  const release={tag_name:'family-manifest-v4.18.2-fixture',draft:false,prerelease:false,immutable:true,published_at:'2026-10-25T00:00:00Z',assets:[{name:'FAMILY_MANIFEST.json',url:api,browser_download_url:'https://github.com/jiying2007/codex-safe-core/releases/download/fixture/FAMILY_MANIFEST.json'}]};
  return{core,manifest,api,release};
}

test('freshness manifests use the bounded authenticated asset reader and strip CDN credentials',async()=>{
  const original=global.fetch,seen=[],fixture=manifestFixture();
  global.fetch=async(url,options)=>{
    const current=String(url);seen.push({url:current,options});
    if(current.includes('/releases?'))return Response.json([fixture.release]);
    if(current===fixture.api)return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/freshness-fixture'}});
    assert.equal(current,'https://release-assets.githubusercontent.com/freshness-fixture');
    return Response.json(fixture.manifest);
  };
  try{
    assert.deepEqual(await latestFamilyManifest(fixture.core,{token:'synthetic-read-token'}),fixture.manifest);
    assert.equal(seen[1].url,fixture.api);assert.equal(seen[1].options.redirect,'manual');
    assert.equal(seen[1].options.headers.authorization,'Bearer synthetic-read-token');
    assert.equal(seen[2].options.headers.authorization,undefined);assert.ok(seen[1].options.signal);
  }finally{global.fetch=original;}
});

test('freshness rejects oversized or non-GitHub manifest assets before accepting evidence',async()=>{
  const original=global.fetch,fixture=manifestFixture();
  try{
    global.fetch=async url=>String(url).includes('/releases?')?Response.json([fixture.release]):new Response('{}',{headers:{'content-length':String(2*1024*1024+1)}});
    await assert.rejects(latestFamilyManifest(fixture.core,{token:'synthetic-read-token'}),/size limit/);
    let requests=0;
    fixture.release.assets[0].url='https://untrusted.invalid/FAMILY_MANIFEST.json';
    global.fetch=async()=>{requests++;return Response.json([fixture.release]);};
    await assert.rejects(latestFamilyManifest(fixture.core,{token:'synthetic-read-token'}),/must start at GitHub/);
    assert.equal(requests,1);
  }finally{global.fetch=original;}
});
