'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  REQUIRED_CODEX_TOP_LEVEL_FLAGS,
  REQUIRED_CODEX_EXEC_FLAGS,
  buildSafeCodexArgs,
  missingHelpFlags,
  isCliCompatibilityError
} = require('./safe-contract');
const {
  extractCodexUsage,
  usageShape,
  estimateRequestTokens,
  assertWithinTokenBudget
} = require('./efficiency-planner');
const { createCodexJsonlAccumulator } = require('./codex-jsonl-stream');
const {
  normalizeCodexRuntimeOptions,
  appendProviderArgs,
  resolveProviderCredential,
  providerMetadata,
  classifyCodexFailure
} = require('./codex-runtime');

const DEFAULT_CODEX_STDOUT_CAPTURE_LIMIT = 4 * 1024 * 1024;
const DEFAULT_CODEX_TRANSCRIPT_LIMIT = 64 * 1024 * 1024;

function createError(code, message, cause, extra = {}) {
  const error = new Error(message);
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  Object.assign(error, extra);
  return error;
}

function parseCodexJsonl(stdout, { allowLeadingPartial = false } = {}) {
  let lastAgentMessage = '';
  const errors = [];
  const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    let event;
    try { event = JSON.parse(line); }
    catch {
      if (allowLeadingPartial && index === 0) continue;
      throw createError('ECODEXOUTPUT', 'Codex --json returned invalid JSONL.');
    }
    if (event?.type === 'item.completed' && event?.item?.type === 'agent_message' && typeof event.item.text === 'string') {
      lastAgentMessage = event.item.text;
    }
    if (event?.type === 'error') errors.push(event.message || event.error?.message || 'Codex reported an error');
    if (event?.type === 'turn.failed') errors.push(event.error?.message || event.message || 'Codex turn failed');
  }
  if (!lastAgentMessage && errors.length) throw createError('ECODEXTURN', errors.join('; '));
  if (!lastAgentMessage) throw createError('ECODEXOUTPUT', 'Codex JSONL did not contain a final agent_message.');
  return lastAgentMessage.trim();
}

function assertSafeTempPrefix(value) {
  if (typeof value !== 'string' || !value || value.length > 80 || /[\\/\r\n\0]/.test(value) || value.includes('..')) {
    throw new TypeError('tempPrefix must be a simple filename prefix.');
  }
  return value;
}

function assertSafeSchemaFileName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.json$/.test(value) || value.includes('..')) {
    throw new TypeError('schemaFileName must be a simple .json filename.');
  }
  return value;
}

function assertSchema(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('schema must be a JSON object.');
  }
  return value;
}

function normalizeStructuredOutputLimit(value, fallback, name) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(resolved) || resolved < 0 || resolved > 256 * 1024 * 1024) {
    throw new RangeError(`${name} must be a finite value between 0 and 268435456 bytes.`);
  }
  return Math.floor(resolved);
}

