'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const core=require('..');

test('Git C quoting retains BOM names and refuses malformed JavaScript path text',()=>{
  const file='\ufeffname.c';
  assert.equal(core.decodeGitQuotedPath(core.quoteGitPath(file)),file);
  for(const invalid of ['bad\ud800','bad\0name'])assert.throws(()=>core.decodeGitQuotedPath(invalid),/Invalid Git path text/);
  assert.throws(()=>core.decodeGitQuotedPath('"bad\\000name"'),/decoded NUL/);
});

const semanticDiff=['diff --git a/src/a.js b/src/a.js','--- a/src/a.js','+++ b/src/a.js','@@ -1 +1 @@','-old','+new','diff --git a/package-lock.json b/package-lock.json','--- a/package-lock.json','+++ b/package-lock.json','@@ -1 +1 @@','-old-lock','+new-lock','diff --git a/images/a.png b/images/a.png','Binary files a/images/a.png and b/images/a.png differ'].join('\n');

test('semantic context keeps source and demotes generated/binary payloads',()=>{const context=core.buildSemanticContext({files:['src/a.js','package-lock.json','images/a.png'],diff:semanticDiff,commits:['feat: x'],maxBytes:4096});assert.match(context.text,/src\/a\.js/);assert.match(context.text,/\+new/);assert.doesNotMatch(context.text,/\+new-lock/);assert.deepEqual(context.generatedFiles,['package-lock.json']);assert.deepEqual(context.binaryFiles,['images/a.png']);assert.equal(core.splitUnifiedDiff(semanticDiff).length,3);});
test('semantic context truncates per source file instead of global prefix slicing',()=>{const large=['diff --git a/src/a.js b/src/a.js','--- a/src/a.js','+++ b/src/a.js','@@ -1 +1 @@',`+${'a'.repeat(6000)}`,'diff --git a/src/b.js b/src/b.js','--- a/src/b.js','+++ b/src/b.js','@@ -1 +1 @@',`+${'b'.repeat(6000)}`].join('\n');const context=core.buildSemanticContext({diff:large,maxBytes:4096});assert.equal(context.truncated,true);assert.deepEqual(context.includedSourceFiles.sort(),['src/a.js','src/b.js']);assert.ok(context.truncatedSourceFiles.length>=1);assert.match(context.text,/src\/a\.js/);assert.match(context.text,/src\/b\.js/);});
test('review evidence chunker preserves every included hunk or fails closed',()=>{const diff=['diff --git a/src/a.js b/src/a.js','--- a/src/a.js','+++ b/src/a.js','@@ -1 +1 @@','-a','+A','@@ -50 +50 @@','-b','+B','diff --git a/src/b.js b/src/b.js','--- a/src/b.js','+++ b/src/b.js','@@ -1 +1 @@','-c','+C'].join('\n');const evidence=core.buildReviewEvidenceChunks({diff,maxBytes:4096,maxChunks:4});assert.equal(evidence.complete,true);assert.match(evidence.chunks.map(c=>c.text).join('\n'),/\+A/);assert.match(evidence.chunks.map(c=>c.text).join('\n'),/\+B/);assert.match(evidence.chunks.map(c=>c.text).join('\n'),/\+C/);const huge=['diff --git a/src/huge.js b/src/huge.js','--- a/src/huge.js','+++ b/src/huge.js','@@ -1 +1 @@',`+${'x'.repeat(6000)}`].join('\n');const incomplete=core.buildReviewEvidenceChunks({diff:huge,maxBytes:4096,maxChunks:2});assert.equal(incomplete.complete,false);assert.ok(incomplete.coverageGaps.some(value=>value.includes('hunk_exceeds_budget')));});
test('policy v4 is canonical, closed and deeply immutable',()=>{assert.equal(core.POLICY_FILE,'.codex-safe.json');assert.equal(core.POLICY_SCHEMA_VERSION,4);const document=core.validatePolicyDocument({schemaVersion:4,commit:{language:'en',scopes:['core'],scopeHints:{core:['runtime']},extraInstructions:'concise'},review:{confidenceThreshold:0.8,severityThreshold:'medium',rules:{requireTestsForCodeChanges:true,codePathPrefixes:['src/'],testPathPrefixes:['test/'],forbiddenPathPrefixes:['secrets/']}},change:{requiredChecks:['build'],requiredApprovals:2,provenancePolicy:'require-all',blockOnReviewFindings:true,requireCleanWorktree:true,requirePushedHead:true,requireFreshTarget:true,reviewers:['alice'],labels:['safe'],titlePolicy:'create-only',managedSections:true},reviewService:{maxContextBytes:65536,maxContextFiles:8,contextLines:20,skipGeneratedFiles:true,blockUnreviewableFiles:false}});assert.equal(document.schemaVersion,4);assert.ok(Object.isFrozen(document));assert.ok(Object.isFrozen(document.change));assert.deepEqual(document.change.requiredChecks,['build']);assert.throws(()=>{document.change.requiredChecks.push('other');},TypeError);assert.throws(()=>core.validatePolicyDocument({schemaVersion:3}),/schemaVersion/);assert.throws(()=>core.validatePolicyDocument({schemaVersion:4,legacy:{}}),/unsupported top-level/);assert.throws(()=>core.validatePolicyDocument({schemaVersion:4,pr:{}}),/unsupported top-level/);assert.throws(()=>core.validatePolicySection('pr',{}),/Unknown policy section/);assert.throws(()=>core.validatePolicySection('commit',{unknown:true}),/unsupported fields/);assert.throws(()=>core.validatePolicySection('review',{confidenceThreshold:1.1}),/between 0 and 1/);assert.throws(()=>core.validatePolicySection('change',{unknown:true}),/unsupported fields/);assert.throws(()=>core.validatePolicySection('change',{requiredApprovals:21}),/between 0 and 20/);assert.throws(()=>core.validatePolicySection('change',{requirePushedHead:'false'}),/boolean/);assert.throws(()=>core.validatePolicySection('change',{requiredChecks:['build','build']}),/duplicate/);assert.throws(()=>core.validatePolicySection('change',{provenancePolicy:'legacy'}),/invalid/);assert.throws(()=>core.validatePolicySection('reviewService',{contextLines:201}),/between 0 and 200/);});
test('JSON Schema keys and critical limits stay aligned with runtime policy',()=>{const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'..','codex-safe.schema.json'),'utf8'));assert.equal(schema.properties.schemaVersion.const,4);for(const section of core.POLICY_SECTIONS){assert.deepEqual(Object.keys(schema.properties[section].properties).sort(),[...core.POLICY_SECTION_KEYS[section]].sort(),`${section} schema keys drifted from runtime`);assert.equal(schema.properties[section].additionalProperties,false);}assert.deepEqual(Object.keys(schema.properties.review.properties.rules.properties).sort(),[...core.REVIEW_RULE_KEYS].sort());assert.equal(schema.properties.change.properties.requiredApprovals.maximum,20);assert.equal(schema.properties.change.properties.provenancePolicy.enum.includes('require-all'),true);assert.equal(schema.properties.pr,undefined);});
test('HEAD policy reader ignores working tree by consuming Git objects only',async()=>{const text=JSON.stringify({schemaVersion:4,change:{requiredChecks:['build']},review:{confidenceThreshold:0.8}}),oid='a'.repeat(40),calls=[];const git=async args=>{calls.push(args);if(args[0]==='ls-tree')return{stdout:`100644 blob ${'b'.repeat(40)}\t.codex-safe.json\0`,stderr:''};if(args[0]==='show')return{stdout:text,stderr:''};throw new Error(`unexpected git call: ${args.join(' ')}`);};const result=await core.readPolicySectionAtHead({git,repoRoot:'/repo',headOid:oid,section:'change'});assert.deepEqual(result.rules,{requiredChecks:['build']});assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.rules));assert.equal(result.fingerprint,crypto.createHash('sha256').update(text,'utf8').digest('hex'));assert.equal(result.schemaVersion,4);assert.deepEqual(calls[0],['ls-tree','-z',oid,'--','.codex-safe.json']);assert.deepEqual(calls[1],['show',`${oid}:.codex-safe.json`]);});

