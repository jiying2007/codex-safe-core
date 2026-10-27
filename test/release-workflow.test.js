'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const release=fs.readFileSync(path.join(root,'.github','workflows','release.yml'),'utf8');
const trusted=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8');
const family=fs.readFileSync(path.join(root,'.github','workflows','family-ci.yml'),'utf8');
const manifestGenerator=fs.readFileSync(path.join(root,'scripts','generate-family-manifest.js'),'utf8');
const performanceTrend=fs.readFileSync(path.join(root,'.github','workflows','performance-trend.yml'),'utf8');

test('validation workflow is read-only and covers both LTS runtimes plus reproducibility',()=>{
  assert.match(release,/name: Release Validation/);
  assert.match(release,/permissions:\r?\n  contents: read/);
  assert.match(release,/node: \['22\.22\.2', '24\.19\.0'\]/);
  assert.match(release,/npm run ci/);
  assert.match(release,/npm run check:contract/);
  assert.match(release,/npm run check:reproducible/);
  assert.doesNotMatch(release,/outputs:|needs:|contents: write|id-token: write|attestations: write|gh release create/);
});

test('trusted publication is workflow_run gated to successful main validation',()=>{
  assert.match(trusted,/workflow_run:[\s\S]*workflows: \["CI", "Release Validation"\][\s\S]*types: \[completed\]/);
  assert.doesNotMatch(trusted,/workflow_run\.conclusion == 'success'/);
  assert.match(trusted,/admission:\s*\n\s*if: .*workflow_run\.head_branch == 'main'/);
  assert.match(trusted,/workflow_run\.head_branch == 'main'/);
  assert.match(trusted,/workflow_run\.event == 'push'/);
  assert.match(trusted,/workflow_run\.head_sha/);
  assert.match(trusted,/remote_main=.*git ls-remote origin refs\/heads\/main/);
  assert.match(trusted,/test "\$remote_main" = "\$validated_sha"/);
});

