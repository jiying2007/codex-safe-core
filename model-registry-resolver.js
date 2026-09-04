'use strict';

const os = require('node:os');
const path = require('node:path');
const { validateModelRegistry } = require('./model-routing');
const { secureReadText } = require('./secure-local-file');

const MODEL_REGISTRY_SCHEMA_VERSION = 1;
const MODEL_REGISTRY_FILE = 'models.json';
const MODEL_REGISTRY_MAX_BYTES = 1024 * 1024;

function registryError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}
function modelRegistryPath(env = process.env, homeDir = os.homedir()) {
  const override = typeof env?.CODEX_SAFE_MODEL_REGISTRY_FILE === 'string' ? env.CODEX_SAFE_MODEL_REGISTRY_FILE.trim() : '';
  if (override) {
    if (override.length > 4096 || /[\r\n\0]/.test(override)) throw registryError('EMODELREGISTRY', 'CODEX_SAFE_MODEL_REGISTRY_FILE is invalid.');
    return path.isAbsolute(override) ? path.normalize(override) : path.resolve(homeDir, override);
  }
  return path.join(homeDir, '.codex-safe', MODEL_REGISTRY_FILE);
}
function readRegistryText(filePath, fsImpl) {
  if (fsImpl) {
    let stat;
    try { stat = fsImpl.lstatSync(filePath); } catch (error) { if (error?.code === 'ENOENT') return null; throw registryError('EMODELREGISTRY', `Unable to inspect model registry: ${filePath}.`, { cause: error, configPath: filePath }); }
    if (stat?.isSymbolicLink?.()) throw registryError('EMODELREGISTRY', `Model registry must not be a symbolic link: ${filePath}.`, { configPath: filePath });
    if (!stat?.isFile?.()) throw registryError('EMODELREGISTRY', `Model registry is not a regular file: ${filePath}.`, { configPath: filePath });
    if (Number(stat.size) > MODEL_REGISTRY_MAX_BYTES) throw registryError('EMODELREGISTRY', `Model registry exceeds ${MODEL_REGISTRY_MAX_BYTES} bytes: ${filePath}.`, { configPath: filePath });
    try { return fsImpl.readFileSync(filePath, 'utf8'); } catch (error) { throw registryError('EMODELREGISTRY', `Unable to read model registry: ${filePath}.`, { cause: error, configPath: filePath }); }
  }
  try {
    return secureReadText(filePath, { maxBytes: MODEL_REGISTRY_MAX_BYTES, allowMissing: true, requireOwner: true, rejectGroupOtherWrite: true });
  } catch (error) {
    throw registryError('EMODELREGISTRY', `Unable to securely read model registry: ${filePath}.`, { cause: error, configPath: filePath });
  }
}
function parseModelRegistryDocument(text, sourcePath = '<memory>') {
  let document;
  try { document = JSON.parse(String(text || '')); } catch (error) { throw registryError('EMODELREGISTRY', `Model registry is invalid JSON: ${sourcePath}.`, { cause: error, configPath: sourcePath }); }
  if (!document || typeof document !== 'object' || Array.isArray(document) || Number(document.schemaVersion) !== MODEL_REGISTRY_SCHEMA_VERSION) throw registryError('EMODELREGISTRY', `Model registry must use schemaVersion ${MODEL_REGISTRY_SCHEMA_VERSION}.`, { configPath: sourcePath });
  const allowed = new Set(['schemaVersion', 'revision', 'models']);
  for (const key of Object.keys(document)) if (!allowed.has(key)) throw registryError('EMODELREGISTRY', `Unknown model registry key: ${key}.`, { configPath: sourcePath });
  try { return validateModelRegistry({ revision: document.revision, models: document.models }); } catch (error) { throw registryError('EMODELREGISTRY', `Model registry validation failed: ${error.message}`, { cause: error, configPath: sourcePath }); }
}
function resolveModelRegistry(value = {}, { env = process.env, homeDir = os.homedir(), fsImpl } = {}) {
  if (value?.registry !== undefined) {
    try { return Object.freeze({ registry: validateModelRegistry(value.registry), source: 'explicit', configPath: '', inherited: false }); } catch (error) { throw registryError('EMODELREGISTRY', `Explicit model registry validation failed: ${error.message}`, { cause: error }); }
  }
  const filePath = value?.registryFile ? (path.isAbsolute(String(value.registryFile)) ? path.normalize(String(value.registryFile)) : path.resolve(homeDir, String(value.registryFile))) : modelRegistryPath(env, homeDir);
  const text = readRegistryText(filePath, fsImpl);
  if (text === null) return Object.freeze({ registry: null, source: 'none', configPath: filePath, inherited: true });
  return Object.freeze({ registry: parseModelRegistryDocument(text, filePath), source: value?.registryFile ? 'explicit-file' : 'machine-registry', configPath: filePath, inherited: true });
}
function inspectModelRegistry(value = {}, options = {}) {
  const resolved = resolveModelRegistry(value, options);
  if (!resolved.registry) return Object.freeze({ source: resolved.source, configPath: resolved.configPath, present: false, revision: '', digest: '', models: 0, approved: 0 });
  const approved = resolved.registry.models.filter(model => model.status === 'approved' && model.health !== 'unhealthy').length;
  return Object.freeze({ source: resolved.source, configPath: resolved.configPath, present: true, revision: resolved.registry.revision, digest: resolved.registry.digest, models: resolved.registry.models.length, approved });
}
module.exports = { MODEL_REGISTRY_SCHEMA_VERSION, MODEL_REGISTRY_FILE, MODEL_REGISTRY_MAX_BYTES, modelRegistryPath, parseModelRegistryDocument, resolveModelRegistry, inspectModelRegistry, readRegistryText };