test('many files cannot exceed the declared exact UTF-8 semantic context budget',()=>{
 const files=Array.from({length:100},(_,i)=>`src/文件${i}.c`);
 const diff=files.map(file=>`diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old\n+new\n`).join('');
 const result=core.buildSemanticContext({files,diff,maxBytes:4096});
 assert.ok(Buffer.byteLength(result.text,'utf8')<=result.budgetBytes);
 assert.equal(result.truncated,true);
 assert.ok(result.truncatedSourceFiles.length>0);
 assert.ok(result.includedSourceFiles.length>0,'retain representable source files rather than globally truncating the diff');
 assert.ok(result.includedSourceFiles.length<files.length,'any source that cannot be represented must be reported as omitted');
 for(const path of files.filter(file=>!result.includedSourceFiles.includes(file)))assert.ok(result.truncatedSourceFiles.includes(path));
});
test('review chunk accounting includes separators between individual hunks',()=>{
 const a='diff --git a/a.c b/a.c\n--- a/a.c\n+++ b/a.c\n@@ -1 +1 @@\n-a\n+A\n';
 const b='diff --git a/b.c b/b.c\n--- a/b.c\n+++ b/b.c\n@@ -1 +1 @@\n-b\n+B\n';
 const chunks=core.buildReviewEvidenceChunks({diff:a+b,maxBytes:4096,maxChunks:8});
 for(const chunk of chunks.chunks)assert.equal(Buffer.byteLength(chunk.text,'utf8'),chunk.bytes);
});

