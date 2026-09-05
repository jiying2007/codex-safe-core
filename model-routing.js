'use strict';

const crypto = require('node:crypto');

const MODEL_ROUTING_CONTRACT_VERSION = 1;
const REVIEW_MODES = Object.freeze(['fast', 'balanced', 'deep']);
const REVIEW_MODE_PLANS = Object.freeze({
  fast: Object.freeze({ mode: 'fast', evidenceFactor: 0.35, contextFactor: 0.25, tokenFactor: 0.4, impactDepth: 0, maxImpactFiles: 0 }),
  balanced: Object.freeze({ mode: 'balanced', evidenceFactor: 0.7, contextFactor: 0.6, tokenFactor: 0.7, impactDepth: 1, maxImpactFiles: 8 }),
  deep: Object.freeze({ mode: 'deep', evidenceFactor: 1, contextFactor: 1, tokenFactor: 1, impactDepth: 2, maxImpactFiles: 20 })
});
const MODEL_ROLES = Object.freeze(['scout', 'reviewer', 'adjudicator']);
const MODEL_CLASSES = Object.freeze(['fast', 'balanced', 'frontier']);
const MODEL_SELECTION_STRATEGIES = Object.freeze(['auto', 'preference', 'fixed']);
const MODEL_COMPATIBILITY_POLICIES = Object.freeze(['strict', 'warn', 'permissive']);
const MODEL_STATUSES = Object.freeze(['discovered', 'compatible', 'qualified', 'shadow', 'canary', 'approved', 'deprecated']);
const MODEL_HEALTH = Object.freeze(['healthy', 'unknown', 'unhealthy']);
const REVISION_PIN_STRENGTH = Object.freeze(['exact', 'alias', 'unknown']);

const CLASS_RANK = Object.freeze({ fast: 0, balanced: 1, frontier: 2 });
const HEALTH_RANK = Object.freeze({ healthy: 0, unknown: 1, unhealthy: 2 });
const MODE_MIN_CLASS = Object.freeze({ fast: 'fast', balanced: 'balanced', deep: 'frontier' });
const ROLE_MIN_CLASS = Object.freeze({ scout: 'fast', reviewer: 'fast', adjudicator: 'frontier' });

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)])));
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function clean(value, name, max = 256, { allowEmpty = false } = {}) {
  const text = String(value ?? '').trim();
  if ((!allowEmpty && !text) || text.length > max || /[\r\n\0]/.test(text)) throw new TypeError(`${name} is invalid.`);
  return text;
}

function enumValue(value, values, name, fallback) {
  const resolved = value === undefined || value === null || value === '' ? fallback : String(value);
  if (!values.includes(resolved)) throw new TypeError(`${name} is unsupported: ${resolved}`);
  return resolved;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function resolveReviewModePlan(mode = 'balanced', overrides = {}) {
  const key = enumValue(mode, REVIEW_MODES, 'mode', 'balanced');
  const base = REVIEW_MODE_PLANS[key];
  return freeze({
    ...base,
    evidenceFactor: clamp(overrides.evidenceFactor, 0.1, 1, base.evidenceFactor),
    contextFactor: clamp(overrides.contextFactor, 0.1, 1, base.contextFactor),
    tokenFactor: clamp(overrides.tokenFactor, 0.1, 1, base.tokenFactor),
    impactDepth: Math.floor(clamp(overrides.impactDepth, 0, 3, base.impactDepth)),
    maxImpactFiles: Math.floor(clamp(overrides.maxImpactFiles, 0, 50, base.maxImpactFiles))
  });
}

function normalizeCapabilities(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('model capabilities must be an object.');
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key)) throw new TypeError(`model capability key is invalid: ${key}`);
    if (!['string', 'number', 'boolean'].includes(typeof raw) && raw !== null) throw new TypeError(`model capability ${key} must be scalar.`);
    out[key] = raw;
  }
  return freeze(out);
}

