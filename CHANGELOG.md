# Changelog

## 4.9.1 - 2026-08-30

### Reliability and quality evidence

- Fix Codex CLI compatibility-history publication so each `(Codex CLI version, Core version, Core SHA)` creates one immutable evidence Release with its asset at creation time instead of trying to append to an already immutable fixed Release.
- Make scheduled/manual live Codex canaries fail closed when no protected canary credential is configured; pull requests without protected secrets still run the mandatory multi-platform capability checks without claiming the live behavior passed.
- Add one bounded live structured quality smoke for security, concurrency, resource-lifetime and clean-negative cases after the existing filesystem/network Safe Contract escape check; compatibility evidence is persisted only after both live checks pass.
- Expand the checked Review regression corpus from 12 to 24 provenance-labeled cases and the Diagnose corpus from 8 to 16 cases, including explicit synthetic mutations and clean/insufficient-evidence negatives.
- Add a deterministic corpus-contract verifier that prevents silent shrinkage, result/corpus ID drift, lost category/classification diversity, missing negative cases, or removal of provenance metadata.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4, Diagnosis Contract/Receipt v1, Quality Platform v3 and all product-owned GitLab/provider boundaries unchanged.

## 4.6.0 - 2026-08-28

### Codex runtime/provider platform

- Add one Core-owned Codex Runtime/Provider Contract for Commit, Review, PR and Review Service while preserving Safe Contract v2 and the mandatory `--ignore-user-config` / `--ignore-rules` isolation boundary.
- Add explicit `openai` and `openai-compatible` runtime modes. Compatible providers accept only an HTTPS `baseUrl` and API-key environment-variable name, inject a synthetic Responses provider, and force `supports_websockets=false` so gateways and relays use HTTP/SSE instead of the fragile Responses WebSocket path.
- Split per-request and whole-operation timeout semantics, add a live `probeCodexRuntime()` through the real structured execution path, classify provider configuration/credential/DNS/connect/TLS/auth/rate-limit/model/request-timeout failures, and preserve bounded process diagnostic tails with elapsed/last-activity timing.
- Make runtime provider normalization, credential-by-reference handling, provider argv injection, error classification and runtime diagnostics Core-owned so consumers cannot drift or re-enable user configuration as a compatibility shortcut.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4 and Prompt Contracts v1 unchanged.

## 4.5.0 - 2026-08-28

### Semantic review platform

- Add pure, product-agnostic semantic review contracts for immutable Evidence Manifests, stable Review Keys, stable Finding IDs, evidence-scoped human resolutions, evidence-backed finding verification, chunk-scoped evidence selection, and repeated-review stability.
- Add ordinary C/C++ call-symbol extraction so products can resolve declaration/definition evidence for unchanged dependencies without letting Core perform repository I/O.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4, and product Git/network boundaries unchanged.

All notable changes to Codex Safe Core are documented here.

## Unreleased

## 4.4.1 - 2026-08-27

### Changed

- Replace the repository-admin `immutable-releases` preflight with authoritative post-publication verification because the standard Actions `GITHUB_TOKEN` cannot read repository Administration settings.
- Verify every new Core and Family Manifest release reaches `immutable=true`, passes `gh release verify`, and matches each locally generated release asset through `gh release verify-asset`; publication remains fail-closed.
- Require an already-existing formal Core release to be both immutable and still tag-exact to the validated canonical `main` SHA before treating publication as complete.
- Keep Safe Contract v2, Policy Schema v3, Receipt v4, Prompt Contracts v1 and Quality Platform v1 unchanged; this is a supply-chain publication patch only.

## 4.4.0 - 2026-08-27

### Changed

