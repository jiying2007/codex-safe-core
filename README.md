# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core is the **single canonical safety/runtime and protocol core** for the Codex Safe family. It is an internal family component, not a standalone end-user application.

| Product | User-facing role |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | Review staged changes in VS Code |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | Generate validated Conventional Commit messages |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | Self-hosted GitLab Self-Managed MR review, publication, gate and audit |
| [Codex Diagnose Safe](https://github.com/jiying2007/codex-diagnose) | CI/build/test failure root-cause diagnosis with bounded evidence and Diagnosis Receipt v1 |

**Codex PR Safe is retired.** There is no replacement PR/MR-description generator. PR/MR creation and metadata stay with the SCM's native UI/CLI/API, and Codex Commit Safe intentionally does not generate PR/MR descriptions.

Current protocol line: **Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Diagnosis Receipt v1 / Review, Commit & Diagnose Prompt Contracts v1**. `core-contract.json` is the machine-checked source of current Core/protocol/runtime identity.

## Which repository should I use?

Use Codex Review Safe for developer-side pre-commit review, Codex Commit Safe for commit-message generation, Codex Review Service for server-side GitLab MR review, and Codex Diagnose Safe for failed CI/build/test diagnosis. Clone this repository directly only when developing the family itself or updating the exact Core pin consumed by those products.

See [Consumer Guide](docs/CONSUMER_GUIDE.md) for the supported consumption model and [SUPPORT.md](SUPPORT.md) for troubleshooting/reporting boundaries.

## Consumption model

Active consumers pin this repository as a Git submodule at `src/codex-safe-core`. The gitlink is the version lock; there is no copied runtime, branch-following mode, npm runtime dependency or compatibility proxy.

```bash
git submodule update --init --recursive
npm run ci
```

A Core change is not complete until all four active consumers are coordinated-repinned to the exact reviewed, formally released Core commit and pass their own CI.

## Machine-verifiable Trust Root identity

`core-contract.json` owns current versions and supported runtimes. `safe-contract.js` derives its protocol constants from this file and exports a closed `SAFE_CONTRACT_MANIFEST` plus `SAFE_CONTRACT_DIGEST` (SHA-256). The digest identifies the exact authority/capability surface without silently changing Safe Contract v2 semantics or Receipt v4 schemas.

Current native runtime support is explicit rather than open-ended:

- Node 22 LTS: **>=22.22.2 <23**
- Node 24 LTS: **>=24.19.0 <25**

CI validates both exact floors on Linux, Windows and macOS. Untested odd/future Node majors are not implicitly supported.

## Ownership

Core owns Codex capability probing/invocation, process lifecycle, generic Git primitives, Semantic Context, coverage-preserving Review Evidence Chunking, Policy Schema v3, deterministic review rules, fingerprints and Receipt validation/provenance. Core 4.9 additionally owns versioned Review Profile Packs, deterministic Test Impact selection, pure Diagnosis Contract/Receipt primitives, bounded token-estimator calibration, Review/Diagnose quality evaluation, Atomic Family Snapshot v1, Family Manifest v3, Product Contract v1 validation and immutable released-Core pin validation. `core-ownership-manifest.json` records this boundary. Products own only Commit, Review, Diagnose or GitLab-service domain behavior and must not carry an independent implementation of a Core-owned primitive.

Analyzer artifact acquisition/parsing orchestration, GitLab pipeline/job APIs, diagnosis publication and SCM provider side effects remain product-owned. PR/MR narrative generation, GitHub Pull Requests provider integration, compare-URL construction, fork-topology assumptions and SCM-side PR/MR creation are explicitly outside Core.

## Safe Contract v2

Required capabilities include `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of shell/unified execution, web search, apps, multi-agent, plugins, hooks, goals, memories and dependency installation. Missing capabilities fail closed; there is no legacy CLI fallback.

The daily Codex CLI Canary checks the latest upstream CLI on Linux/Windows/macOS and records the Safe Contract digest. When protected OpenAI credentials are configured, a live behavioral canary additionally attempts forbidden filesystem and loopback-network side effects and fails if either succeeds. A permanent adversarial corpus verifies that untrusted repository/model text cannot mutate Safe Contract argv.

## Policy Schema v3

The only repository policy is `.codex-safe.json`. Older policy schemas are intentionally rejected. The active closed schema contains only Commit, Review and Review Service sections. The former `pr` section is rejected rather than kept as a compatibility surface. Diagnose has a separate product configuration because CI diagnosis is not a repository-review policy surface.

## Core 4.9 Quality Platform v3

The existing `quick`, `standard`, `deep`, `security`, and `embedded` execution profiles remain stable. Profile Pack v1 provides versioned engineering packs for `general`, `backend`, `frontend`, `security`, `cpp`, `embedded-linux`, `embedded-mcu`, `driver`, `kernel`, and `realtime`. Test Impact v1 ranks controller-provided test candidates from changed paths and semantic evidence without executing tests. Diagnosis Contract v1 remains stable. Quality Platform v3 adds labeled Review and Diagnose regression corpora, including clean negative/cascade cases and explicit cost/accuracy gates. Token Calibration v1 can improve preflight estimates from actual usage without weakening fail-closed budgets.

## Receipt provenance

Review and Commit Receipts are closed v4 contracts. Diagnosis Receipt v1 separately binds project/pipeline/job/commit identity, the exact diagnosis evidence digest, normalized classification/confidence and diagnosis fingerprint. Receipts are AI-workflow provenance, never human approval, build evidence or test evidence by themselves.

Core 4.x Trust Root governance does **not** add fields to Review/Commit Receipt v4. Safe Contract/execution digests remain separate machine identities until a future Receipt major explicitly adopts them.

## Deterministic boundary

Git evidence identity, policy evaluation, Receipt validation, coverage/readiness/mechanical gates, severity/confidence filtering, stale-publication rejection, Profile Pack resolution, Test Impact ranking, diagnosis evidence digests, quality metrics, Family snapshot identity and manifest identity are deterministic. Model wording/findings/diagnoses are non-deterministic inputs and cannot bypass schema validation, evidence binding or deterministic gates.

## Family governance

- **Atomic Family Compatibility:** weekly/manual Linux + Windows + macOS validation first freezes one exact Core/consumer snapshot, then every platform checks out that same snapshot, verifies the four exact released Core pins, checks consumers for Core-owned primitive reimplementation, and runs every active consumer CI.
- **Family Manifest v3 Attestation:** the manifest job consumes the same frozen snapshot and records exact Core/consumer SHAs, Product Contract digests, Core Contract digest, the complete versioned protocol map/fingerprint, runtime identity and a manifest digest before GitHub build provenance and immutable digest-addressed publication.
- **Released Core gate:** active consumers may pin only a Core SHA that is the exact target of a final, immutable `vX.Y.Z` Core Release.
- **Codex CLI Canary:** daily/manual capability validation against the latest upstream CLI, with credential-backed live negative behavior testing when configured.
- **Adversarial corpus:** prompt-injection/tool-escalation samples permanently protect the deterministic Safe Contract boundary.
- **Performance and quality budgets:** broad performance gates catch catastrophic regressions while labeled Review/Diagnose corpora catch accuracy, false-positive, calibration and token-cost regressions.
- **OpenSSF Scorecard:** recurring security-regression signal.
- **Release supply chain:** trusted reusable publication workflow, explicit Node 22/24 release tests, reproducible npm package gate, immutable tags/assets, SHA-256, SPDX SBOM and GitHub build-provenance attestation.

## Development

```bash
git submodule update --init --recursive
npm run ci
```

Use a supported Node 22/24 LTS range from `core-contract.json`.

## Versioning

Core major versions are implementation/protocol-family boundaries. Protocol numbers remain independent and change only when their semantics change. Breaking Receipt/Core changes require a hard switch across active consumers; permanent compatibility shims are forbidden.

## Security

See [SECURITY.md](SECURITY.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [VERIFY_RELEASE.md](VERIFY_RELEASE.md).

The invariant is: **AI output is untrusted data and never gains authority to mutate Git, execute arbitrary commands, bypass safety capabilities, retry CI, or create provider side effects.**

## License

MIT
