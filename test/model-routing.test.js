'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MODEL_ROUTING_CONTRACT_VERSION,
  validateModelRegistry,
  assessModelCompatibility,
  resolveModelSelection,
  buildModelEvidence
} = require('../model-routing');

function registry(models) {
  return { revision: 'test-registry-v1', models };
}

const fastScout = {
  provider: 'relay', model: 'fast-a', class: 'fast', roles: ['scout'], status: 'approved', health: 'healthy', priority: 10,
  qualificationId: 'qual-fast', capabilities: { structuredOutput: true }
};
const balancedReviewer = {
  provider: 'relay', model: 'balanced-a', class: 'balanced', roles: ['reviewer'], status: 'approved', health: 'healthy', priority: 10,
  qualificationId: 'qual-balanced', revision: 'rev-1', revisionPinStrength: 'exact', capabilities: { structuredOutput: true }
};
const frontierReviewer = {
  provider: 'relay', model: 'frontier-a', class: 'frontier', roles: ['reviewer', 'adjudicator'], status: 'approved', health: 'healthy', priority: 5,
  qualificationId: 'qual-frontier', capabilities: { structuredOutput: true }
};

test('registry validation is provider/model agnostic and immutable', () => {
  const result = validateModelRegistry(registry([fastScout, balancedReviewer]));
  assert.equal(result.version, MODEL_ROUTING_CONTRACT_VERSION);
  assert.equal(result.models.length, 2);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.models[0]), true);
});

test('auto balanced reviewer chooses approved balanced model over frontier when both qualify', () => {
  const result = resolveModelSelection({
    registry: registry([frontierReviewer, balancedReviewer]), mode: 'balanced', role: 'reviewer', strategy: 'auto', provider: 'relay'
  });
  assert.equal(result.resolvedModel, 'balanced-a');
  assert.equal(result.modelClass, 'balanced');
  assert.equal(result.degraded, false);
});

test('deep reviewer requires frontier under strict auto policy', () => {
  assert.throws(() => resolveModelSelection({
    registry: registry([balancedReviewer]), mode: 'deep', role: 'reviewer', strategy: 'auto', provider: 'relay'
  }), error => error?.code === 'MODEL_UNAVAILABLE');
  const result = resolveModelSelection({
    registry: registry([balancedReviewer, frontierReviewer]), mode: 'deep', role: 'reviewer', strategy: 'auto', provider: 'relay'
  });
  assert.equal(result.resolvedModel, 'frontier-a');
});

test('fixed selection defaults to warn compatibility for explicit benchmark freedom', () => {
  const result = resolveModelSelection({
    registry: registry([{ ...balancedReviewer, roles: ['reviewer', 'adjudicator'] }]),
    mode: 'deep', role: 'adjudicator', strategy: 'fixed', provider: 'relay', model: 'balanced-a'
  });
  assert.equal(result.resolvedModel, 'balanced-a');
  assert.equal(result.degraded, true);
  assert.equal(result.compatibility, 'degraded');
});

test('preference never crosses provider unless explicitly permitted', () => {
  const publicModel = { ...balancedReviewer, provider: 'public', model: 'balanced-public' };
  assert.throws(() => resolveModelSelection({
    registry: registry([publicModel]), mode: 'balanced', role: 'reviewer', strategy: 'preference',
    candidates: [{ provider: 'relay', model: 'missing' }, { provider: 'public', model: 'balanced-public' }], crossProvider: false
  }), error => error?.code === 'MODEL_UNAVAILABLE');
  const result = resolveModelSelection({
    registry: registry([publicModel]), mode: 'balanced', role: 'reviewer', strategy: 'preference',
    candidates: [{ provider: 'relay', model: 'missing' }, { provider: 'public', model: 'balanced-public' }], crossProvider: true
  });
  assert.equal(result.resolvedProvider, 'public');
  assert.equal(result.fallbackUsed, true);
});

test('unhealthy or non-approved models are not auto eligible', () => {
  assert.throws(() => resolveModelSelection({
    registry: registry([{ ...balancedReviewer, status: 'qualified' }, { ...frontierReviewer, health: 'unhealthy' }]),
    mode: 'balanced', role: 'reviewer', strategy: 'auto', provider: 'relay'
  }), error => error?.code === 'MODEL_UNAVAILABLE');
});

test('scout can use fast while adjudicator requires frontier', () => {
  assert.equal(assessModelCompatibility({ mode: 'fast', role: 'scout', modelClass: 'fast', policy: 'strict' }).compatible, true);
  assert.equal(assessModelCompatibility({ mode: 'fast', role: 'adjudicator', modelClass: 'balanced', policy: 'strict' }).allowed, false);
});

test('model evidence records selection and normalized usage without credentials or prompts', () => {
  const selection = resolveModelSelection({
    registry: registry([balancedReviewer]), mode: 'balanced', role: 'reviewer', strategy: 'auto', provider: 'relay'
  });
  const evidence = buildModelEvidence(selection, {
    routingPolicyRevision: 'routing-v1', lineagePinned: true,
    usage: { inputTokens: 100, cachedInputTokens: 25, outputTokens: 10, reasoningOutputTokens: 5 }
  });
  assert.equal(evidence.resolvedModel, 'balanced-a');
  assert.equal(evidence.routingPolicyRevision, 'routing-v1');
  assert.equal(evidence.lineagePinned, true);
  assert.deepEqual(evidence.usage, {
    inputTokens: 100, cachedInputTokens: 25, cacheWriteInputTokens: 0, outputTokens: 10, reasoningOutputTokens: 5
  });
  assert.equal('apiKey' in evidence, false);
  assert.equal('prompt' in evidence, false);
});
