'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','family-upgrade.yml'),'utf8');

test('Family Upgrade resumes an already-materialized open upgrade PR instead of skipping it',()=>{
  assert.match(workflow,/gh pr list --repo .* --head "\$branch" --state open/);
  assert.match(workflow,/existing upgrade PR #\$pr is already materialized; resuming transaction/);
  assert.match(workflow,/"\$repo" prepared "\$pr" "\$branch"/);
  assert.match(workflow,/git -C "\$dir" checkout main/);
  assert.match(workflow,/main runtime-equivalent; no product repin\/release required/);
});

test('Family Upgrade polls Family release state once per attempt and retries only transient query failures',()=>{
  const releaseStateCalls=workflow.match(/node scripts\/family-release-state\.js/g)||[];
  assert.equal(releaseStateCalls.length,1);
  assert.doesNotMatch(workflow,/family-release-state\.js --repo/);
  assert.match(workflow,/for attempt in \{1\.\.60\}/);
  assert.match(workflow,/429\|5\[0-9\]\{2\}/);
  assert.match(workflow,/ECONNRESET\|ETIMEDOUT\|fetch failed/);
  assert.match(workflow,/transient Family release-state query failure/);
  assert.match(workflow,/Family consumers did not reach exact release \+ distribution \+ runtime readiness/);
});

test('Family Upgrade newline-terminates readiness parser output for Bash read under set -e',()=>{
  assert.match(workflow,/process\.stdout\.write\([^\n]+\+'\\n'\)/);
});
