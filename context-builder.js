'use strict';

const GENERATED_PATTERNS=[/package-lock\.json$/i,/pnpm-lock\.yaml$/i,/yarn\.lock$/i,/\.min\.(js|css)$/i,/^dist\//i,/^build\//i,/^vendor\//i];
const BINARY_EXTENSIONS=new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.gz','.xz','.7z','.bin','.so','.dll','.exe','.woff','.woff2']);
function classifyPath(filePath){const lower=String(filePath||'').replace(/\\/g,'/').toLowerCase(),dot=lower.lastIndexOf('.'),ext=dot>=0?lower.slice(dot):'';if(BINARY_EXTENSIONS.has(ext))return'binary';if(GENERATED_PATTERNS.some(pattern=>pattern.test(lower)))return'generated';return'source';}
function clampBudget(value,fallback=512*1024){const number=Number(value);return Number.isFinite(number)?Math.max(4096,Math.min(8*1024*1024,Math.floor(number))):fallback;}
function decodeGitQuotedPath(value){
 const text=String(value||'').trim();
 if(text[0]!=='"'||!text.endsWith('"'))return text;
 const bytes=[],body=text.slice(1,-1),esc={t:9,n:10,r:13,b:8,f:12,v:11};
 for(let i=0;i<body.length;i++){
   if(body.charCodeAt(i)===92){
     const oct=body.slice(i+1,i+4);
     if(oct.length===3&&/^[0-7]{3}$/.test(oct)){bytes.push(parseInt(oct,8));i+=3;continue;}
     const next=body[i+1];
     if(Object.hasOwn(esc,next)){bytes.push(esc[next]);i++;continue;}
     if(next==='"'||next===String.fromCharCode(92)){bytes.push(next.charCodeAt(0));i++;continue;}
   }
   const symbol=String.fromCodePoint(body.codePointAt(i));
   bytes.push(...Buffer.from(symbol));i+=symbol.length-1;
 }
 return Buffer.from(bytes).toString('utf8');
}
function parseGitDiffHeaderPaths(header){
 const prefix='diff --git ';
 if(!String(header).startsWith(prefix))return null;
 const raw=header.slice(prefix.length);
 if(raw[0]==='"'){
  const paths=[];let cursor=0;
  for(let item=0;item<2;item++){
   if(raw[cursor]!=='"')return null;
   const from=cursor++;
   let closed=false;
   while(cursor<raw.length){
    if(raw.charCodeAt(cursor)===92){cursor+=2;continue;}
    if(raw[cursor]==='"'){cursor++;closed=true;break;}
    cursor++;
   }
   if(!closed)return null;
   paths.push(decodeGitQuotedPath(raw.slice(from,cursor)));
   if(item===0){if(raw[cursor]!==' ')return null;cursor++;}
  }
  if(raw.slice(cursor).trim())return null;
  return {old:paths[0].startsWith('a/')?paths[0].slice(2):paths[0],new:paths[1].startsWith('b/')?paths[1].slice(2):paths[1]};
 }
 const marker=' b/',i=raw.lastIndexOf(marker);
 if(!raw.startsWith('a/')||i<2)return null;
 return {old:raw.slice(2,i),new:raw.slice(i+marker.length)};
}
function splitUnifiedDiff(diff){const text=String(diff||'');if(!text.trim())return[];const starts=[],pattern=/^diff --git /gm;let match;while((match=pattern.exec(text)))starts.push(match.index);if(!starts.length)return[{path:'<diff>',text,kind:'source'}];const blocks=[];for(let i=0;i<starts.length;i+=1){const block=text.slice(starts[i],starts[i+1]??text.length),first=block.match(/^diff --git a\/(.+?) b\/(.+)$/m),plus=block.match(/^\+\+\+ (?:b\/)?(.+)$/m);let file=plus?.[1]||first?.[2]||first?.[1]||'<unknown>';if(file==='/dev/null')file=first?.[1]||'<deleted>';const pathsFromHeader=parseGitDiffHeaderPaths(block.split('\n',1)[0]);const wasQuoted=String(file).trim().startsWith('"');file=decodeGitQuotedPath(file);if(wasQuoted&&file.startsWith('b/'))file=file.slice(2);if((file==='<unknown>'||file==='<deleted>')&&pathsFromHeader)file=file==='<deleted>'?pathsFromHeader.old:pathsFromHeader.new;blocks.push({path:file,text:block,kind:classifyPath(file)});}return blocks;}
function byteLength(value){return Buffer.byteLength(String(value||''),'utf8');}
function trimUtf8(value,maxBytes){const buffer=Buffer.from(String(value||''),'utf8');if(buffer.length<=maxBytes)return buffer.toString('utf8');let end=Math.max(0,maxBytes);while(end>0&&(buffer[end]&0xc0)===0x80)end-=1;return buffer.subarray(0,end).toString('utf8');}
function boundSourceBlock(block,budget){const text=String(block||'');if(byteLength(text)<=budget)return{text,truncated:false};const marker='\n@@ ... semantic budget omitted middle of this file ... @@\n',markerBytes=byteLength(marker);if(budget<=markerBytes+256)return{text:trimUtf8(text,budget),truncated:true};const available=budget-markerBytes,headBudget=Math.ceil(available*0.6),tailBudget=Math.floor(available*0.4),buffer=Buffer.from(text,'utf8'),head=trimUtf8(text,headBudget);let start=Math.max(0,buffer.length-tailBudget);while(start<buffer.length&&(buffer[start]&0xc0)===0x80)start+=1;const tail=buffer.subarray(start).toString('utf8');return{text:`${head}${marker}${tail}`,truncated:true};}
function allocateSourceBlocks(blocks,maxBytes){
  if(!blocks.length)return{text:'',truncated:false,included:[],truncatedFiles:[]};
  const budget=Math.max(0,Math.floor(Number(maxBytes)||0));
  if(!budget)return{text:'',truncated:true,included:[],truncatedFiles:blocks.map(block=>block.path)};
  const separator='\n',fullBytes=blocks.reduce((sum,block)=>sum+byteLength(block.text),Math.max(0,blocks.length-1));
  if(fullBytes<=budget)return{text:blocks.map(block=>block.text).join(separator),truncated:false,included:blocks.map(block=>block.path),truncatedFiles:[]};
  // Cap the represented file count before allocating byte slices. Previously
  // a 256-byte minimum per file could overflow a 4-KiB budget by many KiB.
  const minimumUsefulBytes=64,limit=Math.max(1,Math.floor((budget+1)/(minimumUsefulBytes+1)));
  const chosen=blocks.slice(0,Math.min(blocks.length,limit)),available=budget-Math.max(0,chosen.length-1);
  const fairShare=Math.floor(available/chosen.length);
  const allocations=chosen.map(block=>Math.min(byteLength(block.text),fairShare));
  let spare=available-allocations.reduce((sum,value)=>sum+value,0);
  for(let i=0;i<chosen.length&&spare>0;i++){
    const extra=Math.min(spare,Math.max(0,byteLength(chosen[i].text)-allocations[i]));
    allocations[i]+=extra;spare-=extra;
  }
  const output=[],truncatedFiles=blocks.slice(chosen.length).map(block=>block.path);
  for(let i=0;i<chosen.length;i++){
    const bounded=boundSourceBlock(chosen[i].text,allocations[i]);
    output.push(bounded.text);
    if(bounded.truncated)truncatedFiles.push(chosen[i].path);
  }
  const text=output.join(separator);
  if(byteLength(text)>budget)throw new Error('Semantic source allocation exceeded its byte budget.');
  return{text,truncated:truncatedFiles.length>0,included:chosen.map(block=>block.path),truncatedFiles};
}
function buildSemanticContext({files=[],diff='',commits=[],maxBytes=512*1024}={}){const budget=clampBudget(maxBytes),diffBlocks=splitUnifiedDiff(diff),paths=files.length?files:diffBlocks.map(block=>block.path).filter(path=>!path.startsWith('<')),normalizedFiles=Array.from(new Set(paths)).map(file=>({path:file,kind:classifyPath(file)})),source=normalizedFiles.filter(file=>file.kind==='source'),generated=normalizedFiles.filter(file=>file.kind==='generated'),binary=normalizedFiles.filter(file=>file.kind==='binary');const header=[`Changed files: ${normalizedFiles.length}`,source.length?`Source files (${source.length}):\n${source.map(file=>`- ${file.path}`).join('\n')}`:'',generated.length?`Generated/lock files (${generated.length}, metadata only):\n${generated.map(file=>`- ${file.path}`).join('\n')}`:'',binary.length?`Binary files (${binary.length}, metadata only):\n${binary.map(file=>`- ${file.path}`).join('\n')}`:'',commits.length?`Commits (${Math.min(commits.length,50)} shown):\n${commits.slice(0,50).map(value=>`- ${value}`).join('\n')}`:''].filter(Boolean).join('\n\n'),sourceBlocks=diffBlocks.filter(block=>block.kind==='source'),separator='\n\n--- SOURCE DIFFS ---\n',reserved=byteLength(header+separator),remaining=Math.max(0,budget-reserved),bounded=allocateSourceBlocks(sourceBlocks,remaining),suffix=bounded.truncatedFiles.length?`\n\n[semantic budget truncated source files: ${bounded.truncatedFiles.join(', ')}]`:'';const baseText=`${header}${separator}${bounded.text}`,fullText=byteLength(baseText+suffix)<=budget?baseText+suffix:baseText,overflow=byteLength(fullText)>budget;return Object.freeze({text:trimUtf8(fullText,budget),truncated:bounded.truncated||overflow,budgetBytes:budget,inputDiffBytes:byteLength(diff),sourceFiles:source.map(file=>file.path),generatedFiles:generated.map(file=>file.path),binaryFiles:binary.map(file=>file.path),includedSourceFiles:overflow?[]:bounded.included,truncatedSourceFiles:overflow?[...new Set(sourceBlocks.map(block=>block.path))]:bounded.truncatedFiles});}

function splitReviewBlock(block,maxBytes){if(byteLength(block.text)<=maxBytes)return{units:[{path:block.path,kind:block.kind,text:block.text,bytes:byteLength(block.text)}],gaps:[]};const matches=[...block.text.matchAll(/^@@ /gm)];if(!matches.length)return{units:[],gaps:[`${block.path}:block_exceeds_budget`]};const header=block.text.slice(0,matches[0].index),units=[],gaps=[];for(let i=0;i<matches.length;i+=1){const hunk=block.text.slice(matches[i].index,matches[i+1]?.index??block.text.length),text=`${header}${hunk}`,bytes=byteLength(text);if(bytes>maxBytes)gaps.push(`${block.path}:hunk_exceeds_budget`);else units.push({path:block.path,kind:block.kind,text,bytes});}return{units,gaps};}
function buildReviewEvidenceChunks({diff='',maxBytes=512*1024,maxChunks=8,includeKinds=['source']}={}){const budget=clampBudget(maxBytes),chunkLimit=Math.max(1,Math.min(64,Math.floor(Number(maxChunks)||8))),allowed=new Set(includeKinds),blocks=splitUnifiedDiff(diff),units=[],coverageGaps=[],excluded=[];for(const block of blocks){if(!allowed.has(block.kind)){excluded.push({path:block.path,kind:block.kind});continue;}const split=splitReviewBlock(block,budget);units.push(...split.units);coverageGaps.push(...split.gaps);}const chunks=[];let current=[],bytes=0;const flush=()=>{if(!current.length)return;chunks.push(Object.freeze({index:chunks.length,paths:Object.freeze([...new Set(current.map(unit=>unit.path))]),text:current.map(unit=>unit.text).join('\n'),bytes}));current=[];bytes=0;};for(const unit of units){if(current.length&&bytes+unit.bytes+1>budget)flush();if(chunks.length>=chunkLimit){coverageGaps.push(`${unit.path}:chunk_limit`);continue;}bytes+=unit.bytes+(current.length?1:0);current.push(unit);}if(current.length){if(chunks.length<chunkLimit)flush();else for(const unit of current)coverageGaps.push(`${unit.path}:chunk_limit`);}return Object.freeze({chunks:Object.freeze(chunks),complete:coverageGaps.length===0,coverageGaps:Object.freeze([...new Set(coverageGaps)]),excluded:Object.freeze(excluded),budgetBytes:budget,maxChunks:chunkLimit,inputDiffBytes:byteLength(diff)});}

module.exports={classifyPath,clampBudget,splitUnifiedDiff,boundSourceBlock,allocateSourceBlocks,buildSemanticContext,splitReviewBlock,buildReviewEvidenceChunks};
