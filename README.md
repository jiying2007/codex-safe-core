# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core is the **single canonical safety/runtime and protocol core** for the Codex Safe Family. It is an internal family component, **not a standalone end-user application**.

| Product | User-facing role |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | Review staged changes in VS Code |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | Generate validated Conventional Commit messages |
| [Codex Change Safe](https://github.com/jiying2007/codex-pr) | GitHub/GitLab delivery authorization and merge readiness |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | Server-side GitLab MR review, publication, gating and audit |
| [Codex Diagnose Safe](https://github.com/jiying2007/codex-diagnose) | Bounded CI/build/test failure diagnosis with Diagnosis Receipt v2 |

**Codex PR Safe is retired.** The former model-generated PR-description product is not restored. **Codex Change Safe** is the deterministic successor and uses **zero model calls** by default.

## Current machine contract

`core-contract.json` is the single current-state source of truth:

- Safe Core v4 / Safe Contract v2 / Policy Schema v4;
- Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2;
- Review, Commit and Diagnose Prompt Contract v1;
- Codex Runtime v3 / Provider Contract v3;
- Model Routing / Registry / Lineage / Economics v1;
- Family Snapshot v3 / Family Manifest v5 / Product Contract v2;
- Consumer CI Receipt v1 / Core Digest Contract v1 / Repository Governance Contract v1;
- Node 22 >=22.22.2 <23 or Node 24 >=24.19.0 <25.

Breaking safety/runtime changes require a coordinated hard switch. Permanent compatibility shims are not supported.

## Consumption model

Every active consumer pins one **exact formally released Core commit** as `src/codex-safe-core`:

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

There is no branch-following mode, copied runtime, npm runtime dependency or compatibility proxy.

## Runtime / governance identity

Core Digest Contract v1 separates two cryptographic identities:

- `runtimeDigest` covers runtime modules, `codex-safe.schema.json` and runtime-relevant machine-contract fields;
- `governanceDigest` covers workflows, tests, quality corpora, docs and release/orchestration governance.

A consumer always retains an exact Core SHA pin. It is runtime-compatible with a newer released Core only when the two formally released Core identities have the same `runtimeDigest`. A different runtime digest is stale and requires a consumer patch release. This avoids rebuilding byte-identical products for governance-only Core releases without weakening exact-pin auditability.

Product Contract v2 binds `safeCoreCommit`, `safeCoreRuntimeDigest` and `safeCoreGovernanceDigest`.

## Runtime / Provider Contract v3

Review, Commit, Diagnose and Review Service can share machine-scoped `~/.codex-safe/runtime.json`. Resolution is product override → Family Runtime → user Codex config → built-in OpenAI. Repository-local Codex configuration is never inherited for provider routing.

Compatible providers use secret-by-reference `credentialSource=auto|env|auth-json`; secrets are injected only into the child Codex environment and never appear in argv, settings, receipts or diagnostics. HTTPS is preferred. Machine-owned private-network HTTP can be inherited only under the bounded transport contract and remains visibly marked as plaintext.

## Policy Schema v4

The only repository policy is committed `.codex-safe.json` with closed sections:

- `review` — Review Safe;
- `commit` — Commit Safe;
- `change` — deterministic Change Safe delivery requirements;
- `reviewService` — Review Service.

The retired `pr` prompt/narrative surface remains rejected. Change Safe does not regain model-generated PR/MR narrative.

## Model Routing and token efficiency

Model Routing Contract v1 uses stable `fast` / `balanced` / `deep` execution intent and `scout` / `reviewer` / `adjudicator` authority roles. Concrete model generations remain machine/admin Registry data, not repository policy.

Automatic routing selects only approved eligible models. Model Evidence binds canonical `registryDigest` and `routingPolicyDigest`, resolved provider/model/revision, qualification identity, fallback/degradation state and normalized usage. Cross-provider fallback is disabled unless explicitly machine/admin enabled.

Token Estimator Calibration stores only numeric provider/model observations. Per-model `lastObservedAtMs` drives TTL, and machine files use bounded no-follow reads, owner/permission validation, lock/merge-on-write and atomic mode-0600 replacement. Prompts, source, findings, judgments and credentials are never calibration data.

Model Economics is quality-constrained and segmented by mode, role, provider, model, Profile Pack and repository-size bucket. Promotion requires real corpus results plus minimum total/critical sample counts. The historical recorded baseline is regression evidence, not a claim of universal 100% model quality.

## Judgment and evidence boundary

AI output is untrusted data. Git identity, Policy evaluation, Receipt validation, coverage/readiness gates, Review Evidence Manifest identity, model-routing evidence, Family snapshots and release authorization remain deterministic.

Structural Review Evidence may be cached. Persisted model judgment cannot be reused as a new judgment. Only fresh inference creates a Review Receipt; bounded result replay never creates fresh provenance.

## Family evidence and release flow

Family Registry v1 defines the active topology. Family Snapshot v3 freezes:

- the newest exact immutable Core Release and both Core digests;
- each exact consumer release;
- each consumer's actual exact pinned Core SHA/digests;
- its Consumer CI Receipt v1;
- required Marketplace/GHCR/GitHub Release distribution evidence.

Family Manifest v5 binds that snapshot, Product Contract/package-lock digests, protocol/runtime identity and distribution evidence, then receives GitHub build-provenance attestation and immutable digest-addressed publication.

Routine Family Compatibility trusts immutable Consumer CI Receipts and runs one Ubuntu cross-family validation. The complete five-consumer × Linux/Windows/macOS matrix remains a weekly or explicit `full_matrix=true` audit.

Runtime-changing Core upgrades use a two-phase transaction: prepare all required consumer PRs and wait for every CI gate before any merge; then freeze PR heads and merge only that validated set. Runtime-equivalent consumers are recorded as skipped. Release, distribution and CI-receipt evidence must converge before Family Freshness can complete.

## Family SCM UI

The canonical VS Code SCM primary sequence is **Review → Commit → Change**. `family-ui-contract.json` is the machine source for the primary toolbar contract.

## Repository governance

`repository-governance-contract.json` defines the server-side GitHub Ruleset baseline for all six Family repositories: PR-based changes, strict required checks, review requirements, deletion/non-fast-forward protection and bounded bypass. `scripts/verify-repository-ruleset.js` audits the live GitHub state. Repository tests cannot substitute for server-side enforcement.

## Supply chain

Actions are full-SHA pinned. Trusted releases use supported Node floors, reproducible package checks, immutable tags/releases, SHA-256, SPDX SBOM and GitHub build-provenance attestation. Core Release additionally publishes attested `CORE_DIGESTS.json`; consumer releases publish attested `CONSUMER_CI_RECEIPT.json`.

## Verification

```bash
npm run ci
```

For live server-side repository governance verification:

```bash
npm run check:repository-governance
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [Consumer Guide](docs/CONSUMER_GUIDE.md), [Quality Platform](docs/QUALITY_PLATFORM.md), and [GitHub Governance](docs/GITHUB_GOVERNANCE.md).

## User-visible time zone

Machine-readable receipts/evidence stay canonical UTC. User-visible timestamps follow the runtime time zone or `CODEX_SAFE_DISPLAY_TIME_ZONE`. Display time never participates in fingerprints or evidence digests.

## License

MIT