function normalizeRegistryModel(raw, index = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`registry model ${index} must be an object.`);
  const provider = clean(raw.provider, `registry model ${index} provider`, 128);
  const model = clean(raw.model, `registry model ${index} model`, 256);
  const id = clean(raw.id || `${provider}/${model}`, `registry model ${index} id`, 512);
  const modelClass = enumValue(raw.class, MODEL_CLASSES, `registry model ${id} class`, 'balanced');
  const roles = Array.isArray(raw.roles) ? [...new Set(raw.roles.map(role => enumValue(role, MODEL_ROLES, `registry model ${id} role`)))] : [];
  if (!roles.length) throw new TypeError(`registry model ${id} must declare at least one role.`);
  const status = enumValue(raw.status, MODEL_STATUSES, `registry model ${id} status`, 'discovered');
  const health = enumValue(raw.health, MODEL_HEALTH, `registry model ${id} health`, 'unknown');
  const revisionPinStrength = enumValue(raw.revisionPinStrength, REVISION_PIN_STRENGTH, `registry model ${id} revisionPinStrength`, raw.revision ? 'exact' : 'unknown');
  const priority = Number.isFinite(Number(raw.priority)) ? Math.max(-1000000, Math.min(1000000, Number(raw.priority))) : 0;
  return freeze({
    id,
    provider,
    model,
    class: modelClass,
    roles,
    status,
    health,
    priority,
    qualificationId: clean(raw.qualificationId || '', `registry model ${id} qualificationId`, 256, { allowEmpty: true }),
    revision: clean(raw.revision || '', `registry model ${id} revision`, 256, { allowEmpty: true }),
    revisionPinStrength,
    capabilities: normalizeCapabilities(raw.capabilities || {})
  });
}

function validateModelRegistry(registry = {}) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('model registry must be an object.');
  const revision = clean(registry.revision || 'unversioned', 'model registry revision', 256);
  const values = Array.isArray(registry.models) ? registry.models : [];
  const models = values.map(normalizeRegistryModel);
  const ids = new Set();
  const providerModels = new Set();
  for (const model of models) {
    if (ids.has(model.id)) throw new TypeError(`duplicate model registry id: ${model.id}`);
    ids.add(model.id);
    const providerModel = `${model.provider}\n${model.model}`;
    if (providerModels.has(providerModel)) throw new TypeError(`duplicate provider/model registry identity: ${model.provider}/${model.model}`);
    providerModels.add(providerModel);
  }
  const registryDigest = digest({ version: MODEL_ROUTING_CONTRACT_VERSION, revision, models });
  return freeze({ version: MODEL_ROUTING_CONTRACT_VERSION, revision, digest: registryDigest, models });
}

function requiredClassFor(mode, role) {
  const resolvedMode = enumValue(mode, REVIEW_MODES, 'mode', 'balanced');
  const resolvedRole = enumValue(role, MODEL_ROLES, 'role', 'reviewer');
  const rank = Math.max(CLASS_RANK[MODE_MIN_CLASS[resolvedMode]], CLASS_RANK[ROLE_MIN_CLASS[resolvedRole]]);
  return MODEL_CLASSES[rank];
}

function assessModelCompatibility({ mode = 'balanced', role = 'reviewer', modelClass = 'balanced', policy } = {}) {
  const resolvedMode = enumValue(mode, REVIEW_MODES, 'mode', 'balanced');
  const resolvedRole = enumValue(role, MODEL_ROLES, 'role', 'reviewer');
  const resolvedClass = enumValue(modelClass, MODEL_CLASSES, 'modelClass', 'balanced');
  const compatibilityPolicy = enumValue(policy, MODEL_COMPATIBILITY_POLICIES, 'compatibilityPolicy', 'strict');
  const requiredClass = requiredClassFor(resolvedMode, resolvedRole);
  const compatible = CLASS_RANK[resolvedClass] >= CLASS_RANK[requiredClass];
  return freeze({
    mode: resolvedMode,
    role: resolvedRole,
    modelClass: resolvedClass,
    requiredClass,
    compatibilityPolicy,
    compatible,
    degraded: !compatible,
    allowed: compatible || compatibilityPolicy !== 'strict'
  });
}

