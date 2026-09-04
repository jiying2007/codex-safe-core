'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function localFileError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function assertPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim() || filePath.length > 4096 || /[\r\n\0]/.test(filePath)) {
    throw localFileError('ELOCALFILE', 'Machine-local file path is invalid.');
  }
  return path.resolve(filePath);
}

function validateOpenFile(fd, target, { maxBytes = 1024 * 1024, requireOwner = true, rejectGroupOtherWrite = true } = {}) {
  const stat = fs.fstatSync(fd);
  if (!stat.isFile()) throw localFileError('ELOCALFILE', `Machine-local path is not a regular file: ${target}.`, { filePath: target });
  if (Number(stat.size) > Number(maxBytes)) throw localFileError('ELOCALFILE', `Machine-local file exceeds ${maxBytes} bytes: ${target}.`, { filePath: target });
  if (process.platform !== 'win32') {
    if (requireOwner && typeof process.getuid === 'function' && Number(stat.uid) !== Number(process.getuid())) {
      throw localFileError('ELOCALFILE', `Machine-local file is not owned by the current user: ${target}.`, { filePath: target });
    }
    if (rejectGroupOtherWrite && (Number(stat.mode) & 0o022) !== 0) {
      throw localFileError('ELOCALFILE', `Machine-local file is group/other writable: ${target}.`, { filePath: target });
    }
  }
  return stat;
}

function secureReadText(filePath, { maxBytes = 1024 * 1024, allowMissing = false, requireOwner = true, rejectGroupOtherWrite = true } = {}) {
  const target = assertPath(filePath);
  let fd;
  try {
    const noFollow = Number(fs.constants.O_NOFOLLOW || 0);
    fd = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
  } catch (error) {
    if (allowMissing && error?.code === 'ENOENT') return null;
    if (['ELOOP', 'EMLINK'].includes(error?.code)) throw localFileError('ELOCALFILE', `Machine-local file must not be a symbolic link: ${target}.`, { cause: error, filePath: target });
    throw localFileError('ELOCALFILE', `Unable to open machine-local file: ${target}.`, { cause: error, filePath: target });
  }
  try {
    validateOpenFile(fd, target, { maxBytes, requireOwner, rejectGroupOtherWrite });
    return fs.readFileSync(fd, 'utf8');
  } finally {
    try { fs.closeSync(fd); } catch {}
  }
}

function rejectSymlinkTarget(target) {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw localFileError('ELOCALFILE', `Machine-local target must not be a symbolic link: ${target}.`, { filePath: target });
    if (!stat.isFile()) throw localFileError('ELOCALFILE', `Machine-local target is not a regular file: ${target}.`, { filePath: target });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function atomicWriteText(filePath, text, { mode = 0o600, maxBytes = 8 * 1024 * 1024 } = {}) {
  const target = assertPath(filePath);
  const body = String(text ?? '');
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > Number(maxBytes)) throw localFileError('ELOCALFILE', `Machine-local write exceeds ${maxBytes} bytes: ${target}.`, { filePath: target });
  rejectSymlinkTarget(target);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, mode);
    fs.writeFileSync(fd, body, 'utf8');
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary, target);
    try { fs.chmodSync(target, mode); } catch {}
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    try { fs.rmSync(temporary, { force: true }); } catch {}
  }
  return Object.freeze({ path: target, bytes });
}

function sleepSync(ms) {
  const wait = Math.max(1, Math.floor(Number(ms) || 1));
  const state = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(state, 0, 0, wait);
}

function withExclusiveFileLock(filePath, fn, { timeoutMs = 2000, retryMs = 25, staleAfterMs = 30000, now = () => Date.now() } = {}) {
  if (typeof fn !== 'function') throw new TypeError('withExclusiveFileLock requires a function.');
  const target = assertPath(filePath);
  const lockPath = `${target}.lock`;
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const deadline = now() + Math.max(50, Number(timeoutMs) || 2000);
  let fd;
  while (fd === undefined) {
    try {
      fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
      fs.writeFileSync(fd, `${process.pid}\n`, 'utf8');
    } catch (error) {
      if (error?.code !== 'EEXIST') throw localFileError('ELOCALFILELOCK', `Unable to acquire machine-local lock: ${lockPath}.`, { cause: error, filePath: lockPath });
      let stat;
      try { stat = fs.lstatSync(lockPath); } catch (statError) { if (statError?.code === 'ENOENT') continue; throw statError; }
      if (stat.isSymbolicLink()) throw localFileError('ELOCALFILELOCK', `Machine-local lock must not be a symbolic link: ${lockPath}.`, { filePath: lockPath });
      if (now() - Number(stat.mtimeMs || 0) > Math.max(1000, Number(staleAfterMs) || 30000)) {
        try { fs.rmSync(lockPath, { force: true }); } catch {}
        continue;
      }
      if (now() >= deadline) throw localFileError('ELOCALFILELOCK', `Timed out waiting for machine-local lock: ${lockPath}.`, { filePath: lockPath });
      sleepSync(retryMs);
    }
  }
  try {
    return fn();
  } finally {
    try { fs.closeSync(fd); } catch {}
    try { fs.rmSync(lockPath, { force: true }); } catch {}
  }
}

module.exports = {
  assertPath,
  atomicWriteText,
  secureReadText,
  validateOpenFile,
  withExclusiveFileLock
};
