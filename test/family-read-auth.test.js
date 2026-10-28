'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {repositoryJson,inspectConsumer,downloadJson,releaseAssets}=require('../scripts/family-release-state');
const commit='a'.repeat(40);
function contents(value){const data=Buffer.from(JSON.stringify(value));return{type:'file',encoding:'base64',content:data.toString('base64'),size:data.length,sha:crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')};}
test('exact private repository file reads use the authenticated Contents API',async()=>{
  const original=global.fetch,seen=[];
  global.fetch=async(url,options)=>{seen.push({url:String(url),options});return Response.json(contents({version:'7.6.2'}));};
  try{
    assert.deepEqual(await repositoryJson('codex-review-service',commit,'package.json',{token:'synthetic-read-token'}),{version:'7.6.2'});
    assert.equal(seen.length,1);assert.match(seen[0].url,new RegExp(`/contents/package.json\\?ref=${commit}$`));
    assert.equal(seen[0].options.headers.authorization,'Bearer synthetic-read-token');assert.equal(seen[0].options.redirect,'error');
    await assert.rejects(repositoryJson('codex-review-service','main','package.json',{token:'synthetic-read-token'}),/exact commit/);
  }finally{global.fetch=original;}
});
test('consumer inspection forwards explicit authentication to both private JSON reads',async()=>{
  const original=global.fetch,seen=[];
  global.fetch=async(url,options)=>{
    seen.push({url:String(url),authorization:options.headers.authorization});
    if(String(url).includes('/commits/main'))return Response.json({sha:commit});
    if(String(url).includes('/contents/package.json'))return Response.json(contents({version:'7.6.2'}));
    if(String(url).includes('/contents/product-contract.json'))return Response.json(contents({productId:'codex-review-service'}));
    return Response.json({}, {status:404});
  };
  try{
    await assert.rejects(inspectConsumer('codex-review-service',{}, {token:'synthetic-read-token'}));
    assert.equal(seen.filter(item=>item.url.includes('/contents/')).length,3);
    assert.ok(seen.every(item=>item.authorization==='Bearer synthetic-read-token'));
    assert.ok(seen.every(item=>item.url.startsWith('https://api.github.com/')));
  }finally{global.fetch=original;}
});
test('repository contents fail closed on a truncated or substituted blob',async()=>{
  const original=global.fetch;
  try{for(const malformed of [{...contents({ok:true}),size:1},{...contents({ok:true}),sha:'0'.repeat(40)},{...contents({ok:true}),type:'symlink'}]){
    global.fetch=async()=>Response.json(malformed);
    await assert.rejects(repositoryJson('codex-review-service',commit,'package.json',{token:'synthetic-read-token'}));
  }}finally{global.fetch=original;}
});
test('private release assets use their API URL and drop authentication at CDN redirects',async()=>{
  const original=global.fetch,seen=[];
  const asset=releaseAssets({assets:[{name:'receipt.json',url:'https://api.github.com/repos/jiying2007/codex-review-service/releases/assets/1',browser_download_url:'https://github.com/jiying2007/codex-review-service/releases/download/v1/receipt.json'}]})[0];
  global.fetch=async(url,options)=>{
    seen.push({url:String(url),headers:options.headers});
    if(seen.length===1)return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/signed'}});
    if(seen.length===2)return new Response(null,{status:302,headers:{location:asset.apiUrl+'?return=1'}});
    return Response.json({ok:true});
  };
  try{assert.deepEqual(await downloadJson(asset.apiUrl,'synthetic-read-token'),{ok:true});assert.equal(seen[0].headers.authorization,'Bearer synthetic-read-token');assert.equal(seen[1].headers.authorization,undefined);assert.equal(seen[2].headers.authorization,undefined);}
  finally{global.fetch=original;}
});

test('private Family credential is isolated from PR code and bound to immutable Core admission',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const yaml=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-release-guard.yml'),'utf8').replace(/\r\n/g,'\n');
  const parts=yaml.split('\n  private-governance:\n');
  assert.equal(parts.length,2,'trusted remote audit must run in a separate reusable workflow job');
  const [candidateJob,privateJob]=parts;
  assert.match(candidateJob,/^jobs:\n  guard:/m);
  assert.doesNotMatch(candidateJob,/secrets\.CODEX_SAFE_FAMILY_READ_TOKEN/,'candidate-controlled PR code must not receive the private token');
  assert.match(privateJob,/needs: guard/);
  assert.match(privateJob,/contents\/core-contract\.json\?ref/);
  assert.match(privateJob,/releases\/tags\//);
  assert.match(privateJob,/immutable!==true/);
  assert.match(privateJob,/object\.sha!==expected/);
  assert.match(privateJob,/repository: jiying2007\/codex-safe-core/);
  const use=privateJob.indexOf('Verify actual family Rulesets with scoped private read identity');
  assert.ok(use>0);
  assert.doesNotMatch(privateJob.slice(0,use),/secrets\.CODEX_SAFE_FAMILY_READ_TOKEN/,'Core identity must be verified before the private token is exposed');
  assert.match(privateJob.slice(use),/secrets\.CODEX_SAFE_FAMILY_READ_TOKEN \|\| github\.token/);
  assert.doesNotMatch(privateJob,/persist-credentials: true/);
});

test('private Core admission executes and rejects invalid immutable-release evidence before revealing secrets',{timeout:6000},async()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-release-guard.yml'),'utf8').replace(/\r\n/g,'\n');
  const title='- name: Admit only an immutable released Core commit without private credentials';
  const section=workflow.slice(workflow.indexOf(title));
  assert.ok(section.startsWith(title));
  const match=section.match(/          node - <<'NODE'\n([\s\S]*?)          NODE/);
  assert.ok(match,'privileged admission must contain executable source owned by immutable workflow');
  const script=match[1].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
  const sha='a'.repeat(40),contract=Buffer.from(JSON.stringify({coreVersion:'4.18.2'}));
  async function execute({immutable=true,tagSha=sha}={}){
    const calls=[];
    let finished;
    const result=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Core admission did not settle')),2000);
      const done=(ok,value)=>{clearTimeout(timer);resolve({ok,value,calls});};
      const context={
        Buffer,AbortSignal,
        process:{env:{EXPECTED_CORE_SHA:sha,PUBLIC_GITHUB_TOKEN:'synthetic-public-token'},stdout:{write:value=>done(true,value)},exitCode:0},
        console:{error:error=>done(false,String(error))},
        fetch:async(url,options)=>{
          calls.push({url:String(url),credential:options.headers.authorization||null});
          let response;
          if(String(url).includes('/contents/core-contract.json?ref='))response={type:'file',encoding:'base64',content:contract.toString('base64'),size:contract.length};
          else if(String(url).includes('/releases/tags/v4.18.2'))response={tag_name:'v4.18.2',immutable,draft:false,prerelease:false};
          else if(String(url).includes('/git/ref/tags/v4.18.2'))response={object:{type:'commit',sha:tagSha}};
          else throw Error('Unexpected Core release evidence URL: '+url);
          return{ok:true,status:200,json:async()=>response};
        }
      };
      try{vm.runInNewContext(script,context,{timeout:1000});}catch(error){clearTimeout(timer);reject(error);}
    });
    return result;
  }
  const valid=await execute();
  assert.equal(valid.ok,true,valid.value);
  assert.equal(valid.calls.length,3);
  assert.ok(valid.calls.every(call=>call.credential==='Bearer synthetic-public-token'));
  const tampered=await execute({tagSha:'b'.repeat(40)});
  assert.equal(tampered.ok,false);
  assert.match(tampered.value,/does not point to the requested exact SHA/);
  const mutable=await execute({immutable:false});
  assert.equal(mutable.ok,false);
  assert.match(mutable.value,/not an immutable final release/);
});


