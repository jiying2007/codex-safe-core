'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TokenEstimatorCalibration } = require('../efficiency-planner');
const { createTokenCalibrationStore } = require('../token-calibration-store');

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-token-cal-')); }

test('persists numeric calibration and restores it after restart', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'calibration.json');
    const first = new TokenEstimatorCalibration({ minSamples: 1, now: () => 900000 });
    first.observe('relay', 'model-a', { bytes: 2000, usage: { inputTokens: 1000 } });
    const store = createTokenCalibrationStore({ filePath: file, now: () => 1000000 });
    const written = store.write(first);
    assert.equal(written.entries, 1);
    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(persisted.entries[0].provider, 'relay');
    assert.equal(persisted.entries[0].model, 'model-a');
    assert.equal(persisted.entries[0].lastObservedAtMs, 900000);
    assert.equal('prompt' in persisted.entries[0], false);
    assert.equal('source' in persisted.entries[0], false);
    const second = new TokenEstimatorCalibration({ minSamples: 1 });
    assert.equal(store.restore(second), 1);
    assert.notEqual(second.bytesPerToken('relay', 'model-a'), second.defaultBytesPerToken);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('expired entries are ignored using per-model observation time', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'calibration.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, entries: [{ provider: 'relay', model: 'old', samples: 10, bytesPerToken: 2, lastObserved: 2, lastObservedAtMs: 1, updatedAtMs: 9_999_999 }] }), { mode: 0o600 });
    const store = createTokenCalibrationStore({ filePath: file, now: () => 10_000_000, ttlMs: 60_000 });
    assert.deepEqual(store.read(), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('writing a fresh model does not renew an unrelated stale calibration', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'calibration.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, entries: [{ provider: 'relay', model: 'stale', samples: 5, bytesPerToken: 2, lastObserved: 2, lastObservedAtMs: 1, updatedAtMs: 1 }] }), { mode: 0o600 });
    const fresh = new TokenEstimatorCalibration({ minSamples: 1, now: () => 100000 });
    fresh.observe('relay', 'fresh', { bytes: 1000, usage: { inputTokens: 500 } });
    const store = createTokenCalibrationStore({ filePath: file, now: () => 100000, ttlMs: 60_000 });
    store.write(fresh);
    const names = store.read().map(item => item.model);
    assert.deepEqual(names, ['fresh']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sequential writers merge independent model observations', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'calibration.json');
    const store = createTokenCalibrationStore({ filePath: file, now: () => 100000, ttlMs: 60_000 });
    const a = new TokenEstimatorCalibration({ minSamples: 1, now: () => 90000 });
    a.observe('relay', 'a', { bytes: 1000, usage: { inputTokens: 500 } });
    store.write(a);
    const b = new TokenEstimatorCalibration({ minSamples: 1, now: () => 95000 });
    b.observe('relay', 'b', { bytes: 1000, usage: { inputTokens: 500 } });
    store.write(b);
    assert.deepEqual(store.read().map(item => item.model).sort(), ['a', 'b']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('store rejects symbolic link targets', { skip: process.platform === 'win32' }, () => {
  const dir = temp();
  try {
    const real = path.join(dir, 'real.json');
    const link = path.join(dir, 'link.json');
    fs.writeFileSync(real, JSON.stringify({ version: 1, entries: [] }), { mode: 0o600 });
    fs.symlinkSync(real, link);
    const store = createTokenCalibrationStore({ filePath: link });
    assert.throws(() => store.read(), error => error?.code === 'ECALIBRATIONSTORE');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
