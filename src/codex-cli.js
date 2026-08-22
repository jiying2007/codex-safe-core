'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { REQUIRED_CODEX_TOP_LEVEL_FLAGS, REQUIRED_CODEX_EXEC_FLAGS, buildSafeCodexArgs, missingHelpFlags, isCliCompatibilityError } = require('./safe-contract');

function createError(code, message, cause, extra = {}) { const error = new Error(message); error.code = code; if (cause !== undefined) error.cause = cause; Object.assign(error, extra); return error; }
function parseCodexJsonl(stdout) {
  let lastAgentMessage = ''; const errors = [];
  for (const line of String(stdout || '').split(/\r?\n/).filter(Boolean)) {
    let event; try { event = JSON.parse(line); } catch { throw createError('ECODEXOUTPUT', 'Codex --json returned invalid JSONL.'); }
    if (event?.type === 'item.completed' && event?.item?.type === 'agent_message' && typeof event.item.text === 'string') lastAgentMessage = event.item.text;
    if (event?.type === 'error') errors.push(event.message || event.error?.message || 'Codex reported an error');
    if (event?.type === 'turn.failed') errors.push(event.error?.message || event.message || 'Codex turn failed');
  }
  if (!lastAgentMessage && errors.length) throw createError('ECODEXTURN', errors.join('; '));
  if (!lastAgentMessage) throw createError('ECODEXOUTPUT', 'Codex JSONL did not contain a final agent_message.');
  return lastAgentMessage.trim();
}
function createCodexCli({ runPreparedProcess, tempPrefix = 'codex-safe-', capabilityCache = new Map() } = {}) {
  if (typeof runPreparedProcess !== 'function') throw new TypeError('createCodexCli requires runPreparedProcess.');
  async function findWindowsCodexCandidates(codexPath) {
    if (process.platform !== 'win32' || codexPath !== 'codex') return [codexPath];
    const candidates = [];
    try { const { stdout } = await runPreparedProcess('where.exe', ['codex'], { timeoutMs: 5000 }); for (const line of String(stdout || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)) if (!candidates.includes(line)) candidates.push(line); } catch {}
    for (const fallback of ['codex.exe','codex.cmd','codex.bat','codex']) if (!candidates.includes(fallback)) candidates.push(fallback);
    return candidates.sort((a,b)=> (/\.exe$/i.test(a)?0:/\.(cmd|bat)$/i.test(a)?1:2)-(/\.exe$/i.test(b)?0:/\.(cmd|bat)$/i.test(b)?1:2));
  }
  async function resolveCodexExecutable(codexPath) {
    const candidates = await findWindowsCodexCandidates(codexPath); const lookup = process.platform === 'win32' && codexPath === 'codex'; let lastError;
    for (const candidate of candidates) {
      try { const result = await runPreparedProcess(candidate, ['--version'], { timeoutMs: 10000 }); const version = String(result.stdout || result.stderr || '').trim(); if (!version) throw new Error('No version output.'); return { executable: candidate, version }; }
      catch (error) { lastError = error; if (lookup) continue; if (error?.code === 'ENOENT') break; throw createError('ECODEXUNUSABLE', `Codex CLI failed to run: ${candidate}.`, error); }
    }
    throw createError('ECODEXNOTFOUND', `No usable Codex CLI was found for: ${codexPath}.`, lastError);
  }
  async function probeCodexCapabilities(resolved, model = '') {
    const executable = typeof resolved === 'string' ? resolved : resolved?.executable; const version = typeof resolved === 'string' ? '' : resolved?.version || '';
    if (!executable) throw createError('ECODEXCAPABILITY', 'Codex CLI executable is missing.');
    const cacheKey = `${executable}\n${version}\n${model ? 'model' : 'default'}`; if (capabilityCache.has(cacheKey)) return capabilityCache.get(cacheKey);
    let topHelp, execHelp;
    try { const [top, exec] = await Promise.all([runPreparedProcess(executable,['--help'],{timeoutMs:10000,maxStdoutBytes:1024*1024,maxStderrBytes:256*1024}),runPreparedProcess(executable,['exec','--help'],{timeoutMs:10000,maxStdoutBytes:1024*1024,maxStderrBytes:256*1024})]); topHelp=`${top.stdout||''}\n${top.stderr||''}`; execHelp=`${exec.stdout||''}\n${exec.stderr||''}`; }
    catch (error) { throw createError('ECODEXCAPABILITY', `Unable to inspect Codex CLI capabilities${version ? ` for ${version}` : ''}.`, error); }
    const missing = [...missingHelpFlags(topHelp, REQUIRED_CODEX_TOP_LEVEL_FLAGS).map(flag=>`top-level ${flag}`), ...missingHelpFlags(execHelp, REQUIRED_CODEX_EXEC_FLAGS).map(flag=>`exec ${flag}`)];
    if (model && !`${topHelp}\n${execHelp}`.includes('--model')) missing.push('--model');
    if (missing.length) throw createError('ECODEXCAPABILITY', `Codex CLI${version ? ` ${version}` : ''} does not expose required capabilities: ${missing.join(', ')}.`, undefined, { missingFlags: missing });
    const result = Object.freeze({ executable, version, capabilitiesVerified: true }); capabilityCache.set(cacheKey, result); return result;
  }
  async function withTemporaryDirectory(fn) { const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix)); try { return await fn(tempDir); } finally { try { fs.rmSync(tempDir,{recursive:true,force:true}); } catch {} } }
  async function runStructuredCodex({ codexPath='codex', model='', timeoutMs, schema, input, schemaFileName='output-schema.json', token, maxStdoutBytes=4*1024*1024, maxStderrBytes=1024*1024, processOptions={} }) {
    const resolved = await resolveCodexExecutable(codexPath); await probeCodexCapabilities(resolved, model);
    return withTemporaryDirectory(async tempDir => { const schemaPath = path.join(tempDir, schemaFileName); fs.writeFileSync(schemaPath, JSON.stringify(schema), {encoding:'utf8',mode:0o600}); let processResult;
      try { processResult = await runPreparedProcess(resolved.executable, buildSafeCodexArgs(schemaPath, model), {...processOptions,cwd:tempDir,timeoutMs,maxStdoutBytes,maxStderrBytes}, input, token); }
      catch (error) { if (isCliCompatibilityError(error)) throw createError('ECODEXVERSION', `The installed Codex CLI rejected one or more required safety arguments.`, error); throw error; }
      const agentText = parseCodexJsonl(processResult.stdout); let parsed; try { parsed = JSON.parse(agentText); } catch { throw createError('ECODEXOUTPUT','The final Codex agent_message is not valid JSON.'); }
      return { parsed, resolved, processResult };
    });
  }
  return Object.freeze({ findWindowsCodexCandidates, resolveCodexExecutable, probeCodexCapabilities, buildCodexArgs: buildSafeCodexArgs, withTemporaryDirectory, runStructuredCodex, parseCodexJsonl, capabilityCache });
}
module.exports = { createCodexCli, parseCodexJsonl };
