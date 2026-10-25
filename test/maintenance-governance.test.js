'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {CURRENT_CONTRACT_TESTS,CURRENT_STATE_DOCS,bumpPatch,prependChangelog,readOptionalText,repinConsumer,shouldSkipRuntimeEquivalentRepin,syncContractTestText,syncCurrentIdentityText,syncProductVersionAliases,syncReusableWorkflowPins,syncVerifierText,updatePackageVersion}=require('../scripts/repin-consumer');
const {computeCoreDigests}=require('../scripts/core-digests');

const root = path.resolve(__dirname, '..');
const contributing = fs.readFileSync(path.join(root, 'CONTRIBUTING.md'), 'utf8');

test('maintenance flow is coordinated across all five active consumers', () => {
  for (const name of ['Codex Change Safe','Codex Review Safe','Codex Commit Safe','Codex Review Service','Codex Diagnose Safe']) assert.match(contributing, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(contributing, /Codex PR Safe remains retired/i);
  assert.match(contributing, /one exact Core commit/i);
  assert.match(contributing, /coordinated repin/i);
  assert.match(contributing, /Policy Schema v4/);
});

test('obsolete copied-runtime and parallel policy instructions cannot return', () => {
  assert.doesNotMatch(contributing, /scripts\/safe-core\.js\s+sync/);
  assert.match(contributing, /Branch tracking and copied-runtime synchronization are forbidden\./);
  assert.match(contributing,/single repository policy is `\.codex-safe\.json`/i);
  assert.match(contributing,/Do not add parallel product policy files/i);
});

test('every actual Core gitlink change remains release-bearing and requires a consumer patch version', () => {
  assert.match(contributing, /every Core gitlink change requires a consumer patch release/i);
  assert.match(contributing, /immutable release/i);
  assert.equal(bumpPatch('4.7.2'),'4.7.3');
});

test('release-bearing repin synchronizes existing product version aliases only',()=>{
  const service=syncProductVersionAliases({productVersion:'7.4.2',serviceVersion:'7.4.1',databaseSchemaVersion:8},'7.4.2');
  assert.equal(service.serviceVersion,'7.4.2');
  assert.equal(service.databaseSchemaVersion,8);
  const diagnose=syncProductVersionAliases({productVersion:'1.4.3',diagnoseVersion:'1.4.2',diagnosisReceiptVersion:2},'1.4.3');
  assert.equal(diagnose.diagnoseVersion,'1.4.3');
  assert.equal(diagnose.diagnosisReceiptVersion,2);
  const generic=syncProductVersionAliases({productVersion:'4.7.3',reviewReceiptVersion:5},'4.7.3');
  assert.equal(Object.prototype.hasOwnProperty.call(generic,'serviceVersion'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(generic,'diagnoseVersion'),false);
});

test('exact pin mode may replace a runtime-equivalent prerelease SHA without a product bump',()=>{assert.equal(shouldSkipRuntimeEquivalentRepin({coreChanged:true,runtimeChanged:false}),true);assert.equal(shouldSkipRuntimeEquivalentRepin({coreChanged:true,runtimeChanged:false,exactPin:true}),false);});
test('optional repin inputs are bounded regular files and only absence is skipped',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repin-optional-read-'));
  try{
    const file=path.join(dir,'product-contract.json');
    assert.equal(readOptionalText(file),null);
    fs.writeFileSync(file,'');assert.equal(readOptionalText(file),'');
    fs.writeFileSync(file,'{"ok":true}\n');assert.equal(readOptionalText(file),'{"ok":true}\n');
    assert.throws(()=>readOptionalText(dir),error=>error?.code==='ELOCALFILE');
    fs.truncateSync(file,16*1024*1024+1);
    assert.throws(()=>readOptionalText(file),error=>error?.code==='ELOCALFILE');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('repin refuses symlink inputs without modifying their targets',{skip:process.platform==='win32'},()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repin-no-follow-'));
  try{
    const target=path.join(dir,'outside.json'),packagePath=path.join(dir,'package.json'),lockPath=path.join(dir,'package-lock.json');
    fs.writeFileSync(target,'{"version":"1.0.0"}\n');fs.writeFileSync(packagePath,'{"version":"1.0.0"}\n');
    fs.symlinkSync(target,lockPath);
    assert.throws(()=>readOptionalText(lockPath),error=>error?.code==='ELOCALFILE');
    assert.throws(()=>updatePackageVersion(dir,'1.0.1'),error=>error?.code==='ELOCALFILE');
    assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).version,'1.0.0');
    assert.equal(JSON.parse(fs.readFileSync(packagePath,'utf8')).version,'1.0.0');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('package repin replaces files atomically, preserves modes and does not create optional inputs',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repin-package-write-'));
  try{
    const file=path.join(dir,'package.json'),alias=path.join(dir,'original-package.json'),lock=path.join(dir,'package-lock.json');
    fs.writeFileSync(file,'{"version":"1.0.0"}\n');fs.linkSync(file,alias);
    updatePackageVersion(dir,'1.0.1');
    assert.equal(JSON.parse(fs.readFileSync(alias,'utf8')).version,'1.0.0');
    // Exclusive creation also proves repin did not create this optional input.
    fs.writeFileSync(lock,JSON.stringify({version:'1.0.1',packages:{'':{version:'1.0.1'}}}),{flag:'wx'});
    if(process.platform!=='win32'){fs.chmodSync(file,0o644);fs.chmodSync(lock,0o664);}
    updatePackageVersion(dir,'1.0.2');
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).version,'1.0.2');
    const value=JSON.parse(fs.readFileSync(lock,'utf8'));assert.equal(value.version,'1.0.2');assert.equal(value.packages[''].version,'1.0.2');
    if(process.platform!=='win32'){assert.equal(fs.statSync(file).mode&0o777,0o644);assert.equal(fs.statSync(lock).mode&0o777,0o664);}
    prependChangelog(dir,{newProductVersion:'1.0.2',newCoreVersion:'4.18.2',runtimeDigest:'a'.repeat(64)});
    assert.equal(fs.existsSync(path.join(dir,'CHANGELOG.md')),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('failed atomic repin leaves the existing file intact and removes its temporary output',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repin-write-failure-')),rename=fs.renameSync;
  try{
    const file=path.join(dir,'package.json'),before='{"version":"1.0.0"}\n';fs.writeFileSync(file,before);
    fs.renameSync=(source,target)=>{if(target===file)throw Object.assign(new Error('injected replacement failure'),{code:'EACCES'});return rename(source,target);};
    assert.throws(()=>updatePackageVersion(dir,'1.0.1'),error=>error?.code==='EACCES');
    assert.equal(fs.readFileSync(file,'utf8'),before);
    assert.deepEqual(fs.readdirSync(dir),['package.json']);
  }finally{fs.renameSync=rename;fs.rmSync(dir,{recursive:true,force:true});}
});

test('two-phase coordinated upgrade validates all runtime-changing PRs before merge and then waits for durable release evidence', () => {
  const workflow=fs.readFileSync(path.join(root,'.github','workflows','family-upgrade.yml'),'utf8');
  assert.match(workflow,/Phase 1 - prepare every runtime-changing consumer PR/i);
  assert.match(workflow,/validate all prepared PRs before any merge/i);
  assert.match(workflow,/Phase 2 - merge frozen validated heads/i);
  assert.match(workflow,/node scripts\/family-upgrade-pr\.js validate/);
  assert.match(workflow,/node scripts\/family-upgrade-pr\.js merge/);
  assert.match(fs.readFileSync(path.join(root,'scripts','family-upgrade-pr.js'),'utf8'),/--match-head-commit/);
  assert.match(workflow,/runtime-equivalent; no product repin\/release required/i);
  assert.match(workflow,/existing upgrade PR #\$pr is already materialized; resuming transaction/i);
  assert.match(workflow,/FAMILY_UPGRADE_STATE\.json/);
  const releaseStateCalls=workflow.match(/node scripts\/family-release-state\.js/g)||[];
  assert.equal(releaseStateCalls.length,1);
  assert.doesNotMatch(workflow,/family-release-state\.js --repo/);
  assert.match(workflow,/for attempt in \{1\.\.60\}/);
  assert.match(workflow,/transient Family release-state query failure/i);
  assert.match(workflow,/exact immutable consumer releases and required distribution/i);
  assert.match(workflow,/release \+ distribution \+ runtime readiness/i);
  assert.match(workflow,/gh workflow run "Family Freshness"/);
  assert.doesNotMatch(workflow,/gh workflow run "Family Compatibility"/);
});

test('trusted immutable Core release dispatches the coordinated Family Upgrade',()=>{const trusted=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8');assert.match(trusted,/Dispatch coordinated active-consumer upgrade/);assert.match(trusted,/gh workflow run "Family Upgrade"/);assert.match(trusted,/FAMILY_BOT_TOKEN/);});

test('repin synchronizes current Change verifier constants across Core patches',()=>{const oldSha='a'.repeat(40),sha='b'.repeat(40),text=`const core='${oldSha}';if(contract.safeCoreVersion!=='4.12.3'||contract.safeCoreCommit!==core)fail('family Core pin must remain exact');`,out=syncVerifierText(text,{sha,version:'4.12.4'});assert.match(out,new RegExp(`const core='${sha}'`));assert.match(out,/contract\.safeCoreVersion!=='4\.12\.4'/);assert.doesNotMatch(out,/4\.12\.3/);});
test('repin synchronizes derived Core assertions, runtime digest and reusable workflow pins',t=>{
  const old='a'.repeat(40),runtime='c'.repeat(64);
  const {directory:dir,file,targetGuardSha:sha}=callerFixture(t,'','on:\n  workflow_call:\n');
  const text=`const expectedCore=productContract.safeCoreCommit;assert.strictEqual(expectedCore,'${old}');assert.strictEqual(productContract.safeCoreRuntimeDigest,'${'d'.repeat(64)}');assert.match(marketplace,/distribution-receipt\\.yml@${old}/);`;
  const out=syncVerifierText(text,{sha,version:'4.18.0',runtimeDigest:runtime});
  assert.equal((out.match(new RegExp(sha,'g'))||[]).length,2);assert.match(out,new RegExp(runtime));
  fs.writeFileSync(file,`uses: jiying2007/codex-safe-core/.github/workflows/family-release-guard.yml@${old}\nwith:\n  expected_core_sha: ${old}\nreceipt: jiying2007/codex-safe-core/.github/workflows/distribution-receipt.yml@${old}\nintegrity: jiying2007/codex-safe-core/.github/workflows/consumer-release-integrity.yml@${old}\n`);
  syncReusableWorkflowPins(dir,sha);
  const value=fs.readFileSync(file,'utf8');assert.equal((value.match(new RegExp(sha,'g'))||[]).length,3);
  assert.match(value,new RegExp(`consumer-release-integrity\\.yml@${old}`));
});
test('repin synchronizes current docs without rewriting unrelated historical versions',()=>{const oldSha='a'.repeat(40),newSha='b'.repeat(40),text=`Codex Safe Core v4.12.3 current ${oldSha}; migration from Core 4.9.0 stays historical.`,out=syncCurrentIdentityText(text,{oldSha,newSha,oldVersion:'4.12.3',newVersion:'4.12.4'});assert.match(out,/Codex Safe Core v4\.12\.4/);assert.match(out,new RegExp(newSha));assert.match(out,/Core 4\.9\.0 stays historical/);for(const required of ['docs/DEPLOYMENT.md','docs/DEPLOYMENT.zh-CN.md','OPERATIONS.md','docs/GETTING_STARTED.md'])assert.ok(CURRENT_STATE_DOCS.includes(required),`missing current-state repin path: ${required}`);assert.equal(CURRENT_STATE_DOCS.includes('docs/OPERATIONS.md'),false);});
test('repin updates bilingual exact-commit slash-version identity without touching unrelated history',()=>{
  const oldSha='a'.repeat(40),newSha='b'.repeat(40),text=[
    `- Safe Core: exact commit \`${oldSha}\` / v4.18.1`,
    `- Safe Core：精确提交 \`${oldSha}\` / v4.18.1`,
    'Migration from Core 4.9.0 stays historical.',
    'Historical artifact / v4.18.1'
  ].join('\n');
  const value=syncCurrentIdentityText(text,{oldSha,newSha,oldVersion:'4.18.1',newVersion:'4.18.2'});
  assert.equal((value.match(/\/ v4\.18\.2/g)||[]).length,2);
  assert.equal((value.match(new RegExp(newSha,'g'))||[]).length,2);
  assert.match(value,/Core 4\.9\.0 stays historical/);assert.match(value,/Historical artifact \/ v4\.18\.1/);
});
test('a real local consumer repin preserves release semantics and every edited file mode',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repin-consumer-integration-')),upstream=path.join(dir,'upstream'),consumer=path.join(dir,'consumer');
  const git=(cwd,...args)=>execFileSync('git',['-c','protocol.file.allow=always','-c','commit.gpgsign=false',...args],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).trim();
  const write=(file,text,mode=0o644)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);if(process.platform!=='win32')fs.chmodSync(file,mode);};
  const json=(file,value,mode)=>write(file,JSON.stringify(value,null,2)+'\n',mode);
  const init=directory=>{fs.mkdirSync(directory,{recursive:true});git(directory,'init','--quiet');git(directory,'config','user.name','Repin Fixture');git(directory,'config','user.email','fixture@example.invalid');};
  try{
    init(upstream);
    const contract={...JSON.parse(fs.readFileSync(path.join(root,'core-contract.json'),'utf8')),coreVersion:'4.18.1'};
    json(path.join(upstream,'core-contract.json'),contract);
    json(path.join(upstream,'core-surface-manifest.json'),{schemaVersion:1,runtimeFiles:['index.js'],runtimeContractKeys:['safeCoreMajorVersion','safeContractVersion','policySchemaVersion']});
    write(path.join(upstream,'index.js'),'module.exports = 1;\n');
    const oldGuard='on:\n  workflow_call:\n    inputs:\n      product:\n        type: string\n';
    write(path.join(upstream,'.github/workflows/family-release-guard.yml'),oldGuard);
    git(upstream,'add','.');git(upstream,'commit','--quiet','-m','original');const oldSha=git(upstream,'rev-parse','HEAD');
    json(path.join(upstream,'core-contract.json'),{...contract,coreVersion:'4.18.2'});write(path.join(upstream,'index.js'),'module.exports = 2;\n');
    write(path.join(upstream,'.github/workflows/family-release-guard.yml'),'on:\n  workflow_call:\n    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN:\n        required: false\n');
    git(upstream,'add','.');git(upstream,'commit','--quiet','-m','runtime update');const newSha=git(upstream,'rev-parse','HEAD');
    init(consumer);git(consumer,'submodule','add','--quiet',upstream,'src/codex-safe-core');
    const sub=path.join(consumer,'src','codex-safe-core');git(sub,'checkout','--quiet','--detach',oldSha);
    const oldDigests=computeCoreDigests(sub);
    json(path.join(consumer,'package.json'),{name:'repin-fixture',version:'1.0.0'});
    json(path.join(consumer,'package-lock.json'),{name:'repin-fixture',version:'1.0.0',packages:{'':{version:'1.0.0'}}},0o664);
    json(path.join(consumer,'product-contract.json'),{productId:'fixture',productVersion:'1.0.0',serviceVersion:'1.0.0',safeCoreCommit:oldSha,safeCoreVersion:'4.18.1',safeCoreRuntimeDigest:oldDigests.runtimeDigest});
    json(path.join(consumer,'.codex-safe.example.json'),{schemaVersion:3,$schema:`https://raw.githubusercontent.com/jiying2007/codex-safe-core/${oldSha}/codex-safe.schema.json`},0o640);
    write(path.join(consumer,'scripts/verify-manifest.js'),`#!/usr/bin/env node\nconst core='${oldSha}';\nif(contract.safeCoreVersion!=='4.18.1')throw new Error('drift');\n`,0o755);
    write(path.join(consumer,'.github/workflows/guard.yml'),`jobs:\n  family-release-guard:\n    uses: jiying2007/codex-safe-core/.github/workflows/family-release-guard.yml@${oldSha}\n    with:\n      product: fixture\n      expected_core_sha: ${oldSha}\n`,0o664);
    write(path.join(consumer,'README.zh-CN.md'),`- Safe Core：精确提交 \`${oldSha}\` / v4.18.1\n`);
    write(path.join(consumer,'CHANGELOG.md'),'# Changelog\n\n## 1.0.0\n\n- Original.\n');
    git(consumer,'add','.');git(consumer,'commit','--quiet','-m','consumer original');
    const beforeFiles=['package.json','package-lock.json','product-contract.json','.codex-safe.example.json','scripts/verify-manifest.js','.github/workflows/guard.yml','README.zh-CN.md','CHANGELOG.md'];
    const beforeContents=beforeFiles.map(file=>fs.readFileSync(path.join(consumer,file),'utf8'));
    const localCallee=path.join(sub,'.github/workflows/family-release-guard.yml');
    const checkedOutCallee=fs.readFileSync(localCallee,'utf8');
    const editedCallee=fs.readFileSync(path.join(upstream,'.github/workflows/family-release-guard.yml'),'utf8');
    write(localCallee,editedCallee);
    assert.throws(()=>repinConsumer(consumer,oldSha,{exactPin:true}),/worktree differs from the exact commit/);
    assert.equal(fs.readFileSync(localCallee,'utf8'),editedCallee,'a same-SHA checkout must not authorize or overwrite user edits');
    assert.deepEqual(beforeFiles.map(file=>fs.readFileSync(path.join(consumer,file),'utf8')),beforeContents);
    git(sub,'restore','--worktree','--','.github/workflows/family-release-guard.yml');
    assert.equal(fs.readFileSync(localCallee,'utf8'),checkedOutCallee,'restore this test-owned fixture to its original checkout bytes');
    assert.equal(git(sub,'diff','--name-only'),'','fixture cleanup must precede the independent caller-preflight check');
    const badCaller=path.join(consumer,'.github/workflows/z-unsupported.yml');
    write(badCaller,`jobs:\n  guard:\n    uses: jiying2007/codex-safe-core/.github/workflows/family-release-guard.yml@${oldSha}\n    secrets: inherit\n`);
    assert.throws(()=>repinConsumer(consumer,newSha),/block-style secrets/);
    assert.deepEqual(beforeFiles.map(file=>fs.readFileSync(path.join(consumer,file),'utf8')),beforeContents,'workflow validation precedes every consumer file write');
    fs.rmSync(badCaller);
    const result=repinConsumer(consumer,newSha);
    assert.equal(result.runtimeChanged,true);assert.equal(result.newProductVersion,'1.0.1');assert.equal(result.skipped,false);
    assert.equal(git(sub,'rev-parse','HEAD'),newSha);
    const read=relative=>JSON.parse(fs.readFileSync(path.join(consumer,relative),'utf8'));
    assert.equal(read('package.json').version,'1.0.1');assert.equal(read('package-lock.json').packages[''].version,'1.0.1');
    assert.equal(read('product-contract.json').safeCoreCommit,newSha);assert.equal(read('product-contract.json').serviceVersion,'1.0.1');
    assert.equal(read('.codex-safe.example.json').schemaVersion,contract.policySchemaVersion);assert.match(read('.codex-safe.example.json').$schema,new RegExp(newSha));
    assert.match(fs.readFileSync(path.join(consumer,'README.zh-CN.md'),'utf8'),/\/ v4\.18\.2/);
    assert.match(fs.readFileSync(path.join(consumer,'scripts/verify-manifest.js'),'utf8'),new RegExp(newSha));
    assert.match(fs.readFileSync(path.join(consumer,'.github/workflows/guard.yml'),'utf8'),new RegExp(newSha));
    assert.match(fs.readFileSync(path.join(consumer,'.github/workflows/guard.yml'),'utf8'),/CODEX_SAFE_FAMILY_READ_TOKEN: \$\{\{ secrets\.CODEX_SAFE_FAMILY_READ_TOKEN \}\}/);
    assert.match(fs.readFileSync(path.join(consumer,'CHANGELOG.md'),'utf8'),/## 1\.0\.1/);
    if(process.platform!=='win32')for(const [relative,mode]of Object.entries({'package-lock.json':0o664,'.codex-safe.example.json':0o640,'scripts/verify-manifest.js':0o755,'.github/workflows/guard.yml':0o664}))assert.equal(fs.statSync(path.join(consumer,relative)).mode&0o777,mode,relative);
    const again=repinConsumer(consumer,newSha);assert.equal(again.newProductVersion,'1.0.1');
    json(path.join(upstream,'core-contract.json'),{...contract,coreVersion:'4.18.3'});
    git(upstream,'add','.');git(upstream,'commit','--quiet','-m','governance only');const governanceSha=git(upstream,'rev-parse','HEAD');
    const skipped=repinConsumer(consumer,governanceSha);
    assert.equal(skipped.skipped,true);assert.equal(git(sub,'rev-parse','HEAD'),newSha);
    assert.equal(read('product-contract.json').safeCoreCommit,newSha);assert.equal(read('package.json').version,'1.0.1');
    const exact=repinConsumer(consumer,governanceSha,{exactPin:true});
    assert.equal(exact.skipped,false);assert.equal(exact.runtimeChanged,false);assert.equal(exact.newProductVersion,'1.0.1');
    assert.equal(read('product-contract.json').safeCoreCommit,governanceSha);assert.equal(read('product-contract.json').safeCoreVersion,'4.18.3');
    assert.match(fs.readFileSync(path.join(consumer,'README.zh-CN.md'),'utf8'),/\/ v4\.18\.3/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('repin synchronizes Diagnose current Core contract assertion',()=>{const out=syncContractTestText("assert.equal(contract.safeCoreVersion,'4.12.3');",{oldVersion:'4.12.3',newVersion:'4.12.4'});assert.equal(out,"assert.equal(contract.safeCoreVersion,'4.12.4');");assert.ok(CURRENT_CONTRACT_TESTS.includes('test/input-manifest-contract.test.js'));});
test('dependency automation remains review-only and digest-pinned', () => {const renovate=JSON.parse(fs.readFileSync(path.join(root,'renovate.json'),'utf8'));assert.ok(renovate.extends.includes('config:best-practices'));assert.ok(renovate.extends.includes(':automergeDisabled'));assert.equal(renovate.minimumReleaseAge,'3 days');assert.equal(renovate.packageRules.every(rule=>rule.automerge===false),true);});
test('released artifacts document consumer-side attestation verification', () => {const verify=fs.readFileSync(path.join(root,'VERIFY_RELEASE.md'),'utf8');assert.match(verify,/sha256sum -c SHA256SUMS/);assert.match(verify,/gh attestation verify .* -R jiying2007\/codex-safe-core/);});
test('consumer boundary scan excludes the canonical Core submodule but still rejects consumer reimplementation', () => {const family = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-safe-family-boundary-')),repos = ['codex-pr','codex-commit','codex-review','codex-review-service','codex-diagnose'];try {for (const repo of repos) {const repoRoot = path.join(family, repo);fs.mkdirSync(path.join(repoRoot, 'src', 'codex-safe-core'), { recursive: true });fs.writeFileSync(path.join(repoRoot, 'src', 'codex-safe-core', 'context-builder.js'), 'function buildReviewEvidenceChunks() {}\n');fs.writeFileSync(path.join(repoRoot, 'src', 'consumer.js'), 'module.exports = {};\n');}const verifier = path.join(root, 'scripts', 'verify-consumer-boundaries.js'),clean = spawnSync(process.execPath, [verifier, family], { encoding: 'utf8' });assert.equal(clean.status, 0, clean.stderr || clean.stdout);fs.writeFileSync(path.join(family, 'codex-pr', 'src', 'consumer.js'), 'function buildReviewEvidenceChunks() {}\n');const violation = spawnSync(process.execPath, [verifier, family], { encoding: 'utf8' });assert.notEqual(violation.status, 0);assert.match(violation.stderr, /codex-pr reimplements Core-owned symbol buildReviewEvidenceChunks: src[\\/]consumer\.js/);} finally {fs.rmSync(family, { recursive: true, force: true });}});

const oldGuardSha='190651770a444b0693d82228afc66879dd57b0c0';
const familyGuardReference='jiying2007/codex-safe-core/.github/workflows/family-release-guard.yml';
const familyReadMapping='CODEX_SAFE_FAMILY_READ_TOKEN: ${{ secrets.CODEX_SAFE_FAMILY_READ_TOKEN }}';
const supportedGuard='on:\n  workflow_call:\n    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN:\n        required: false\n      OTHER_READ_TOKEN:\n        required: false\n';
// These are minimal equivalents of the five public Family caller contracts;
// no private consumer workflow implementation is copied into the Core tests.
function familyCaller(product,extra=''){
  return `name: CI\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  family-release-guard:\n    if: github.event_name == 'pull_request'\n    uses: ${familyGuardReference}@${oldGuardSha}\n    with:\n      product: ${product}\n      expected_core_sha: ${oldGuardSha}\n${extra}  unrelated:\n    uses: example/public/.github/workflows/read.yml@${oldGuardSha}\n    secrets: inherit\n`;
}
function callerFixture(t,caller,callee=supportedGuard){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'repin-family-secret-'));
  const workflows=path.join(directory,'.github','workflows');
  const target=path.join(directory,'src','codex-safe-core','.github','workflows','family-release-guard.yml');
  fs.mkdirSync(workflows,{recursive:true});
  const file=path.join(workflows,'ci.yml');fs.writeFileSync(file,caller);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  if(callee!==null)fs.writeFileSync(target,callee);
  const sub=path.join(directory,'src','codex-safe-core');
  const git=args=>execFileSync('git',['-c','commit.gpgsign=false',...args],{cwd:sub,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).trim();
  git(['init','--quiet']);git(['config','user.name','Guard Fixture']);git(['config','user.email','fixture@example.invalid']);
  fs.writeFileSync(path.join(sub,'fixture.txt'),'public target fixture\n');
  git(['add','.']);git(['commit','--quiet','-m','target workflow']);
  const targetGuardSha=git(['rev-parse','HEAD']);
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  return{directory,workflows,file,target,targetGuardSha};
}
for(const product of ['codex-commit-safe','codex-review-safe','codex-review-service','codex-diagnose','codex-change-safe']){
  test(`canonical repin explicitly wires the narrow read secret for ${product}`,t=>{
    const before=familyCaller(product),{directory,file,targetGuardSha}=callerFixture(t,before);
    if(process.platform!=='win32')fs.chmodSync(file,0o664);
    syncReusableWorkflowPins(directory,targetGuardSha);
    const after=fs.readFileSync(file,'utf8');
    assert.ok(after.includes(`uses: ${familyGuardReference}@${targetGuardSha}\n    secrets:\n      ${familyReadMapping}\n    with:`));
    assert.ok(after.includes(`expected_core_sha: ${targetGuardSha}`));
    assert.equal(after.slice(after.indexOf('  unrelated:')),before.slice(before.indexOf('  unrelated:')));
    assert.equal((after.match(/CODEX_SAFE_FAMILY_READ_TOKEN:/g)||[]).length,1);
    assert.doesNotMatch(after.slice(0,after.indexOf('  unrelated:')),/FAMILY_BOT_TOKEN|secrets: inherit/);
    syncReusableWorkflowPins(directory,targetGuardSha);
    assert.equal(fs.readFileSync(file,'utf8'),after,'repeated repin must be byte-identical');
    if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o664);
  });
}
test('Family repin preserves other explicit secrets and an existing read-secret alias',t=>{
  const extra='    secrets:\n      OTHER_READ_TOKEN: ${{ secrets.OTHER_READ_TOKEN }} # keep\n';
  const {directory,file,targetGuardSha}=callerFixture(t,familyCaller('codex-review-safe',extra));
  syncReusableWorkflowPins(directory,targetGuardSha);
  let after=fs.readFileSync(file,'utf8');
  assert.ok(after.includes('    secrets:\n      '+familyReadMapping+'\n      OTHER_READ_TOKEN: ${{ secrets.OTHER_READ_TOKEN }} # keep\n'));
  after=after.replace(familyReadMapping,'CODEX_SAFE_FAMILY_READ_TOKEN: ${{ secrets.ORG_FAMILY_READ_TOKEN }} # controlled read alias');
  fs.writeFileSync(file,after);
  syncReusableWorkflowPins(directory,targetGuardSha);
  assert.equal(fs.readFileSync(file,'utf8'),after);
});
test('Family repin preserves CRLF and quoted job keys while wiring the caller',t=>{
  const before=familyCaller('codex-review-safe').replace('  family-release-guard:','  "family-release-guard":').replaceAll('\n','\r\n');
  const {directory,file,targetGuardSha}=callerFixture(t,before);
  syncReusableWorkflowPins(directory,targetGuardSha);
  const after=fs.readFileSync(file,'utf8');
  assert.ok(after.includes(`    secrets:\r\n      ${familyReadMapping}\r\n`));
  assert.equal(after.replaceAll('\r\n','').includes('\n'),false);
});
test('Family repin preserves a valid wider indentation for existing secret entries',t=>{
  const extra='    secrets:\n        OTHER_READ_TOKEN: ${{ secrets.OTHER_READ_TOKEN }}\n';
  const {directory,file,targetGuardSha}=callerFixture(t,familyCaller('codex-review-safe',extra));
  syncReusableWorkflowPins(directory,targetGuardSha);
  const after=fs.readFileSync(file,'utf8');
  assert.ok(after.includes(`    secrets:\n        ${familyReadMapping}\n        OTHER_READ_TOKEN: \${{ secrets.OTHER_READ_TOKEN }}\n`));
  syncReusableWorkflowPins(directory,targetGuardSha);
  assert.equal(fs.readFileSync(file,'utf8'),after);
});
test('old or absent target callees never receive an undeclared new secret',t=>{
  for(const callee of [null,'on:\n  workflow_call:\n    inputs:\n      product:\n        type: string\n']){
    const {directory,file,targetGuardSha}=callerFixture(t,familyCaller('codex-review-safe'),callee);
    syncReusableWorkflowPins(directory,targetGuardSha);
    const after=fs.readFileSync(file,'utf8');
    assert.ok(after.includes(`${familyGuardReference}@${targetGuardSha}`));
    assert.doesNotMatch(after,/CODEX_SAFE_FAMILY_READ_TOKEN/);
  }
});
test('untracked target declarations and unreadable Git objects cannot supply secret capability',t=>{
  const before=familyCaller('codex-review-safe'),{directory,file,target,targetGuardSha}=callerFixture(t,before,null);
  fs.writeFileSync(target,supportedGuard);
  assert.throws(()=>syncReusableWorkflowPins(directory,targetGuardSha),/worktree differs from the exact commit/);
  assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.equal(fs.readFileSync(target,'utf8'),supportedGuard);
  assert.throws(()=>syncReusableWorkflowPins(directory,'f'.repeat(40)),error=>error.status!==0&&/ls-tree/.test(error.message));
  assert.equal(fs.readFileSync(file,'utf8'),before);
});
test('target capability accepts a real Git CRLF checkout while rejecting substantive content drift',t=>{
  const {directory,file,target,targetGuardSha}=callerFixture(t,familyCaller('codex-review-safe'));
  const sub=path.join(directory,'src','codex-safe-core'),relative='.github/workflows/family-release-guard.yml';
  const git=args=>execFileSync('git',args,{cwd:sub,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000});
  git(['config','core.autocrlf','true']);
  fs.rmSync(target);git(['checkout','--',relative]);
  const checkedOut=fs.readFileSync(target,'utf8');
  assert.match(checkedOut,/on:\r\n/,'Git must actually materialize a CRLF working-tree fixture');
  git(['diff','--exit-code',targetGuardSha,'--',relative]);
  syncReusableWorkflowPins(directory,targetGuardSha);
  const after=fs.readFileSync(file,'utf8');assert.ok(after.includes(familyReadMapping));
  const changed=checkedOut.replace('required: false','required: true');fs.writeFileSync(target,changed);
  assert.throws(()=>syncReusableWorkflowPins(directory,targetGuardSha),/worktree differs from the exact commit/);
  assert.equal(fs.readFileSync(target,'utf8'),changed,'substantive local edits remain intact');
  assert.equal(fs.readFileSync(file,'utf8'),after);
});
test('comments and similarly named inputs do not declare a reusable-workflow secret',t=>{
  const decoy='on:\n  workflow_call:\n    inputs:\n      CODEX_SAFE_FAMILY_READ_TOKEN:\n        type: string\n# secrets:\n#   CODEX_SAFE_FAMILY_READ_TOKEN:\nenv:\n  CODEX_SAFE_FAMILY_READ_TOKEN: fixture\n';
  const {directory,file,targetGuardSha}=callerFixture(t,familyCaller('codex-review-safe'),decoy);
  syncReusableWorkflowPins(directory,targetGuardSha);
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/CODEX_SAFE_FAMILY_READ_TOKEN/);
});
test('a downgrade with an existing unsupported read mapping fails before workflow writes',t=>{
  const before=familyCaller('codex-review-safe',`    secrets:\n      ${familyReadMapping}\n`);
  const {directory,file,targetGuardSha}=callerFixture(t,before,'on:\n  workflow_call:\n    inputs:\n      product:\n        type: string\n');
  assert.throws(()=>syncReusableWorkflowPins(directory,targetGuardSha),/does not declare CODEX_SAFE_FAMILY_READ_TOKEN/);
  assert.equal(fs.readFileSync(file,'utf8'),before);
});
test('ambiguous or broad secret mappings are rejected before any workflow file is written',t=>{
  for(const extra of [
    '    secrets: inherit\n',
    '    secrets: { OTHER_READ_TOKEN: "${{ secrets.OTHER_READ_TOKEN }}" }\n',
    '    secrets:\n      <<: *shared\n',
    `    secrets:\n      ${familyReadMapping}\n      ${familyReadMapping}\n`,
    '    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN: ${{ secrets.FAMILY_BOT_TOKEN }}\n',
    '    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN: ${{ secrets.family_bot_token }}\n',
    '    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN: >-\n        ${{ secrets.FAMILY_BOT_TOKEN }}\n',
    '    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN: *write_token\n',
    '    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN: &write_token ${{ secrets.FAMILY_BOT_TOKEN }}\n',
    '    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN: ${{ secrets[format(\'FAMILY_{0}_TOKEN\', \'BOT\')] }}\n',
    '    secrets:\n      CODEX_SAFE_FAMILY_READ_TOKEN: literal-credential-must-not-be-preserved\n',
    `      secrets:\n        ${familyReadMapping}\n`
  ]){
    const before=familyCaller('codex-review-safe'),{directory,workflows,file,targetGuardSha}=callerFixture(t,before);
    const invalid=path.join(workflows,'z-invalid.yml');
    let invalidBefore=familyCaller('codex-review-safe',extra);
    if(extra.includes('*write_token'))invalidBefore=invalidBefore.replace('jobs:\n','env:\n  DECLARED_SECRET: &write_token ${{ secrets.FAMILY_BOT_TOKEN }}\njobs:\n');
    fs.writeFileSync(invalid,invalidBefore);
    assert.throws(()=>syncReusableWorkflowPins(directory,targetGuardSha),/Family Release Guard|CODEX_SAFE_FAMILY_READ_TOKEN/);
    assert.equal(fs.readFileSync(file,'utf8'),before);
    assert.equal(fs.readFileSync(invalid,'utf8'),invalidBefore);
  }
});
test('a failed caller replacement preserves original bytes and mode and removes the temporary file',t=>{
  const before=familyCaller('codex-review-safe'),{directory,workflows,file,targetGuardSha}=callerFixture(t,before);
  if(process.platform!=='win32')fs.chmodSync(file,0o664);
  const rename=fs.renameSync;
  try{
    fs.renameSync=(source,target)=>{if(target===file)throw Object.assign(new Error('injected caller replacement failure'),{code:'EACCES'});return rename(source,target);};
    assert.throws(()=>syncReusableWorkflowPins(directory,targetGuardSha),{code:'EACCES'});
  }finally{fs.renameSync=rename;}
  assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.deepEqual(fs.readdirSync(workflows),['ci.yml']);
  if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o664);
});