test('scheduled private Family readers fail before checkout when the scoped credential is absent',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const workflows=['family-freshness.yml','family-status.yml','repository-governance.yml','family-ci.yml'];
  for(const name of workflows){
    const text=fs.readFileSync(path.join(__dirname,'..','.github','workflows',name),'utf8').replace(/\r\n/g,'\n');
    const firstCheckout=text.indexOf('      - uses: actions/checkout@');
    assert.ok(firstCheckout>0,name+': requires a first checkout');
    const prefix=text.slice(0,firstCheckout);
    assert.match(prefix,/      - name: Require scoped private Family read credential before checkout\n/);
    assert.match(prefix,/FAMILY_READ_TOKEN: \$\{\{ secrets\.CODEX_SAFE_FAMILY_READ_TOKEN \}\}/);
    assert.match(prefix,/if \[ -z "\$FAMILY_READ_TOKEN" \]; then/);
    assert.match(prefix,/Missing CODEX_SAFE_FAMILY_READ_TOKEN/);
    assert.match(prefix,/^\s+exit 2\s*$/m);
    assert.doesNotMatch(prefix,/set -x|printenv|echo "\$FAMILY_READ_TOKEN"/,'preflight must never log the credential');
    assert.match(text,/GITHUB_TOKEN: \$\{\{ secrets\.CODEX_SAFE_FAMILY_READ_TOKEN \}\}/);
    assert.doesNotMatch(text,/GITHUB_TOKEN: \$\{\{ secrets\.CODEX_SAFE_FAMILY_READ_TOKEN \|\| github\.token \}\}/,'private checks must not silently use a repository-scoped token');
  }
});
