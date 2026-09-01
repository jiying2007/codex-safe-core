'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROVIDER_MODES = Object.freeze(['openai', 'openai-compatible']);
const PROVIDER_CREDENTIAL_SOURCES = Object.freeze(['auto', 'env', 'auth-json']);
const DEFAULT_RUNTIME_TIMEOUTS = Object.freeze({
  connectMs: 15000,
  requestMs: 180000,
  operationMs: 600000,
  idleMs: 60000
});
const COMPATIBLE_PROVIDER_ID = 'codex_safe_compatible';
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const DEFAULT_API_KEY_ENV = 'OPENAI_API_KEY';
const MAX_AUTH_JSON_BYTES = 1024 * 1024;

function runtimeError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function boundedInteger(value, fallback, min, max, name) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!Number.isFinite(value)) throw runtimeError('ECODEX_PROVIDER_CONFIG', `${name} must be a finite number.`);
  const normalized = Math.floor(value);
  if (normalized < min || normalized > max) {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', `${name} must be between ${min} and ${max} milliseconds.`);
  }
  return normalized;
}

function normalizeBaseUrl(value, allowInsecureHttp = false) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\r\n\0]/.test(value)) {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', 'OpenAI-compatible provider baseUrl must be a non-empty URL.');
  }
  let url;
  try { url = new URL(value.trim()); }
  catch { throw runtimeError('ECODEX_PROVIDER_CONFIG', 'OpenAI-compatible provider baseUrl is not a valid URL.'); }
  if (url.username || url.password || url.search || url.hash) {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', 'Provider baseUrl must not contain credentials, query parameters, or fragments.');
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', 'Provider baseUrl must use HTTP or HTTPS.');
  }
  if (url.protocol === 'http:' && !loopback && allowInsecureHttp !== true) {
    throw runtimeError(
      'ECODEX_PROVIDER_CONFIG',
      'Provider baseUrl uses insecure HTTP. Set provider.allowInsecureHttp=true explicitly to allow non-loopback HTTP.'
    );
  }
  return url.toString().replace(/\/$/, '');
}

function normalizeApiKeyEnv(value) {
  const normalized = value === undefined || value === null || value === '' ? DEFAULT_API_KEY_ENV : value;
  if (typeof normalized !== 'string' || !ENV_NAME.test(normalized)) {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', 'provider.apiKeyEnv must be a valid environment-variable name.');
  }
  return normalized;
}

function normalizeCredentialSource(value) {
  const normalized = value === undefined || value === null || value === '' ? 'auto' : String(value).trim();
  if (!PROVIDER_CREDENTIAL_SOURCES.includes(normalized)) {
    throw runtimeError(
      'ECODEX_PROVIDER_CONFIG',
      `provider.credentialSource must be one of: ${PROVIDER_CREDENTIAL_SOURCES.join(', ')}.`
    );
  }
  return normalized;
}