- Add the shared Quality Platform: deterministic review profiles (`quick`, `standard`, `deep`, `security`, `embedded`), bounded semantic Impact Evidence Graphs, normalized generic/SARIF analyzer findings, quality/cost evaluation primitives, safe patch-proposal validation and relative performance comparison.
- Add a checked synthetic defect corpus and offline quality gate covering Critical Recall, Recall, Precision, false positives, duplicate/invalid-line rates and Token per true positive; Critical Recall is fail-closed at 100% and live/model result files can be supplied separately.
- Replace duplicated Family Baseline/BOM generation with one canonical `FAMILY_MANIFEST.json` carrying exact Core/consumer SHAs, protocol/runtime identities and package/product-contract digests under one manifest digest.
- Make Core ownership and non-goal governance reject consumer reimplementation of Quality Platform primitives, repository-defined analyzer execution commands, implicit Core network evidence retrieval and the return of duplicate Family manifest surfaces.
- Extend broad 4 MiB performance coverage to Impact/Token/Risk planning and add scheduled same-runner relative regression checks.
- Require release workflows to verify GitHub Immutable Releases are enabled and verify the published Release API reports `immutable=true`; digest addressing alone is no longer described as immutability.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4 and Prompt Contracts v1 unchanged; Core 4.4.0 adds shared quality/evidence/execution capabilities without a repository-policy compatibility layer.

## 4.3.0 - 2026-08-27

### Changed

- Add a shared cost-aware execution planner for the entire Codex Safe Family: normalized Codex token usage, conservative request preflight, deterministic evidence-risk scoring, adaptive cap-preserving budgets, optional low-risk model routing, risk-prioritized total-byte selection and concurrent token reservations.
- Make `runStructuredCodex()` return normalized usage, request estimates and duration, and optionally reject an over-budget request before Codex capability probing or process startup.
- Move generic Token/efficiency primitives into the Core ownership boundary so Commit, Review, PR and Review Service consume one implementation instead of drifting product-local copies.
- Lock the quality invariant that efficiency may reduce work only through explicit policy/budget decisions; evidence omitted by a budget must remain visible to the product and cannot silently become a successful coverage verdict.
- Add deterministic regression tests for usage parsing, preflight behavior, risk/model routing, adaptive budget caps, MR-wide byte selection and concurrent reservation overshoot.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4 and Prompt Contracts v1 unchanged; Core 4.3.0 is a shared execution-efficiency feature release, not a protocol compatibility layer.

## 4.2.0 - 2026-08-26

### Changed

- Promote Family Baseline into a versioned Family BOM with exact product versions, source SHAs, Core pins and protocol/runtime identity; publish provenance-attested baseline/BOM assets to permanent digest-addressed historical releases.
- Add a coordinated Family Upgrade orchestrator that opens exact-pin consumer PRs, waits for each product's own CI, squash-merges successful repins and triggers Family Compatibility; cross-repository writes require a dedicated `FAMILY_BOT_TOKEN` and fail closed when it is absent.
- Add machine-enforced family non-goals so Core cannot absorb provider/database/notification domains, consumers cannot branch-track Core, and removed legacy policy files cannot return.
- Add a shared machine-readable error taxonomy and metadata-only family diagnostics envelope without exposing source, prompts, credentials or repository content.
- Enforce exact commit-SHA pinning for every external GitHub Action and add a reusable Family Release Guard that verifies exact Core pin, governance and diagnostics identity for consumer releases.
- Add Dependency Review with a fail-closed npm audit/license-policy fallback for repositories where GitHub Dependency Graph is not enabled.
- Add append-only Codex CLI compatibility history tied to Safe Contract digest and Core identity; live filesystem/network behavior validation still requires protected `OPENAI_API_KEY` credentials and is never reported as passed when not executed.
- Add broad performance trend snapshots while retaining non-fragile evidence/context regression budgets.
- Add a release artifact verifier for SHA-256, Family baseline shape and GitHub provenance attestations.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4 and Prompt Contracts v1 unchanged; Core 4.2.0 is a governance/product-family feature release, not a protocol compatibility layer.

## 4.1.0 - 2026-08-25

### Changed