function normalizeCandidate(raw, name = 'candidate') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`${name} must be an object.`);
  return freeze({
    provider: clean(raw.provider, `${name} provider`, 128),
    model: clean(raw.model, `${name} model`, 256)
  });
}

function normalizeEconomicsRecord(raw = {}, name = 'economics') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`${name} must be an object.`);
  const number = key => {
    const value = Number(raw[key]);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };
  return freeze({
    samples: Math.max(0, Math.floor(Number(raw.samples) || 0)),
    qualityApproved: raw.qualityApproved !== false,
    tokensPerVerifiedFinding: number('tokensPerVerifiedFinding'),
    costPerVerifiedFinding: number('costPerVerifiedFinding'),
    latencyP95Ms: number('latencyP95Ms'),
    falsePositiveRate: number('falsePositiveRate'),
    coverageRatio: Math.max(0, Math.min(1, Number(raw.coverageRatio) || 0))
  });
}

function normalizeEconomicsByModel(value = {}) {
  if (value === undefined || value === null) return freeze({});
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('economicsByModel must be an object.');
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const identity = clean(key, 'economics model key', 512);
    out[identity] = normalizeEconomicsRecord(raw, `economics ${identity}`);
  }
  return freeze(out);
}

function economicsFor(model, economicsByModel, minimumSamples) {
  const raw = economicsByModel[model.id]
    || economicsByModel[`${model.provider}/${model.model}`]
    || economicsByModel[`${model.provider}\n${model.model}`];
  if (!raw || raw.samples < minimumSamples) return null;
  return raw;
}

function economicsDominance(a, b) {
  if (!a || !b) return 0;
  const lower = ['tokensPerVerifiedFinding', 'costPerVerifiedFinding', 'latencyP95Ms', 'falsePositiveRate'];
  const aNoWorse = lower.every(key => a[key] <= b[key]) && a.coverageRatio >= b.coverageRatio;
  const bNoWorse = lower.every(key => b[key] <= a[key]) && b.coverageRatio >= a.coverageRatio;
  const aBetter = lower.some(key => a[key] < b[key]) || a.coverageRatio > b.coverageRatio;
  const bBetter = lower.some(key => b[key] < a[key]) || b.coverageRatio > a.coverageRatio;
  if (aNoWorse && aBetter) return -1;
  if (bNoWorse && bBetter) return 1;
  return 0;
}

function modelLookup(registry) {
  const byIdentity = new Map();
  for (const item of registry.models) byIdentity.set(`${item.provider}\n${item.model}`, item);
  return byIdentity;
}

function baseEligibility(model, role, { approvedOnly = true } = {}) {
  if (!model || model.health === 'unhealthy' || !model.roles.includes(role) || model.status === 'deprecated') return false;
  if (approvedOnly && model.status !== 'approved') return false;
  return true;
}

function chooseAuto(registry, role, mode, compatibilityPolicy, provider, allowedProviders, economicsByModel, minimumEconomicsSamples) {
  return registry.models
    .filter(model => baseEligibility(model, role, { approvedOnly: true }))
    .filter(model => !provider || model.provider === provider)
    .filter(model => !allowedProviders.length || allowedProviders.includes(model.provider))
    .map(model => ({
      model,
      compatibility: assessModelCompatibility({ mode, role, modelClass: model.class, policy: compatibilityPolicy }),
      economics: economicsFor(model, economicsByModel, minimumEconomicsSamples)
    }))
    .filter(item => item.compatibility.allowed)
    .filter(item => !item.economics || item.economics.qualityApproved)
    .sort((a, b) => {
      if (a.compatibility.degraded !== b.compatibility.degraded) return a.compatibility.degraded ? 1 : -1;
      if (HEALTH_RANK[a.model.health] !== HEALTH_RANK[b.model.health]) return HEALTH_RANK[a.model.health] - HEALTH_RANK[b.model.health];

      if (a.economics && b.economics) {
        const dominance = economicsDominance(a.economics, b.economics);
        if (dominance) return dominance;
      } else if (a.economics || b.economics) {
        return a.economics ? -1 : 1;
      }

      const target = CLASS_RANK[requiredClassFor(mode, role)];
      const distanceA = Math.abs(CLASS_RANK[a.model.class] - target);
      const distanceB = Math.abs(CLASS_RANK[b.model.class] - target);
      if (distanceA !== distanceB) return distanceA - distanceB;
      if (a.model.priority !== b.model.priority) return b.model.priority - a.model.priority;
      return a.model.id.localeCompare(b.model.id);
    })[0] || null;
}