function normalizeCodexRuntimeOptions(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', 'Codex runtime options must be an object.');
  }
  const rawProvider = value.provider && typeof value.provider === 'object' && !Array.isArray(value.provider)
    ? value.provider
    : {};
  const mode = rawProvider.mode || 'openai';
  if (!PROVIDER_MODES.includes(mode)) {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', `Unsupported Codex provider mode: ${mode}`);
  }
  let provider;
  if (mode === 'openai') {
    if (rawProvider.baseUrl || rawProvider.apiKeyEnv || (rawProvider.credentialSource && rawProvider.credentialSource !== 'openai-auth') || rawProvider.allowInsecureHttp === true) {
      throw runtimeError(
        'ECODEX_PROVIDER_CONFIG',
        'baseUrl/apiKeyEnv/credentialSource/allowInsecureHttp are only valid for openai-compatible mode.'
      );
    }
    provider = Object.freeze({
      mode: 'openai',
      baseUrl: '',
      apiKeyEnv: '',
      credentialSource: 'openai-auth',
      allowInsecureHttp: false,
      wireApi: 'responses',
      supportsWebsockets: true
    });
  } else {
    const allowInsecureHttp = rawProvider.allowInsecureHttp === true;
    provider = Object.freeze({
      mode,
      baseUrl: normalizeBaseUrl(rawProvider.baseUrl, allowInsecureHttp),
      apiKeyEnv: normalizeApiKeyEnv(rawProvider.apiKeyEnv),
      credentialSource: normalizeCredentialSource(rawProvider.credentialSource),
      allowInsecureHttp,
      wireApi: 'responses',
      supportsWebsockets: false
    });
  }
  const rawTimeouts = value.timeouts && typeof value.timeouts === 'object' && !Array.isArray(value.timeouts)
    ? value.timeouts
    : {};
  const timeouts = Object.freeze({
    connectMs: boundedInteger(rawTimeouts.connectMs, DEFAULT_RUNTIME_TIMEOUTS.connectMs, 1000, 120000, 'timeouts.connectMs'),
    requestMs: boundedInteger(rawTimeouts.requestMs, DEFAULT_RUNTIME_TIMEOUTS.requestMs, 10000, 900000, 'timeouts.requestMs'),
    operationMs: boundedInteger(rawTimeouts.operationMs, DEFAULT_RUNTIME_TIMEOUTS.operationMs, 10000, 1800000, 'timeouts.operationMs'),
    idleMs: boundedInteger(rawTimeouts.idleMs, DEFAULT_RUNTIME_TIMEOUTS.idleMs, 5000, 600000, 'timeouts.idleMs')
  });
  if (timeouts.operationMs < timeouts.requestMs) {
    throw runtimeError('ECODEX_PROVIDER_CONFIG', 'timeouts.operationMs must be greater than or equal to timeouts.requestMs.');
  }
  return Object.freeze({ provider, timeouts });
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function providerConfigOverrides(runtime) {
  const normalized = normalizeCodexRuntimeOptions(runtime);
  if (normalized.provider.mode === 'openai') return [];
  const { provider, timeouts } = normalized;
  return [
    `model_provider=${tomlString(COMPATIBLE_PROVIDER_ID)}`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.name=${tomlString('Codex Safe OpenAI-compatible Provider')}`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.base_url=${tomlString(provider.baseUrl)}`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.env_key=${tomlString(provider.apiKeyEnv)}`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.wire_api=${tomlString('responses')}`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.requires_openai_auth=false`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.supports_websockets=false`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.request_max_retries=2`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.stream_max_retries=2`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.stream_idle_timeout_ms=${timeouts.idleMs}`,
    `model_providers.${COMPATIBLE_PROVIDER_ID}.websocket_connect_timeout_ms=${timeouts.connectMs}`
  ];
}

function appendProviderArgs(args, runtime) {
  if (!Array.isArray(args)) throw new TypeError('args must be an array.');
  const overrides = providerConfigOverrides(runtime);
  if (!overrides.length) return [...args];
  const result = [...args];
  const stdinIndex = result.lastIndexOf('-');
  const insertAt = stdinIndex >= 0 ? stdinIndex : result.length;
  const injected = [];
  for (const override of overrides) injected.push('--config', override);
  result.splice(insertAt, 0, ...injected);
  return result;
}

function resolveCodexHome(env = process.env, homeDir = os.homedir()) {
  const configured = typeof env?.CODEX_HOME === 'string' ? env.CODEX_HOME.trim() : '';
  if (configured) {
    if (configured.length > 4096 || /[\r\n\0]/.test(configured)) {
      throw runtimeError('ECODEX_CREDENTIAL', 'CODEX_HOME is invalid.');
    }
    return path.isAbsolute(configured) ? path.normalize(configured) : path.resolve(homeDir, configured);
  }
  return path.join(homeDir, '.codex');
}

function resolveAuthJsonPath(env = process.env, homeDir = os.homedir()) {
  return path.join(resolveCodexHome(env, homeDir), 'auth.json');
}

function readAuthJsonApiKey({ env = process.env, homeDir = os.homedir(), fsImpl = fs } = {}) {
  const authJsonPath = resolveAuthJsonPath(env, homeDir);
  let stat;
  try { stat = fsImpl.statSync(authJsonPath); }
  catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw runtimeError('ECODEX_CREDENTIAL', `Unable to inspect Codex auth.json: ${authJsonPath}.`, { cause: error });
  }
  if (!stat?.isFile?.()) {
    throw runtimeError('ECODEX_CREDENTIAL', `Codex auth.json is not a regular file: ${authJsonPath}.`);
  }
  if (Number(stat.size) > MAX_AUTH_JSON_BYTES) {
    throw runtimeError('ECODEX_CREDENTIAL', `Codex auth.json exceeds ${MAX_AUTH_JSON_BYTES} bytes.`);
  }
  let parsed;
  try { parsed = JSON.parse(fsImpl.readFileSync(authJsonPath, 'utf8')); }
  catch (error) {
    throw runtimeError('ECODEX_CREDENTIAL', `Codex auth.json is not valid JSON: ${authJsonPath}.`, { cause: error });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw runtimeError('ECODEX_CREDENTIAL', `Codex auth.json has an invalid shape: ${authJsonPath}.`);
  }
  if (parsed.auth_mode !== undefined && parsed.auth_mode !== 'apikey') {
    throw runtimeError(
      'ECODEX_CREDENTIAL',
      'Codex auth.json does not contain API-key authentication; compatible providers require auth_mode="apikey".'
    );
  }
  const value = typeof parsed.OPENAI_API_KEY === 'string' ? parsed.OPENAI_API_KEY.trim() : '';
  if (!value) {
    throw runtimeError('ECODEX_CREDENTIAL', 'Codex auth.json does not contain OPENAI_API_KEY.');
  }
  return Object.freeze({ value, source: 'auth-json', path: authJsonPath });
}

function resolveProviderCredential(runtime, {
  env = process.env,
  homeDir = os.homedir(),
  fsImpl = fs
} = {}) {
  const normalized = normalizeCodexRuntimeOptions(runtime);
  if (normalized.provider.mode !== 'openai-compatible') {
    return Object.freeze({
      runtime: normalized,
      environment: env || process.env,
      source: 'openai-auth',
      credentialEnv: '',
      authJsonPath: ''
    });
  }

  const provider = normalized.provider;
  const name = provider.apiKeyEnv;
  const configuredSource = provider.credentialSource;
  const environment = env || {};
  const envValue = typeof environment[name] === 'string' ? environment[name].trim() : '';

  if ((configuredSource === 'auto' || configuredSource === 'env') && envValue) {
    return Object.freeze({
      runtime: normalized,
      environment,
      source: 'env',
      credentialEnv: name,
      authJsonPath: ''
    });
  }

  if (configuredSource === 'env') {
    throw runtimeError(
      'ECODEX_CREDENTIAL',
      `Codex provider credential environment variable ${name} is not available to this process.`,
      { credentialEnv: name, credentialSource: configuredSource, provider: providerMetadata(normalized) }
    );
  }

  const authCredential = readAuthJsonApiKey({ env: environment, homeDir, fsImpl });
  if (authCredential) {
    const childEnvironment = { ...environment, [name]: authCredential.value };
    return Object.freeze({
      runtime: normalized,
      environment: childEnvironment,
      source: 'auth-json',
      credentialEnv: name,
      authJsonPath: authCredential.path
    });
  }

  throw runtimeError(
    'ECODEX_CREDENTIAL',
    configuredSource === 'auth-json'
      ? `Codex auth.json was not found at ${resolveAuthJsonPath(environment, homeDir)}.`
      : `Codex provider credential ${name} is unavailable and Codex auth.json could not be found.`,
    {
      credentialEnv: name,
      credentialSource: configuredSource,
      authJsonPath: resolveAuthJsonPath(environment, homeDir),
      provider: providerMetadata(normalized)
    }
  );
}

function assertProviderCredential(runtime, env = process.env, options = {}) {
  return resolveProviderCredential(runtime, { ...options, env }).runtime;
}

function providerMetadata(runtime, credential = undefined) {
  const normalized = runtime?.provider?.mode ? normalizeCodexRuntimeOptions(runtime) : normalizeCodexRuntimeOptions(runtime || {});
  const provider = normalized.provider;
  let endpointHost = '';
  let transport = '';
  if (provider.baseUrl) {
    try {
      const url = new URL(provider.baseUrl);
      endpointHost = url.host;
      transport = url.protocol.replace(':', '');
    } catch {}
  }
  return Object.freeze({
    mode: provider.mode,
    endpointHost,
    credentialEnv: provider.apiKeyEnv || '',
    credentialSource: credential?.source || provider.credentialSource || '',
    transport,
    allowInsecureHttp: provider.allowInsecureHttp === true,
    wireApi: provider.wireApi,
    supportsWebsockets: provider.supportsWebsockets
  });
}

function tail(value, max = 16384) {
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value || '');
  return text.length <= max ? text : text.slice(text.length - max);
}

function redactDiagnosticText(value, runtime, env = process.env) {
  let text = tail(value);
  const normalized = normalizeCodexRuntimeOptions(runtime);
  const secretName = normalized.provider.apiKeyEnv;
  if (secretName && env && typeof env[secretName] === 'string' && env[secretName]) {
    text = text.split(env[secretName]).join('[REDACTED]');
  }
  text = text.replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/ig, '$1[REDACTED]');
  text = text.replace(/([?&](?:api[_-]?key|token|access[_-]?token)=)[^&\s]+/ig, '$1[REDACTED]');
  return text;
}

function classifyCodexFailure(error, runtime, { phase = 'request', env = process.env, credential } = {}) {
  if (!error || typeof error !== 'object') return error;
  if (String(error.code || '').startsWith('ECODEX_') && error.code !== 'ECODEX_REQUEST_TIMEOUT') return error;
  const normalized = normalizeCodexRuntimeOptions(runtime);
  const raw = [error.stderrTail, error.stderr, error.stdoutTail, error.stdout, error.message].filter(Boolean).join('\n');
  const diagnosticTail = redactDiagnosticText(raw, normalized, env);
  const text = diagnosticTail.toLowerCase();
  let code;
  if (error.code === 'ETIMEDOUT') code = 'ECODEX_REQUEST_TIMEOUT';
  else if (/failed to lookup address information|getaddrinfo|enotfound|temporary failure in name resolution|name or service not known/.test(text)) code = 'ECODEX_DNS';
  else if (/certificate|self[- ]signed|unable to verify|tls|ssl/.test(text)) code = 'ECODEX_TLS';
  else if (/\b401\b|unauthori[sz]ed|invalid api key|incorrect api key/.test(text)) code = 'ECODEX_AUTH';
  else if (/\b429\b|rate limit|too many requests/.test(text)) code = 'ECODEX_RATE_LIMIT';
  else if ((/\b404\b|not found/.test(text)) && /model/.test(text)) code = 'ECODEX_MODEL';
  else if (/econnrefused|connection refused|failed to connect|connect timeout|connection timed out|network is unreachable/.test(text)) code = 'ECODEX_CONNECT';
  else return error;
  const metadata = providerMetadata(normalized, credential);
  const wrapped = runtimeError(code, diagnosticMessage(code, metadata, phase), {
    cause: error,
    provider: metadata,
    phase,
    diagnosticTail,
    elapsedMs: Number(error.elapsedMs) || undefined,
    lastActivityMs: Number(error.lastActivityMs) || undefined
  });
  return wrapped;
}

function diagnosticMessage(code, metadata, phase) {
  const endpoint = metadata.endpointHost ? ` (${metadata.endpointHost})` : '';
  const messages = {
    ECODEX_DNS: `Codex provider DNS resolution failed${endpoint}.`,
    ECODEX_TLS: `Codex provider TLS validation failed${endpoint}.`,
    ECODEX_AUTH: `Codex provider authentication failed${endpoint}.`,
    ECODEX_RATE_LIMIT: `Codex provider rate limit was reached${endpoint}.`,
    ECODEX_MODEL: `Codex provider could not resolve the requested model${endpoint}.`,
    ECODEX_CONNECT: `Codex provider connection failed${endpoint}.`,
    ECODEX_REQUEST_TIMEOUT: `Codex provider request timed out during ${phase}${endpoint}.`
  };
  return messages[code] || `Codex provider failed during ${phase}${endpoint}.`;
}

module.exports = {
  PROVIDER_MODES,
  PROVIDER_CREDENTIAL_SOURCES,
  DEFAULT_RUNTIME_TIMEOUTS,
  COMPATIBLE_PROVIDER_ID,
  DEFAULT_API_KEY_ENV,
  MAX_AUTH_JSON_BYTES,
  normalizeCodexRuntimeOptions,
  providerConfigOverrides,
  appendProviderArgs,
  resolveCodexHome,
  resolveAuthJsonPath,
  readAuthJsonApiKey,
  resolveProviderCredential,
  assertProviderCredential,
  providerMetadata,
  redactDiagnosticText,
  classifyCodexFailure
};
