#!/usr/bin/env node
'use strict';
// Local-only, fail-closed import from explicit labelled external data.
// Does not fetch networks, clone PRs, run models, or claim leaderboard scores.
const fs=require('node:fs');
const {normalizeExternalReviewCorpus}=require('../review-benchmark-adapter');
function parseInput(path){
 const bytes=fs.readFileSync(path);
 if(bytes.length>8*1024*1024)throw new Error('Benchmark input exceeds 8 MiB');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(path.endsWith('.jsonl')){
   const lines=text.split(/\r?\n/).filter(x=>x.trim());
   if(lines.length>500)throw new Error('Benchmark input exceeds 500 records');
   return lines.map(x=>JSON.parse(x));
 }
 const parsed=JSON.parse(text);
 if(!Array.isArray(parsed))throw new Error('Expected a JSON array or JSONL records');
 return parsed;
}
function main(args=process.argv.slice(2)){
 const flag=name=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw Error('Missing '+name);return args[i+1];};
 if(args.length<6)throw new Error('Usage: node scripts/review-benchmark-import.js --format reviewbench-golden|aacr-review-instances --source-revision <40hex> --input <file> [--approval <file>]');
 const format=flag('--format'),sourceRevision=flag('--source-revision');
 const records=parseInput(flag('--input'));
 const approval=args.includes('--approval')?JSON.parse(fs.readFileSync(flag('--approval'),'utf8')):{};
 const result=normalizeExternalReviewCorpus({format,sourceRevision,records,approval});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(require.main===module)try{main();}catch(e){console.error(String(e?.message||e));process.exitCode=2;}
module.exports={main,parseInput};
