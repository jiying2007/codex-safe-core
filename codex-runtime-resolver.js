'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const {
  normalizeCodexRuntimeOptions,
  resolveCodexHome,
  resolveAuthJsonPath,
  readAuthJsonApiKey
} = require('./codex-runtime');

const FAMILY_RUNTIME_SCHEMA_VERSION = 1;
const FAMILY_RUNTIME_DIR = '.codex-safe';
const FAMILY_RUNTIME_FILE = 'runtime.json';
const MAX_CONFIG_BYTES = 1024 * 1024;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function resolverError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function runtimeProfilePath(env = process.env, homeDir = os.homedir()) {
  const override = typeof env?.CODEX_SAFE_RUNTIME_FILE === 'string' ? env.CODEX_SAFE_RUNTIME_FILE.trim() : '';
  if (override) {
    if (override.length > 4096 || /[\r\n\0]/.test(override)) throw resolverError('ECODEX_RUNTIME_PROFILE', 'CODEX_SAFE_RUNTIME_FILE is invalid.');
    return path.isAbsolute(override) ? path.normalize(override) : path.resolve(homeDir, override);
  }
  return path.join(homeDir, FAMILY_RUNTIME_DIR, FAMILY_RUNTIME_FILE);
}

function codexConfigPath(env = process.env, homeDir = os.homedir()) {
  return path.join(resolveCodexHome(env, homeDir), 'config.toml');
}

function isPrivateIpv4(host) {
  const parts = String(host || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || (a === 169 && b === 254);
}

function isPrivateIpv6(host) {
  const value = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value);
}

function isPrivateNetworkHost(host) {
  const value = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!value) return false;
  if (value === 'localhost') return true;
  const kind = net.isIP(value);
  if (kind === 4) return isPrivateIpv4(value);
  if (kind === 6) return isPrivateIpv6(value);
  return false;
}

function readBoundedText(filePath, fsImpl = fs) {
  let stat;
  try { stat = fsImpl.statSync(filePath); }
  catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw resolverError('ECODEX_RUNTIME_CONFIG', `Unable to inspect runtime configuration: ${filePath}.`, { cause: error, configPath: filePath });
  }
  if (!stat?.isFile?.()) throw resolverError('ECODEX_RUNTIME_CONFIG', `Runtime configuration is not a regular file: ${filePath}.`, { configPath: filePath });
  if (Number(stat.size) > MAX_CONFIG_BYTES) throw resolverError('ECODEX_RUNTIME_CONFIG', `Runtime configuration exceeds ${MAX_CONFIG_BYTES} bytes: ${filePath}.`, { configPath: filePath });
  try { return fsImpl.readFileSync(filePath, 'utf8'); }
  catch (error) { throw resolverError('ECODEX_RUNTIME_CONFIG', `Unable to read runtime configuration: ${filePath}.`, { cause: error, configPath: filePath }); }
}

function stripTomlComment(line) {
  let out = '', quote = '', escaped = false;
  for (const ch of String(line || '')) {
    if (escaped) { out += ch; escaped = false; continue; }
    if (quote === '"' && ch === '\\') { out += ch; escaped = true; continue; }
    if (quote) {
      out += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
    if (ch === '#') break;
    out += ch;
  }
  return out.trim();
}

function parseTomlScalar(raw) {
  const value = String(raw || '').trim();
  if (!value) return undefined;
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return undefined; }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return undefined;
}

function parseCodexProviderToml(text) {
  const top = {};
  const providers = new Map();
  let section = '';
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = stripTomlComment(raw);
    if (!line) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) { section = header[1].trim(); continue; }
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!match) continue;
    const key = match[1], value = parseTomlScalar(match[2]);
    if (value === undefined) continue;
    if (!section) { top[key] = value; continue; }
    const providerMatch = section.match(/^model_providers\.([A-Za-z0-9_-]+)$/);
    if (providerMatch) {
      const id = providerMatch[1];
      const current = providers.get(id) || {};
      current[key] = value;
      providers.set(id, current);
    }
  }
  return Object.freeze({ top: Object.freeze(top), providers });
}

