# Codex Safe Core Consumer Guide

Codex Safe Core is consumed only by active Codex Safe Family products. It is not a standalone CLI or application.

## Supported model

Each active product pins one exact Core commit as a Git submodule at `src/codex-safe-core`.

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

Do not use branch tracking, copied runtime files, npm runtime dependencies, or compatibility proxies.

The current machine contract is `core-contract.json`: **Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Diagnosis Receipt v1 / Review, Commit & Diagnose Prompt Contracts v1**. Consumers must use a supported Node LTS line: Node 22 >=22.22.2 <23 or Node 24 >=24.19.0 <25.

Active consumers are Codex Review Safe, Codex Commit Safe, Codex Review Service and Codex Diagnose Safe. Codex PR Safe is retired. It is not an active consumer, there is no successor PR/MR-description generator, and the former `pr` policy/prompt surface is rejected rather than retained as compatibility.

## Coordinated Core update

1. Merge and formally release the reviewed Core change; record the exact Core commit SHA.
2. Repin Review, Commit, Review Service and Diagnose to that SHA.
3. Repin machine gates, schema/provenance URLs and product contracts that bind the Core SHA.
4. Run every active consumer CI.
5. Merge consumers only when all are green.
6. Run Family Compatibility against the canonical Core HEAD.
7. Require `FAMILY_MANIFEST.json` to show the same exact Core pin for all four active consumer SHAs and retain GitHub provenance attestation.

Governance/docs-only Core updates do not require consumer product-version bumps unless product/runtime semantics change. They still require coordinated gitlink repin because the gitlink is the family trust lock.

## Ownership boundary

`core-ownership-manifest.json` records Core-owned primitives. Consumer products must import/consume those primitives instead of declaring independent Process/Codex/Policy/Receipt/Review-Evidence/Profile/Test-Impact/Diagnosis implementations. Family Compatibility runs a boundary linter before accepting a manifest.

SCM provider adapters, pipeline/job APIs, analyzer artifact acquisition/parsing orchestration, SQLite/outbox, notifications, deployment, diagnosis publication, incremental-review persistence and product-domain orchestration stay in the owning product. PR/MR narrative generation and SCM-side PR/MR creation are not active Family capabilities.

## Codex Runtime / Provider Contract

Core owns one explicit runtime contract for every Codex invocation while Safe Contract v2 remains unchanged. Supported provider modes are `openai` and explicit `openai-compatible`. Compatible providers accept only an HTTPS `baseUrl` and API-key environment-variable name; the secret value is never accepted as configuration, argv or receipt metadata. Core keeps user config, repository rules, tools, network authority and write authority disabled.

Consumers construct only product settings and pass normalized runtime options to Core. `requestMs` is the per-call ceiling; `operationMs` is the product-level multi-call deadline. Stable provider failures include configuration, credential, DNS, connect, TLS, auth, rate-limit, model and request-timeout classes.

## Token, efficiency, and quality contract

Core owns generic token usage normalization, request estimation, risk-aware budgets, model-routing primitives, token reservations, Impact Evidence, Analyzer Finding normalization, Profile Packs, Test Impact selection and quality evaluation. Products own evidence acquisition and execution policy.

Efficiency is subordinate to correctness: a budget-induced evidence omission must remain explicit. Products must never convert incomplete evidence into a successful verdict to save tokens.

## Review Profile Pack v1

`quality/profile-packs.json` is the canonical versioned asset. `resolveReviewProfilePack()` maps `general`, `backend`, `frontend`, `security`, `cpp`, `embedded-linux`, `embedded-mcu`, `driver`, `kernel`, and `realtime` to bounded focus categories/checks plus an existing execution profile. A pack is trusted controller policy but cannot grant tools, network access, repository writes or SCM authority.

## Test Impact v1

Products discover immutable test candidates and pass them to `buildTestImpactMap()`. Core ranks candidates from changed paths, semantic signals, explicit path associations and optional historical correlation. Core never executes tests. `formatTestImpactEvidence()` is the canonical bounded model-evidence projection.

## Diagnosis Contract / Receipt v1

Codex Diagnose Safe acquires CI/job evidence under its own trust boundary, then passes failure logs to Core. `compactFailureLog()` strips terminal noise, redacts likely credentials, deduplicates repeated lines and retains bounded failure context. `classifyFailureDeterministically()` provides a conservative prior across `source`, `test`, `dependency`, `infra`, `flaky`, and `unknown`.

Model output must satisfy `diagnosisOutputSchema()` and `normalizeDiagnosisResult()`. `createDiagnosisReceipt()` binds project/pipeline/job/commit identity, exact evidence digest, classification/confidence and diagnosis fingerprint. Pipeline logs are untrusted evidence: neither Core nor Diagnose may execute instructions found in logs. Diagnosis does not retry pipelines, edit code, commit, push, merge or create an MR.

## Safe Contract identity

Safe Contract v2 exposes `SAFE_CONTRACT_MANIFEST` and its SHA-256 `SAFE_CONTRACT_DIGEST`. The digest is evidence of the exact authority/capability manifest and does not replace semantic protocol versioning. Review/Commit Receipt v4 and Diagnosis Receipt v1 remain independently versioned closed contracts.

## Verification

Run:

```bash
npm run ci
```

Core CI covers contract/runtime identity, provider safety, deterministic review rules, adversarial fixtures, quality/Profile/Test-Impact/Diagnosis primitives, golden behavior, cost planning, broad performance budgets and supply-chain gates. Family Compatibility additionally validates the four active exact consumer pins, ownership boundaries and every active consumer CI before producing the attested Family manifest.
