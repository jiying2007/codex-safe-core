# Codex Safe Core Consumer Guide

Codex Safe Core is consumed only by active Codex Safe Family products. It is not a standalone CLI or application.

## Supported model

Each active product pins one exact Core commit as a Git submodule at `src/codex-safe-core`.

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

Do not use branch tracking, copied runtime files, npm runtime dependencies, or compatibility proxies.

The current machine contract is `core-contract.json`: **Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2 / Review, Commit & Diagnose Prompt Contracts v1 / Codex Runtime v3 / Provider Contract v3**. Consumers use Node 22 >=22.22.2 <23 or Node 24 >=24.19.0 <25.

Active consumers are **Codex Change Safe, Codex Review Safe, Codex Commit Safe, Codex Review Service and Codex Diagnose Safe**. Codex PR Safe is retired as the former model-generated PR-description identity; Change Safe is a distinct deterministic delivery product and does not restore that narrative generator.

## Repository Policy Schema v4

The single repository policy is committed `.codex-safe.json` with `schemaVersion: 4`. Core owns parsing, closed-key/type validation and policy fingerprinting.

The supported sections are:

- `review` — Review Safe;
- `commit` — Commit Safe;
- `change` — Change Safe deterministic delivery requirements;
- `reviewService` — Review Service.

The former `pr` section remains rejected. `change` is not a compatibility alias: it contains no model prompt/narrative configuration. Diagnose remains outside repository policy because CI diagnosis uses a different execution surface.

Consumers must call Core policy APIs rather than defining another JSON schema/parser. Product code may interpret its validated rules, but it cannot redefine field types or accept older schemas.

## Coordinated Core update

1. Merge and formally release the reviewed Core change; record the exact Core commit SHA.
2. Repin Change, Review, Commit, Review Service and Diagnose to that SHA.
3. Repin machine gates, schema/provenance URLs and Product Contracts that bind the Core SHA and Policy Schema version.
4. Run every active consumer CI, including Change Safe Provider and Extension Host gates.
5. Merge consumers only when all are green.
6. Run Family Compatibility against canonical Core HEAD.
7. Require `FAMILY_MANIFEST.json` to show the same exact Core pin for all five active consumer SHAs and retain GitHub provenance attestation.

The gitlink is the Family Trust Root lock even for governance-only Core changes.

## Ownership boundary

`core-ownership-manifest.json` records Core-owned primitives. Consumer products must import/consume those primitives instead of declaring independent Process/Codex/Policy/Receipt/Review-Evidence/Profile/Test-Impact/Diagnosis implementations. Family Compatibility runs a boundary linter before accepting a manifest.

SCM provider adapters, pipeline/job APIs, analyzer artifact acquisition/parsing orchestration, SQLite/outbox, notifications, deployment, diagnosis publication, incremental-review persistence and product-domain orchestration stay in the owning product.

Model-generated PR/MR narrative remains a Family non-goal. SCM-side PR/MR delivery authorization is owned by Codex Change Safe and remains outside Core runtime ownership; only its repository policy schema/validation is Core-owned.

## Codex Runtime / Provider Contract v3

Core owns one explicit runtime contract for every Codex invocation while Safe Contract v2 remains unchanged. Supported provider modes are `openai` and explicit `openai-compatible`.

Compatible providers support `credentialSource=auto|env|auth-json`. `auto` first uses the configured API-key environment variable and, if it is absent, reads `${CODEX_HOME}/auth.json` or `~/.codex/auth.json`. Only API-key authentication is accepted from that file: `auth_mode=apikey` with a non-empty `OPENAI_API_KEY`. ChatGPT/session tokens are not reused as relay credentials. The secret value is injected only into the child Codex environment and never appears in argv, product settings, receipts or diagnostics.

HTTPS remains the default. Loopback HTTP is allowed for local development. Non-loopback HTTP is supported only when the product/machine runtime explicitly sets `allowInsecureHttp=true`; repository policy cannot enable it. URL credentials, query parameters and fragments remain rejected. Compatible providers continue to require Responses HTTP/SSE and structured output, with WebSockets disabled.

Change Safe has zero model calls by default; it consumes deterministic Core primitives without acquiring Codex runtime authority.

## Token, efficiency, and quality contract

Core owns generic token usage normalization, request estimation, risk-aware budgets, model-routing primitives, token reservations, Impact Evidence, Analyzer Finding normalization, Profile Packs, Test Impact selection and quality evaluation. Products own evidence acquisition and execution policy.

Efficiency is subordinate to correctness: a budget-induced evidence omission must remain explicit. Products must never convert incomplete evidence into a successful verdict to save tokens.

## Diagnosis Contract / Receipt v2

Codex Diagnose Safe acquires CI/job evidence under its own trust boundary, then passes failure logs to Core. Model output must satisfy the Core diagnosis schema/normalization before Diagnosis Receipt v2 is created. Pipeline logs are untrusted evidence; neither Core nor Diagnose executes instructions found in logs.

## Safe Contract identity

Safe Contract v2 exposes `SAFE_CONTRACT_MANIFEST` and its SHA-256 `SAFE_CONTRACT_DIGEST`. The digest is evidence of the exact authority/capability manifest and does not replace semantic protocol versioning. Review Receipt v5, Commit Receipt v4 and Diagnosis Receipt v2 remain independently versioned closed contracts.

## Verification

Run:

```bash
npm run ci
```

Core CI covers contract/runtime identity, Policy Schema v4, Provider Contract v3 credential/transport safety, deterministic review rules, adversarial fixtures, quality/Profile/Test-Impact/Diagnosis primitives, golden behavior, cost planning, broad performance budgets and supply-chain gates. Family Compatibility additionally validates the five active exact consumer pins, ownership boundaries and every active consumer CI before producing the attested Family manifest.


Runtime Contract v3 lets every consumer share machine-scoped `~/.codex-safe/runtime.json`, so Review, Commit, Diagnose and Review Service do not need the same relay endpoint configured repeatedly. The profile stores no secret; API keys remain environment/auth.json references.
