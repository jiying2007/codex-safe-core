# Codex Safe Core Consumer Guide

Codex Safe Core is consumed only by active Codex Safe Family products. It is not a standalone CLI or application.

## Supported consumption model

Each active product pins one exact formally released Core commit as a Git submodule at `src/codex-safe-core`.

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

Do not use branch tracking, copied runtime files, npm runtime dependencies, or compatibility proxies.

The current machine contract is `core-contract.json`: **Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2 / Runtime v3 / Provider Contract v3 / Model Routing v1 / Family Snapshot v3 / Family Manifest v5 / Product Contract v2 / Consumer CI Receipt v1**. Consumers use Node 22 >=22.22.2 <23 or Node 24 >=24.19.0 <25.

Active consumers are **Codex Change Safe, Codex Review Safe, Codex Commit Safe, Codex Review Service and Codex Diagnose Safe**. Codex PR Safe is retired as the former model-generated PR-description identity; Change Safe is a distinct deterministic delivery product and does not restore that narrative generator.

## Repository Policy Schema v4

The single repository policy is committed `.codex-safe.json` with `schemaVersion: 4`. Core owns parsing, closed-key/type validation and policy fingerprinting. Supported sections are `review`, `commit`, `change` and `reviewService`; the former `pr` section remains rejected. Diagnose remains outside repository policy because CI diagnosis uses a different execution surface.

Consumers must call Core policy APIs rather than defining another JSON schema/parser. Product code may interpret validated rules, but it cannot redefine field types or accept older schemas.

## Runtime and governance identity

Core Digest Contract v1 publishes two cryptographic identities for every immutable Core release:

- `runtimeDigest` covers the runtime modules, policy schema and runtime-relevant contract fields shipped to consumers;
- `governanceDigest` covers workflows, tests, quality corpora, documentation and release/orchestration identity.

Every consumer still pins one exact released Core SHA. A consumer may remain on an older released Core only when its `runtimeDigest` is exactly equal to the newest released Core runtime digest. That is cryptographic runtime identity, not a compatibility shim. A different runtime digest requires a product repin and patch release.

Product Contract v2 binds `safeCoreCommit`, `safeCoreRuntimeDigest` and `safeCoreGovernanceDigest` to the exact consumer product version. A governance-only Core release therefore does not force byte-identical VSIX/OCI/tgz artifacts to be rebuilt or redistributed.

## Coordinated Core update

1. Merge and formally release the reviewed Core change; verify the exact SHA and `CORE_DIGESTS.json`.
2. Compare the released `runtimeDigest` with each consumer's pinned released Core.
3. Prepare repin PRs only for consumers whose runtime digest changed; runtime-equivalent consumers are recorded as skipped.
4. Wait for every prepared PR to pass its complete product CI before any merge.
5. Freeze all prepared PR head SHAs, then merge only that validated set.
6. Each changed consumer publishes an exact immutable product release, its current-stage required distribution evidence and `CONSUMER_CI_RECEIPT.json`.
7. Family Freshness verifies runtime compatibility, release/required-distribution and CI receipts, then dispatches Family Compatibility when the immutable Family Manifest is stale.

The two-phase transaction prevents a partially merged rollout from being treated as complete. The exact consumer Core gitlink remains an auditable lock; governance-only Core updates simply do not require moving it when runtime identity is unchanged.

## Consumer CI Receipt v1

Every active consumer release carries an attested `CONSUMER_CI_RECEIPT.json`. It binds product ID/version/SHA, exact pinned Core SHA/digests, successful CI run ID/attempt and the validated suite identity. Family readiness verifies that immutable receipt instead of relying on an ephemeral green check.

The receipt does not grant authority and does not replace the CI run. It is durable evidence that the released product SHA passed the declared gate.

## Family evidence

Atomic Family Snapshot v3 freezes the newest exact immutable Core release and both Core digests, plus each exact consumer product release, its actual pinned Core SHA/digests, Consumer CI Receipt and required distribution evidence.

At the current product stage, Review Safe, Commit Safe and Change Safe use the exact immutable GitHub Release containing the VSIX as their required distribution boundary. VS Code Marketplace publication is optional/manual and is not required for Family readiness. Review Service still requires its published GHCR digest; Diagnose uses its immutable GitHub Release.

Family Manifest v5 records that snapshot, Product Contract/package-lock digests, protocol/runtime identity and distribution evidence, then receives GitHub build-provenance attestation and digest-addressed immutable publication.

Routine Family Compatibility consumes immutable consumer CI receipts and runs one Ubuntu cross-family validation. The full five-consumer × Linux/Windows/macOS matrix remains a weekly/manual `full_matrix=true` audit. This removes repeated product CI work without weakening the product release gate.

## Ownership boundary

`core-ownership-manifest.json` records Core-owned primitives. Consumer products must import/consume those primitives instead of declaring independent Process/Codex/Policy/Receipt/Review-Evidence/Profile/Test-Impact/Diagnosis/model-routing implementations. Family Compatibility runs a boundary linter before accepting a manifest.

SCM provider adapters, pipeline/job APIs, analyzer artifact acquisition/parsing orchestration, SQLite/outbox, notifications, deployment, diagnosis publication, incremental-review persistence and product-domain orchestration stay in the owning product.

Model-generated PR/MR narrative remains a Family non-goal. SCM-side PR/MR delivery authorization is owned by Codex Change Safe and remains outside Core runtime ownership; only its repository policy schema/validation is Core-owned.

## Codex Runtime / Provider Contract v3

Core owns one runtime contract for every Codex invocation while Safe Contract v2 remains unchanged. Compatible providers support machine-owned `credentialSource=auto|env|auth-json`. Secrets are injected only into the child Codex environment and never appear in argv, product settings, receipts or diagnostics.

Consumers default to machine runtime resolution: explicit product override → Family Runtime → user Codex config → built-in OpenAI. Repository-local Codex config is not inherited for provider routing. HTTPS is preferred; private-network plaintext inheritance remains explicit, machine-owned and visible. Change Safe has zero model calls by default.

## Model Routing, token and quality contract

Core owns Model Routing Contract v1, machine Registry validation, canonical `registryDigest` / `routingPolicyDigest`, token usage normalization, request estimation, risk-aware budgets, calibration, reservations, Profile Packs, Test Impact and quality/economics evaluation.

Efficiency is subordinate to correctness. Budget-induced evidence omissions remain explicit. Model promotion requires real corpus results and minimum sample counts; the historical recorded baseline is not interpreted as universal 100% quality.

## Diagnosis Contract / Receipt v2

Codex Diagnose Safe acquires CI/job evidence under its own trust boundary, then passes failure logs to Core. Model output must satisfy the Core diagnosis schema/normalization before Diagnosis Receipt v2 is created. Pipeline logs are untrusted evidence; neither Core nor Diagnose executes instructions found in logs.

## Repository governance

`repository-governance-contract.json` defines the required server-side Ruleset baseline for all six Family repositories. Repository tests cannot substitute for the GitHub-side control. Run `npm run check:repository-governance` or the scheduled Repository Governance workflow after an administrator installs the Rulesets.

## Verification

Run:

```bash
npm run ci
```

Core CI covers contract/runtime identity, Policy Schema v4, Provider Contract v3 credential/transport safety, deterministic review rules, adversarial fixtures, Promotion Corpus structure, quality/Profile/Test-Impact/Diagnosis primitives, model routing/economics, digest classification, broad performance budgets and supply-chain gates.

Runtime Contract v3 lets Review, Commit, Diagnose and Review Service share machine-scoped `~/.codex-safe/runtime.json`; the profile stores no secret, and API keys remain environment/auth.json references.
