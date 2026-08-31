# Quality Platform

Codex Safe Core 4.10.2 / Quality Platform v3 keeps the shared deterministic quality platform stable while Policy Schema v4 adds the `change` repository-policy section. Product-owned GitHub/GitLab provider behavior, VS Code UI, pipeline APIs, databases, analyzer acquisition and notifications remain outside Core.

## Review profiles and Profile Packs

`quick`, `standard`, `deep`, `security`, and `embedded` remain the execution profiles. Profile Pack v1 adds `general`, `backend`, `frontend`, `security`, `cpp`, `embedded-linux`, `embedded-mcu`, `driver`, `kernel`, and `realtime` engineering emphasis without granting tools, network or write authority.

## Impact Evidence and Test Impact

Core builds deterministic bounded Impact Evidence from controller-provided text and changed paths. `buildTestImpactMap()` ranks controller-provided test candidates; Core never discovers or executes tests itself. Budget pressure may reduce coverage only when that reduction remains explicit and fail closed.

## Analyzer contract

Core normalizes generic analyzer findings and SARIF 2.1 into a bounded deterministic contract. Analyzer text is untrusted evidence, never instructions. Repository policy cannot define executable analyzer commands.

## Diagnosis Contract / Receipt v1

Diagnosis primitives compact and redact failure logs, derive a conservative classification prior, validate structured model output and bind evidence into Diagnosis Receipt v1. Products own pipeline/job retrieval and publication. Diagnosis never retries CI, edits source, commits, pushes or merges.

Quality evaluation tracks classification accuracy, false positives, calibration and token cost against labeled Review/Diagnose corpora.

## Semantic review contracts

Review Evidence chunking preserves changed-hunk coverage or records an explicit gap. Review Profile Packs, Test Impact, analyzer normalization, Diagnosis and semantic review contracts remain pure deterministic Core primitives. Model output is never allowed to create authority.

## Safe patch boundary

Patch proposals are evidence only. Core **never applies, commits, pushes or merges** a proposal. Products may display bounded proposals but may not convert model text into implicit repository mutation.

## Family evidence

Atomic Family Snapshot v1 freezes one exact Core SHA and the five active consumer SHAs before cross-platform validation. Family Manifest v3 then records exact Core/consumer pins, Product Contract digests, Core Contract digest, runtime/protocol identity and the snapshot digest in `FAMILY_MANIFEST.json` before provenance attestation and immutable publication.

Change Safe participates as the fifth active Core consumer for deterministic policy/fingerprint primitives. Its SCM Provider and Delivery Authorization behavior remains product-owned; its `change` policy schema/validation is Core-owned through the same `.codex-safe.json` Policy Schema v4 used by Review, Commit and Review Service.
