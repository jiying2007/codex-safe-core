# Quality Platform

Codex Safe Core 4.8 extends the shared, deterministic quality platform without moving product-owned GitLab, VS Code, pipeline API, database, analyzer acquisition, or notification concerns into Core.

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

Core 4.8 adds pure diagnosis primitives for the `codex-diagnose` product: bounded failure-log compaction, conservative deterministic classification, a closed structured output schema, normalized diagnosis results, evidence digests, and Diagnosis Receipt v1. Pipeline logs and artifact text are always untrusted evidence. Core never fetches a pipeline, retries a job, executes a command from a log, edits code, creates a merge request, or publishes a diagnosis.

## Quality evaluation

`quality/corpus.json` defines critical/high/medium synthetic defect expectations. `scripts/quality-eval.js` computes critical recall, recall, precision, false positives per review, duplicate/invalid-line rates and tokens per true positive. CI fails closed if critical recall drops below 100% or cost/quality regresses beyond the checked baseline. The recorded corpus is a deterministic offline gate; products may supply fresh result files with `--results` for live/model evaluations.

## Patch proposal safety

Core validates candidate unified patches before a product previews or applies them. Binary patches, out-of-evidence paths, NUL bytes and oversized patches are rejected. Core never applies, commits, pushes or merges a patch.

## Performance

Broad absolute budgets remain as catastrophic regression guards. Scheduled performance history additionally compares same-runner snapshots and rejects more than 10% latency or RSS regression.

## Family manifest

The canonical `FAMILY_MANIFEST.json` records exact Core plus `codex-commit`, `codex-review`, `codex-review-service`, and `codex-diagnose` SHAs, protocol versions, runtime versions, package-lock digests and product-contract digests under one manifest digest.

## Semantic review contracts

Core 4.5+ provides pure semantic review contracts: immutable Evidence Manifest digests, stable Review Keys, stable Finding IDs, evidence-scoped human resolutions, evidence-backed verification grades/statuses, chunk-scoped evidence selection, repeated-review stability, and C/C++ call-symbol extraction. Core never reads repositories or executes analyzers/models for these contracts; products acquire immutable evidence and pass bounded data into Core.
