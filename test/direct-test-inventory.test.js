'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('default npm test must enumerate every direct test suite exactly once',()=>{
 const script=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).scripts.test;
 const entries=script.split(/\s+/).filter(x=>/^test\/[^/]+\.test\.js$/.test(x)).sort();
 const expected=fs.readdirSync(__dirname,{withFileTypes:true})
   .filter(x=>x.isFile()&&x.name.endsWith('.test.js'))
   .map(x=>'test/'+x.name).sort();
 assert.deepEqual(entries,expected,'Unlisted test files silently bypass Core CI');
 assert.equal(new Set(entries).size,entries.length,'Duplicate test file in the test runner');
});
