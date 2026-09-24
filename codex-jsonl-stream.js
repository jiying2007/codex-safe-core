'use strict';

const { TextDecoder } = require('node:util');
const MAX_LINE_BYTES = 16 * 1024 * 1024;

function createCodexJsonlAccumulator({ maxLineBytes = MAX_LINE_BYTES } = {}) {
  const limit = Math.max(1024, Math.min(64 * 1024 * 1024, Math.floor(Number(maxLineBytes) || MAX_LINE_BYTES)));
  // Fatal streaming decoding preserves split UTF-8 and never silently replaces bytes.
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let pending = '', undecodedBytes = 0, lastAgentMessage = '', usage = null;
  let events = 0, state = 'initial', failure = null, finished = null;
  const errors = [];

  function fail(code, message) {
    if (!failure) failure = Object.assign(new Error(message), { code });
    throw failure;
  }
  function rememberError(message) {
    if (errors.length < 16) errors.push(String(message).slice(0, 1024));
  }
  function checkLimit(bytes) {
    if (bytes > limit) fail('ECODEXOUTPUT', `Codex JSONL line exceeded the limit (${limit} bytes).`);
  }
  function consumeLine(line) {
    if (!line) return;
    checkLimit(Buffer.byteLength(line, 'utf8'));
    let event;
    try { event = JSON.parse(line); }
    catch { fail('ECODEXOUTPUT', 'Codex --json returned invalid JSONL.'); }
    if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') {
      fail('ECODEXOUTPUT', 'Codex JSONL event must be an object with a type.');
    }
    events++;
    if (event.type === 'turn.failed') {
      rememberError(event.error?.message || event.message || 'Codex turn failed');
      state = 'failed';
      return;
    }
    if (state === 'failed') return; // A terminal failure can never regain authority.
    if (event.type === 'turn.started') {
      state = 'running';
      lastAgentMessage = '';
      usage = null;
      errors.length = 0;
    } else if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
      if (state === 'completed') fail('ECODEXOUTPUT', 'Codex agent_message followed a completed turn.');
      if (typeof event.item.text !== 'string') fail('ECODEXOUTPUT', 'Codex agent_message text is invalid.');
      state = 'running';
      lastAgentMessage = event.item.text;
    } else if (event.type === 'turn.completed') {
      if (state === 'completed') fail('ECODEXOUTPUT', 'Codex JSONL contains duplicate turn completion.');
      state = 'completed';
      usage = event.usage && typeof event.usage === 'object' && !Array.isArray(event.usage) ? event.usage : null;
    } else if (event.type === 'error') {
      // A recoverable diagnostic is not a terminal failure; completion is still required.
      rememberError(event.message || event.error?.message || 'Codex reported an error');
      if (state === 'completed') state = 'failed';
    }
  }
  function consumeText(text) {
    pending += text;
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '');
      pending = pending.slice(newline + 1);
      consumeLine(line);
    }
    // Also bound a large unfinished suffix after one or more complete lines.
    checkLimit(Buffer.byteLength(pending, 'utf8') + undecodedBytes);
  }
  function push(chunk) {
    if (failure) throw failure;
    if (finished) fail('ECODEXOUTPUT', 'Codex JSONL input arrived after finish.');
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || ''), 'utf8');
    if (!bytes.length) return;
    let text;
    try { text = decoder.decode(bytes, { stream: true }); }
    catch { fail('ECODEXOUTPUT', 'Codex --json returned invalid UTF-8.'); }
    undecodedBytes += bytes.length - Buffer.byteLength(text, 'utf8');
    consumeText(text);
  }
  function finish() {
    if (failure) throw failure;
    if (finished) return finished;
    let tail;
    try { tail = decoder.decode(); }
    catch { fail('ECODEXOUTPUT', 'Codex --json ended with incomplete UTF-8.'); }
    undecodedBytes = 0;
    consumeText(tail);
    if (pending) { consumeLine(pending.replace(/\r$/, '')); pending = ''; }
    if (state === 'failed') fail('ECODEXTURN', errors.join('; ') || 'Codex turn failed.');
    if (state !== 'completed') {
      fail(errors.length ? 'ECODEXTURN' : 'ECODEXOUTPUT', errors.join('; ') || 'Codex JSONL did not contain a successful turn.completed.');
    }
    if (!lastAgentMessage.trim()) fail('ECODEXOUTPUT', 'Codex JSONL did not contain a final agent_message.');
    finished = Object.freeze({
      agentMessage: lastAgentMessage.trim(),
      usage: usage ? Object.freeze({ ...usage }) : null,
      errors: Object.freeze(errors.slice()),
      events
    });
    return finished;
  }
  function snapshot() {
    return Object.freeze({
      agentMessage: lastAgentMessage.trim(),
      usage: usage ? Object.freeze({ ...usage }) : null,
      errors: Object.freeze(errors.slice()),
      events,
      pendingBytes: Buffer.byteLength(pending, 'utf8') + undecodedBytes
    });
  }
  return Object.freeze({ push, finish, snapshot });
}

module.exports = { MAX_LINE_BYTES, createCodexJsonlAccumulator };