test('failed main workflow completion reaches admission rather than bypassing the failure verdict',()=>{
 const workflow=trusted.replace(/\r\n/g,'\n');
 const flow=workflow.match(/  admission:\n    if: ([^\n]+)/);
 assert.ok(flow);
 assert.doesNotMatch(flow[1],/conclusion/);
 assert.match(flow[1],/head_branch == 'main'/);
 assert.match(flow[1],/workflow_run\.event == 'push'/);
 assert.match(trusted,/if\(denied\.length\)throw Error\('Trusted Release blocked:/);
 assert.match(workflow,/publish:\n    needs: admission\n    if: .*ready == 'true'/);
});

test('trusted release no-ops only for an unchanged version with an existing immutable release on an older SHA',()=>{
  assert.match(trusted,/fetch-depth: 0/);
  assert.match(trusted,/parent_version=''/);
  assert.match(trusted,/git show HEAD\^:core-contract\.json/);
  assert.match(trusted,/parent_version.*==.*version/);
  assert.match(trusted,/Core \$\{version\} has runtime-identical governance-only main changes/);
  assert.match(trusted,/reason=no-version-change/);
  assert.match(trusted,/Existing formal release \$\{tag\} is not immutable/);
  assert.match(trusted,/Existing formal release \$\{tag\} points to \$\{tag_sha\}, expected \$\{VALIDATED_SHA\}; version changed or parent version could not prove a no-op/);
});

test('formal release is skipped when immutable and still exact-head',()=>{
  assert.match(trusted,/gh release view "\$tag"[\s\S]*tag_sha=.*git ls-remote origin[\s\S]*VALIDATED_SHA/);
  assert.match(trusted,/release_verified=false[\s\S]*for attempt in \{1\.\.12\}; do[\s\S]*gh release verify "\$tag"/);
  assert.match(trusted,/Existing formal release \$\{tag\} attestation did not become verifiable/);
  assert.match(trusted,/reason=exact-existing-release/);
  assert.match(trusted,/publish=false/);
  assert.match(trusted,/git ls-remote --exit-code --refs origin "refs\/tags\/\$\{tag\}"/);
  assert.match(trusted,/git rev-list -n 1 "\$tag"[\s\S]*VALIDATED_SHA/);
  assert.match(trusted,/publish=true/);
  assert.match(trusted,/reason=new-release/);
});

test('trusted release provenance action stays SHA-pinned to v4.2.2',()=>{
  assert.match(trusted,/actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4\.2\.2/);
  assert.doesNotMatch(trusted,/actions\/attest-build-provenance@(?:v|main|master)/);
});

test('trusted release verifies actual immutable state without repository-admin preflight',()=>{
  assert.doesNotMatch(trusted,/\/immutable-releases/);
  assert.match(trusted,/releases\/tags\/\$\{RELEASE_TAG\}[\s\S]*--jq '\.immutable'/);
  assert.match(trusted,/did not become immutable/);
  assert.match(trusted,/gh release verify "\$RELEASE_TAG"/);
  assert.match(trusted,/gh release verify-asset "\$RELEASE_TAG"/);
});

test('trusted release tolerates bounded release and asset attestation propagation delay',()=>{
  assert.match(trusted,/release_verified=false/);
  assert.match(trusted,/for attempt in \{1\.\.12\}; do[\s\S]*if gh release verify "\$RELEASE_TAG"; then[\s\S]*gh release verify-asset "\$RELEASE_TAG" "\$asset"[\s\S]*sleep 5/);
  assert.match(trusted,/Release\/asset attestation for \$\{RELEASE_TAG\} is not fully visible yet/);
  assert.match(trusted,/attestation did not become fully verifiable/);
  assert.match(trusted,/test "\$release_verified" = true/);
});

test('trusted release remains reproducible and provenance-complete',()=>{
  assert.match(trusted,/npm run check:contract/);
  assert.match(trusted,/npm run check:reproducible/);
  assert.match(trusted,/npm run ci/);
  assert.match(trusted,/SBOM\.spdx\.json/);
  assert.match(trusted,/CORE_CONTRACT\.json/);
  assert.match(trusted,/CORE_OWNERSHIP_MANIFEST\.json/);
  assert.match(trusted,/SHA256SUMS/);
  assert.match(trusted,/gh release create/);
  assert.doesNotMatch(trusted,/--clobber/);
});

test('Family publication has one canonical manifest and verifies immutable release assets',()=>{
  assert.match(family,/FAMILY_MANIFEST\.json/);
  assert.match(family,/generate-family-manifest\.js/);
  assert.match(family,/codex-safe-family-manifest/);
  assert.doesNotMatch(family,/FAMILY_BASELINE\.json|FAMILY_BOM\.json|generate-family-baseline\.js/);
  assert.doesNotMatch(family,/\/immutable-releases/);
  assert.match(family,/gh release verify "\$tag"/);
  assert.match(family,/gh release verify-asset "\$tag" FAMILY_MANIFEST\.json/);
});

test('Family Manifest binds canonical released Core while validating runtime-equivalent checkout',()=>{
  assert.match(manifestGenerator,/const checkoutCoreSha=git\(\['rev-parse','HEAD'\]\)/);
  assert.match(manifestGenerator,/const coreSha=snapshot\.core\?\.sha\|\|''/);
  assert.match(manifestGenerator,/snapshot\.core\?\.runtimeDigest!==currentCoreDigests\.runtimeDigest/);
  assert.match(manifestGenerator,/checkoutCoreSha===coreSha&&snapshot\.core\?\.governanceDigest!==currentCoreDigests\.governanceDigest/);
  assert.match(manifestGenerator,/core:\{version:snapshot\.core\.version,sha:coreSha,runtimeDigest:snapshot\.core\.runtimeDigest,governanceDigest:snapshot\.core\.governanceDigest/);
  assert.match(manifestGenerator,/releaseAssetSha256\(snapshot\.core\.release,'CORE_CONTRACT\.json'\)/);
  assert.doesNotMatch(manifestGenerator,/snapshot\.core\?\.sha!==coreSha/);
  assert.doesNotMatch(manifestGenerator,/runtimeDigest:currentCoreDigests\.runtimeDigest,governanceDigest:currentCoreDigests\.governanceDigest/);
});

test('Family release verification tolerates bounded release-attestation propagation delay',()=>{
  assert.match(family,/release_verified=false/);
  assert.match(family,/for attempt in \{1\.\.12\}; do[\s\S]*if gh release verify "\$tag"; then[\s\S]*release_verified=true[\s\S]*sleep 5/);
  assert.match(family,/Release attestation for \$\{tag\} is not visible yet/);
  assert.match(family,/attestation did not become verifiable/);
  assert.match(family,/test "\$release_verified" = true/);
});

test('Performance publication is provenance-attested and uses only pinned actions',()=>{
  assert.match(performanceTrend,/permissions:\r?\n  contents: write\r?\n  id-token: write\r?\n  attestations: write/);
  assert.match(performanceTrend,/actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4\.2\.2/);
  assert.match(performanceTrend,/subject-path: \$\{\{ steps\.evidence\.outputs\.asset \}\}/);
  assert.doesNotMatch(performanceTrend,/actions\/attest-build-provenance@(?:v|main|master)/);
});

test('Performance immutable release reruns verify the existing canonical asset instead of overwriting it',()=>{
  assert.match(performanceTrend,/exists=false[\s\S]*gh release view "\$tag"[\s\S]*exists=true/);
  assert.match(performanceTrend,/if: steps\.evidence\.outputs\.exists != 'true'/);
  assert.match(performanceTrend,/gh release download "\$PERFORMANCE_TAG" --pattern "\$PERFORMANCE_ASSET" --dir \./);
  assert.match(performanceTrend,/release_verified=false/);
  assert.match(performanceTrend,/for attempt in \{1\.\.12\}; do[\s\S]*if gh release verify "\$PERFORMANCE_TAG"; then[\s\S]*release_verified=true/);
  assert.match(performanceTrend,/gh release verify-asset "\$PERFORMANCE_TAG" "\$PERFORMANCE_ASSET"/);
  assert.doesNotMatch(performanceTrend,/--clobber/);
});

test('trusted release requires full main CI security proof and version race protection',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8');
 assert.match(workflow,/group: trusted-release-main/);
 assert.match(workflow,/Require exact main push CI Gate and real security job/);
 assert.match(workflow,/security \/ codeql/);
 assert.match(workflow,/Missing successful exact-SHA main CI/);
 assert.match(workflow,/main moved during trusted release/);
 assert.match(workflow,/runtimeDigest!==current\.runtimeDigest/);
});

test('trusted publication converges regardless of CI versus validation completion order',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8');
 assert.match(workflow,/workflows: \["CI", "Release Validation"\]/);
 assert.match(workflow,/name: Require successful same-SHA CI and Release Validation/);
 assert.match(workflow,/latest\('ci\.yml'\)/);
 assert.match(workflow,/latest\('release\.yml'\)/);
 assert.ok(workflow.includes("ready='+(ready?'true':'false')"),'admission must expose true only when both workflows succeeded');
 assert.match(workflow,/needs: admission/);
 assert.match(workflow,/needs\.admission\.outputs\.ready == 'true'/);
 assert.match(workflow,/latest exact-SHA main CI|Missing successful exact-SHA main CI/);
});

test('executable release admission waits for both exact-SHA successful workflows',{timeout:6000},async()=>{
 const vm=require('node:vm');
 const source=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8').replace(/\r\n/g,'\n');
 const title='name: Require successful same-SHA CI and Release Validation';
 const section=source.slice(source.indexOf(title));
 assert.ok(section.startsWith(title));
 const match=section.match(/          node - <<'NODE'\n([\s\S]*?)          NODE/);
 assert.ok(match,'release admission must use a testable, bounded script');
 const script=match[1].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
 const sha='a'.repeat(40);
 const pass=(workflow,id)=>({id,head_sha:sha,head_branch:'main',event:workflow==='ci.yml'?'push':'workflow_dispatch',status:'completed',conclusion:'success'});
 async function run({ci=[pass('ci.yml',10)],validation=[pass('release.yml',11)]}={}){
  const lines=[];
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Release admission timed out in fixture')),2000);
   const finish=(ok,value)=>{clearTimeout(timeout);resolve({ok,value,lines});};
   const context={
    require:name=>{assert.equal(name,'node:fs');return{appendFileSync:(file,value)=>{assert.equal(file,'fixture-output');lines.push(value);}};},
    process:{env:{EXPECTED_SHA:sha,GITHUB_REPOSITORY:'jiying2007/codex-safe-core',API_TOKEN:'synthetic-public',GITHUB_OUTPUT:'fixture-output'},exitCode:0},
    AbortSignal,
    console:{log:value=>finish(true,JSON.parse(value)),error:error=>finish(false,String(error))},
    fetch:async(url,options)=>{
     assert.equal(options.headers.authorization,'Bearer synthetic-public');
     const value=String(url).includes('/ci.yml/')?ci:validation;
     return{ok:true,status:200,json:async()=>({workflow_runs:value})};
    }
   };
   try{vm.runInNewContext(script,context,{timeout:1000});}catch(error){clearTimeout(timeout);reject(error);}
  });
 }
 const both=await run();
 assert.equal(both.ok,true);
 assert.equal(both.value.ready,true);
 assert.deepEqual(both.lines,['ready=true\n']);
 const pending=await run({validation:[{...pass('release.yml',11),status:'in_progress',conclusion:null}]});
 assert.equal(pending.ok,true);
 assert.equal(pending.value.ready,false);
 assert.deepEqual(pending.lines,['ready=false\n']);
 const failed=await run({ci:[{...pass('ci.yml',12),conclusion:'failure'},pass('ci.yml',10)]});
 assert.equal(failed.ok,false);
 assert.match(failed.value,/Trusted Release blocked: CI=failure/);
 const badValidation=await run({validation:[{...pass('release.yml',11),conclusion:'failure'}]});
 assert.equal(badValidation.ok,false);
 assert.match(badValidation.value,/Release Validation=failure/);
});

test('Family bot credential must be preflighted before any immutable Core tag can be created',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github','workflows','_trusted-release.yml'),'utf8');
 const preflight=workflow.indexOf('Require Family Upgrade dispatch credential before immutable publication');
 const tag=workflow.indexOf('      - name: Ensure release tag');
 assert.ok(preflight>=0&&tag>preflight,'preflight must precede tag writes');
 const fragment=workflow.slice(preflight,tag);
 assert.match(fragment,/steps\.decision\.outputs\.publish == 'true'/);
 assert.match(fragment,/secrets\.FAMILY_BOT_TOKEN/);
 assert.match(fragment,/test -n "\$FAMILY_BOT_TOKEN"/);
 assert.doesNotMatch(fragment,/echo\s+["']?\$FAMILY_BOT_TOKEN/);
});
