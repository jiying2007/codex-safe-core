'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateModelRegistry, resolveModelSelection, buildModelEvidence } = require('../model-routing');

const model = { provider: 'relay', model: 'reviewer-a', class: 'balanced', roles: ['reviewer'], status: 'approved', health: 'healthy', priority: 1, qualificationId: 'q1', capabilities: { structuredOutput: true } };

function registry(revision = 'r1') { return { revision, models: [model] }; }

test('registry digest is canonical and changes with authority content', () => {
  const a = validateModelRegistry(registry('r1'));
  const b = validateModelRegistry({ models: [model], revision: 'r1' });
  const c = validateModelRegistry(registry('r2'));
  assert.match(a.digest, /^[0-9a-f]{64}$/);
  assert.equal(a.digest, b.digest);
  assert.notEqual(a.digest, c.digest);
});

test('routing policy digest binds selection inputs and is emitted in evidence', () => {
  const first = resolveModelSelection({ registry: registry(), mode: 'balanced', role: 'reviewer', strategy: 'auto', provider: 'relay' });
  const second = resolveModelSelection({ registry: registry(), mode: 'balanced', role: 'reviewer', strategy: 'auto', provider: 'relay', allowedProviders: ['relay'] });
  assert.match(first.routingPolicyDigest, /^[0-9a-f]{64}$/);
  assert.match(first.registryDigest, /^[0-9a-f]{64}$/);
  assert.notEqual(first.routingPolicyDigest, second.routingPolicyDigest);
  const evidence = buildModelEvidence(first, { routingPolicyRevision: 'policy-r1' });
  assert.equal(evidence.registryDigest, first.registryDigest);
  assert.equal(evidence.routingPolicyDigest, first.routingPolicyDigest);
});
