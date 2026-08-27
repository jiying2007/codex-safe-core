# Quality Platform

Codex Safe Core 4.4 adds shared, deterministic quality primitives without moving product-owned GitLab, VS Code, database or notification concerns into Core.

## Review profiles

`quick`, `standard`, `deep`, `security`, and `embedded` are execution profiles. They scale evidence/context/token budgets inside product caps and select impact-analysis depth. They are not repository instructions and cannot weaken Safe Contract, receipt validation, changed-line anchoring, or fail-closed coverage.

## Impact evidence graph

Core extracts bounded include/import, symbol, build, Kconfig and DeviceTree signals from the diff and scores controller-provided candidate files. Core never performs filesystem or network retrieval itself. Consumers acquire candidate evidence under their own trust boundary and pass immutable text into `buildImpactEvidenceGraph()`.

## Static analyzer contract

Core normalizes generic findings and SARIF 2.1 results into one analyzer-finding contract. Analyzer text is always untrusted evidence, never instructions. Repository policy cannot define executable analyzer commands. Products may ingest operator-controlled or CI-generated SARIF and combine it with deterministic rules and Codex reasoning.

## Quality evaluation

`quality/corpus.json` defines critical/high/medium synthetic defect expectations. `scripts/quality-eval.js` computes critical recall, recall, precision, false positives per review, duplicate/invalid-line rates and tokens per true positive. CI fails closed if critical recall drops below 100% or cost/quality regresses beyond the checked baseline. The recorded corpus is a deterministic offline gate; products may supply fresh result files with `--results` for live/model evaluations.

## Patch proposal safety

Core validates candidate unified patches before a product previews or applies them. Binary patches, out-of-evidence paths, NUL bytes and oversized patches are rejected. Core never applies, commits, pushes or merges a patch.

## Performance

Broad absolute budgets remain as catastrophic regression guards. Scheduled performance history additionally compares same-runner snapshots and rejects more than 10% latency or RSS regression.

## Family manifest

The duplicated `FAMILY_BASELINE.json` / `FAMILY_BOM.json` pair is replaced by one `FAMILY_MANIFEST.json`. It records exact Core and consumer SHAs, protocol versions, runtime versions, package-lock digests and product-contract digests under one canonical manifest digest.
