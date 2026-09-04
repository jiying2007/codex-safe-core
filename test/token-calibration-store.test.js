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
    const first = new TokenEstimatorCalibration({ minSamples: 1 });
    first.observe('relay', 'model-a', { bytes: 2000, usage: { inputTokens: 1000 } });
    const store = createTokenCalibrationStore({ filePath: file, now: () => 1000000 });
    const written = store.write(first);
    assert.equal(written.entries, 1);
    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(persisted.entries[0].provider, 'relay');
    assert.equal(persisted.entries[0].model, 'model-a');
    assert.equal('prompt' in persisted.entries[0], false);
    assert.equal('source' in persisted.entries[0], false);
    const second = new TokenEstimatorCalibration({ minSamples: 1 });
    assert.equal(store.restore(second), 1);
    assert.notEqual(second.bytesPerToken('relay', 'model-a'), second.defaultBytesPerToken);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('expired entries are ignored', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'calibration.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, entries: [{ provider: 'relay', model: 'old', samples: 10, bytesPerToken: 2, lastObserved: 2, updatedAtMs: 1 }] }));
    const store = createTokenCalibrationStore({ filePath: file, now: () => 10_000_000, ttlMs: 60_000 });
    assert.deepEqual(store.read(), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('store rejects symbolic link targets', { skip: process.platform === 'win32' }, () => {
  const dir = temp();
  try {
    const real = path.join(dir, 'real.json');
    const link = path.join(dir, 'link.json');
    fs.writeFileSync(real, JSON.stringify({ version: 1, entries: [] }));
    fs.symlinkSync(real, link);
    const store = createTokenCalibrationStore({ filePath: link });
    assert.throws(() => store.read(), error => error?.code === 'ECALIBRATIONSTORE');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
