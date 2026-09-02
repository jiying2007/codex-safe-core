# Changelog

## 4.12.5 - 2026-09-02

- Add a Family-wide user-visible time formatter: displays follow the runtime local time zone or `CODEX_SAFE_DISPLAY_TIME_ZONE`, while receipts, evidence, persisted audit timestamps, fingerprints and digests remain canonical UTC. Diagnose Markdown now uses localized display time.

## 4.12.4 - 2026-09-02

### Review Service current-document repin paths

- Fix the coordinated repin current-state allowlist to use Review Service's real root `OPERATIONS.md` path instead of the nonexistent `docs/OPERATIONS.md` shadow path.
- Add `docs/DEPLOYMENT.zh-CN.md` so English and Chinese production deployment guides remain bound to the same exact released Core SHA.
- Add regression coverage that requires both real Service paths and explicitly rejects the nonexistent operations shadow path.
- Keep the 4.12.3 Change inline-version synchronization, 4.12.2 bounded Trusted Release attestation retry, all runtime/protocol contracts and all consumer product versions unchanged.

## 4.12.3 - 2026-09-02

### Change verifier repin completeness

- Extend `repin-consumer.js` to synchronize inline `contract.safeCoreVersion` equality/inequality assertions in addition to named Core version constants.
- Add a regression sample matching the current one-line Codex Change Safe verifier shape so a coordinated governance-only Core repin cannot update the SHA while leaving the version assertion stale.
- Keep the 4.12.2 identity-complete documentation/test synchronization and bounded Trusted Release attestation retry unchanged.
- Keep Safe Contract v2, Policy Schema v4, Runtime/Provider Contract v2, Review Receipt v5, Commit Receipt v4, Diagnosis Receipt v2, Quality Platform v3, Family Manifest v3 and all consumer runtime/product semantics unchanged.

## 4.12.2 - 2026-09-02

### Coordinated repin and release reliability

- Make `repin-consumer.js` identity-complete for all five active consumer shapes: synchronize exact Core gitlinks and Product Contracts together with current Change verifier constants, current Diagnose contract assertions, Family Release Guard pins, schema provenance and a bounded allowlist of current product/operations documentation.
- Preserve historical release facts by excluding CHANGELOG/MIGRATION history from maintenance identity replacement; governance-only repins still do not force consumer product-version churn.
- Add regression coverage for the current Change, Commit/Review documentation, Review Service operations and Diagnose contract-test failure modes exposed by the 4.12.1 coordinated repin attempt.
- Make Trusted Core Release tolerate GitHub attestation eventual consistency with bounded 12×5-second verification of both the immutable Release and every published asset; verification still fails closed if propagation never completes.
- Keep Safe Contract v2, Policy Schema v4, Runtime/Provider Contract v2, Review Receipt v5, Commit Receipt v4, Diagnosis Receipt v2, Quality Platform v3, Family Manifest v3 and all consumer runtime/product semantics unchanged.

## 4.12.1 - 2026-09-02

### Release-aware Family freshness

- Add one lightweight Core-owned `Family Freshness` watcher. Core `main` must be the exact target of the current immutable final Core Release before any Family refresh can be considered.
- Preserve governance-only consumer repins without product-version churn: each active consumer is checked at `main` for matching package/Product Contract identity plus an exact `safeCoreVersion`, `safeCoreCommit` and `src/codex-safe-core` gitlink to the released Core; consumer product Release tags are not repurposed as governance readiness markers.
- Compare those fully aligned active consumer heads with the newest immutable Family Manifest for the released Core and dispatch the full `Family Compatibility` workflow only when that snapshot is missing or stale. A queued/running Family validation suppresses duplicate dispatch.
- Route the coordinated Family Upgrade completion path through the same freshness decision point instead of directly launching Family Compatibility, leaving one canonical trigger policy for automated maintenance.
- Keep the watcher credential-minimal and CI-lightweight: it uses only the current Core repository `GITHUB_TOKEN`, does not distribute cross-repository PATs, does not checkout consumers, does not run product CI itself and never invokes a model.
- Preserve the existing Atomic Family Snapshot v1, three-platform consumer matrix, Family Manifest v3, provenance attestation and digest-addressed immutable Family Release as the only authoritative validation path.
- Keep Safe Contract v2, Policy Schema v4, Runtime/Provider Contract v2, Review Receipt v5, Commit Receipt v4, Diagnosis Receipt v2 and all consumer product behavior unchanged; this patch changes Family release orchestration only.

## 4.12.0 - 2026-09-01

### Runtime / Provider Contract v2

- Add one Core-owned compatible-provider credential resolver for the whole Codex Safe Family. `credentialSource=auto` prefers the configured environment variable and otherwise reads `${CODEX_HOME}/auth.json` or `~/.codex/auth.json`; explicit `env` and `auth-json` modes are also supported.
- Accept only API-key authentication from Codex `auth.json`: `auth_mode=apikey` with non-empty `OPENAI_API_KEY`. ChatGPT/session credentials are never repurposed as relay API keys.
- Inject resolved relay secrets only into the child Codex process environment. Secret values remain absent from argv, product settings, receipts, provider metadata and bounded diagnostics.
- Keep HTTPS as the default compatible-provider transport while allowing non-loopback HTTP only through explicit product/machine runtime opt-in `allowInsecureHttp=true`; loopback HTTP remains available for development and repository policy cannot enable insecure transport.
- Keep URL credentials/query/fragment rejection, Responses HTTP/SSE, Structured Output and `supports_websockets=false` unchanged for compatible providers.
- Promote `codexRuntimeVersion` and `providerContractVersion` to v2, add cross-platform regression coverage for `auth.json`, `CODEX_HOME`, environment precedence and LAN HTTP opt-in, and hard-cut current product docs to Review Receipt v5 / Diagnosis Receipt v2.
- Keep Safe Contract v2, Policy Schema v4, Judgment Lifecycle v1, Review Receipt v5, Commit Receipt v4, Diagnosis Contract v1 / Receipt v2, Quality Platform v3 and Family Manifest v3 semantics unchanged.

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
- Add a workflow regression test that requires bounded release-attestation propagation retry and prevents replacing verification with a skip or fail-open path.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4, Diagnosis Contract/Receipt v1, Quality Platform v3 and all consumer product/runtime semantics unchanged.

## 4.9.2 - 2026-08-30

### Performance evidence reliability

- Replace the future fixed `codex-safe-performance-history` append model with one immutable performance-evidence Release per exact `(Core version, Core SHA)`.
- Compare a new broad performance snapshot against the newest previous immutable performance Release before publication, while treating a rerun for the same Core SHA as idempotent evidence verification.
- Create the snapshot asset atomically with the Release, wait for `immutable=true`, and verify both the Release and asset instead of using `gh release upload` against a fixed historical Release.
- Add a supply-chain regression test that prevents mutable fixed performance-history publication from returning.
- Keep Safe Contract v2, Policy Schema v3, Review/Commit Receipt v4, Diagnosis Contract/Receipt v1, Quality Platform v3 and all consumer product/runtime semantics unchanged.

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
