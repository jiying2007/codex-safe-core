'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { atomicWriteText, secureReadBuffer, secureReadText, withExclusiveFileLock } = require('../secure-local-file');

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-secure-local-')); }

test('binary reader preserves arbitrary bytes under the same descriptor and byte budget', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'artifact.bin'), value = Buffer.from([0,255,128,10,13,42]);
    fs.writeFileSync(file, value, { mode: 0o600 });
    assert.deepEqual(secureReadBuffer(file, { maxBytes: value.length }), value);
    assert.equal(secureReadText(file), value.toString('utf8'), 'text reads retain their existing replacement decoding');
    assert.throws(() => secureReadBuffer(file, { maxBytes: value.length - 1 }), error => error.code === 'ELOCALFILE');
    assert.equal(secureReadBuffer(path.join(dir, 'missing'), { allowMissing: true }), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader passes available no-follow and nonblocking flags to the opener', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'regular');
    fs.writeFileSync(file, 'regular content', { mode: 0o600 });
    const fsImpl = Object.create(fs);
    let observedFlags;
    fsImpl.openSync = (target, flags) => {
      observedFlags = flags;
      return fs.openSync(target, flags);
    };
    assert.equal(secureReadText(file, { fsImpl }), 'regular content');
    assert.equal(observedFlags, fs.constants.O_RDONLY | Number(fs.constants.O_NOFOLLOW || 0) | Number(fs.constants.O_NONBLOCK || 0));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader closes a nonregular descriptor before any path check or read on every platform', () => {
  const fsImpl = Object.create(fs);
  let closed = 0;
  fsImpl.openSync = () => 123;
  fsImpl.fstatSync = fd => { assert.equal(fd, 123); return { isFile: () => false }; };
  fsImpl.lstatSync = () => assert.fail('a nonregular descriptor must be rejected before checking its path');
  fsImpl.readSync = () => assert.fail('a nonregular descriptor must never be read');
  fsImpl.closeSync = fd => { assert.equal(fd, 123); closed++; };
  assert.throws(() => secureReadBuffer(path.join(os.tmpdir(), 'nonregular'), { fsImpl }), error => error.code === 'ELOCALFILE' && /not a regular file/.test(error.message));
  assert.equal(closed, 1);
});

function assertFifoRejectedWithoutBlocking(target, replacement = '') {
  const script = String.raw`
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const [modulePath, target, replacement] = process.argv.slice(1);
    const { secureReadBuffer } = require(modulePath);
    const fsImpl = Object.create(fs);
    let closed = 0;
    fsImpl.openSync = (file, flags) => {
      if (replacement) {
        assert.equal(fs.lstatSync(file).isFile(), true);
        fs.renameSync(replacement, file);
      }
      return fs.openSync(file, flags);
    };
    fsImpl.readSync = () => assert.fail('a FIFO must never be read');
    fsImpl.closeSync = fd => { fs.closeSync(fd); closed++; };
    assert.throws(() => secureReadBuffer(target, { fsImpl }), error => error.code === 'ELOCALFILE' && /not a regular file/.test(error.message));
    assert.equal(closed, 1);
  `;
  const result = spawnSync(process.execPath, ['-e', script, require.resolve('../secure-local-file'), target, replacement], {
    encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024
  });
  assert.equal(result.error, undefined, `secure read blocked or failed: ${result.error?.message || ''}`);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
}

