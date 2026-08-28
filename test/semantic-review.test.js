'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const semantic = require('../semantic-review');

test('extractCallSymbols captures ordinary C/C++ call sites without control keywords', () => {
  const diff = [
    'diff --git a/app.c b/app.c',
    '--- a/app.c',
    '+++ b/app.c',
    '@@ -1,2 +1,5 @@',
    '+if (ready) VSAPISTRING_Trim(&pcFileName);',
    '+VSHDIOS_MemFree(pcFileName);',
    '+for (i = 0; i < n; ++i) consume(i);'
  ].join('\n');
  const symbols = semantic.extractCallSymbols(diff);
  assert.ok(symbols.includes('VSAPISTRING_Trim'));
  assert.ok(symbols.includes('VSHDIOS_MemFree'));
  assert.ok(symbols.includes('consume'));
  assert.ok(!symbols.includes('if'));
  assert.ok(!symbols.includes('for'));
});

test('evidence manifests and review keys are deterministic and snapshot-bound', () => {
  const entries = [
    { kind: 'symbol-definition', source: 'index', path: 'src/api.c', symbol: 'Trim', content: 'void Trim(char **p) {}', relatedPaths: ['app.c'] },
    { kind: 'staged', source: 'index', path: 'app.c', content: 'Trim(&p);', relatedPaths: ['app.c'] }
  ];
  const manifestA = semantic.buildEvidenceManifest(entries, { headOid: 'h', indexFingerprint: 'i', diffFingerprint: 'd' });
  const manifestB = semantic.buildEvidenceManifest([...entries].reverse(), { headOid: 'h', indexFingerprint: 'i', diffFingerprint: 'd' });
  assert.equal(manifestA.manifestDigest, manifestB.manifestDigest);
  const keyA = semantic.computeReviewKey({ subject: { headOid: 'h', indexFingerprint: 'i' }, diffFingerprint: 'd', policyFingerprint: 'p', profile: 'embedded', evidenceManifestDigest: manifestA.manifestDigest, analyzerDigest: 'a', promptContractVersion: 2, modelIdentity: 'm' });
  const keyB = semantic.computeReviewKey({ subject: { headOid: 'h', indexFingerprint: 'i2' }, diffFingerprint: 'd', policyFingerprint: 'p', profile: 'embedded', evidenceManifestDigest: manifestA.manifestDigest, analyzerDigest: 'a', promptContractVersion: 2, modelIdentity: 'm' });
  assert.notEqual(keyA, keyB);
});

test('stable finding identity survives title/wording changes when semantic anchor is stable', () => {
  const a = semantic.computeStableFindingId({ category: 'resource', file: 'app.c', line: 42, rootCauseSymbol: 'VSAPISTRING_Trim', anchorContextDigest: 'ctx', claimClass: 'invalid-free', description: 'first wording' });
  const b = semantic.computeStableFindingId({ category: 'resource', file: 'app.c', line: 99, rootCauseSymbol: 'VSAPISTRING_Trim', anchorContextDigest: 'ctx', claimClass: 'invalid-free', description: 'completely different wording' });
  assert.equal(a, b);
});

test('semantic assumptions require dependency evidence before publication', () => {
  const manifest = semantic.buildEvidenceManifest([{ kind: 'staged', source: 'index', path: 'app.c', content: 'VSAPISTRING_Trim(&p);', relatedPaths: ['app.c'] }]);
  const finding = semantic.validateEvidenceBackedFinding({
    category: 'resource', file: 'app.c', line: 10, claim: 'Trim may leave an interior pointer',
    requiredSymbols: ['VSAPISTRING_Trim'], assumptions: ['Trim only advances the pointer'], verificationStatus: 'verified',
    evidenceRefs: [manifest.entries[0].id], anchorContextDigest: 'ctx', claimClass: 'invalid-free'
  }, manifest);
  assert.equal(finding.evidenceGrade, 'C');
  assert.equal(finding.publishable, false);
});

