'use strict';
const crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const SHA=/^[a-f0-9]{40}$/;
const CATEGORIES=new Set(['correctness','security','concurrency','resource','performance','robustness','maintainability','api','test','other']);
const SEVERITIES=new Set(['critical','high','medium','low','info']);
function validPath(x){
 return typeof x==='string'&&x.length>0&&x.length<=1024&&!x.startsWith('/')&&!x.includes('\0')&&
 !x.includes('\r')&&!x.includes('\n')&&!x.split('/').some(y=>y==='.'||y==='..'||!y);
}
function normalizeLabel(source){
 if(!source||!validPath(source.file||source.path))throw new Error('Unscoped external benchmark finding');
 const line=source.line??source.start_line??source.from_line;
 const end=source.endLine??source.end_line??source.to_line??line;
 if(!Number.isSafeInteger(line)||line<1||!Number.isSafeInteger(end)||end<line||end-line>200)
   throw new Error('External label requires a bounded exact line range');
 const category=String(source.category||'correctness'),severity=String(source.severity||'medium');
 if(!CATEGORIES.has(category)||!SEVERITIES.has(severity))
   throw new Error('Unsupported externally labelled category or severity');
 return Object.freeze({file:source.file||source.path,line,endLine:end,category,severity});
}
function normalizeExternalReviewCorpus({format,records,approval={},sourceRevision='',maxCases=200}={}){
 if(!['reviewbench-golden','aacr-review-instances'].includes(format))throw new Error('Unknown external Review benchmark format');
 if(!Array.isArray(records)||!records.length||records.length>500)
   throw new Error('Bounded array of external records required');
 if(!Number.isSafeInteger(maxCases)||maxCases<1||maxCases>500)throw new RangeError('Invalid benchmark cap');
 if(typeof sourceRevision!=='string'||!SHA.test(sourceRevision))
   throw new Error('Exact 40-byte source revision is required');
 const cases=[],excluded=[],seen=new Set();
 for(const record of records){
   if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('Invalid external record');
   let id,repo,base,head,rawLabels=[],truth='unverified';
   if(format==='reviewbench-golden'){
     id=String(record.pr_key||''),repo=String(record.pr?.repo||'');
     base=String(record.pr?.base||''),head=String(record.pr?.head||'');
     if(!Array.isArray(record.findings))throw new Error('ReviewBench findings are missing');
     // Only adjudicated TP findings become positive ground truth.
     rawLabels=record.findings.filter(f=>f.tp_fp==='tp'&&f.scope==='introduced-by-pr').map(f=>({
       file:f.file,line:f.start_line,end_line:f.end_line,category:f.category,severity:f.severity
     }));
     truth='reviewbench-labelled-tp';
   }else{
     id=String(record.instance_id||''),repo=String(record.repo||'');
     base=String(record.base_commit||''),head=String(record.head_commit||'');
     if(!Array.isArray(record.reference_comments))throw new Error('AACR reference_comments are missing');
     // AACR reference comments are not automatically labelled truth: only
     // explicitly approved human defect labels can enter the positive corpus.
     const allowed=approval[id];
     if(allowed?.approved===true&&Array.isArray(allowed.expected)){
       rawLabels=allowed.expected;
       truth='human-approved-aacr-defect';
     }
   }
   if(!id||!repo||!SHA.test(base)||!SHA.test(head)||seen.has(id))
     throw new Error('Duplicate or incomplete external PR identity');
   seen.add(id);
   if(!rawLabels.length){
     excluded.push(Object.freeze({id,reason:'no_verified_positive_ground_truth'}));
     continue; // Never convert an unlabeled or TP-empty PR into a clean negative.
   }
   if(rawLabels.length>128)throw new Error('Too many external findings per case');
   const labels=rawLabels.map(normalizeLabel);
   cases.push(Object.freeze({id:format+':'+id,sourceKind:'external-adjudicated',
     expected:Object.freeze(labels),provenance:Object.freeze({repo,base,head,groundTruth:truth})}));
   if(cases.length>=maxCases){excluded.push({id:'<remaining>',reason:'corpus_cap'});break;}
 }
 if(!cases.length)throw new Error('No verified external positives; cannot score an unlabeled benchmark');
 return Object.freeze({schemaVersion:1,sourceFormat:format,sourceRevision,
   sourceDigest:sha(records),corpus:Object.freeze({schemaVersion:3,cases:Object.freeze(cases)}),
   excluded:Object.freeze(excluded),eligibleCases:cases.length,rawRecordCount:records.length,
   freshModelExecution:false,
   warning:'Imported labels are source-bound evaluation references, not a fresh model review or benchmark leaderboard result.'});
}
module.exports=Object.freeze({normalizeExternalReviewCorpus});