test('Git C-quoted Chinese paths decode without losing real b/ directories',()=>{
 const escaped=Array.from(Buffer.from('测试.c','utf8'),byte=>'\\'+byte.toString(8).padStart(3,'0')).join('');
 const quoted=['diff --git "a/'+escaped+'" "b/'+escaped+'"',
               '--- "a/'+escaped+'"','+++ "b/'+escaped+'"','@@ -1 +1 @@','-old','+new'].join('\n');
 const decoded=core.splitUnifiedDiff(quoted);
 assert.deepEqual(decoded.map(block=>block.path),['测试.c']);
 const plain=['diff --git a/b/main.c b/b/main.c','--- a/b/main.c','+++ b/b/main.c','@@ -1 +1 @@','-old','+new'].join('\n');
 assert.deepEqual(core.splitUnifiedDiff(plain).map(block=>block.path),['b/main.c']);
});

test('C-quoted deleted and binary-only Git diff paths remain identifiable',()=>{
  const encoded=Array.from(Buffer.from('驱动.c'),x=>'\\'+x.toString(8).padStart(3,'0')).join('');
  const binary=['diff --git "a/'+encoded+'" "b/'+encoded+'"',
    'Binary files "a/'+encoded+'" and "b/'+encoded+'" differ'].join('\n');
  const removed=['diff --git "a/'+encoded+'" "b/'+encoded+'"',
    'deleted file mode 100644',
    '--- "a/'+encoded+'"',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-old'].join('\n');
  assert.deepEqual(core.splitUnifiedDiff(binary).map(v=>v.path),['驱动.c']);
  assert.deepEqual(core.splitUnifiedDiff(removed).map(v=>v.path),['驱动.c']);
});

test('raw provider paths serialize without introducing extra diff records',()=>{
 for(const path of ['plain.c','x\\y.c','a b.c','tab\t.c','line\nnext.c','测试.c','quote".c',' padded.c ']){
   const encoded=core.quoteGitPath(path);
   assert.equal(core.decodeGitQuotedPath(encoded),path);
   assert.ok(!encoded.includes('\n'));
   const header=`diff --git ${core.quoteGitPath('a/'+path)} ${core.quoteGitPath('b/'+path)}`;
   assert.deepEqual(core.parseGitDiffHeaderPaths(header),{old:path,new:path});
 }
 for(const invalid of ['',null,'nul\0.c','\ud800'])assert.throws(()=>core.quoteGitPath(invalid),/Git path/);
});

test('byte allocations never exceed limits even with thousands of tiny source chunks',()=>{
 const blocks=Array.from({length:800},(_,index)=>({path:'src/f'+index+'.c',text:'diff --git a/src/f'+index+'.c b/src/f'+index+'.c\n-old\n+new'+('x'.repeat(200))}));
 for(const maxBytes of [1,2,16,63,64,65,128,4096,65536]){
  const value=core.allocateSourceBlocks(blocks,maxBytes);
  assert.ok(Buffer.byteLength(value.text,'utf8')<=maxBytes,'maxBytes='+maxBytes);
  assert.equal(value.truncated,true);
  assert.ok(value.truncatedFiles.length);
  for(const file of blocks.slice(value.included.length))assert.ok(value.truncatedFiles.includes(file.path));
 }
});


test('oversized review hunks are losslessly split with accurate changed-line coordinates',()=>{
 const pairs=Array.from({length:240},(_,i)=>'-old'+i+'-'+('x'.repeat(32))+'\n+new'+i+'-'+('y'.repeat(32)));
 const diff=['diff --git a/src/huge.c b/src/huge.c','--- a/src/huge.c','+++ b/src/huge.c',
   '@@ -1,240 +1,240 @@ fn',...pairs].join('\n');
 const evidence=core.buildReviewEvidenceChunks({diff,maxBytes:4096,maxChunks:64});
 assert.equal(evidence.complete,true,JSON.stringify(evidence.coverageGaps));
 assert.ok(evidence.chunks.length>1);
 assert.ok(evidence.plannedUnits>1);
 assert.equal(evidence.scheduledUnits,evidence.plannedUnits);
 assert.ok(evidence.chunks.every(chunk=>Buffer.byteLength(chunk.text,'utf8')===chunk.bytes&&chunk.bytes<=4096));
 let removed=0,added=0,oldCursor=1,newCursor=1;
 for(const chunk of evidence.chunks){
   for(const block of core.splitUnifiedDiff(chunk.text)){
     let oldLine=0,newLine=0,previousOld=0,previousNew=0;
     for(const line of block.text.split('\n')){
       const h=/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/.exec(line);
       if(h){
         oldLine=Number(h[1]);newLine=Number(h[3]);previousOld=0;previousNew=0;
         assert.equal(oldLine,oldCursor);assert.equal(newLine,newCursor);
       }else if(line.startsWith('-')&&!line.startsWith('---')){
         assert.equal(line.startsWith('-old'+removed+'-'),true);
         oldLine++;oldCursor++;removed++;previousOld++;
       }else if(line.startsWith('+')&&!line.startsWith('+++')){
         assert.equal(line.startsWith('+new'+added+'-'),true);
         newLine++;newCursor++;added++;previousNew++;
       }else if(line.startsWith(' ')){oldLine++;newLine++;oldCursor++;newCursor++;}
     }
     assert.ok(previousOld>0||previousNew>0);
   }
 }
 assert.equal(removed,240);assert.equal(added,240);
});

test('oversized hunk keeps no-newline marker with its changed line and fails closed for giant line',()=>{
 const pairs=Array.from({length:240},(_,i)=>'-old'+i+'-'+('x'.repeat(20))+'\n+new'+i+'-'+('y'.repeat(20)));
 const diff=['diff --git a/src/a.c b/src/a.c','--- a/src/a.c','+++ b/src/a.c',
   '@@ -1,241 +1,241 @@',...pairs,'-old-last','+new-last','\\ No newline at end of file'].join('\n');
 const result=core.buildReviewEvidenceChunks({diff,maxBytes:4096,maxChunks:64});
 assert.equal(result.complete,true,JSON.stringify(result.coverageGaps));
 const matched=result.chunks.filter(c=>c.text.includes('No newline at end of file'));
 assert.equal(matched.length,1);
 assert.match(matched[0].text,/\+new-last\n\\ No newline at end of file/);
 const huge=['diff --git a/huge.c b/huge.c','--- a/huge.c','+++ b/huge.c',
   '@@ -0,0 +1 @@','+'+'z'.repeat(5000)].join('\n');
 const rejected=core.buildReviewEvidenceChunks({diff:huge,maxBytes:4096,maxChunks:64});
 assert.equal(rejected.complete,false);
 assert.ok(rejected.coverageGaps.some(gap=>gap.includes('hunk_exceeds_budget')));
});

test('lossless oversized hunk splitting recognizes real +++/--- code prefixes',()=>{
 const many=Array.from({length:180},(_,i)=>'-old'+i+' '+('a'.repeat(26))+'\n+new'+i+' '+('b'.repeat(26)));
 const diff=['diff --git a/counter.c b/counter.c','--- a/counter.c','+++ b/counter.c',
   '@@ -1,181 +1,181 @@',...many,'---counter','+++counter'].join('\n');
 const evidence=core.buildReviewEvidenceChunks({diff,maxBytes:4096,maxChunks:64});
 assert.equal(evidence.complete,true,JSON.stringify(evidence.coverageGaps));
 assert.ok(evidence.chunks.length>1);
 const all=evidence.chunks.map(c=>c.text).join('\n');
 assert.match(all,/---counter/);
 assert.match(all,/\+\+\+counter/);
 assert.equal((all.match(/^@@ /gm)||[]).length,evidence.plannedUnits);
});

test('semantic context bounds huge binary and source path inventories without starving changed source evidence',()=>{
 const files=[...Array.from({length:900},(_,i)=>'artifacts/'+String(i).padStart(4,'0')+'.BIN'),'src/critical.c'];
 const diff=['diff --git a/src/critical.c b/src/critical.c','--- a/src/critical.c','+++ b/src/critical.c','@@ -1 +1 @@','-old','+critical_fix'].join('\n');
 const result=core.buildSemanticContext({files,diff,maxBytes:4096});
 assert.ok(Buffer.byteLength(result.text,'utf8')<=4096);
 assert.equal(result.metadataBudgetBytes,819);
 assert.equal(result.metadataTruncated,true);
 assert.ok(result.binaryFiles.length===900);
 assert.ok(result.text.includes('+critical_fix'));
 assert.ok(result.truncated);
});
test('uppercase binary extensions remain metadata-only in semantic context',()=>{
 const files=['firmware/IMAGE.BIN'];
 const diff=['diff --git a/firmware/IMAGE.BIN b/firmware/IMAGE.BIN','Binary files a/firmware/IMAGE.BIN and b/firmware/IMAGE.BIN differ'].join('\n');
 const result=core.buildSemanticContext({files,diff,maxBytes:4096});
 assert.deepEqual(result.binaryFiles,files);
 assert.doesNotMatch(result.text,/Binary files .*\\n.*\\+payload/);
});

test('semantic inventory and source sections use actual newlines, never escaped newline text',()=>{
 const diff=[
  'diff --git a/src/main.c b/src/main.c',
  '--- a/src/main.c',
  '+++ b/src/main.c',
  '@@ -1 +1 @@',
  '-old',
  '+new'
 ].join('\n');
 const result=core.buildSemanticContext({files:['src/main.c','firmware/IMAGE.BIN'],diff,maxBytes:4096});
 assert.ok(result.text.includes('Changed files: 2\n'));
 assert.ok(result.text.includes('Source files (1):\n- src/main.c'));
 assert.ok(result.text.includes('Binary files, metadata only (1):\n- firmware/IMAGE.BIN'));
 assert.ok(result.text.includes('--- SOURCE DIFFS ---\n'));
 assert.ok(result.text.includes('+new'));
 assert.equal(result.text.includes(String.raw`\n`),false);
});

test('Git binary metadata excludes unknown-extension payloads from semantic and review contexts',()=>{
 const files=['firmware/update.dat','firmware/image','src/main.c'];
 const diff=[
  'diff --git a/firmware/update.dat b/firmware/update.dat',
  'index 1111111..2222222 100644',
  'GIT binary patch',
  'literal 1000000',
  'BINARY_SENTINEL_'.repeat(100000),
  'diff --git a/firmware/image b/firmware/image',
  'Binary files a/firmware/image and b/firmware/image differ',
  'diff --git a/src/main.c b/src/main.c',
  '--- a/src/main.c','+++ b/src/main.c','@@ -1 +1 @@',
  '-old','+source_fix'
 ].join('\n');
 assert.deepEqual(core.splitUnifiedDiff(diff).map(block=>block.kind),['binary','binary','source']);
 const context=core.buildSemanticContext({files,diff,maxBytes:4096});
 assert.deepEqual(context.binaryFiles,files.slice(0,2));
 assert.deepEqual(context.sourceFiles,['src/main.c']);
 assert.deepEqual(context.includedSourceFiles,['src/main.c']);
 assert.doesNotMatch(context.text,/BINARY_SENTINEL_|GIT binary patch|literal 1000000/);
 assert.match(context.text,/\+source_fix/);
 assert.ok(Buffer.byteLength(context.text,'utf8')<=4096);
 const review=core.buildReviewEvidenceChunks({diff,maxBytes:4096});
 assert.equal(review.complete,true);
 assert.deepEqual(review.excluded,files.slice(0,2).map(path=>({path,kind:'binary'})));
 assert.doesNotMatch(review.chunks.map(chunk=>chunk.text).join('\n'),/BINARY_SENTINEL_/);
});

test('binary inventory hints are metadata-only and cannot introduce files or source payloads',()=>{
 const diff=['diff --git a/data b/data','--- a/data','+++ b/data',
  '@@ -1 +1 @@','-old','+DO_NOT_SEND'].join('\n');
 const context=core.buildSemanticContext({
  files:['data','package-lock.json','firmware/image.bin'],
  binaryPaths:['data','package-lock.json','not-staged'],
  diff,maxBytes:4096
 });
 assert.deepEqual(context.sourceFiles,[]);
 assert.deepEqual(context.binaryFiles,['data','package-lock.json','firmware/image.bin']);
 assert.deepEqual(context.includedSourceFiles,[]);
 assert.doesNotMatch(context.text,/DO_NOT_SEND|not-staged/);
});

test('binary marker text inside source hunks cannot suppress source evidence',()=>{
 const diff=['diff --git a/docs/example.txt b/docs/example.txt',
  '--- a/docs/example.txt','+++ b/docs/example.txt','@@ -1,2 +1,2 @@',
  '-GIT binary patch','+GIT binary patch',
  '-Binary files a/data and b/data differ','+Binary files a/data and b/data differ'].join('\n');
 assert.equal(core.splitUnifiedDiff(diff)[0].kind,'source');
 const context=core.buildSemanticContext({diff,maxBytes:4096});
 assert.deepEqual(context.sourceFiles,['docs/example.txt']);
 assert.deepEqual(context.binaryFiles,[]);
 assert.match(context.text,/\+GIT binary patch/);
});
