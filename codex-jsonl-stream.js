'use strict';

const MAX_LINE_BYTES = 16 * 1024 * 1024;

function createCodexJsonlAccumulator({ maxLineBytes = MAX_LINE_BYTES } = {}) {
  const limit = Math.max(1024, Math.min(64 * 1024 * 1024, Math.floor(Number(maxLineBytes) || MAX_LINE_BYTES)));
  let pending = '';
  let lastAgentMessage = '';
  let usage = null;
  const errors = [];
  let events = 0;

  function consumeLine(line) {
    if (!line) return;
    if (Buffer.byteLength(line, 'utf8') > limit) {
      const error = new Error(`Codex JSONL line exceeded the limit (${limit} bytes).`);
      error.code = 'ECODEXOUTPUT';
      throw error;
    }
    let event;
    try { event = JSON.parse(line); }
    catch {
      const error = new Error('Codex --json returned invalid JSONL.');
      error.code = 'ECODEXOUTPUT';
      throw error;
    }
    events++;
    if (event?.type === 'item.completed' && event?.item?.type === 'agent_message' && typeof event.item.text === 'string') {
      lastAgentMessage = event.item.text;
    }
    if (event?.type === 'turn.completed' && event.usage && typeof event.usage === 'object') usage = event.usage;
    if (event?.type === 'error') errors.push(event.message || event.error?.message || 'Codex reported an error');
    if (event?.type === 'turn.failed') errors.push(event.error?.message || event.message || 'Codex turn failed');
  }

  function push(chunk) {
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
    if (!text) return;
    pending += text;
    if (Buffer.byteLength(pending, 'utf8') > limit && !pending.includes('\n')) {
      const error = new Error(`Codex JSONL line exceeded the limit (${limit} bytes).`);
      error.code = 'ECODEXOUTPUT';
      throw error;
    }
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '');
      pending = pending.slice(newline + 1);
      consumeLine(line);
    }
  }

  function finish() {
    if (pending) {
      consumeLine(pending.replace(/\r$/, ''));
      pending = '';
    }
    if (!lastAgentMessage && errors.length) {
      const error = new Error(errors.join('; '));
      error.code = 'ECODEXTURN';
      throw error;
    }
    if (!lastAgentMessage) {
      const error = new Error('Codex JSONL did not contain a final agent_message.');
      error.code = 'ECODEXOUTPUT';
      throw error;
    }
    return Object.freeze({
      agentMessage: lastAgentMessage.trim(),
      usage: usage ? Object.freeze({ ...usage }) : null,
      errors: Object.freeze(errors.slice()),
      events
    });
  }

  function snapshot() {
    return Object.freeze({
      agentMessage: lastAgentMessage.trim(),
      usage: usage ? Object.freeze({ ...usage }) : null,
      errors: Object.freeze(errors.slice()),
      events,
      pendingBytes: Buffer.byteLength(pending, 'utf8')
    });
  }

  return Object.freeze({ push, finish, snapshot });
}

module.exports = { MAX_LINE_BYTES, createCodexJsonlAccumulator };
