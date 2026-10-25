'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {execFile,execFileSync,spawn}=require('node:child_process');
const {promisify}=require('node:util');
const {familyGitEnvironment}=require('../scripts/family-read-auth');
const {runUpgradeCommand,upgradeGitEnvironment}=require('../scripts/family-upgrade-git');
const root=path.resolve(__dirname,'..');

test('upgrade Git and repin keep the existing bot scope, remove raw secrets and propagate child status',()=>{
  const source={PATH:process.env.PATH,GH_TOKEN:'synthetic-upgrade-write',GITHUB_TOKEN:'unrelated-token',CODEX_SAFE_FAMILY_READ_TOKEN:'synthetic-read-only',FAMILY_BOT_TOKEN:'synthetic-upgrade-write',GIT_TRACE_CURL:'1',GIT_AUTHOR_NAME:'fixture-author'};
  for(const mode of ['git','repin']){
    let invocation;
    const status=runUpgradeCommand(mode,['target','a'.repeat(40)],{source,execute:(command,args,options)=>{invocation={command,args,options};return{status:7};}});
    assert.equal(status,7);assert.equal(invocation.options.stdio,'inherit');
    assert.equal(invocation.command,mode==='git'?'git':process.execPath);
    if(mode==='repin')assert.equal(invocation.args[0],path.join(root,'scripts','repin-consumer.js'));
    assert.ok(invocation.args.every(argument=>!argument.includes('synthetic-')));
    const env=invocation.options.env;
    for(const key of ['GH_TOKEN','GITHUB_TOKEN','CODEX_SAFE_FAMILY_READ_TOKEN','FAMILY_BOT_TOKEN','GIT_TRACE_CURL'])assert.equal(env[key],undefined);
    assert.equal(env.GIT_CONFIG_KEY_5,'http.https://github.com/.extraheader');
    assert.equal(env.GIT_CONFIG_VALUE_5,'AUTHORIZATION: basic '+Buffer.from('x-access-token:synthetic-upgrade-write').toString('base64'));
    assert.equal(env.GIT_AUTHOR_NAME,'fixture-author');assert.equal(env.GIT_CONFIG_VALUE_2,'false');
  }
  assert.equal(source.GH_TOKEN,'synthetic-upgrade-write');
  assert.equal(runUpgradeCommand('git',[],{source,execute:()=>({status:null,signal:'SIGTERM'})}),1);
});

test('upgrade Git rejects missing bot credentials and unknown modes without spawning',()=>{
  const execute=()=>assert.fail('invalid invocation must not spawn');
  assert.throws(()=>runUpgradeCommand('git',[],{source:{CODEX_SAFE_FAMILY_READ_TOKEN:'synthetic-read-only'},execute}),/requires its existing GH_TOKEN/);
  assert.throws(()=>runUpgradeCommand('unknown',[],{source:{GH_TOKEN:'synthetic-upgrade-write'},execute}),/Expected git or repin/);
  assert.throws(()=>upgradeGitEnvironment({GH_TOKEN:'bad\ncredential'}),/Invalid Family read credential/);
});

