'use strict';

const path = require('node:path');
const { atomicWriteText, secureReadText, withExclusiveFileLock } = require('./secure-local-file');

const TOKEN_CALIBRATION_STORE_VERSION = 1;
const DEFAULT_TOKEN_CALIBRATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_CALIBRATION_ENTRIES = 256;
const MAX_TOKEN_CALIBRATION_STORE_BYTES = 1024 * 1024;

function normalizePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim() || /[\r\n\0]/.test(filePath) || filePath.length > 4096) throw new TypeError('Token calibration store path is invalid.');
  return path.resolve(filePath);
}
function createTokenCalibrationStore({ filePath, now = () => Date.now(), ttlMs = DEFAULT_TOKEN_CALIBRATION_TTL_MS, maxEntries = DEFAULT_MAX_CALIBRATION_ENTRIES } = {}) {
  const target = normalizePath(filePath);
  const ttl = Math.max(60 * 1000, Math.min(365 * 24 * 60 * 60 * 1000, Math.floor(Number(ttlMs) || DEFAULT_TOKEN_CALIBRATION_TTL_MS)));
  const limit = Math.max(1, Math.min(4096, Math.floor(Number(maxEntries) || DEFAULT_MAX_CALIBRATION_ENTRIES)));
  function parseDocument(text) {
    let document;
    try { document = JSON.parse(text); } catch { const error = new Error('Token calibration store is not valid JSON.'); error.code = 'ECALIBRATIONSTORE'; throw error; }
    if (!document || typeof document !== 'object' || Array.isArray(document) || document.version !== TOKEN_CALIBRATION_STORE_VERSION || !Array.isArray(document.entries)) { const error = new Error('Token calibration store has an unsupported shape or version.'); error.code = 'ECALIBRATIONSTORE'; throw error; }
    const cutoff = now() - ttl;
    return document.entries.filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(item => ({
      provider: String(item.provider || '').trim(),
      model: String(item.model || '').trim(),
      samples: Math.max(0, Math.floor(Number(item.samples) || 0)),
      bytesPerToken: Number(item.bytesPerToken),
      lastObserved: item.lastObserved === null ? null : Number(item.lastObserved),
      lastObservedAtMs: Math.max(0, Number(item.lastObservedAtMs ?? item.updatedAtMs) || 0),
      updatedAtMs: Math.max(0, Number(item.updatedAtMs) || 0)
    })).filter(item => item.provider && item.model && item.samples > 0 && Number.isFinite(item.bytesPerToken) && item.bytesPerToken > 0 && item.lastObservedAtMs >= cutoff).sort((a,b) => b.lastObservedAtMs - a.lastObservedAtMs || b.samples - a.samples || `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`)).slice(0, limit);
  }
  function readUnlocked() {
    let text;
    try { text = secureReadText(target, { maxBytes: MAX_TOKEN_CALIBRATION_STORE_BYTES, allowMissing: true, requireOwner: true, rejectGroupOtherWrite: true }); }
    catch (error) { const wrapped = new Error(`Unable to securely read token calibration store: ${error.message}`); wrapped.code = 'ECALIBRATIONSTORE'; wrapped.cause = error; throw wrapped; }
    if (text === null) return [];
    return parseDocument(text);
  }
  function read() { return Object.freeze(readUnlocked().map(item => Object.freeze(item))); }
  function restore(calibration) {
    if (!calibration || typeof calibration.restore !== 'function') throw new TypeError('Token calibration store requires a restorable calibration object.');
    return calibration.restore(read(), { replace: false });
  }
  function write(calibration) {
    if (!calibration || typeof calibration.snapshot !== 'function') throw new TypeError('Token calibration store requires a calibration snapshot provider.');
    return withExclusiveFileLock(target, () => {
      const updatedAtMs = now();
      const local = calibration.snapshot().map(item => ({
        provider: String(item.provider || '').trim(), model: String(item.model || '').trim(), samples: Math.max(0, Math.floor(Number(item.samples) || 0)), bytesPerToken: Number(item.bytesPerToken), lastObserved: item.lastObserved === null ? null : Number(item.lastObserved), lastObservedAtMs: Math.max(0, Number(item.lastObservedAtMs) || 0), updatedAtMs
      })).filter(item => item.provider && item.model && item.samples > 0 && Number.isFinite(item.bytesPerToken) && item.bytesPerToken > 0 && item.lastObservedAtMs > 0);
      const disk = readUnlocked();
      const merged = new Map();
      for (const item of [...disk, ...local]) {
        const key = `${item.provider}\n${item.model}`, current = merged.get(key);
        if (!current || item.lastObservedAtMs > current.lastObservedAtMs || (item.lastObservedAtMs === current.lastObservedAtMs && item.samples >= current.samples)) merged.set(key, item);
      }
      const cutoff = updatedAtMs - ttl;
      const entries = [...merged.values()].filter(item => item.lastObservedAtMs >= cutoff).sort((a,b) => b.lastObservedAtMs - a.lastObservedAtMs || b.samples - a.samples || `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`)).slice(0, limit).map(item => ({ ...item, updatedAtMs }));
      const document = JSON.stringify({ version: TOKEN_CALIBRATION_STORE_VERSION, updatedAtMs, entries }, null, 2) + '\n';
      const written = atomicWriteText(target, document, { mode: 0o600, maxBytes: MAX_TOKEN_CALIBRATION_STORE_BYTES });
      return Object.freeze({ entries: entries.length, bytes: written.bytes, path: target });
    });
  }
  return Object.freeze({ version: TOKEN_CALIBRATION_STORE_VERSION, filePath: target, ttlMs: ttl, maxEntries: limit, read, restore, write });
}
module.exports = { TOKEN_CALIBRATION_STORE_VERSION, DEFAULT_TOKEN_CALIBRATION_TTL_MS, DEFAULT_MAX_CALIBRATION_ENTRIES, MAX_TOKEN_CALIBRATION_STORE_BYTES, createTokenCalibrationStore };