test('secure reader rejects a real FIFO without waiting for a writer', { skip: process.platform === 'win32' }, () => {
  const dir = temp();
  try {
    const fifo = path.join(dir, 'fifo');
    execFileSync('mkfifo', ['-m', '600', fifo], { timeout: 5000 });
    assert.equal(fs.lstatSync(fifo).isFIFO(), true);
    assertFifoRejectedWithoutBlocking(fifo);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader rejects a regular file replaced by a FIFO immediately before opening', { skip: process.platform === 'win32' }, () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'regular'), fifo = path.join(dir, 'replacement-fifo');
    fs.writeFileSync(file, 'regular content', { mode: 0o600 });
    execFileSync('mkfifo', ['-m', '600', fifo], { timeout: 5000 });
    assert.equal(fs.lstatSync(fifo).isFIFO(), true);
    assertFifoRejectedWithoutBlocking(file, fifo);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('optional single-link policy rejects a second name before and during a read', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'snapshot'), alias = path.join(dir, 'alias');
    fs.writeFileSync(file, 'private snapshot', { mode: 0o600 });
    fs.linkSync(file, alias);
    assert.throws(() => secureReadBuffer(file, { requireSingleLink: true }), /exactly one link/);
    fs.unlinkSync(alias);
    const fsImpl = Object.create(fs); let linked = false;
    fsImpl.readSync = (...args) => {
      if (!linked) { fs.linkSync(file, alias); linked = true; }
      return fs.readSync(...args);
    };
    assert.throws(() => secureReadBuffer(file, { requireSingleLink: true, fsImpl }), /exactly one link/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure local file round-trip uses private regular file', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'state.json');
    atomicWriteText(file, '{"ok":true}\n');
    assert.equal(secureReadText(file), '{"ok":true}\n');
    if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader rejects symlink targets', { skip: process.platform === 'win32' }, () => {
  const dir = temp();
  try {
    const real = path.join(dir, 'real');
    const link = path.join(dir, 'link');
    fs.writeFileSync(real, 'x', { mode: 0o600 });
    fs.symlinkSync(real, link);
    assert.throws(() => secureReadText(link), error => error?.code === 'ELOCALFILE');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('exclusive lock releases after callback', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'state');
    assert.equal(withExclusiveFileLock(file, () => 42), 42);
    assert.equal(fs.existsSync(`${file}.lock`), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader rejects a symlink even when the opener cannot enforce no-follow', { skip: process.platform === 'win32' }, () => {
  const dir = temp();
  try {
    const real = path.join(dir, 'real');
    const link = path.join(dir, 'link');
    fs.writeFileSync(real, 'private', { mode: 0o600 });
    fs.symlinkSync(real, link);
    const fsImpl = Object.create(fs);
    fsImpl.openSync = target => fs.openSync(target, fs.constants.O_RDONLY);
    let read = false;
    fsImpl.readSync = (...args) => { read = true; return fs.readSync(...args); };
    assert.throws(() => secureReadText(link, { fsImpl }), error => error.code === 'ELOCALFILE');
    assert.equal(read, false, 'the opened descriptor must be checked against the path before reading');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader bounds bytes even when a regular file grows after fstat', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'growing');
    fs.writeFileSync(file, 'small', { mode: 0o600 });
    let reads = 0, bytes = 0;
    const fsImpl = Object.create(fs);
    fsImpl.readSync = (...args) => {
      if (reads++ === 0) fs.appendFileSync(file, 'x'.repeat(4096));
      const count = fs.readSync(...args); bytes += count; return count;
    };
    assert.throws(() => secureReadText(file, { maxBytes: 32, fsImpl }), error => error.code === 'ELOCALFILE');
    assert.ok(bytes <= 33, 'the read itself must be bounded, not only the initial stat');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader refuses path replacement while retaining the original descriptor', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'config');
    fs.writeFileSync(file, 'original', { mode: 0o600 });
    let replaced = false;
    const fsImpl = Object.create(fs);
    fsImpl.readSync = (...args) => {
      if (!replaced) {
        replaced = true;
        fs.renameSync(file, file + '.original');
        fs.writeFileSync(file, 'substitute', { mode: 0o600 });
      }
      return fs.readSync(...args);
    };
    assert.throws(() => secureReadText(file, { fsImpl }), error => error.code === 'ELOCALFILE');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('secure reader rejects group/other writable files', { skip: process.platform === 'win32' }, () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'shared');
    fs.writeFileSync(file, 'untrusted'); fs.chmodSync(file, 0o666);
    assert.throws(() => secureReadText(file), error => error.code === 'ELOCALFILE');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