- Add `core-contract.json` as the machine-readable source of current Core/protocol/runtime identity and derive Safe Contract constants from it.
- Add a canonical `SAFE_CONTRACT_MANIFEST` and SHA-256 `SAFE_CONTRACT_DIGEST` without changing Receipt v4 schemas or Safe Contract v2 semantics.
- Explicitly support only Node 22 LTS >=22.22.2 and Node 24 LTS >=24.19.0, with Linux/Windows/macOS CI on both exact floors.
- Correct Security Policy drift from stale Core/Receipt v3 facts to the v4 protocol line and permanently verify documentation against the Core contract.
- Add an adversarial prompt-injection corpus and deterministic tests proving untrusted repository/model text cannot alter Safe Contract argv or enable authority-bearing capabilities.
- Extend the latest-Codex canary with Safe Contract digest reporting and an optional credential-backed live filesystem/network negative-behavior probe.
- Add `core-ownership-manifest.json` plus a Family consumer boundary linter to detect independent reimplementation of Core-owned primitives.
- Add coordinated `FAMILY_BASELINE.json` generation containing exact Core/consumer SHAs, protocol/runtime facts and a baseline digest, with GitHub provenance attestation after all consumer CIs pass.
- Add release package reproducibility verification and keep release write/id-token permissions isolated to the final publication job.
- Preserve provider, SQLite/outbox, notification and product-domain concerns outside Core; no compatibility shim or provider abstraction is introduced.

## 4.0.1

### Changed

- Harden release recovery so an unchanged version is skipped only when its immutable tag already exists; failed pre-tag releases can be retried safely.
- Update `actions/attest-build-provenance` to the SHA-pinned v4.2.2 release.
- Add a regression test that locks release recovery and provenance-action pinning semantics.

## 4.0.0

### Changed

- Hard-switched Review Receipt and Commit Receipt to closed schema v4; schema v3 receipts are intentionally rejected.
- Added canonical Receipt provenance for Safe Core, Safe Contract, Policy Schema, Prompt Contract, requested/resolved model identity and Codex CLI version.
- Added independent Review, Commit and PR Prompt Contract version identities without changing Safe Contract v2 or Policy Schema v3.
- Added a recurring cross-repository Family Compatibility matrix across Linux, Windows and macOS.
- Added a daily latest-Codex CLI capability canary across Linux, Windows and macOS.
- Added a SHA-pinned OpenSSF Scorecard workflow.
- Hardened releases to immutable assets with SHA-256 checksums, deterministic SPDX 2.3 SBOM and GitHub build-provenance attestation.
- Documented deterministic versus model-nondeterministic boundaries as a permanent family architecture rule.

## 3.0.1

### Changed

- Added the canonical deterministic Review rule evaluator used by Review Safe and Review Service.
- Centralized path-prefix normalization and the `requireTestsForCodeChanges` / forbidden-path semantics so consumers cannot drift while mapping violations to their own UI or provider finding models.

## 3.0.0

### Changed

- Raised the implementation line to Safe Core v3 while keeping Safe Contract v2 unchanged.
- Replaced Policy Schema v2 with closed Policy Schema v3; v2 documents are intentionally rejected.
- Added shared Review deterministic rules under `.codex-safe.json.review.rules` and a separate `reviewService` section for server-only context/coverage controls.
- Replaced Review Receipt v2 with Review Receipt v3 using an explicit subject envelope for local Git-index review and GitLab MR review.
- Raised Commit Receipt to schema v3 so Commit provenance can bind Review Receipt v3 without compatibility shims.
- Added coverage-preserving Review Evidence Chunking: changed hunks are either included in bounded review chunks or reported as explicit coverage gaps; review input is never silently middle-truncated.
- Kept Semantic Context budgeting as the narrative-oriented Commit/PR path, separate from review evidence coverage semantics.
- Continued fail-closed Codex capability negotiation, read-only execution and immutable public runtime boundaries.

## 2.1.0

### Changed

- Added shared policy-schema provenance and canonical policy fingerprinting primitives.
- Added shared safe-contract capability probing, strict CLI invocation, process cancellation/timeout bounds and cross-platform process-tree termination.
- Added shared Git evidence primitives and semantic-context budgeting used across the product family.

## 2.0.0

### Changed

- Established Safe Contract v2 and Policy Schema v2 as the first coordinated family protocol line.
- Removed legacy Codex CLI argument fallbacks and fail open behavior.

## 1.0.0

- Initial shared runtime extraction for the Codex Safe product family.