function createCodexCli({ runPreparedProcess, tempPrefix = 'codex-safe-', capabilityCache = new Map() } = {}) {
  if (typeof runPreparedProcess !== 'function') {
    throw new TypeError('createCodexCli requires runPreparedProcess(command, args, options, stdinText, token).');
  }
  assertSafeTempPrefix(tempPrefix);
  if (!(capabilityCache instanceof Map)) throw new TypeError('capabilityCache must be a Map.');

  async function findWindowsCodexCandidates(codexPath) {
    if (process.platform !== 'win32' || codexPath !== 'codex') return [codexPath];
    const candidates = [];
    try {
      const { stdout } = await runPreparedProcess('where.exe', ['codex'], { timeoutMs: 5000 });
      for (const line of String(stdout || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
        if (!candidates.includes(line)) candidates.push(line);
      }
    } catch {}
    for (const fallback of ['codex.exe', 'codex.cmd', 'codex.bat', 'codex']) {
      if (!candidates.includes(fallback)) candidates.push(fallback);
    }
    candidates.sort((a, b) => {
      const rank = value => /\.exe$/i.test(value) ? 0 : /\.(cmd|bat)$/i.test(value) ? 1 : 2;
      return rank(a) - rank(b);
    });
    return candidates;
  }

  async function resolveCodexExecutable(codexPath) {
    if (typeof codexPath !== 'string' || !codexPath.trim() || /[\r\n\0]/.test(codexPath) || codexPath.length > 1024) {
      throw createError('ECODEXNOTFOUND', 'Codex CLI path is invalid.');
    }
    const candidates = await findWindowsCodexCandidates(codexPath);
    const windowsDefaultLookup = process.platform === 'win32' && codexPath === 'codex';
    let lastError;

    for (const candidate of candidates) {
      try {
        const result = await runPreparedProcess(candidate, ['--version'], { timeoutMs: 10000 });
        const version = String(result.stdout || result.stderr || '').trim();
        if (!version) throw new Error(`Codex CLI ${candidate} returned no version information from --version.`);
        return { executable: candidate, version };
      } catch (error) {
        lastError = error;
        if (windowsDefaultLookup) continue;
        if (error?.code === 'ENOENT') break;
        const detail = error?.stderr || error?.stdout || error?.message || String(error);
        throw createError(
          'ECODEXUNUSABLE',
          `Codex CLI failed to run: ${candidate}. Make sure "${candidate} --version" succeeds. Original error: ${detail}`,
          error
        );
      }
    }

    const detail = lastError?.stderr || lastError?.stdout || lastError?.message || '';
    throw createError(
      'ECODEXNOTFOUND',
      `No usable Codex CLI was found for: ${codexPath}. Make sure "codex --version" succeeds.${detail ? ` Original error: ${detail}` : ''}`,
      lastError
    );
  }

  async function probeCodexCapabilities(resolved, model = '') {
    const executable = typeof resolved === 'string' ? resolved : resolved?.executable;
    const version = typeof resolved === 'string' ? resolved : resolved?.version;
    if (!executable) throw createError('ECODEXCAPABILITY', 'Codex CLI executable is missing.');
    const cacheKey = `${executable}\n${version || ''}\n${model ? 'model' : 'default'}`;
    if (capabilityCache.has(cacheKey)) return capabilityCache.get(cacheKey);

    let topHelp;
    let execHelp;
    try {
      const [top, exec] = await Promise.all([
        runPreparedProcess(executable, ['--help'], { timeoutMs: 10000, maxStdoutBytes: 1024 * 1024, maxStderrBytes: 256 * 1024 }),
        runPreparedProcess(executable, ['exec', '--help'], { timeoutMs: 10000, maxStdoutBytes: 1024 * 1024, maxStderrBytes: 256 * 1024 })
      ]);
      topHelp = `${top.stdout || ''}\n${top.stderr || ''}`;
      execHelp = `${exec.stdout || ''}\n${exec.stderr || ''}`;
    } catch (error) {
      throw createError(
        'ECODEXCAPABILITY',
        `Unable to inspect Codex CLI capabilities${version ? ` for ${version}` : ''}. Make sure "codex --help" and "codex exec --help" succeed.`,
        error
      );
    }

    const missing = [
      ...missingHelpFlags(topHelp, REQUIRED_CODEX_TOP_LEVEL_FLAGS).map(flag => `top-level ${flag}`),
      ...missingHelpFlags(execHelp, REQUIRED_CODEX_EXEC_FLAGS).map(flag => `exec ${flag}`)
    ];
    if (model && !`${topHelp}\n${execHelp}`.includes('--model')) missing.push('--model');
    if (missing.length) {
      throw createError(
        'ECODEXCAPABILITY',
        `Codex CLI${version ? ` ${version}` : ''} does not expose required capabilities: ${missing.join(', ')}.`,
        undefined,
        { missingFlags: missing }
      );
    }

    const result = Object.freeze({ executable, version: version || '', capabilitiesVerified: true });
    capabilityCache.set(cacheKey, result);
    return result;
  }

  function buildCodexArgs(schemaPath, model = '', runtime = {}) {
    return appendProviderArgs(buildSafeCodexArgs(schemaPath, model), runtime);
  }

  async function withTemporaryDirectory(fn) {
    if (typeof fn !== 'function') throw new TypeError('withTemporaryDirectory requires a function.');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
    try { return await fn(tempDir); }
    finally { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {} }
  }

  async function runStructuredCodex({
    codexPath = 'codex',
    model = '',
    timeoutMs,
    runtime = {},
    phase = 'request',
    schema,
    input,
    schemaFileName = 'output-schema.json',
    token,
    maxStdoutBytes = DEFAULT_CODEX_STDOUT_CAPTURE_LIMIT,
    maxTranscriptBytes = DEFAULT_CODEX_TRANSCRIPT_LIMIT,
    maxStderrBytes = 1024 * 1024,
    processOptions = {},
    maxEstimatedTokens = 0,
    estimatedOutputTokens = 512,
    estimateBytesPerToken = 2
  } = {}) {
    assertSchema(schema);
    assertSafeSchemaFileName(schemaFileName);
    if (typeof input !== 'string') throw new TypeError('input must be a string.');
    if (!processOptions || typeof processOptions !== 'object' || Array.isArray(processOptions)) {
      throw new TypeError('processOptions must be an object.');
    }
    const captureLimit = normalizeStructuredOutputLimit(maxStdoutBytes, DEFAULT_CODEX_STDOUT_CAPTURE_LIMIT, 'maxStdoutBytes');
    const transcriptLimit = normalizeStructuredOutputLimit(maxTranscriptBytes, DEFAULT_CODEX_TRANSCRIPT_LIMIT, 'maxTranscriptBytes');
    const effectiveTranscriptLimit = Math.max(captureLimit, transcriptLimit);

    const baseEnvironment = processOptions.env || process.env;
    const credential = resolveProviderCredential(runtime, { env: baseEnvironment });
    const normalizedRuntime = credential.runtime;
    const environment = credential.environment;
    const effectiveTimeoutMs = timeoutMs === undefined
      ? normalizedRuntime.timeouts.requestMs
      : Math.min(Math.max(0, Math.floor(timeoutMs)), normalizedRuntime.timeouts.requestMs);
    const requestEstimate = Number(maxEstimatedTokens) > 0
      ? assertWithinTokenBudget(input, {
        maxTokens: Number(maxEstimatedTokens),
        estimatedOutputTokens,
        bytesPerToken: estimateBytesPerToken,
        label: 'Codex structured request'
      })
      : estimateRequestTokens(input, { estimatedOutputTokens, bytesPerToken: estimateBytesPerToken });
    const started = Date.now();
    const resolved = await resolveCodexExecutable(codexPath);
    await probeCodexCapabilities(resolved, model);
    return withTemporaryDirectory(async tempDir => {
      const schemaPath = path.join(tempDir, schemaFileName);
      fs.writeFileSync(schemaPath, JSON.stringify(schema), { encoding: 'utf8', mode: 0o600 });
      const stream = createCodexJsonlAccumulator();
      const callerStdout = typeof processOptions.onStdoutChunk === 'function' ? processOptions.onStdoutChunk : null;
      let processResult;
      try {
        processResult = await runPreparedProcess(
          resolved.executable,
          buildCodexArgs(schemaPath, model, normalizedRuntime),
          {
            ...processOptions,
            env: environment,
            cwd: tempDir,
            timeoutMs: effectiveTimeoutMs,
            maxStdoutBytes: effectiveTranscriptLimit,
            maxCapturedStdoutBytes: captureLimit,
            maxStderrBytes,
            onStdoutChunk: chunk => {
              stream.push(chunk);
              if (callerStdout) callerStdout(chunk);
            }
          },
          input,
          token
        );
      } catch (error) {
        if (isCliCompatibilityError(error)) {
          throw createError(
            'ECODEXVERSION',
            `The installed Codex CLI rejected one or more safety/structured-output arguments. Original error: ${error.stderr || error.message}`,
            error
          );
        }
        throw classifyCodexFailure(error, normalizedRuntime, { phase, env: environment, credential });
      }

      const streamedSnapshot = stream.snapshot();
      let agentText;
      let usage;
      if (streamedSnapshot.events > 0 || streamedSnapshot.pendingBytes > 0) {
        const streamed = stream.finish();
        agentText = streamed.agentMessage;
        usage = usageShape(streamed.usage || {});
      } else {
        agentText = parseCodexJsonl(processResult.stdout, {
          allowLeadingPartial: processResult.stdoutTruncated === true
        });
        usage = extractCodexUsage(processResult.stdout);
      }
      let parsed;
      try { parsed = JSON.parse(agentText); }
      catch { throw createError('ECODEXOUTPUT', 'The final Codex agent_message is not JSON matching the output schema.'); }
      return {
        parsed,
        resolved,
        processResult,
        usage,
        requestEstimate,
        provider: providerMetadata(normalizedRuntime, credential),
        durationMs: Math.max(0, Date.now() - started)
      };
    });
  }

  async function probeCodexRuntime({ codexPath = 'codex', model = '', runtime = {}, timeoutMs, token } = {}) {
    const normalizedRuntime = normalizeCodexRuntimeOptions(runtime);
    const result = await runStructuredCodex({
      codexPath,
      model,
      runtime: normalizedRuntime,
      timeoutMs: timeoutMs === undefined ? Math.min(30000, normalizedRuntime.timeouts.requestMs) : timeoutMs,
      phase: 'connectivity-probe',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { ok: { type: 'boolean', const: true } },
        required: ['ok']
      },
      input: 'Connectivity probe. Return exactly {"ok":true} through the required output schema. Do not use tools or external data.',
      schemaFileName: 'runtime-probe-schema.json',
      token,
      maxEstimatedTokens: 2048,
      estimatedOutputTokens: 32
    });
    return Object.freeze({
      ok: result.parsed?.ok === true,
      codexVersion: result.resolved?.version || '',
      model: model || 'cli-default',
      provider: result.provider,
      durationMs: result.durationMs
    });
  }

  return Object.freeze({
    findWindowsCodexCandidates,
    resolveCodexExecutable,
    probeCodexCapabilities,
    probeCodexRuntime,
    buildCodexArgs,
    withTemporaryDirectory,
    runStructuredCodex,
    parseCodexJsonl,
    capabilityCache
  });
}

module.exports = {
  DEFAULT_CODEX_STDOUT_CAPTURE_LIMIT,
  DEFAULT_CODEX_TRANSCRIPT_LIMIT,
  assertSafeTempPrefix,
  assertSafeSchemaFileName,
  assertSchema,
  createCodexCli,
  parseCodexJsonl
};
