# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core is the **single canonical safety/runtime and protocol core** for the Codex Safe family. It is an internal family component, not a standalone end-user application.

| Product | User-facing role |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | Review staged changes in VS Code |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | Generate validated Conventional Commit messages |
| [Codex PR Safe](https://github.com/jiying2007/codex-pr) | Generate validated PR title/body from committed changes |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | Self-hosted GitLab MR review enforcement |

Current protocol line: **Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Prompt Contracts v1**. `core-contract.json` is the machine-checked source of current Core/protocol/runtime identity.

## Which repository should I use?

If you want to review code, generate a commit message, create PR text, or deploy GitLab review automation, install/use the matching product above. Clone this repository directly only when developing the family itself or updating the exact Core pin consumed by those products.

See [Consumer Guide](docs/CONSUMER_GUIDE.md) for the supported consumption model and [SUPPORT.md](SUPPORT.md) for troubleshooting/reporting boundaries.

## Consumption model

Consumers pin this repository as a Git submodule at `src/codex-safe-core`. The gitlink is the version lock; there is no copied runtime, branch-following mode, npm runtime dependency or compatibility proxy.

```bash
git submodule update --init --recursive
npm run ci
```

A Core change is not complete until every consumer is coordinated-repinned to the exact reviewed Core commit and passes its own CI.

## Machine-verifiable Trust Root identity

`core-contract.json` owns current versions and supported runtimes. `safe-contract.js` derives its protocol constants from this file and exports a closed `SAFE_CONTRACT_MANIFEST` plus `SAFE_CONTRACT_DIGEST` (SHA-256). The digest identifies the exact authority/capability surface without silently changing Safe Contract v2 semantics or Receipt v4 schemas.

Current native runtime support is explicit rather than open-ended:

- Node 22 LTS: **>=22.22.2 <23**
- Node 24 LTS: **>=24.19.0 <25**

CI validates both exact floors on Linux, Windows and macOS. Untested odd/future Node majors are not implicitly supported.

## Ownership

Core owns Codex capability probing/invocation, process lifecycle, generic Git primitives, Semantic Context, coverage-preserving Review Evidence Chunking, Policy Schema v3, deterministic review rules, fingerprints and Receipt validation/provenance. `core-ownership-manifest.json` records this boundary. Products own only Commit, Review, PR or GitLab-service domain behavior and must not carry an independent implementation of a Core-owned primitive.

## Safe Contract v2

Required capabilities include `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of shell/unified execution, web search, apps, multi-agent, plugins, hooks, goals, memories and dependency installation. Missing capabilities fail closed; there is no legacy CLI fallback.

The daily Codex CLI Canary checks the latest upstream CLI on Linux/Windows/macOS and records the Safe Contract digest. When protected OpenAI credentials are configured, a live behavioral canary additionally attempts forbidden filesystem and loopback-network side effects and fails if either succeeds. A permanent adversarial corpus verifies that untrusted repository/model text cannot mutate Safe Contract argv.

## Policy Schema v3

The only repository policy is `.codex-safe.json`. Older policy schemas are intentionally rejected. Commit, Review, Review Service and PR consume separate sections of the same closed schema.

## Receipt v4 provenance

Review and Commit Receipts are closed v4 contracts. Core canonicalizes and records protocol versions, requested/resolved model identity, Codex CLI version, immutable Git subject/evidence fingerprints and verdict metadata. Receipts are AI-workflow provenance, never human approval, build evidence or test evidence.

Core 4.1 Trust Root governance does **not** add fields to Receipt v4. Safe Contract/execution digests remain separate machine identities until a future Receipt major explicitly adopts them.

## Deterministic boundary

Git evidence identity, policy evaluation, Receipt validation, coverage/readiness/mechanical gates, severity/confidence filtering and stale-publication rejection are deterministic. Model wording/findings are non-deterministic inputs and cannot bypass schema validation, evidence binding or deterministic gates.

## Family governance

- **Family Compatibility:** weekly/manual Linux + Windows + macOS validation replays the family golden corpus, verifies exact Core pins, checks consumers for Core-owned primitive reimplementation, and runs every consumer CI.
- **Family Baseline Attestation:** after coordinated repin, generates `FAMILY_BASELINE.json` with exact Core/consumer SHAs, protocol/runtime identity and a digest, then attaches GitHub build provenance.
- **Codex CLI Canary:** daily/manual capability validation against the latest upstream CLI, with credential-backed live negative behavior testing when configured.
- **Adversarial corpus:** prompt-injection/tool-escalation samples permanently protect the deterministic Safe Contract boundary.
- **Performance budgets:** broad regression gates catch order-of-magnitude context/evidence regressions without fragile micro-benchmarks.
- **OpenSSF Scorecard:** recurring security-regression signal.
- **Release supply chain:** trusted reusable publication workflow, explicit Node 22/24 release tests, reproducible npm package gate, immutable tags/assets, SHA-256, SPDX SBOM and GitHub build-provenance attestation.

## Development

```bash
git submodule update --init --recursive
npm run ci
```

Use a supported Node 22/24 LTS range from `core-contract.json`.

## Versioning

Core major versions are implementation/protocol-family boundaries. Protocol numbers remain independent and change only when their semantics change. Breaking Receipt/Core changes require a hard switch across consumers; permanent compatibility shims are forbidden.

## Security

See [SECURITY.md](SECURITY.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [VERIFY_RELEASE.md](VERIFY_RELEASE.md).

The invariant is: **AI output is untrusted data and never gains authority to mutate Git, execute arbitrary commands, bypass safety capabilities, or create provider side effects.**

## License

MIT