function resolveModelSelection(request = {}) {
  const registry = validateModelRegistry(request.registry || {});
  const role = enumValue(request.role, MODEL_ROLES, 'role', 'reviewer');
  const mode = enumValue(request.mode, REVIEW_MODES, 'mode', 'balanced');
  const strategy = enumValue(request.strategy, MODEL_SELECTION_STRATEGIES, 'selectionStrategy', 'auto');
  const compatibilityPolicy = enumValue(request.compatibilityPolicy, MODEL_COMPATIBILITY_POLICIES, 'compatibilityPolicy', strategy === 'fixed' ? 'warn' : 'strict');
  const provider = clean(request.provider || '', 'requested provider', 128, { allowEmpty: true });
  const allowedProviders = Array.isArray(request.allowedProviders)
    ? [...new Set(request.allowedProviders.map((value, index) => clean(value, `allowedProviders[${index}]`, 128)))]
    : [];
  const crossProvider = request.crossProvider === true;
  const normalizedCandidates = Array.isArray(request.candidates)
    ? request.candidates.map((item, index) => normalizeCandidate(item, `candidate ${index}`))
    : [];
  const fixed = strategy === 'fixed'
    ? {
        provider: provider || clean(request.fixed?.provider || '', 'fixed provider', 128),
        model: clean(request.model || request.fixed?.model || '', 'fixed model', 256)
      }
    : null;
  const economicsByModel = normalizeEconomicsByModel(request.economicsByModel || {});
  const minimumEconomicsSamples = Math.max(1, Math.min(1000000, Math.floor(Number(request.minimumEconomicsSamples) || 5)));
  const economicsDigest = digest({ minimumEconomicsSamples, economicsByModel });
  const routingPolicyDigest = digest({
    mode,
    role,
    strategy,
    compatibilityPolicy,
    provider,
    allowedProviders,
    crossProvider,
    candidates: normalizedCandidates,
    fixed,
    requireApprovedFixed: request.requireApprovedFixed === true,
    economicsDigest
  });

  const byIdentity = modelLookup(registry);
  let selected = null;
  let fallbackUsed = false;

  if (strategy === 'fixed') {
    const model = byIdentity.get(`${fixed.provider}\n${fixed.model}`);
    if (model && baseEligibility(model, role, { approvedOnly: request.requireApprovedFixed === true })) {
      const compatibility = assessModelCompatibility({ mode, role, modelClass: model.class, policy: compatibilityPolicy });
      if (compatibility.allowed) selected = { model, compatibility };
    }
  } else if (strategy === 'preference') {
    const originProvider = provider || normalizedCandidates[0]?.provider || '';
    for (let index = 0; index < normalizedCandidates.length; index++) {
      const candidate = normalizedCandidates[index];
      if (!crossProvider && originProvider && candidate.provider !== originProvider) continue;
      if (allowedProviders.length && !allowedProviders.includes(candidate.provider)) continue;
      const model = byIdentity.get(`${candidate.provider}\n${candidate.model}`);
      if (!baseEligibility(model, role, { approvedOnly: true })) continue;
      const compatibility = assessModelCompatibility({ mode, role, modelClass: model.class, policy: compatibilityPolicy });
      if (!compatibility.allowed) continue;
      selected = { model, compatibility };
      fallbackUsed = index > 0;
      break;
    }
  } else {
    selected = chooseAuto(
      registry,
      role,
      mode,
      compatibilityPolicy,
      provider,
      allowedProviders,
      economicsByModel,
      minimumEconomicsSamples
    );
  }

  if (!selected) {
    const error = new Error(`No eligible model is available for ${role}/${mode} using ${strategy} selection.`);
    error.code = 'MODEL_UNAVAILABLE';
    error.role = role;
    error.mode = mode;
    error.strategy = strategy;
    throw error;
  }

  if (!crossProvider && provider && selected.model.provider !== provider) {
    const error = new Error('Cross-provider model fallback is disabled.');
    error.code = 'MODEL_CROSS_PROVIDER_FORBIDDEN';
    throw error;
  }

  return freeze({
    contractVersion: MODEL_ROUTING_CONTRACT_VERSION,
    registryRevision: registry.revision,
    registryDigest: registry.digest,
    routingPolicyDigest,
    mode,
    role,
    strategy,
    compatibilityPolicy,
    requestedProvider: provider,
    resolvedProvider: selected.model.provider,
    resolvedModel: selected.model.model,
    resolvedModelRevision: selected.model.revision,
    revisionPinStrength: selected.model.revisionPinStrength,
    modelClass: selected.model.class,
    qualificationId: selected.model.qualificationId,
    fallbackUsed,
    crossProviderFallback: Boolean(provider && selected.model.provider !== provider),
    compatibility: selected.compatibility.compatible ? 'compatible' : 'degraded',
    degraded: selected.compatibility.degraded,
    capabilities: selected.model.capabilities
  });
}

