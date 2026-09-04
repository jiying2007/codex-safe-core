'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveEffectiveModelCapabilities, capabilitySatisfied } = require('../model-capabilities');

test('live probe is authoritative over manual capability override', () => {
  const effective = resolveEffectiveModelCapabilities({
    providerMetadata: { structuredOutput: true, contextTokens: 100000 },
    registry: { codeReasoning: 'high' },
    override: { structuredOutput: true, contextTokens: 200000 },
    liveProbe: { structuredOutput: false }
  });
  assert.equal(effective.capabilities.structuredOutput, false);
  assert.equal(effective.sources.structuredOutput, 'live');
  assert.equal(effective.capabilities.contextTokens, 200000);
  assert.equal(effective.sources.contextTokens, 'override');
});

test('manual override fills metadata gaps when live probe is silent', () => {
  const effective = resolveEffectiveModelCapabilities({
    registry: { codeReasoning: 'medium' },
    override: { codeReasoning: 'high', contextTokens: 200000 }
  });
  assert.equal(effective.capabilities.codeReasoning, 'high');
  assert.equal(effective.capabilities.contextTokens, 200000);
  assert.equal(effective.liveProbeAuthoritative, false);
});

test('capabilitySatisfied requires exact proven value', () => {
  const effective = resolveEffectiveModelCapabilities({ liveProbe: { structuredOutput: true } });
  assert.equal(capabilitySatisfied(effective, 'structuredOutput'), true);
  assert.equal(capabilitySatisfied(effective, 'tools'), false);
});
