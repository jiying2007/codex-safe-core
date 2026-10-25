'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {execFile,execFileSync,spawnSync}=require('node:child_process');
const {promisify}=require('node:util');
const {changelogBeginsWithRelease,isNextPatch,isNextRelease,releaseBumpGitEnvironment}=require('../scripts/verify-consumer-release-bump');
const {CURRENT_STATE_DOCS,prependChangelog,repinConsumer,syncCurrentIdentityText}=require('../scripts/repin-consumer');
const {computeCoreDigests}=require('../scripts/core-digests');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'scripts','verify-consumer-release-bump.js'),'utf8');

test('release bump version relation is product-local and patch exact',()=>{
  assert.equal(isNextPatch('5.4.4','5.4.5'),true);
  assert.equal(isNextPatch('4.7.3','4.7.4'),true);
  assert.equal(isNextPatch('7.4.1','7.4.2'),true);
  assert.equal(isNextPatch('1.4.2','1.4.3'),true);
  assert.equal(isNextPatch('5.4.4','4.14.2'),false);
  assert.equal(isNextPatch('5.4.4','5.4.6'),false);
  assert.equal(isNextRelease('7.5.5','7.5.6'),true);
  assert.equal(isNextRelease('7.5.5','7.6.0'),true);
  assert.equal(isNextRelease('7.5.5','8.0.0'),true);
  assert.equal(isNextRelease('7.5.5','7.6.1'),false);
  assert.equal(isNextRelease('7.5.5','7.7.0'),false);
});