function normalizeMachineCompatibleProvider({ baseUrl, apiKeyEnv = 'OPENAI_API_KEY', credentialSource = 'auto', trustedPrivateHttp = false }, timeouts, source) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) throw resolverError('ECODEX_RUNTIME_CONFIG', `${source} selected an OpenAI-compatible provider without base_url.`);
  let url;
  try { url = new URL(baseUrl.trim()); }
  catch { throw resolverError('ECODEX_RUNTIME_CONFIG', `${source} contains an invalid provider base URL.`); }
  let allowInsecureHttp = false;
  if (url.protocol === 'http:') {
    if (isPrivateNetworkHost(url.hostname)) allowInsecureHttp = true;
    else if (trustedPrivateHttp === true) allowInsecureHttp = true;
    else throw resolverError(
      'ECODEX_RUNTIME_PUBLIC_HTTP',
      `Refusing to inherit public/non-IP HTTP provider ${url.origin}. Use HTTPS or explicitly trust it in the machine-scoped Family Runtime profile.`,
      { endpointHost: url.host }
    );
  }
  return normalizeCodexRuntimeOptions({
    provider: {
      mode: 'openai-compatible',
      baseUrl: url.toString().replace(/\/$/, ''),
      apiKeyEnv: String(apiKeyEnv || 'OPENAI_API_KEY'),
      credentialSource: String(credentialSource || 'auto'),
      allowInsecureHttp
    },
    timeouts
  });
}