test('upgrade runner performs real HTTP Git clone, fetch and lease-protected push without persisting credentials',{timeout:30000},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'family-upgrade-http-'));
  const upstream=path.join(dir,'upstream.git'),first=path.join(dir,'first'),second=path.join(dir,'second');
  const source={...process.env,GH_TOKEN:'synthetic-upgrade-write',GITHUB_TOKEN:undefined,CODEX_SAFE_FAMILY_READ_TOKEN:'synthetic-read-only',FAMILY_BOT_TOKEN:undefined,GIT_TRACE:'1',GIT_AUTHOR_NAME:'Family Upgrade Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Family Upgrade Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',LC_ALL:'C',LANG:'C'};
  const backendEnv=familyGitEnvironment({...source,GH_TOKEN:undefined,CODEX_SAFE_FAMILY_READ_TOKEN:undefined});
  const setup=args=>execFileSync('git',args,{cwd:dir,env:backendEnv,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const commands=[],requests=[],backendErrors=[],children=new Set();
  let server;
  try{
    setup(['init','--quiet','--bare','--initial-branch=main',upstream]);setup(['--git-dir',upstream,'config','http.receivepack','true']);
    server=http.createServer((request,response)=>{
      const url=new URL(request.url,'http://fixture.invalid');
      requests.push({path:url.pathname,authorization:request.headers.authorization});
      const child=spawn('git',['http-backend'],{env:{...backendEnv,GIT_PROJECT_ROOT:dir,GIT_HTTP_EXPORT_ALL:'1',PATH_INFO:url.pathname,QUERY_STRING:url.search.slice(1),REQUEST_METHOD:request.method,CONTENT_TYPE:request.headers['content-type']||'',CONTENT_LENGTH:request.headers['content-length']||'',HTTP_GIT_PROTOCOL:request.headers['git-protocol']||'',REMOTE_ADDR:'127.0.0.1'},stdio:['pipe','pipe','pipe']});
      children.add(child);let header=Buffer.alloc(0),started=false,stderr='';
      child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8');});
      child.stdin.on('error',()=>{});request.pipe(child.stdin);
      child.stdout.on('data',chunk=>{
        if(started){response.write(chunk);return;}
        header=Buffer.concat([header,chunk]);let end=header.indexOf('\r\n\r\n'),separator=4;
        if(end<0){end=header.indexOf('\n\n');separator=2;}
        if(end<0){if(header.length>65536){backendErrors.push('oversized CGI headers');child.kill();}return;}
        for(const line of header.subarray(0,end).toString('utf8').split(/\r?\n/)){
          if(/^Status: [0-9]{3}\b/i.test(line))response.statusCode=Number(line.slice(8,11));
          else if(/^Content-Type:/i.test(line))response.setHeader('Content-Type',line.slice(13).trim());
        }
        started=true;response.write(header.subarray(end+separator));header=Buffer.alloc(0);
      });
      child.once('error',error=>{backendErrors.push(error.code);if(!response.headersSent)response.statusCode=500;response.end();});
      child.once('close',code=>{children.delete(child);if(code!==0)backendErrors.push(stderr||`backend status ${code}`);if(!started&&!response.headersSent)response.statusCode=500;response.end();});
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const url=`http://127.0.0.1:${server.address().port}/upstream.git`;
    const git=async args=>{commands.push([...args]);return promisify(execFile)(process.execPath,[path.join(root,'scripts','family-upgrade-git.js'),'git',...args],{cwd:dir,env:source,encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024});};
    const outputs=[];
    outputs.push(await git(['clone','--quiet',url,first]));
    fs.writeFileSync(path.join(first,'README.md'),'base\n');
    await git(['-C',first,'add','README.md']);outputs.push(await git(['-C',first,'commit','--quiet','-m','base']));
    outputs.push(await git(['-C',first,'push','--force-with-lease','origin','main']));
    outputs.push(await git(['clone','--quiet',url,second]));
    fs.writeFileSync(path.join(first,'README.md'),'remote advance\n');await git(['-C',first,'add','README.md']);await git(['-C',first,'commit','--quiet','-m','advance']);
    outputs.push(await git(['-C',first,'push','--force-with-lease','origin','main']));
    const advanced=(await git(['-C',first,'rev-parse','HEAD'])).stdout.trim();
    fs.writeFileSync(path.join(second,'other.md'),'stale branch\n');await git(['-C',second,'add','other.md']);await git(['-C',second,'commit','--quiet','-m','stale']);
    await assert.rejects(git(['-C',second,'push','--force-with-lease','origin','main']),error=>error.code===1&&/stale info/.test(error.stderr));
    assert.equal(setup(['--git-dir',upstream,'rev-parse','refs/heads/main']),advanced);
    outputs.push(await git(['-C',second,'fetch','origin','main']));
    assert.equal((await git(['-C',second,'rev-parse','origin/main'])).stdout.trim(),advanced);
    assert.equal((await git(['-C',second,'remote','get-url','origin'])).stdout.trim(),url);
    assert.ok(requests.some(request=>request.path.endsWith('/git-upload-pack')));assert.ok(requests.some(request=>request.path.endsWith('/git-receive-pack')));
    assert.ok(requests.every(request=>request.authorization===undefined));assert.deepEqual(backendErrors,[]);
    for(const checkout of [first,second])assert.doesNotMatch(fs.readFileSync(path.join(checkout,'.git','config'),'utf8'),/synthetic-|AUTHORIZATION|extraheader/i);
    assert.doesNotMatch(outputs.map(value=>value.stdout+value.stderr).join('\n'),/synthetic-|AUTHORIZATION|trace:/i);
    assert.ok(commands.flat().every(argument=>!argument.includes('synthetic-')));
  }finally{
    for(const child of children)child.kill();
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
