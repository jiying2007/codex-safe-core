'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TOKEN_CALIBRATION_STORE_VERSION = 1;
const DEFAULT_TOKEN_CALIBRATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_CALIBRATION_ENTRIES = 256;

function normalizePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim() || /[\r\n\0]/.test(filePath) || filePath.length > 4096) {
    throw new TypeError('Token calibration store path is invalid.');
  }
  return path.resolve(filePath);
}

function createTokenCalibrationStore({
  filePath,
  now = () => Date.now(),
  ttlMs = DEFAULT_TOKEN_CALIBRATION_TTL_MS,
  maxEntries = DEFAULT_MAX_CALIBRATION_ENTRIES
} = {}) {
  const target = normalizePath(filePath);
  const ttl = Math.max(60 * 1000, Math.min(365 * 24 * 60 * 60 * 1000, Math.floor(Number(ttlMs) || DEFAULT_TOKEN_CALIBRATION_TTL_MS)));
  const limit = Math.max(1, Math.min(4096, Math.floor(Number(maxEntries) || DEFAULT_MAX_CALIBRATION_ENTRIES)));

  function rejectSymlinkIfPresent() {
    try {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {
        const error = new Error('Token calibration store must not be a symbolic link.');
        error.code = 'ECALIBRATIONSTORE';
        throw error;
      }
      if (!stat.isFile()) {
        const error = new Error('Token calibration store path is not a regular file.');
        error.code = 'ECALIBRATIONSTORE';
        throw error;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  function parseDocument(text) {
    let document;
    try { document = JSON.parse(text); }
    catch {
      const error = new Error('Token calibration store is not valid JSON.');
      error.code = 'ECALIBRATIONSTORE';
      throw error;
    }
    if (!document || typeof document !== 'object' || Array.isArray(document) || document.version !== TOKEN_CALIBRATION_STORE_VERSION || !Array.isArray(document.entries)) {
      const error = new Error('Token calibration store has an unsupported shape or version.');
      error.code = 'ECALIBRATIONSTORE';
      throw error;
    }
    const cutoff = now() - ttl;
    return document.entries
      .filter(item => item && typeof item === 'object' && !Array.isArray(item))
      .filter(item => Number(item.updatedAtMs) >= cutoff)
      .slice(0, limit)
      .map(item => ({
        provider: String(item.provider || '').trim(),
        model: String(item.model || '').trim(),
        samples: Math.max(0, Math.floor(Number(item.samples) || 0)),
        bytesPerToken: Number(item.bytesPerToken),
        lastObserved: item.lastObserved === null ? null : Number(item.lastObserved),
        updatedAtMs: Number(item.updatedAtMs)
      }))
      .filter(item => item.provider && item.model && item.samples > 0 && Number.isFinite(item.bytesPerToken) && item.bytesPerToken > 0);
  }

  function read() {
    rejectSymlinkIfPresent();
    let text;
    try { text = fs.readFileSync(target, 'utf8'); }
    catch (error) {
      if (error?.code === 'ENOENT') return Object.freeze([]);
      throw error;
    }
    return Object.freeze(parseDocument(text).map(item => Object.freeze(item)));
  }

  function restore(calibration) {
    if (!calibration || typeof calibration.restore !== 'function') throw new TypeError('Token calibration store requires a restorable calibration object.');
    return calibration.restore(read(), { replace: false });
  }

  function write(calibration) {
    if (!calibration || typeof calibration.snapshot !== 'function') throw new TypeError('Token calibration store requires a calibration snapshot provider.');
    rejectSymlinkIfPresent();
    const updatedAtMs = now();
    const entries = calibration.snapshot().slice(0, limit).map(item => ({
      provider: String(item.provider || '').trim(),
      model: String(item.model || '').trim(),
      samples: Math.max(0, Math.floor(Number(item.samples) || 0)),
      bytesPerToken: Number(item.bytesPerToken),
      lastObserved: item.lastObserved === null ? null : Number(item.lastObserved),
      updatedAtMs
    })).filter(item => item.provider && item.model && item.samples > 0 && Number.isFinite(item.bytesPerToken) && item.bytesPerToken > 0);
    const document = JSON.stringify({ version: TOKEN_CALIBRATION_STORE_VERSION, updatedAtMs, entries }, null, 2) + '\n';
    const directory = path.dirname(target);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(directory, `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(temporary, document, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, target);
      try { fs.chmodSync(target, 0o600); } catch {}
    } finally {
      try { fs.rmSync(temporary, { force: true }); } catch {}
    }
    return Object.freeze({ entries: entries.length, bytes: Buffer.byteLength(document, 'utf8'), path: target });
  }

  return Object.freeze({
    version: TOKEN_CALIBRATION_STORE_VERSION,
    filePath: target,
    ttlMs: ttl,
    maxEntries: limit,
    read,
    restore,
    write
  });
}

module.exports = {
  TOKEN_CALIBRATION_STORE_VERSION,
  DEFAULT_TOKEN_CALIBRATION_TTL_MS,
  DEFAULT_MAX_CALIBRATION_ENTRIES,
  createTokenCalibrationStore
};
