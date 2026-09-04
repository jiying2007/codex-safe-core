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
