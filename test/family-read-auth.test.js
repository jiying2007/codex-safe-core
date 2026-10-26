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
  const yaml=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-release-guard.yml'),'utf8');
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
