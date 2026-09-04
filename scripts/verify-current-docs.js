#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const contract = require('../core-contract.json');
const { renderCurrentContractBlock } = require('./current-contract-block');

const root = path.resolve(__dirname, '..');
const normalizeText = value => String(value).replace(/\r\n/g, '\n');
const architecture = normalizeText(fs.readFileSync(path.join(root, 'ARCHITECTURE.md'), 'utf8'));
const expected = normalizeText(renderCurrentContractBlock(contract));
const start = '<!-- GENERATED:CORE-CONTRACT:START -->';
const end = '<!-- GENERATED:CORE-CONTRACT:END -->';
const startIndex = architecture.indexOf(start);
const endIndex = architecture.indexOf(end);
if (startIndex < 0 || endIndex < startIndex) throw new Error('ARCHITECTURE.md is missing the generated current-contract block.');
const actual = architecture.slice(startIndex, endIndex + end.length);
if (actual !== expected) throw new Error('ARCHITECTURE.md current-contract block drifted from core-contract.json.');

const currentFiles = [
  'ARCHITECTURE.md',
  'README.md',
  'README.zh-CN.md',
  'SECURITY.md',
  'docs/CONSUMER_GUIDE.md',
  'docs/CONSUMER_GUIDE.zh-CN.md',
  'docs/EFFICIENCY_CONTRACT.md',
  'docs/EFFICIENCY_CONTRACT.zh-CN.md',
  'docs/QUALITY_PLATFORM.md',
  'docs/QUALITY_PLATFORM.zh-CN.md'
];
const facts = [
  ['Review Receipt', contract.reviewReceiptVersion],
  ['Commit Receipt', contract.commitReceiptVersion],
  ['Diagnosis Receipt', contract.diagnosisReceiptVersion],
  ['Family Snapshot', contract.familySnapshotVersion],
  ['Family Manifest', contract.familyManifestVersion],
  ['Product Contract', contract.productContractVersion]
];
for (const relative of currentFiles) {
  const text = normalizeText(fs.readFileSync(path.join(root, relative), 'utf8'));
  for (const [label, version] of facts) {
    const pattern = new RegExp(`${label.replace(' ', '\\s+')}\\s+v(\\d+)`, 'gi');
    let match;
    while ((match = pattern.exec(text))) {
      if (Number(match[1]) !== Number(version)) throw new Error(`${relative} contains stale current fact ${label} v${match[1]}; expected v${version}.`);
    }
  }
}
console.log(`Current documentation verified against Core ${contract.coreVersion}.`);
