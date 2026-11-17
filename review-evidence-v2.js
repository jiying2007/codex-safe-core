'use strict';
// Bounded, deterministic review evidence. Regex/lexical matches are hints,
// never a resolved compiler call graph or proof of a semantic defect.
const crypto=require('node:crypto');
const {splitUnifiedDiff}=require('./context-builder');
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const MAX_DIFF=2*1024*1024,MAX_SOURCE=96*1024,MAX_FILES=64;
const namePattern=/^[A-Za-z_$][A-Za-z0-9_$]*$/;
const forbidden=new Set(['if','while','for','switch','catch','return','throw','sizeof','new','delete','else','do','case','function','def']);
function boundedInt(value,defaultValue,max){
 if(value===undefined)return defaultValue;
 if(!Number.isSafeInteger(value)||value<1||value>max)throw new RangeError('Invalid review evidence bound');
 return value;
}
function validPath(value){
 return typeof value==='string'&&value.length>0&&value.length<=1024&&!value.startsWith('/')&&
   !value.includes('\0')&&!value.includes('\r')&&!value.includes('\n')&&
   !value.split('/').some(x=>x==='.'||x==='..'||x==='');
}
function definition(line,path){
 const s=String(line||'').trim().slice(0,500);
 let m;
 if((m=/^(?:(?:export|default|async|declare|public|private|static)\s+)*function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(s)))return m[1];
 if((m=/^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(s)))return m[1];
 if((m=/^(?:(?:export|const|let|var|static|readonly|async)\s+){1,4}([A-Za-z_$][\w$]*)\s*=\s*(?:(?:async\s*)?\([^)]{0,160}\)|[A-Za-z_$][\w$]*)\s*=>/.exec(s)))return m[1];
 if(/\.(?:c|cc|cpp|cxx|h|hpp|hxx|rs|go|java|kt|cs)$/i.test(path)){
   // Conservative declaration/definition. No function-pointer resolution.
   m=/^(?:(?:inline|static|extern|const|volatile|unsigned|signed|struct|virtual|constexpr|noexcept)\s+){0,5}[A-Za-z_][\w:<>,*& \t]{0,150}\s+([A-Za-z_]\w*)\s*\([^()]{0,180}\)\s*(?:const\s*)?(?:\{|;|$)/.exec(s);
   if(m&&!forbidden.has(m[1]))return m[1];
 }
 return '';
}
function parseChangedLines(diff,{maxDiffBytes=MAX_DIFF}={}){
 if(typeof diff!=='string')throw new TypeError('Diff must be text');
 const max=boundedInt(maxDiffBytes,MAX_DIFF,MAX_DIFF);
 if(Buffer.byteLength(diff,'utf8')>max)return Object.freeze({lines:[],complete:false,reasons:['diff_byte_limit']});
 const lines=[];let valid=true;
 for(const block of splitUnifiedDiff(diff)){
   if(!validPath(block.path)){valid=false;continue;}
   let oldLine=0,newLine=0,inHunk=false;
   for(const text of block.text.split(/\r?\n/)){
     const h=/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(text);
     if(h){oldLine=Number(h[1]);newLine=Number(h[2]);inHunk=true;continue;}
     if(!inHunk)continue;
     if(text.startsWith('+')){lines.push({path:block.path,side:'new',line:newLine,text:text.slice(1)});newLine++;}
     else if(text.startsWith('-')){lines.push({path:block.path,side:'old',line:oldLine,text:text.slice(1)});oldLine++;}
     else if(text.startsWith(' ')){oldLine++;newLine++;}
     else if(text.startsWith('\\'))continue;
     else if(text)valid=false;
   }
 }
 return Object.freeze({lines,complete:valid,reasons:valid?[]:['invalid_diff_path_or_line']});
}
function buildFunctionImpactEvidence({diff='',candidates=[],maxSymbols=32,maxEdges=64,maxBytes=24*1024}={}){
 const symbolLimit=boundedInt(maxSymbols,32,256),edgeLimit=boundedInt(maxEdges,64,512);
 const outputLimit=boundedInt(maxBytes,24*1024,256*1024);
 const parsed=parseChangedLines(diff),reasons=[...parsed.reasons],seedMap=new Map();
 for(const item of parsed.lines){
   if(item.side!=='new')continue;
   const symbol=definition(item.text,item.path);
   if(!symbol||seedMap.has(symbol))continue;
   seedMap.set(symbol,{name:symbol,path:item.path,line:item.line,kind:'changed_declaration',
     identity:hash(item.path+'\0'+symbol+'\0'+item.line).slice(0,20)});
   if(seedMap.size>=symbolLimit){reasons.push('symbol_limit');break;}
 }
 if(!seedMap.size){
   // A modified body without a changed declaration cannot identify its owner
   // with this parser. Never invent an enclosing function from partial hunks.
   return Object.freeze({version:1,kind:'lexical_function_impact',complete:parsed.complete,
     seeds:[],edges:[],bytes:0,confidence:'none',reasons:Object.freeze([...new Set(reasons)]),
     disclaimer:'No changed function declaration proven from the diff; semantic relationships not assessed.'});
 }
 if(!Array.isArray(candidates))throw new TypeError('Impact candidates must be an array');
 if(candidates.length>MAX_FILES)reasons.push('candidate_file_limit');
 const edges=[],seen=new Set();let inputBytes=0;
 for(const file of candidates.slice(0,MAX_FILES)){
   if(!validPath(file?.path)){reasons.push('candidate_path_invalid');continue;}
   if(typeof file.content!=='string'){reasons.push('candidate_text_missing');continue;}
   const size=Buffer.byteLength(file.content,'utf8');
   if(size>MAX_SOURCE){reasons.push('candidate_file_oversized');continue;}
   inputBytes+=size;
   if(inputBytes>MAX_SOURCE*MAX_FILES){reasons.push('aggregate_source_limit');break;}
   const rows=file.content.split(/\r?\n/);
   let enclosing='',enclosingLine=0;
   for(let i=0;i<rows.length&&i<16000;i++){
     const row=rows[i].slice(0,1000);
     const declared=definition(row,file.path);
     if(declared){enclosing=declared;enclosingLine=i+1;}
     if(declared)continue; // definition is not itself a CALLS edge
     for(const seed of seedMap.values()){
       // Identity = same function spelling, not resolved import or receiver.
       // Exclude obvious comments and natural-language lines.
       if(/^\s*(?:\/\/|#|\*|\/\*)/.test(row))continue;
       const matcher=new RegExp('(?:^|[^A-Za-z0-9_$])'+seed.name.replace(/[$]/g,'\\$&')+'\\s*\\(');
       if(!matcher.test(row))continue;
       const key=JSON.stringify([file.path,i+1,seed.identity]);
       if(seen.has(key))continue;
       seen.add(key);
       edges.push(Object.freeze({kind:'lexical_call_candidate',symbol:seed.name,
         from:{path:file.path,line:i+1,function:enclosing||null,functionStart:enclosingLine||null},
         to:{path:seed.path,line:seed.line,identity:seed.identity},
         confidence:enclosing?0.6:0.45,verifiedResolution:false}));
       if(edges.length>=edgeLimit){reasons.push('edge_limit');break;}
     }
     if(edges.length>=edgeLimit)break;
   }
   if(rows.length>16000)reasons.push('candidate_line_limit');
   if(edges.length>=edgeLimit)break;
 }
 const seeds=[...seedMap.values()];
 // Never trim individual evidence objects in a way that changes identities.
 while(Buffer.byteLength(JSON.stringify({seeds,edges}),'utf8')>outputLimit&&edges.length){
   edges.pop();reasons.push('evidence_byte_limit');
 }
 const bytes=Buffer.byteLength(JSON.stringify({seeds,edges}),'utf8');
 if(bytes>outputLimit){reasons.push('seed_byte_limit');}
 return Object.freeze({version:1,kind:'lexical_function_impact',complete:parsed.complete&&reasons.length===0,
   seeds:Object.freeze(seeds.map(Object.freeze)),edges:Object.freeze(edges),
   bytes,confidence:'heuristic_only',reasons:Object.freeze([...new Set(reasons)]),
   disclaimer:'Lexical call sites are candidate dependencies, never compiler-verified target resolution.'});
}
const RISK_PATTERNS=Object.freeze([
 {id:'irq-blocking',category:'concurrency',path:/(?:irq|isr|interrupt)[/_.-]/i,regex:/\b(?:msleep|usleep|sleep|mutex_lock|wait_event)\s*\(/},
 {id:'unsafe-copy',category:'security',path:/\.(?:c|h|cpp|cc)$/i,regex:/\b(?:strcpy|strcat|sprintf|gets)\s*\(/},
 {id:'ota-flash-write',category:'robustness',path:/(?:ota|boot|flash|firmware)/i,regex:/\b(?:erase|flash_write|flash_erase|write_partition|set_active_slot)\s*\(/i},
 {id:'tls-verify-disabled',category:'security',path:/.*/,regex:/\b(?:rejectUnauthorized\s*:\s*false|verify\s*=\s*False|CURLOPT_SSL_VERIFYPEER\s*,\s*0)\b/i},
 {id:'unsafe-ci-trigger',category:'security',path:/\.github\/workflows\/.+\.ya?ml$/i,regex:/\bpull_request_target\s*:/},
 {id:'world-writable',category:'security',path:/.*/,regex:/\b(?:chmod\s+0?777|chmod\s*\([^)]*,\s*0?777)\b/i}
]);
function buildReviewRiskEvidence({diff='',maxSignals=24}={}){
 const cap=boundedInt(maxSignals,24,128),parsed=parseChangedLines(diff),signals=[],reasons=[...parsed.reasons];
 for(const item of parsed.lines){
   if(item.side!=='new')continue;
   for(const rule of RISK_PATTERNS){
     if(!rule.path.test(item.path)||!rule.regex.test(item.text))continue;
     signals.push(Object.freeze({path:item.path,side:item.side,line:item.line,
       ruleId:rule.id,category:rule.category,disposition:'review_hint_not_defect',
       textDigest:hash(item.text),confidence:'pattern_only'}));
     if(signals.length>=cap){reasons.push('risk_signal_limit');break;}
   }
   if(signals.length>=cap)break;
 }
 return Object.freeze({version:1,kind:'deterministic_review_risk',signals:Object.freeze(signals),
   complete:parsed.complete&&reasons.length===0,reasons:Object.freeze([...new Set(reasons)]),
   disclaimer:'Risk hints prioritize review; no rule creates a confirmed finding.'});
}
function verifyFindingEvidence({diff='',findings=[],maxFindings=128}={}){
 if(!Array.isArray(findings))throw new TypeError('Findings must be an array');
 const cap=boundedInt(maxFindings,128,512);
 if(findings.length>cap)throw new RangeError('Review findings exceed verification capacity');
 const parsed=parseChangedLines(diff),indexed=new Map();
 for(const line of parsed.lines){
   indexed.set(JSON.stringify([line.path,line.side,line.line]),line);
 }
 const results=findings.map((finding,index)=>{
   const path=String(finding?.file||''),side=String(finding?.side||'new');
   const from=finding?.line,end=finding?.endLine??from;
   let status='insufficient_evidence',reason='anchor_missing_or_invalid';
   if(validPath(path)&&(side==='new'||side==='old')&&Number.isSafeInteger(from)&&
      Number.isSafeInteger(end)&&from>0&&end>=from&&end-from<=200){
     const anchors=[];
     for(let line=from;line<=end;line++)anchors.push(indexed.get(JSON.stringify([path,side,line])));
     if(anchors.every(Boolean)){
       status='anchor_verified';reason='exact_changed_line_range';
       if(typeof finding?.expectedLineText==='string'&&finding.expectedLineText.length<=1000&&
          finding.expectedLineText!==anchors[0].text){
         status='evidence_conflict';reason='claimed_line_text_mismatch';
       }
       if(typeof finding?.expectedLineDigest==='string'&&
          finding.expectedLineDigest!==hash(anchors[0].text)){
         status='evidence_conflict';reason='claimed_line_digest_mismatch';
       }
     }
   }
   return Object.freeze({index,path,side,line:from,endLine:end,status,reason,
     semanticDefectVerified:false,automaticallyRemoved:false,
     sourceShaBound:false});
 });
 return Object.freeze({version:1,kind:'review_evidence_verification',complete:parsed.complete,
   results:Object.freeze(results),verifiedAnchorCount:results.filter(x=>x.status==='anchor_verified').length,
   conflicts:results.filter(x=>x.status==='evidence_conflict').length,
   incomplete:results.filter(x=>x.status==='insufficient_evidence').length,
   automaticallyRemoved:0,findings:Object.freeze([...findings]),
   disclaimer:'Verifies changed-line anchors only, never proves or disproves a semantic defect.'});
}
module.exports=Object.freeze({parseChangedLines,buildFunctionImpactEvidence,buildReviewRiskEvidence,verifyFindingEvidence});