function buildModelEvidence(selection, options = {}) {
  if (!selection || typeof selection !== 'object') throw new TypeError('model selection evidence requires a resolved selection.');
  const usage = options.usage && typeof options.usage === 'object' ? options.usage : {};
  const number = value => Math.max(0, Number(value) || 0);
  return freeze({
    contractVersion: MODEL_ROUTING_CONTRACT_VERSION,
    mode: selection.mode,
    role: selection.role,
    selectionStrategy: selection.strategy,
    requestedProvider: selection.requestedProvider || '',
    resolvedProvider: selection.resolvedProvider,
    resolvedModel: selection.resolvedModel,
    resolvedModelRevision: selection.resolvedModelRevision || '',
    modelClass: selection.modelClass,
    routingPolicyRevision: clean(options.routingPolicyRevision || 'unversioned', 'routingPolicyRevision', 256),
    routingPolicyDigest: clean(options.routingPolicyDigest || selection.routingPolicyDigest || '', 'routingPolicyDigest', 64, { allowEmpty: true }),
    registryRevision: selection.registryRevision,
    registryDigest: clean(options.registryDigest || selection.registryDigest || '', 'registryDigest', 64, { allowEmpty: true }),
    qualificationId: selection.qualificationId || '',
    lineagePinned: options.lineagePinned === true,
    revisionPinStrength: selection.revisionPinStrength || 'unknown',
    fallbackUsed: selection.fallbackUsed === true,
    crossProviderFallback: selection.crossProviderFallback === true,
    compatibility: selection.compatibility,
    degraded: selection.degraded === true,
    usage: {
      inputTokens: number(usage.inputTokens ?? usage.input_tokens),
      cachedInputTokens: number(usage.cachedInputTokens ?? usage.cached_input_tokens),
      cacheWriteInputTokens: number(usage.cacheWriteInputTokens ?? usage.cache_write_input_tokens),
      outputTokens: number(usage.outputTokens ?? usage.output_tokens),
      reasoningOutputTokens: number(usage.reasoningOutputTokens ?? usage.reasoning_output_tokens)
    }
  });
}

module.exports = {
  MODEL_ROUTING_CONTRACT_VERSION,
  REVIEW_MODES,
  REVIEW_MODE_PLANS,
  MODEL_ROLES,
  MODEL_CLASSES,
  MODEL_SELECTION_STRATEGIES,
  MODEL_COMPATIBILITY_POLICIES,
  MODEL_STATUSES,
  MODEL_HEALTH,
  REVISION_PIN_STRENGTH,
  resolveReviewModePlan,
  validateModelRegistry,
  requiredClassFor,
  assessModelCompatibility,
  normalizeEconomicsByModel,
  economicsDominance,
  resolveModelSelection,
  buildModelEvidence
};
