'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { atomicWriteText, secureReadText, withExclusiveFileLock } = require('../secure-local-file');

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-secure-local-')); }

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
