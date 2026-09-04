'use strict';

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)])));
  return value;
}

function normalize(value, label) {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} capabilities must be an object.`);
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key)) throw new TypeError(`${label} capability key is invalid: ${key}`);
    if (!['string', 'number', 'boolean'].includes(typeof raw) && raw !== null) throw new TypeError(`${label} capability ${key} must be scalar.`);
    out[key] = raw;
  }
  return out;
}

function resolveEffectiveModelCapabilities({
  providerMetadata,
  registry,
  override,
  liveProbe
} = {}) {
  const layers = [
    ['provider', normalize(providerMetadata, 'provider')],
    ['registry', normalize(registry, 'registry')],
    ['override', normalize(override, 'override')],
    ['live', normalize(liveProbe, 'live probe')]
  ];
  const capabilities = {};
  const sources = {};
  for (const [source, values] of layers) {
    for (const [key, value] of Object.entries(values)) {
      if (source === 'override' && Object.prototype.hasOwnProperty.call(layers[3][1], key)) continue;
      capabilities[key] = value;
      sources[key] = source;
    }
  }
  for (const [key, value] of Object.entries(layers[3][1])) {
    capabilities[key] = value;
    sources[key] = 'live';
  }
  return freeze({ capabilities, sources, liveProbeAuthoritative: Object.keys(layers[3][1]).length > 0 });
}

function capabilitySatisfied(effective, key, expected = true) {
  if (!effective || typeof effective !== 'object') return false;
  const values = effective.capabilities && typeof effective.capabilities === 'object' ? effective.capabilities : effective;
  return Object.prototype.hasOwnProperty.call(values, key) && values[key] === expected;
}

module.exports = { resolveEffectiveModelCapabilities, capabilitySatisfied };
