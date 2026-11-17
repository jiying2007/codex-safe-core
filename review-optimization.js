'use strict';
// Review planning is deterministic. Code/text under review never becomes policy.
const crypto=require('node:crypto');
const {classifyPath}=require('./context-builder');
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MAX_FILES=2048,MAX_DIFF_BYTES=65536;
function checkedPath(value){
 if(typeof value!=='string'||!value||value.startsWith('/')||value.includes('\0')||
   value.split('/').some(x=>x==='.'||x==='..'||!x))throw new TypeError('Invalid review file path');
 return value;
}
function logicalStem(path){
 const base=path.slice(path.lastIndexOf('/')+1).toLowerCase();
 return base.replace(/\.(?:c|cc|cpp|cxx|h|hpp|hxx|js|jsx|ts|tsx|py|rs|go|json|yaml|yml|properties|proto|xml|md|dts|dtsi)$/, '')
   .replace(/(?:[._-](?:test|tests|spec|impl|interface|en|zh|zh_cn|zh-cn|en_us|en-us))$/,'');
}
function changedReferences(text){
 const refs=new Set();
 for(const line of String(text||'').slice(0,MAX_DIFF_BYTES).split('\n')){
   if(!line.startsWith('+')||line.startsWith('+++'))continue;
   const src=line.slice(1);let m;
   if((m=src.match(/^\s*#\s*include\s*[<"]([^>"]{1,160})[>"]/)))refs.add(m[1]);
   if((m=src.match(/^\s*(?:import|export)(?:[^'"]{0,140}\s+from\s+)?['"]([^'"]{1,160})['"]/)))refs.add(m[1]);
   if((m=src.match(/^\s*from\s+([A-Za-z][A-Za-z0-9_.]{0,120})\s+import\b/)))refs.add(m[1].replaceAll('.','/'));
   if(refs.size>=24)break;
 }
 return refs;
}
function related(a,b){
 if(a.path===b.path)return true;
 const aDir=a.path.slice(0,a.path.lastIndexOf('/')+1),bDir=b.path.slice(0,b.path.lastIndexOf('/')+1);
 const aStem=logicalStem(a.path),bStem=logicalStem(b.path);
 const generic=new Set(['main','index','config','test','tests','util','utils','readme','default','settings']);
 // Identical translation / declaration / test peers: exact logical stem,
 // scoped to a directory unless the stem is distinctive.
 if(aStem.length>=3&&aStem===bStem&&(aDir===bDir||!generic.has(aStem)))return true;
 const aBase=a.path.slice(a.path.lastIndexOf('/')+1),bBase=b.path.slice(b.path.lastIndexOf('/')+1);
 const match=(refs,p,base)=>[...refs].some(ref=>ref===base||ref===p||
   (ref.startsWith('./')&&p.endsWith(ref.slice(2)))||
   (ref.includes('/')&&p.endsWith('/'+ref)));
 return match(a.refs,b.path,bBase)||match(b.refs,a.path,aBase);
}
function planSemanticReviewGroups(files,{maxFilesPerGroup=8,maxGroupBytes=96*1024}={}){
 if(!Array.isArray(files))throw new TypeError('files must be an array');
 if(!Number.isSafeInteger(maxFilesPerGroup)||maxFilesPerGroup<1||maxFilesPerGroup>32||
    !Number.isSafeInteger(maxGroupBytes)||maxGroupBytes<1024||maxGroupBytes>8*1024*1024)
   throw new RangeError('Invalid semantic group bounds');
 const items=files.map((file,i)=>{
   const path=checkedPath(file?.path);
   const diff=String(file?.diffText??file?.diff??'');
   const bytes=Number.isSafeInteger(file?.bytes)&&file.bytes>=0?file.bytes:Buffer.byteLength(diff,'utf8');
   return {path,index:i,bytes,kind:String(file.kind||classifyPath(path)),refs:changedReferences(diff)};
 });
 const parent=items.map((_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const pairwise=items.length<=MAX_FILES;
 if(pairwise)for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)
   if(related(items[i],items[j]))parent[root(j)]=root(i);
 const components=new Map();
 for(let i=0;i<items.length;i++){const id=root(i);if(!components.has(id))components.set(id,[]);components.get(id).push(items[i]);}
 const ordered=[...components.values()].sort((a,b)=>a[0].index-b[0].index);
 const groups=[];
 for(const component of ordered){
   let current=[],size=0;
   const flush=()=>{
     if(!current.length)return;
     const paths=current.map(x=>x.path);
     groups.push(Object.freeze({id:sha(paths).slice(0,16),paths:Object.freeze(paths),bytes:size,
       related:component.length>1,oversized:size>maxGroupBytes}));
     current=[];size=0;
   };
   for(const item of component){
     if(current.length&&(current.length>=maxFilesPerGroup||size+item.bytes>maxGroupBytes))flush();
     current.push(item);size+=item.bytes;
     if(size>maxGroupBytes)flush(); // retain an indivisible file; never drop it.
   }
   flush();
 }
 return Object.freeze({groups:Object.freeze(groups),complete:true,scheduledFiles:items.length,
   inputFiles:items.length,degradations:Object.freeze(pairwise?[]:['pairwise_file_cap_per_file_fallback'])});
}
const RULES=Object.freeze({
 'safety-bounds':'Check bounds, null and error paths using changed evidence only',
 'source-lifetime':'Check allocation, cleanup symmetry and failure-path lifetime',
 'mcu-isr':'Check interrupt context, atomicity, DMA ownership and watchdog transitions',
 'ota-rollback':'Check verified boot, power-loss recovery, flash partitions and rollback',
 'motor-control':'Check saturation, timing, actuator state transitions and current protection',
 'linux-driver':'Check probe/remove unwind, sleeping context, IRQ and power transitions',
 'api-compatibility':'Check declarations against definitions, callers and ABI compatibility',
 'config-contract':'Check configuration defaults, schema migration and consumers together',
 'ci-supply-chain':'Check permission scoping, untrusted inputs, immutable pins and CI gates',
 'test-regression':'Check missing assertions, test reliability and changed behavior',
 'locale-parity':'Check key parity, substitutions and placeholder compatibility',
 'security-boundary':'Check authorization, secrets, injection and trust boundaries',
 'runtime-concurrency':'Check concurrent state transitions, cancellation and locks'
});
function resolveFileReviewRules(filePath,{maxRules=4}={}){
 const path=checkedPath(filePath),p=path.toLowerCase(),name=p.slice(p.lastIndexOf('/')+1);
 if(!Number.isSafeInteger(maxRules)||maxRules<1||maxRules>8)throw new RangeError('Invalid file-rule limit');
 const ids=[];
 const add=id=>{if(!ids.includes(id))ids.push(id);};
 if(/(^|\/)(?:kernel|drivers?|dts|devicetree)(\/|$)|\.(?:dts|dtsi)$/.test(p))add('linux-driver');
 if(/(?:^|[\/._-])(?:ota|bootloader|flash|dfu|firmware|rollback)(?:[\/._-]|$)/.test(p))add('ota-rollback');
 if(/(?:^|[\/._-])(?:motor|foc|pwm|bldc|encoder|pid)(?:[\/._-]|$)/.test(p))add('motor-control');
 if(/(?:^|[\/._-])(?:irq|isr|dma|rtos|mcu)(?:[\/._-]|$)/.test(p))add('mcu-isr');
 if(p.startsWith('.github/workflows/')||p.startsWith('.gitlab/')||/gitlab-ci\.yml$/.test(p))add('ci-supply-chain');
 if(/(?:^|\/)(?:auth|security|secrets?)(?:[\/._-]|$)/.test(p))add('security-boundary');
 if(/\.(?:h|hpp|hxx|proto|idl)$/.test(p))add('api-compatibility');
 if(/\.(?:json|yaml|yml|toml|ini|dts|dtsi|properties|xml)$/.test(p)||/^(?:makefile|cmakelists\.txt|kconfig)$/.test(name))add('config-contract');
 if(/\.(?:properties|po|pot)$/.test(p)||/[._-](?:en|zh|fr|de|es)(?:[._-]|$)/.test(name))add('locale-parity');
 if(/(^|\/)(?:tests?|__tests__|fixtures)(\/|$)|(?:[._-](?:test|spec))\./.test(p))add('test-regression');
 if(/\.(?:c|cc|cpp|h|hpp|rs)$/.test(p))add('source-lifetime');
 if(/\.(?:c|cc|cpp|h|hpp|rs|go|js|ts|py)$/.test(p))add('runtime-concurrency');
 add('safety-bounds');
 const selected=ids.slice(0,maxRules);
 return Object.freeze({path,ruleIds:Object.freeze(selected),
   checks:Object.freeze(selected.map(id=>RULES[id])),omittedRuleCount:ids.length-selected.length});
}
function buildReviewPlanPreview({files=[],chunks=[],groups=[],coverageGaps=[]}={}){
 if(!Array.isArray(files)||!Array.isArray(chunks)||!Array.isArray(groups)||!Array.isArray(coverageGaps))
   throw new TypeError('Review preview expects arrays');
 const planned=new Set(chunks.flatMap(x=>Array.isArray(x.paths)?x.paths:Array.isArray(x.files)?x.files.map(f=>f.path):[]));
 const items=files.map(file=>{
   const path=checkedPath(file.path),state=String(file.coverageState||(file.skipped?'excluded':'reviewable'));
   return Object.freeze({path,state,planned:planned.has(path),reason:String(file.skippedReason||''),ruleIds:resolveFileReviewRules(path).ruleIds});
 });
 const reviewable=items.filter(x=>x.state==='reviewable'||x.state==='reviewed_text');
 const unplanned=reviewable.filter(x=>!x.planned);
 return Object.freeze({modelCalls:0,fileCount:items.length,reviewableFiles:reviewable.length,
   plannedFiles:reviewable.length-unplanned.length,unplannedFiles:unplanned.length,
   groups:Object.freeze(groups.map(g=>Object.freeze({id:String(g.id),paths:Object.freeze([...g.paths]),oversized:Boolean(g.oversized)}))),
   chunks:chunks.length,items:Object.freeze(items),coverageGaps:Object.freeze([...coverageGaps]),
   complete:unplanned.length===0&&coverageGaps.length===0});
}
// Optional, deterministic fact-check candidate audit. This NEVER discards a
// finding by inference; high-risk and unverifiable claims always survive.
function auditReviewClaims(findings=[],{evidenceByPath={}}={}){
 if(!Array.isArray(findings))throw new TypeError('findings must be an array');
 const highRisk=new Set(['security','concurrency','resource','api']);
 const warnings=[];
 for(let index=0;index<findings.length;index++){
   const finding=findings[index];if(!finding||typeof finding!=='object')continue;
   const path=String(finding.file||finding.path||'');
   const evidence=evidenceByPath[path];
   if(!evidence||highRisk.has(String(finding.category||'')))continue;
   const literal=String(finding.claimedAbsentLiteral||'');
   if(literal.length<4||literal.length>120||/[\r\n\0]/.test(literal))continue;
   const added=String(evidence).split('\n').filter(x=>x.startsWith('+')&&!x.startsWith('+++'));
   if(added.some(line=>line.slice(1).includes(literal)))
     warnings.push(Object.freeze({index,path,reason:'literal_claim_conflicts_with_added_diff',
       disposition:'review_required_not_removed'}));
 }
 return Object.freeze({findings:Object.freeze([...findings]),warnings:Object.freeze(warnings),
   automaticallyRemoved:0});
}
module.exports=Object.freeze({planSemanticReviewGroups,resolveFileReviewRules,buildReviewPlanPreview,auditReviewClaims});
