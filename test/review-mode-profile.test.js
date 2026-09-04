'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveReviewModePlan } = require('../model-routing');
const { resolveReviewModeProfile } = require('../review-profile-pack');

test('review modes define execution depth independently of engineering pack', () => {
  const fast = resolveReviewModeProfile('fast', 'embedded-linux');
  const deep = resolveReviewModeProfile('deep', 'embedded-linux');
  assert.equal(fast.mode, 'fast');
  assert.equal(deep.mode, 'deep');
  assert.equal(fast.packName, 'embedded-linux');
  assert.equal(deep.packName, 'embedded-linux');
  assert.deepEqual(fast.focusCategories, deep.focusCategories);
  assert.ok(fast.tokenFactor < deep.tokenFactor);
  assert.ok(fast.impactDepth < deep.impactDepth);
});

test('balanced mode is the stable default', () => {
  const plan = resolveReviewModePlan();
  assert.equal(plan.mode, 'balanced');
  assert.equal(plan.tokenFactor, 0.7);
  assert.equal(plan.impactDepth, 1);
});

test('mode overrides remain bounded', () => {
  const plan = resolveReviewModePlan('fast', { tokenFactor: 5, impactDepth: 99, maxImpactFiles: 999 });
  assert.equal(plan.tokenFactor, 1);
  assert.equal(plan.impactDepth, 3);
  assert.equal(plan.maxImpactFiles, 50);
});
