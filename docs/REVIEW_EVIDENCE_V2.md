# Review Evidence V2 — Core 4.18.10

Independent implementation of bounded, source-anchored review evidence patterns derived from comparing Kodus Graph, PR-Agent, Sashiko, ReviewBench and AACR-Bench. No third-party code, extra runtime or model calls are imported.

## 1. Function-level lexical impact candidates

`buildFunctionImpactEvidence({diff,candidates,maxSymbols,maxEdges,maxBytes})` uses exact changed-line declarations from the canonical Diff plus explicit immutable-head text candidates to enumerate *candidate* call sites, with source path/line, optional enclosing function, candidate target identity, bounded byte budget and explicit reasons for missing/oversized/truncated source.

**Important:** this is a conservative lexical subset, **not a compiler-resolved or AST-proven call graph**. Return fields include `verifiedResolution:false`, `confidence`, `complete` and `reasons`. A missing changed declaration yields no guessed symbol; multi-target call ambiguity is not silently resolved.

## 2. Deterministic risk evidence

`buildReviewRiskEvidence({diff,maxSignals})` returns path-, side- and changed-line-scoped review hints for ISR blocking calls, unsafe C copies, OTA/Flash writes, insecure TLS flags, CI pull_request_target and world-writable changes. It hashes matched text instead of copying credentials or code snippets into telemetry. These are **hints**, not self-certified defects. Tests include clean/no-op negative controls.

## 3. Real Finding evidence verification

`verifyFindingEvidence({diff,findings,maxFindings})` checks each Finding's exact file, old/new side and changed-line interval against the actual immutable Diff. If an optional expected line text or digest is provided, it can detect direct evidence mismatch. Malformed, contradictory, overlapping or truncated unified Hunk line counts invalidate the *entire* Diff's anchor index; no partial row is verified. The parser still does not verify source SHA, which must be bound by the consumer.

Result states are `anchor_verified`, `insufficient_evidence`, `evidence_conflict`, always carrying `semanticDefectVerified:false` unless independently proven by an existing trusted semantic verifier. All high-risk findings survive; `automaticallyRemoved:0`. Missing line, context or unsupported range remains explicit instead of being silently corrected.

An anchor match is **not proof of semantic correctness**. Neither a positive regex nor a model claim authorizes a merge decision by itself. Provider source identity, completeness and immutable SHA remain the responsibility of the consumer.

## 4. Offline benchmark formats

`normalizeExternalReviewCorpus()` and `scripts/review-benchmark-import.js` accept two strictly source-bound formats:

- `reviewbench-golden`: ReviewBench `golden/*.json`; only entries explicitly adjudicated `tp_fp=tp` and `scope=introduced-by-pr` count as positives. Documented `fp` entries do not become expected positive defects, and a PR with no verified positives is **not assumed clean**.
- `aacr-review-instances`: AACR-Bench normalized `ReviewInstance` JSON/JSONL (`instance_id`, `repo`, `base_commit`, `head_commit`, `reference_comments`). Human/AI reference comments **are not accepted as defect ground truth** until an explicit human approval manifest maps an instance to bounded expected defects. Unknown or missing ground truth rejects the benchmark; `reference_comments` are retained only as provenance, not hallucinated labels.

Both require exact 40-character source revision, full base/head commit IDs and valid paths/line ranges. The adapter only converts already obtained, lawfully usable data and never clones external PRs, downloads models, calls APIs or runs Codex.

Example:

~~~bash
node scripts/review-benchmark-import.js --format reviewbench-golden \
 --source-revision <full-source-SHA> --input golden-records.json > corpus.json
node scripts/review-quality-compare.js --corpus corpus-cases.json \
 --baseline previous-run.json --candidate candidate-run.json
~~~

The importer emits `{corpus:{schemaVersion:3,cases:[...]},sourceDigest,...}`: for the quality scorer, use the nested `corpus` object and its `cases`. Do not claim fresh model execution, independent ground-truth verification, or measured Recall/Token gains from static fixtures.

## 5. Embedding-specific fixtures

`quality/embedded-review-structural-fixtures.json` holds eight synthetic structural examples covering ISR, OTA/Flash, C copies, CI, motor callers, clean controls and missing source. These test parser behavior and coverage reasons; they are **not** a real model-recall benchmark. Do not mix them into production `quality/baseline.json`.

## Security, cost and deployment

Only bounded deterministic code, no new agent roles, no default extra model calls, no project script execution, no persistent source cache, no new credentials or model quota. Users must validate review results against actual held-out PRs at the same model/provider/budget before promoting effectiveness claims. Official Core release/consumer exact-pins/production rollouts remain separate gates.
