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
const {CURRENT_STATE_DOCS,syncCurrentIdentityText}=require('../scripts/repin-consumer');

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
