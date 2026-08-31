'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,validatePackage}=require('../scripts/verify-family-ui-contract');
function pkg(command,group,extra=[]){return {contributes:{menus:{'scm/title':[{command,group,when:'scmProvider == git && isWorkspaceTrusted'},...extra]}}};}
test('Family SCM primary sequence is Review then Commit then Change',()=>{assert.deepEqual(CONTRACT.primarySequence.map(x=>[x.productId,x.group]),[['codex-review-safe','navigation@5'],['codex-commit-safe','navigation@6'],['codex-change-safe','navigation@7']]);});
test('canonical primary entries pass',()=>{for(const x of CONTRACT.primarySequence)assert.deepEqual(validatePackage(pkg(x.command,x.group),x.productId),[]);});
test('secondary Review and Change commands cannot occupy scm/title',()=>{assert.ok(validatePackage(pkg('safeCodexReview.reviewStaged','navigation@5',[{command:'safeCodexReview.independentReviewStaged',group:'navigation@8',when:'scmProvider == git && isWorkspaceTrusted'}]),'codex-review-safe').length);assert.ok(validatePackage(pkg('safeCodexChange.createOrUpdate','navigation@7',[{command:'safeCodexChange.preflight',group:'navigation@8',when:'scmProvider == git && isWorkspaceTrusted'}]),'codex-change-safe').length);});
test('wrong group or trust clause fails',()=>{assert.ok(validatePackage(pkg('safeCodexCommit.generate','navigation@5'),'codex-commit-safe').length);const bad={contributes:{menus:{'scm/title':[{command:'safeCodexCommit.generate',group:'navigation@6',when:'scmProvider == git'}]}}};assert.ok(validatePackage(bad,'codex-commit-safe').length);});