test('resolved dependency evidence makes a semantic finding publishable and contradiction rejects it', () => {
  const manifest = semantic.buildEvidenceManifest([
    { kind: 'staged', source: 'index', path: 'app.c', content: 'Trim(&p);', relatedPaths: ['app.c'] },
    { kind: 'symbol-definition', source: 'index', path: 'api.c', symbol: 'Trim', content: 'void Trim(char **p) { *p = realloc(*p, 8); }', relatedPaths: ['app.c'] }
  ]);
  const ids = manifest.entries.map(x => x.id);
  const verified = semantic.validateEvidenceBackedFinding({ category: 'resource', file: 'app.c', line: 10, claim: 'some semantic issue', requiredSymbols: ['Trim'], verificationStatus: 'verified', evidenceRefs: ids, anchorContextDigest: 'ctx' }, manifest);
  assert.equal(verified.evidenceGrade, 'B');
  assert.equal(verified.publishable, true);
  const contradicted = semantic.validateEvidenceBackedFinding({ category: 'resource', file: 'app.c', line: 10, claim: 'invalid free', requiredSymbols: ['Trim'], verificationStatus: 'contradicted', evidenceRefs: ids, anchorContextDigest: 'ctx' }, manifest);
  assert.equal(contradicted.evidenceGrade, 'X');
  assert.equal(contradicted.publishable, false);
});

test('false-positive resolution is evidence-digest scoped and invalidates when evidence changes', () => {
  const make = body => semantic.buildEvidenceManifest([{ kind: 'symbol-definition', source: 'index', path: 'api.c', symbol: 'Trim', content: body, relatedPaths: ['app.c'] }]);
  const a = make('old implementation');
  const raw = { category: 'resource', file: 'app.c', line: 10, claim: 'invalid free', requiredSymbols: ['Trim'], verificationStatus: 'verified', evidenceRefs: [a.entries[0].id], rootCauseSymbol: 'Trim', anchorContextDigest: 'ctx', claimClass: 'invalid-free' };
  const initial = semantic.validateEvidenceBackedFinding(raw, a);
  const resolution = { stableFindingId: initial.stableFindingId, resolution: 'false_positive', evidenceDigest: initial.evidenceDigest, actor: 'user' };
  const suppressed = semantic.validateEvidenceBackedFinding(raw, a, [resolution]);
  assert.equal(suppressed.verificationStatus, 'suppressed_by_resolution');
  assert.equal(suppressed.publishable, false);
  const b = make('new implementation');
  const changed = semantic.validateEvidenceBackedFinding({ ...raw, evidenceRefs: [b.entries[0].id] }, b, [resolution]);
  assert.notEqual(changed.evidenceDigest, initial.evidenceDigest);
  assert.equal(changed.verificationStatus, 'verified');
});

test('repeated review stability uses stable finding sets rather than prose', () => {
  const findingA = { category: 'api', file: 'x.c', line: 1, rootCauseSymbol: 'foo', anchorContextDigest: 'ctx', severity: 'high', verificationStatus: 'verified', evidenceGrade: 'B', evidenceDigest: 'e' };
  const findingB = { ...findingA, title: 'different prose', description: 'different prose again' };
  const stable = semantic.compareFindingSets([{ findings: [findingA] }, { findings: [findingB] }]);
  assert.equal(stable.stable, true);
});

test('chunk evidence selection keeps only path-connected evidence under budget', () => {
  const entries = [
    { kind: 'dependency', path: 'api-a.c', contentDigest: 'a', bytes: 10, relatedPaths: ['a.c'] },
    { kind: 'dependency', path: 'api-b.c', contentDigest: 'b', bytes: 10, relatedPaths: ['b.c'] }
  ];
  const selected = semantic.selectEvidenceForPaths(entries, ['a.c'], { maxBytes: 100 });
  assert.equal(selected.entries.length, 1);
  assert.equal(selected.entries[0].path, 'api-a.c');
});
