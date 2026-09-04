'use strict';

const MODEL_LINEAGE_VERSION = 1;

function clean(value, name, max = 512, allowEmpty = false) {
  const text = String(value ?? '').trim();
  if ((!allowEmpty && !text) || text.length > max || /[\r\n\0]/.test(text)) throw new TypeError(`${name} is invalid.`);
  return text;
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key,item])=>[key,freeze(item)])));
  return value;
}

function identityFromSelection(selection = {}) {
  if (!selection || typeof selection !== 'object') throw new TypeError('Model lineage requires a resolved selection.');
  return freeze({
    provider: clean(selection.resolvedProvider, 'resolvedProvider'),
    model: clean(selection.resolvedModel, 'resolvedModel'),
    revision: clean(selection.resolvedModelRevision || '', 'resolvedModelRevision', 256, true),
    revisionPinStrength: clean(selection.revisionPinStrength || 'unknown', 'revisionPinStrength', 32),
    registryRevision: clean(selection.registryRevision || 'unversioned', 'registryRevision', 256),
    qualificationId: clean(selection.qualificationId || '', 'qualificationId', 256, true),
    role: clean(selection.role || 'reviewer', 'role', 32),
    mode: clean(selection.mode || 'balanced', 'mode', 32)
  });
}

function createModelLineagePin({ lineageId, routingPolicyRevision = 'unversioned', selection } = {}) {
  return freeze({
    version: MODEL_LINEAGE_VERSION,
    lineageId: clean(lineageId, 'lineageId'),
    routingPolicyRevision: clean(routingPolicyRevision, 'routingPolicyRevision', 256),
    identity: identityFromSelection(selection)
  });
}

function compareModelLineagePin(pin, selection, { routingPolicyRevision } = {}) {
  if (!pin || typeof pin !== 'object' || Number(pin.version) !== MODEL_LINEAGE_VERSION) throw new TypeError('Model lineage pin is invalid.');
  const current = identityFromSelection(selection);
  const fields = ['provider','model','revision','revisionPinStrength','registryRevision','qualificationId','role','mode'];
  const mismatches = fields.filter(key => String(pin.identity?.[key] ?? '') !== String(current[key] ?? ''));
  if (routingPolicyRevision !== undefined && String(pin.routingPolicyRevision) !== String(routingPolicyRevision)) mismatches.push('routingPolicyRevision');
  return freeze({ matches: mismatches.length === 0, mismatches, expected: pin.identity, actual: current });
}

function createModelFailoverEvent({ lineageId, from, to, reason, at = new Date().toISOString() } = {}) {
  const fromIdentity = identityFromSelection(from);
  const toIdentity = identityFromSelection(to);
  const crossProvider = fromIdentity.provider !== toIdentity.provider;
  return freeze({
    version: MODEL_LINEAGE_VERSION,
    type: 'MODEL_FAILOVER',
    lineageId: clean(lineageId, 'lineageId'),
    reason: clean(reason, 'failover reason', 1024),
    at: clean(at, 'failover timestamp', 64),
    crossProvider,
    from: fromIdentity,
    to: toIdentity
  });
}

module.exports = { MODEL_LINEAGE_VERSION, createModelLineagePin, compareModelLineagePin, createModelFailoverEvent };
