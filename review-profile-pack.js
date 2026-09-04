'use strict';

const packsDocument = require('./quality/profile-packs.json');
const { REVIEW_PROFILES, resolveReviewProfile } = require('./quality-platform');
const { resolveReviewModePlan } = require('./model-routing');

const PROFILE_PACK_VERSION = 1;
const PROFILE_PACK_NAMES = Object.freeze(Object.keys(packsDocument.packs || {}));

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)])));
  return value;
}

function validatePack(name, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Review profile pack ${name} must be an object.`);
  if (!Object.prototype.hasOwnProperty.call(REVIEW_PROFILES, raw.baseProfile)) throw new Error(`Review profile pack ${name} references unsupported base profile ${raw.baseProfile}.`);
  const categories = Array.isArray(raw.focusCategories) ? raw.focusCategories.map(String) : [];
  const checks = Array.isArray(raw.checks) ? raw.checks.map(value => String(value).trim()).filter(Boolean) : [];
  if (!categories.length || !checks.length) throw new Error(`Review profile pack ${name} must define focusCategories and checks.`);
  return freeze({ name, baseProfile: raw.baseProfile, focusCategories: categories, checks });
}

if (Number(packsDocument.schemaVersion) !== PROFILE_PACK_VERSION) throw new Error(`Unsupported profile pack schema ${packsDocument.schemaVersion}.`);
const REVIEW_PROFILE_PACKS = freeze(Object.fromEntries(PROFILE_PACK_NAMES.map(name => [name, validatePack(name, packsDocument.packs[name])])));

function resolveReviewProfilePack(name = 'general', overrides = {}) {
  const key = PROFILE_PACK_NAMES.includes(String(name)) ? String(name) : 'general';
  const pack = REVIEW_PROFILE_PACKS[key];
  const runtimeProfile = resolveReviewProfile(pack.baseProfile, overrides);
  return freeze({
    ...runtimeProfile,
    packVersion: PROFILE_PACK_VERSION,
    packName: pack.name,
    baseProfile: pack.baseProfile,
    focusCategories: pack.focusCategories,
    checks: pack.checks
  });
}

function resolveReviewModeProfile(mode = 'balanced', packName = 'general', overrides = {}) {
  const key = PROFILE_PACK_NAMES.includes(String(packName)) ? String(packName) : 'general';
  const pack = REVIEW_PROFILE_PACKS[key];
  const plan = resolveReviewModePlan(mode, overrides);
  return freeze({
    ...plan,
    name: plan.mode,
    packVersion: PROFILE_PACK_VERSION,
    packName: pack.name,
    legacyBaseProfile: pack.baseProfile,
    focusCategories: pack.focusCategories,
    checks: pack.checks,
    analyzerMode: overrides.analyzerMode || 'advisory'
  });
}

function formatProfilePackEvidence(profile) {
  if (!profile?.packName || !Array.isArray(profile.checks)) return '';
  const execution = profile.mode
    ? `Mode: ${profile.mode}`
    : `Base profile: ${profile.baseProfile || profile.name || 'standard'}`;
  return [
    '--- TRUSTED REVIEW PROFILE PACK ---',
    `Pack: ${profile.packName} v${profile.packVersion || PROFILE_PACK_VERSION}`,
    execution,
    `Focus categories: ${(profile.focusCategories || []).join(', ')}`,
    'Required review emphasis:',
    ...profile.checks.map(check => `- ${check}`),
    '--- END TRUSTED REVIEW PROFILE PACK ---'
  ].join('\n');
}

module.exports = Object.freeze({
  PROFILE_PACK_VERSION,
  PROFILE_PACK_NAMES,
  REVIEW_PROFILE_PACKS,
  resolveReviewProfilePack,
  resolveReviewModeProfile,
  formatProfilePackEvidence
});