test('consumer verifier reads product identity from the caller workspace, never Core package identity',()=>{
  assert.match(source,/root=process\.cwd\(\)/);
  assert.match(source,/path\.join\(root,'package\.json'\)/);
  assert.match(source,/path\.join\(root,'product-contract\.json'\)/);
  assert.doesNotMatch(source,/require\(['"]\.\.\/package\.json['"]\)/);
});

test('consumer verifier enforces existing Service and Diagnose product aliases',()=>{
  assert.match(source,/\['serviceVersion','diagnoseVersion'\]/);
  assert.match(source,/product\[alias\]!==after/);
});

test('changelog validation accepts only canonical top-of-file release forms',()=>{
  assert.equal(changelogBeginsWithRelease('# Changelog\n\n## 7.4.2 - 2026-09-03\n\nbody\n','7.4.2'),true);
  assert.equal(changelogBeginsWithRelease('## 4.5.3 - 2026-09-03\n\nbody\n','4.5.3'),true);
  assert.equal(changelogBeginsWithRelease('# Changelog\n\n## 7.4.1\n\nold\n\n## 7.4.2\n','7.4.2'),false);
  assert.equal(changelogBeginsWithRelease('## 4.5.2\n\nold\n\n## 4.5.3\n','4.5.3'),false);
  assert.equal(changelogBeginsWithRelease('intro\n## 4.5.3\n','4.5.3'),false);
  assert.match(source,/const changelogPath=path\.join\(root,'CHANGELOG\.md'\)/);
  assert.match(source,/fs\.existsSync\(changelogPath\)/);
});

test('release headings bind the complete version and an optional ISO date suffix',()=>{
  for(const heading of ['## 1.2.4','## 1.2.4 - 2026-10-25','## 1.2.4 - 2024-02-29']){
    assert.equal(changelogBeginsWithRelease('# Changelog\r\n\r\n'+heading+'\r\n\r\nbody\r\n','1.2.4'),true,heading);
  }
  for(const heading of ['## 1.2.40','## 1.2.4.1','## 1.2.4-rc.1','## 1.2.4 unexpected','### 1.2.4','## 1.2.4 - malformed','## 1.2.4 - 2026-10-25 extra']){
    assert.equal(changelogBeginsWithRelease('# Changelog\n\n'+heading+'\n\nbody\n','1.2.4'),false,heading);
  }
});

test('repin changelog ignores version-prefix headings and rejects duplicate releases below the top',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'repin-release-heading-')),file=path.join(directory,'CHANGELOG.md');
  const options={newProductVersion:'1.2.4',newCoreVersion:'4.18.2',runtimeDigest:'a'.repeat(64),runtimeChanged:false};
  try{
    for(const before of ['# Changelog\n\n## 1.2.40\n\nExisting.\n','# Changelog\n\n## 1.2.3\n\nOld.\n\n## 1.2.40\n\nHistorical.\n']){
      fs.writeFileSync(file,before);prependChangelog(directory,options);
      const after=fs.readFileSync(file,'utf8');
      assert.equal(changelogBeginsWithRelease(after,'1.2.4'),true);
      assert.match(after,/runtime digest remains/);assert.ok(after.endsWith(before.slice('# Changelog\n\n'.length)));
      prependChangelog(directory,options);assert.equal(fs.readFileSync(file,'utf8'),after);
    }
    const dated='# Changelog\n\n## 1.2.4 - 2026-10-25\n\nPrepared release.\n';
    fs.writeFileSync(file,dated);prependChangelog(directory,options);assert.equal(fs.readFileSync(file,'utf8'),dated);
    const outOfOrder='# Changelog\n\n## 1.2.3\n\nOld.\n\n## 1.2.4\n\nOut of order.\n';
    fs.writeFileSync(file,outOfOrder);
    assert.throws(()=>prependChangelog(directory,options),/already contains release 1\.2\.4 below the current release/);
    assert.equal(fs.readFileSync(file,'utf8'),outOfOrder);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('runtime-equivalent exact repins agree with the real consumer release gate',{timeout:30000},async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'repin-exact-release-')),upstream=path.join(directory,'upstream'),consumer=path.join(directory,'consumer');
  const git=(cwd,...args)=>execFileSync('git',['-c','protocol.file.allow=always','-c','commit.gpgsign=false',...args],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).trim();
  const write=(relative,value)=>{const file=path.join(consumer,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
  const init=where=>{fs.mkdirSync(where,{recursive:true});git(where,'init','--quiet','--initial-branch=main');git(where,'config','user.name','Exact Repin Fixture');git(where,'config','user.email','fixture@example.invalid');};
  let server;
  try{
    init(upstream);
    fs.writeFileSync(path.join(upstream,'core-contract.json'),JSON.stringify({coreVersion:'4.18.1',safeContractVersion:2}));
    fs.writeFileSync(path.join(upstream,'core-surface-manifest.json'),JSON.stringify({schemaVersion:1,runtimeFiles:['index.js'],runtimeContractKeys:['safeContractVersion']}));
    fs.writeFileSync(path.join(upstream,'index.js'),'module.exports=1;\n');
    git(upstream,'add','.');git(upstream,'commit','--quiet','-m','released Core fixture');const originalSha=git(upstream,'rev-parse','HEAD');
    fs.writeFileSync(path.join(upstream,'core-contract.json'),JSON.stringify({coreVersion:'4.18.2',safeContractVersion:2}));
    git(upstream,'add','.');git(upstream,'commit','--quiet','-m','runtime-equivalent release');const nextSha=git(upstream,'rev-parse','HEAD');
    init(consumer);git(consumer,'submodule','add','--quiet',upstream,'src/codex-safe-core');
    const sub=path.join(consumer,'src','codex-safe-core');git(sub,'checkout','--quiet','--detach',originalSha);
    write('package.json',{name:'exact-repin-fixture',version:'1.2.3'});write('package-lock.json',{version:'1.2.3',packages:{'':{version:'1.2.3'}}});
    write('product-contract.json',{productId:'fixture',productVersion:'1.2.3',serviceVersion:'1.2.3',safeCoreCommit:originalSha,safeCoreVersion:'4.18.1',safeCoreRuntimeDigest:computeCoreDigests(sub).runtimeDigest});
    write('CHANGELOG.md','# Changelog\n\n## 1.2.3\n\nOriginal.\n');
    git(consumer,'add','.');git(consumer,'commit','--quiet','-m','released consumer fixture');git(consumer,'update-server-info');
    const files=new Map(),gitDirectory=path.join(consumer,'.git');
    const preload=where=>{for(const entry of fs.readdirSync(where,{withFileTypes:true})){
      const file=path.join(where,entry.name);
      if(entry.isDirectory()&&path.relative(gitDirectory,file)!=='modules')preload(file);
      else if(entry.isFile())files.set('/consumer.git/'+path.relative(gitDirectory,file).split(path.sep).join('/'),fs.readFileSync(file));
    }};
    preload(gitDirectory);
    server=http.createServer((request,response)=>{const body=files.get(new URL(request.url,'http://fixture.invalid').pathname);response.writeHead(body===undefined?404:200,{'Content-Type':'application/octet-stream'});response.end(body);});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    git(consumer,'remote','add','origin',`http://127.0.0.1:${server.address().port}/consumer.git`);git(consumer,'checkout','--quiet','-b','candidate');
    const invoke=()=>promisify(execFile)(process.execPath,[path.join(root,'scripts','verify-consumer-release-bump.js')],{cwd:consumer,env:{...process.env,GITHUB_BASE_REF:'main',GITHUB_TOKEN:'',GH_TOKEN:'',CODEX_SAFE_FAMILY_READ_TOKEN:''},encoding:'utf8',timeout:15000});
    const skipped=repinConsumer(consumer,nextSha);assert.equal(skipped.skipped,true);assert.equal(git(sub,'rev-parse','HEAD'),originalSha);
    const originalChangelog=fs.readFileSync(path.join(consumer,'CHANGELOG.md'),'utf8');
    write('CHANGELOG.md',originalChangelog+'\n## 1.2.4\n\nOut of order.\n');
    const plannedFiles=['package.json','package-lock.json','product-contract.json','CHANGELOG.md'],beforePlan=plannedFiles.map(file=>fs.readFileSync(path.join(consumer,file),'utf8'));
    assert.throws(()=>repinConsumer(consumer,nextSha,{exactPin:true}),/already contains release 1\.2\.4 below the current release/);
    assert.deepEqual(plannedFiles.map(file=>fs.readFileSync(path.join(consumer,file),'utf8')),beforePlan,'invalid changelog must fail before any consumer file write');
    write('CHANGELOG.md',originalChangelog);
    const exact=repinConsumer(consumer,nextSha,{exactPin:true});git(consumer,'add','.');git(consumer,'commit','--quiet','-m','exact pin');
    const accepted=await invoke();
    assert.deepEqual(JSON.parse(accepted.stdout),{changed:true,before:'1.2.3',after:'1.2.4'});
    assert.equal(exact.runtimeChanged,false);assert.equal(exact.newProductVersion,'1.2.4');
    assert.equal(JSON.parse(fs.readFileSync(path.join(consumer,'package-lock.json'),'utf8')).packages[''].version,'1.2.4');
    assert.equal(JSON.parse(fs.readFileSync(path.join(consumer,'product-contract.json'),'utf8')).serviceVersion,'1.2.4');
    assert.equal(repinConsumer(consumer,nextSha,{exactPin:true}).newProductVersion,'1.2.4');
    fs.writeFileSync(path.join(upstream,'release-notes.md'),'Formally released identity fixture.\n');git(upstream,'add','.');git(upstream,'commit','--quiet','-m','formal release identity');const formalSha=git(upstream,'rev-parse','HEAD');
    const prepared=repinConsumer(consumer,formalSha,{exactPin:true,bumpProduct:false});git(consumer,'add','.');git(consumer,'commit','--quiet','-m','replace prepared identity');
    assert.equal(prepared.newProductVersion,'1.2.4');assert.equal(prepared.runtimeChanged,false);
    assert.deepEqual(JSON.parse((await invoke()).stdout),{changed:true,before:'1.2.3',after:'1.2.4'});
    write('CHANGELOG.md','# Changelog\n\n## 1.2.40\n\nWrong release.\n');git(consumer,'add','CHANGELOG.md');git(consumer,'commit','--quiet','-m','reject version-prefix changelog');
    await assert.rejects(invoke(),error=>error.code===1&&/CHANGELOG must begin with product release 1\.2\.4/.test(error.stderr));
    write('package.json',{name:'exact-repin-fixture',version:'1.2.3'});git(consumer,'add','package.json');git(consumer,'commit','--quiet','-m','reject missing version advance');
    await assert.rejects(invoke(),error=>error.code===1&&/product version must advance by one valid SemVer release/.test(error.stderr));
  }finally{
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    fs.rmSync(directory,{recursive:true,force:true});
  }
});

test('current identity synchronization covers Change exact-pin and family-alignment prose',()=>{
  const oldSha='a'.repeat(40),newSha='b'.repeat(40);
  const input='- Safe Core: `4.14.2` exact pin `'+oldSha+'`\nCodex Change Safe 5.4.4 pins Core 4.14.2.\nSafe Core：`4.14.2`\nCodex Change Safe 5.4.4 固定到 Core 4.14.2。';
  const out=syncCurrentIdentityText(input,{oldSha,newSha,oldVersion:'4.14.2',newVersion:'4.14.3',oldProductVersion:'5.4.4',newProductVersion:'5.4.5'});
  assert.match(out,/Safe Core: `4\.14\.3` exact pin `b{40}`/);
  assert.match(out,/Codex Change Safe 5\.4\.5 pins Core 4\.14\.3/);
  assert.match(out,/Safe Core：`4\.14\.3`/);
  assert.match(out,/Codex Change Safe 5\.4\.5 固定到 Core 4\.14\.3/);
});

test('Service compose is canonical current-state release identity',()=>{
  assert.ok(CURRENT_STATE_DOCS.includes('deploy/docker/compose.yaml'));
});

test('release bump inherits workflow credentials only through the scoped Git environment',()=>{
  const source={PATH:process.env.PATH,GITHUB_TOKEN:'synthetic-workflow-read',GH_TOKEN:'synthetic-cli-read',GIT_TRACE:'1',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.extraheader',GIT_CONFIG_VALUE_0:'unscoped-header',RELEASE_BUMP_TEST_SCOPE:'inherited'};
  const actual=releaseBumpGitEnvironment(source);
  assert.equal(source.GITHUB_TOKEN,'synthetic-workflow-read');
  assert.equal(actual.PATH,source.PATH);assert.equal(actual.RELEASE_BUMP_TEST_SCOPE,'inherited');
  for(const key of ['GITHUB_TOKEN','GH_TOKEN','CODEX_SAFE_FAMILY_READ_TOKEN','GIT_TRACE'])assert.equal(actual[key],undefined);
  assert.equal(actual.GIT_TERMINAL_PROMPT,'0');assert.equal(actual.GIT_CONFIG_COUNT,'6');
  assert.equal(actual.GIT_CONFIG_KEY_5,'http.https://github.com/.extraheader');
  assert.equal(actual.GIT_CONFIG_VALUE_5,'AUTHORIZATION: basic '+Buffer.from('x-access-token:synthetic-workflow-read').toString('base64'));
  assert.equal(releaseBumpGitEnvironment({...source,CODEX_SAFE_FAMILY_READ_TOKEN:'synthetic-dedicated-read'}).GIT_CONFIG_VALUE_5,'AUTHORIZATION: basic '+Buffer.from('x-access-token:synthetic-dedicated-read').toString('base64'));
  assert.equal(releaseBumpGitEnvironment({GH_TOKEN:'synthetic-cli-read'}).GIT_CONFIG_COUNT,'6');
  assert.equal(releaseBumpGitEnvironment({GITHUB_TOKEN:'',GH_TOKEN:''}).GIT_CONFIG_COUNT,'5');
  assert.throws(()=>releaseBumpGitEnvironment({GITHUB_TOKEN:'bad\ncredential'}),/Invalid Family read credential/);
});

test('real Git ignores inherited global config and scopes release-bump authorization to HTTPS github.com',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'release-bump-config-'));
  try{
    const inherited=path.join(dir,'inherited.gitconfig');
    fs.writeFileSync(inherited,'[http]\n\textraheader = unscoped-inherited-header\n');
    const env=releaseBumpGitEnvironment({...process.env,GIT_CONFIG_GLOBAL:inherited,CODEX_SAFE_FAMILY_READ_TOKEN:undefined,GITHUB_TOKEN:'synthetic-host-read',GH_TOKEN:undefined});
    const options={cwd:dir,env,encoding:'utf8'};
    const global=spawnSync('git',['config','--global','--list'],options);
    assert.equal(global.status,0,global.stderr);assert.equal(global.stdout,'');
    const lookup=url=>spawnSync('git',['config','--get-urlmatch','http.extraheader',url],options);
    const github=lookup('https://github.com/example/private.git');
    assert.equal(github.status,0,github.stderr);assert.equal(github.stdout.trim(),'AUTHORIZATION: basic '+Buffer.from('x-access-token:synthetic-host-read').toString('base64'));
    for(const url of ['http://github.com/example/private.git','https://github.com.evil.invalid/private.git','https://example.invalid/private.git']){
      const other=lookup(url);assert.equal(other.status,1,other.stderr);assert.equal(other.stdout,'');
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('release bump performs real HTTP Git fetches without persisting or forwarding workflow credentials',{timeout:20000},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'release-bump-http-'));
  const cleanSource={...process.env,CODEX_SAFE_FAMILY_READ_TOKEN:undefined,GITHUB_TOKEN:undefined,GH_TOKEN:undefined};
  const fixtureGit=args=>execFileSync('git',args,{cwd:dir,env:releaseBumpGitEnvironment(cleanSource),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  let server;
  try{
    fixtureGit(['init','--quiet','--initial-branch=main']);fixtureGit(['config','user.name','Release Bump Fixture']);fixtureGit(['config','user.email','fixture@example.invalid']);
    const writeVersion=version=>{
      fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version}));
      fs.writeFileSync(path.join(dir,'product-contract.json'),JSON.stringify({productVersion:version,serviceVersion:version}));
      fs.writeFileSync(path.join(dir,'CHANGELOG.md'),'# Changelog\n\n## '+version+'\n');
    };
    writeVersion('1.2.3');fixtureGit(['add','package.json','product-contract.json','CHANGELOG.md']);fixtureGit(['update-index','--add','--cacheinfo','160000,'+'a'.repeat(40)+',src/codex-safe-core']);fixtureGit(['commit','--quiet','-m','base']);fixtureGit(['update-server-info']);
    const files=new Map(),gitDir=path.join(dir,'.git'),requests=[];
    const preload=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name);
      if(entry.isDirectory())preload(file);
      else if(entry.isFile())files.set('/fixture.git/'+path.relative(gitDir,file).split(path.sep).join('/'),fs.readFileSync(file));
    }};
    preload(gitDir);
    server=http.createServer((request,response)=>{
      requests.push({path:request.url,authorization:request.headers.authorization});
      const body=files.get(new URL(request.url,'http://fixture.invalid').pathname);
      response.writeHead(body===undefined?404:200,{'Content-Type':'application/octet-stream'});response.end(body);
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    fixtureGit(['remote','add','origin',`http://127.0.0.1:${server.address().port}/fixture.git`]);
    const invoke=(token='synthetic-workflow-read')=>promisify(execFile)(process.execPath,[path.join(root,'scripts','verify-consumer-release-bump.js')],{cwd:dir,env:{...cleanSource,GITHUB_BASE_REF:'main',GITHUB_TOKEN:token,GIT_TRACE:'1'},encoding:'utf8',timeout:15000});
    const unchanged=await invoke('');assert.deepEqual(JSON.parse(unchanged.stdout),{changed:false,reason:'core-pin-unchanged'});
    writeVersion('1.2.4');fixtureGit(['add','package.json','product-contract.json','CHANGELOG.md']);fixtureGit(['update-index','--cacheinfo','160000,'+'b'.repeat(40)+',src/codex-safe-core']);fixtureGit(['commit','--quiet','-m','repin']);
    const changed=await invoke();assert.deepEqual(JSON.parse(changed.stdout),{changed:true,before:'1.2.3',after:'1.2.4'});
    writeVersion('1.2.5');fixtureGit(['add','package.json','product-contract.json','CHANGELOG.md']);fixtureGit(['commit','--quiet','-m','invalid release jump']);
    await assert.rejects(invoke(),error=>error.code===1&&/product version must advance by one valid SemVer release/.test(error.stderr));
    assert.ok(requests.some(request=>request.path.startsWith('/fixture.git/info/refs')));
    assert.ok(requests.every(request=>request.authorization===undefined));
    assert.doesNotMatch(unchanged.stderr+changed.stderr,/synthetic-workflow-read|AUTHORIZATION|trace:/i);
    assert.doesNotMatch(fs.readFileSync(path.join(gitDir,'config'),'utf8'),/synthetic-workflow-read|AUTHORIZATION|extraheader/i);
  }finally{
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
