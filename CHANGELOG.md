# Changelog

## 4.10.0 - 2026-08-31

### Policy Schema v4 and Change Safe Family convergence

- Hard-switch the single committed `.codex-safe.json` repository policy from Schema v3 to **Policy Schema v4**.
- Add the closed, deterministic `change` section for Codex Change Safe delivery requirements; the retired `pr` prompt/narrative section remains rejected.
- Keep Safe Contract v2, Review/Commit Receipt v4, Diagnosis Contract/Receipt v1 and model runtime authority unchanged.
- Add Codex Change Safe as the fifth active exact-pin Core consumer and remove the `codex-pr` repository path from retired-product governance while keeping the historical `jiying2007.codex-pr-safe` identity retired.
- Extend Atomic Family Snapshot, Product Contract validation, ownership boundaries, golden replay, cross-platform consumer CI, Family Manifest and coordinated repin orchestration to all five consumers.
- Make coordinated repin synchronize Core version, Policy Schema, Safe Contract and runtime identity in Product Contracts, not only the gitlink SHA.
- Permanently forbid parallel `.codex-change-safe.json` policy surfaces; all repository policy parsing/validation/fingerprinting remains Core-owned.

## 4.9.6 - 2026-08-30

### Performance evidence provenance

- Attest each new immutable Performance Trend snapshot with GitHub build provenance before publishing its release.
- Make repeated runs for an existing Core evidence tag download and verify the canonical immutable asset instead of comparing a fresh sample against an immutable remote asset.
- Add bounded attestation-propagation verification matching the Family release evidence model.
- Keep Safe Contract, policy, receipt, provider, quality-platform and consumer product semantics unchanged.

## 4.9.5 - 2026-08-30

### Performance trend sampling reliability

- Replace single-run wall-clock/RSS trend evidence with seven isolated-process samples and median aggregation while keeping the existing broad absolute budgets.
- Fail closed if deterministic workload structure drifts across samples.
- Treat the first schema v3 snapshot as an explicit migration from legacy schema v2 single-sample evidence; relative 10% regression gating resumes median-to-median once both snapshots are v3.
- Keep all Safe Contract, policy, receipt, quality, provider and consumer product semantics unchanged.

## 4.9.4 - 2026-08-30

### Timestamp contract consistency

- Make Diagnosis Receipt v1 require the same canonical UTC ISO-8601 timestamp shape already enforced by Review/Commit receipts; timezone-less or offset-local receipt timestamps now fail closed.
- Allow deterministic Diagnose Markdown to show the exact receipt time explicitly as UTC without changing the stored receipt schema or diagnosis contract version.
- Add regression coverage for timezone-less timestamp rejection and UTC-labelled diagnosis output.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4, Diagnosis Contract/Receipt v1, Quality Platform v3 and all consumer product/runtime semantics unchanged.

## 4.9.3 - 2026-08-30

### Family release attestation reliability

- Keep Family Manifest publication fail-closed while tolerating GitHub release-attestation eventual consistency: after the digest-addressed Release reaches `immutable=true`, retry `gh release verify` in a bounded 12×5-second window before verifying the manifest asset digest.
- Preserve the exact atomic Family Snapshot, Manifest v3 generation, build-provenance attestation, immutable Release semantics and consumer validation matrix; no protocol or product behavior changes.