function parseFamilyRuntimeProfile(text, timeouts, sourcePath) {
  let value;
  try { value = JSON.parse(String(text || '')); }
  catch (error) { throw resolverError('ECODEX_RUNTIME_PROFILE', `Family Runtime profile is invalid JSON: ${sourcePath}.`, { cause: error, configPath: sourcePath }); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== FAMILY_RUNTIME_SCHEMA_VERSION) {
    throw resolverError('ECODEX_RUNTIME_PROFILE', `Family Runtime profile must use schemaVersion ${FAMILY_RUNTIME_SCHEMA_VERSION}.`, { configPath: sourcePath });
  }
  const allowed = new Set(['schemaVersion', 'mode', 'baseUrl', 'apiKeyEnv', 'credentialSource', 'trustedPrivateHttp']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw resolverError('ECODEX_RUNTIME_PROFILE', `Unknown Family Runtime profile key: ${key}.`, { configPath: sourcePath });
  const mode = value.mode || 'openai-compatible';
  if (mode === 'openai') return normalizeCodexRuntimeOptions({ provider: { mode: 'openai' }, timeouts });
  if (mode !== 'openai-compatible') throw resolverError('ECODEX_RUNTIME_PROFILE', `Unsupported Family Runtime mode: ${mode}.`, { configPath: sourcePath });
  if (value.apiKeyEnv !== undefined && (typeof value.apiKeyEnv !== 'string' || !ENV_NAME.test(value.apiKeyEnv))) {
    throw resolverError('ECODEX_RUNTIME_PROFILE', 'Family Runtime apiKeyEnv must be an environment-variable name.', { configPath: sourcePath });
  }
  return normalizeMachineCompatibleProvider({
    baseUrl: value.baseUrl,
    apiKeyEnv: value.apiKeyEnv || 'OPENAI_API_KEY',
    credentialSource: value.credentialSource || 'auto',
    trustedPrivateHttp: value.trustedPrivateHttp === true
  }, timeouts, 'Family Runtime profile');
}

function runtimeFromCodexConfig(text, timeouts, sourcePath) {
  const parsed = parseCodexProviderToml(text);
  const providerId = typeof parsed.top.model_provider === 'string' ? parsed.top.model_provider.trim() : '';
  if (!providerId || providerId === 'openai') {
    return Object.freeze({ runtime: normalizeCodexRuntimeOptions({ provider: { mode: 'openai' }, timeouts }), providerId: providerId || 'openai' });
  }
  const provider = parsed.providers.get(providerId);
  if (!provider) throw resolverError('ECODEX_RUNTIME_CONFIG', `Codex config selects model_provider=${providerId} but [model_providers.${providerId}] was not found in ${sourcePath}.`, { configPath: sourcePath, providerId });
  const wireApi = provider.wire_api === undefined ? 'responses' : String(provider.wire_api);
  if (wireApi !== 'responses') throw resolverError('ECODEX_RUNTIME_CONFIG', `Codex Safe requires wire_api="responses" for inherited provider ${providerId}.`, { configPath: sourcePath, providerId });
  const apiKeyEnv = provider.env_key === undefined ? 'OPENAI_API_KEY' : String(provider.env_key);
  if (!ENV_NAME.test(apiKeyEnv)) throw resolverError('ECODEX_RUNTIME_CONFIG', `Inherited provider ${providerId} has an invalid env_key.`, { configPath: sourcePath, providerId });
  return Object.freeze({
    runtime: normalizeMachineCompatibleProvider({ baseUrl: provider.base_url, apiKeyEnv, credentialSource: 'auto' }, timeouts, `Codex config provider ${providerId}`),
    providerId
  });
}

function explicitSelection(value = {}) {
  const provider = value?.provider && typeof value.provider === 'object' ? value.provider : {};
  const mode = provider.mode === undefined || provider.mode === null || provider.mode === '' ? 'auto' : String(provider.mode).trim();
  return { mode, provider, timeouts: value?.timeouts };
}

function resolveCodexRuntime(value = {}, { env = process.env, homeDir = os.homedir(), fsImpl = fs } = {}) {
  const selection = explicitSelection(value);
  if (!['auto', 'openai', 'openai-compatible'].includes(selection.mode)) {
    throw resolverError('ECODEX_PROVIDER_CONFIG', `Unsupported Codex provider mode: ${selection.mode}.`);
  }
  if (selection.mode !== 'auto') {
    const runtime = normalizeCodexRuntimeOptions({ provider: selection.provider, timeouts: selection.timeouts });
    return Object.freeze({ runtime, source: 'explicit', configPath: '', providerId: runtime.provider.mode, inherited: false });
  }

  const profilePath = runtimeProfilePath(env, homeDir);
  const profileText = readBoundedText(profilePath, fsImpl);
  if (profileText !== null) {
    const runtime = parseFamilyRuntimeProfile(profileText, selection.timeouts, profilePath);
    return Object.freeze({ runtime, source: 'family-profile', configPath: profilePath, providerId: runtime.provider.mode, inherited: true });
  }

  const configPath = codexConfigPath(env, homeDir);
  const configText = readBoundedText(configPath, fsImpl);
  if (configText !== null) {
    const resolved = runtimeFromCodexConfig(configText, selection.timeouts, configPath);
    return Object.freeze({ runtime: resolved.runtime, source: 'codex-config', configPath, providerId: resolved.providerId, inherited: true });
  }

  const runtime = normalizeCodexRuntimeOptions({ provider: { mode: 'openai' }, timeouts: selection.timeouts });
  return Object.freeze({ runtime, source: 'built-in-openai', configPath: '', providerId: 'openai', inherited: true });
}

function resolveCodexRuntimeOptions(value = {}, options = {}) {
  return resolveCodexRuntime(value, options).runtime;
}

function inspectCodexRuntime(value = {}, { env = process.env, homeDir = os.homedir(), fsImpl = fs } = {}) {
  const resolution = resolveCodexRuntime(value, { env, homeDir, fsImpl });
  const provider = resolution.runtime.provider;
  let endpointHost = '', transport = '', privateNetwork = false;
  if (provider.baseUrl) {
    const url = new URL(provider.baseUrl);
    endpointHost = url.host;
    transport = url.protocol.replace(':', '');
    privateNetwork = isPrivateNetworkHost(url.hostname);
  }
  const credentialEnv = provider.apiKeyEnv || '';
  const envPresent = credentialEnv ? Boolean(typeof env?.[credentialEnv] === 'string' && env[credentialEnv].trim()) : false;
  const authJsonPath = resolveAuthJsonPath(env, homeDir);
  let authJsonPresent = false;
  try { authJsonPresent = Boolean(readAuthJsonApiKey({ env, homeDir, fsImpl })); } catch {}
  const plaintextWarning = transport === 'http'
    ? `Provider ${endpointHost} uses plaintext HTTP; API credentials and request content are not protected by TLS.`
    : '';
  return Object.freeze({
    source: resolution.source,
    configPath: resolution.configPath,
    providerId: resolution.providerId,
    mode: provider.mode,
    endpointHost,
    transport,
    privateNetwork,
    credentialEnv,
    credentialEnvPresent: envPresent,
    authJsonPath,
    authJsonPresent,
    plaintextWarning
  });
}

function writeFamilyRuntimeProfile(profile, { env = process.env, homeDir = os.homedir(), fsImpl = fs } = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw resolverError('ECODEX_RUNTIME_PROFILE', 'Family Runtime profile must be an object.');
  const target = runtimeProfilePath(env, homeDir);
  const value = {
    schemaVersion: FAMILY_RUNTIME_SCHEMA_VERSION,
    mode: profile.mode || 'openai-compatible',
    ...(profile.mode === 'openai' ? {} : {
      baseUrl: String(profile.baseUrl || '').trim(),
      apiKeyEnv: String(profile.apiKeyEnv || 'OPENAI_API_KEY').trim(),
      credentialSource: String(profile.credentialSource || 'auto').trim(),
      trustedPrivateHttp: profile.trustedPrivateHttp === true
    })
  };
  parseFamilyRuntimeProfile(JSON.stringify(value), undefined, target);
  fsImpl.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    fsImpl.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fsImpl.renameSync(temp, target);
  } finally {
    try { fsImpl.rmSync(temp, { force: true }); } catch {}
  }
  return target;
}

module.exports = {
  FAMILY_RUNTIME_SCHEMA_VERSION,
  runtimeProfilePath,
  codexConfigPath,
  isPrivateNetworkHost,
  parseCodexProviderToml,
  parseFamilyRuntimeProfile,
  runtimeFromCodexConfig,
  resolveCodexRuntime,
  resolveCodexRuntimeOptions,
  inspectCodexRuntime,
  writeFamilyRuntimeProfile
};
