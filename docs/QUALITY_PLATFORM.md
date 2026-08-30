# Quality Platform

Codex Safe Core 4.9.1 / Quality Platform v3 extends the shared, deterministic quality platform without moving product-owned GitLab, VS Code, pipeline API, database, analyzer acquisition, or notification concerns into Core.

## Review profiles

`quick`, `standard`, `deep`, `security`, and `embedded` remain the low-level execution profiles. They scale evidence/context/token budgets inside product caps and select impact-analysis depth. They are not repository instructions and cannot weaken Safe Contract, receipt validation, changed-line anchoring, or fail-closed coverage.

## Versioned Review Profile Packs

Profile Pack v1 adds data-driven engineering emphasis on top of the execution profiles. The canonical packs are `general`, `backend`, `frontend`, `security`, `cpp`, `embedded-linux`, `embedded-mcu`, `driver`, `kernel`, and `realtime`. Packs contain bounded focus categories and review checks only; they cannot grant tools, network access, write authority, or relax any safety contract. `quality/profile-packs.json` is the canonical versioned asset and `resolveReviewProfilePack()` is the shared resolver.

## Impact evidence graph

Core extracts bounded include/import, symbol, build, Kconfig and DeviceTree signals from the diff and scores controller-provided candidate files. Core never performs filesystem or network retrieval itself. Consumers acquire candidate evidence under their own trust boundary and pass immutable text into `buildImpactEvidenceGraph()`.

## Test Impact v1

`buildTestImpactMap()` ranks controller-provided test candidates from changed paths, semantic signals, explicit path mappings, and optional historical failure-correlation weights. The result is deterministic, digest-addressed and bounded. Products decide how to discover or execute tests; Core never starts a test command. `formatTestImpactEvidence()` produces bounded evidence that Review Service can add to model context or deterministic gating.

## Static analyzer contract

Core normalizes generic findings and SARIF 2.1 results into one analyzer-finding contract. Analyzer text is always untrusted evidence, never instructions. Repository policy cannot define executable analyzer commands. Products may ingest operator-controlled or CI-generated SARIF, JUnit, GitLab Code Quality, coverage, compiler, SBOM or scanner artifacts through product-owned adapters and normalize their finding-like results through Core.

## Diagnosis Contract and Receipt v1

Core 4.9.1 keeps Diagnosis Contract/Receipt v1 stable: bounded failure-log compaction, conservative deterministic classification, a closed structured output schema, normalized diagnosis results, evidence digests, and Diagnosis Receipt v1. Pipeline logs and artifact text are always untrusted evidence. Core never fetches a pipeline, retries a job, executes a command from a log, edits code, creates a merge request, or publishes a diagnosis.

## Quality evaluation

Quality Platform v3 has two labeled offline gates:

- Review: `quality/corpus.json` now contains at least 24 provenance-labeled regression cases across security, concurrency, resource, correctness and test findings, including at least three clean negatives and ten explicit synthetic mutations. `scripts/quality-eval.js` gates critical recall, recall, precision, false positives/review, duplicate/invalid-line rates and tokens per true positive.
- Diagnose: `quality/diagnosis-corpus.json` now contains at least 16 provenance-labeled cases covering source, test, dependency, infra, flaky, unknown and cascade failures, including multiple insufficient-evidence negatives and mutation-derived failures. `scripts/diagnosis-quality-eval.js` gates classification accuracy, root-cause Top-1 accuracy, affected-file recall, retry accuracy, evidence validity, confidence calibration and tokens per diagnosis.
- `scripts/verify-quality-corpus.js` prevents the checked corpus/results from shrinking, losing category/classification diversity, dropping negative cases, or silently losing provenance metadata.

Recorded result files are deterministic regression fixtures, not claims about production model quality. Products or scheduled evaluation infrastructure may supply fresh result files with `--results`; baseline changes must be reviewed with the corpus change that justified them.

## Live Codex canary

The scheduled `Codex CLI Canary` now fails closed when a protected live credential is missing. After the multi-platform CLI capability matrix, it executes both the Safe Contract filesystem/network escape canary and one bounded structured quality smoke covering security, concurrency, resource-lifetime and clean-negative cases. A pull request without protected secrets may skip only the live call; scheduled/manual runs may not. Compatibility history is published only after those live checks pass.

Compatibility history uses one release per `(Codex CLI version, Core version, Core SHA)` and creates the evidence asset atomically with the release. This preserves append-only history while remaining compatible with repository Release Immutability; an immutable release is never mutated with a later `gh release upload`.

This live smoke is a drift detector, not a statistical quality claim. Broad production quality still requires accumulated real/model evaluation samples and accepted-finding telemetry.

## Patch proposal safety

Core validates candidate unified patches before a product previews or applies them. Binary patches, out-of-evidence paths, NUL bytes and oversized patches are rejected. Core never applies, commits, pushes or merges a patch.

## Token calibration v1

`TokenEstimatorCalibration` starts from the conservative two UTF-8 bytes/token estimate. It learns a bounded provider+model EWMA only from actual input-token usage, activates after a minimum sample count, applies a safety discount, and clamps the learned ratio. A restart returns to the conservative default; calibration never weakens a configured token budget.

## Performance

Broad absolute budgets remain as catastrophic regression guards. Scheduled performance history additionally compares same-runner snapshots and rejects more than 10% latency or RSS regression.

## Atomic Family Snapshot v1 and Manifest v3

Family Compatibility first freezes one exact Core/consumer snapshot. Linux, Windows, macOS and the manifest job all checkout those exact SHAs; no job re-resolves moving `main` heads. Every active consumer must carry Product Contract v1 and pin a Core SHA that maps to a final immutable Core `vX.Y.Z` Release.

`FAMILY_MANIFEST.json` v3 records the snapshot digest, exact Core/consumer SHAs, every consumer Product Contract digest, Core contract digest, the complete integer `*Version` protocol map, a protocol fingerprint, runtime versions and package-lock digests under one manifest digest. Adding a new versioned Core protocol therefore changes the protocol fingerprint automatically rather than requiring a second hand-maintained list.

## Semantic review contracts

Core 4.5+ provides pure semantic review contracts: immutable Evidence Manifest digests, stable Review Keys, stable Finding IDs, evidence-scoped human resolutions, evidence-backed verification grades/statuses, chunk-scoped evidence selection, repeated-review stability, and C/C++ call-symbol extraction. Core never reads repositories or executes analyzers/models for these contracts; products acquire immutable evidence and pass bounded data into Core.
