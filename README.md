# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core is the **single canonical safety/runtime and protocol core** for the Codex Safe family. It is an internal family component, not a standalone end-user application.

| Product | User-facing role |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | Review staged changes in VS Code |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | Generate validated Conventional Commit messages |
| [Codex Change Safe](https://github.com/jiying2007/codex-pr) | Developer-side GitHub/GitLab delivery authorization, merge readiness and Change Receipt v1 |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | Self-hosted GitLab Self-Managed MR review, publication, gate and audit |
| [Codex Diagnose Safe](https://github.com/jiying2007/codex-diagnose) | CI/build/test failure root-cause diagnosis with bounded evidence and Diagnosis Receipt v2 |

**Codex PR Safe is retired.** Its former model-generated PR-description identity is not restored. **Codex Change Safe** is the deterministic successor delivery product: it authorizes and orchestrates GitHub/GitLab PR/MR delivery with zero model calls by default.

## Family SCM primary UI contract

For VS Code Source Control title actions, the canonical primary sequence is **Review → Commit → Change**. Each product owns exactly one primary SCM title command: Review at `navigation@5`, Commit at `navigation@6`, and Change at `navigation@7`. Independent Review and Delivery Preflight remain secondary actions and must not occupy the primary SCM toolbar. The machine source is `family-ui-contract.json`.

Current protocol line: **Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2 / Codex Runtime v2 / Provider Contract v2 / Review, Commit & Diagnose Prompt Contracts v1**. `core-contract.json` is the machine-checked source of current Core/protocol/runtime identity.

## Which repository should I use?

Use Codex Review Safe for developer-side pre-commit review, Codex Commit Safe for commit-message generation, Codex Change Safe for developer-side PR/MR delivery authorization, Codex Review Service for server-side GitLab MR review, and Codex Diagnose Safe for failed CI/build/test diagnosis. Clone this repository directly only when developing the family itself or updating the exact Core pin consumed by those products.

See [Consumer Guide](docs/CONSUMER_GUIDE.md) for the supported consumption model and [SUPPORT.md](SUPPORT.md) for troubleshooting/reporting boundaries.

## Consumption model

All five active consumers pin this repository as a Git submodule at `src/codex-safe-core`. The gitlink is the version lock; there is no copied runtime, branch-following mode, npm runtime dependency or compatibility proxy.

```bash
git submodule update --init --recursive
npm run ci
```

A Core change is not complete until all five active consumers are coordinated-repinned to the exact reviewed, formally released Core commit and pass their own CI.

## Machine-verifiable Trust Root identity

`core-contract.json` owns current versions and supported runtimes. `safe-contract.js` derives its protocol constants from this file and exports a closed `SAFE_CONTRACT_MANIFEST` plus `SAFE_CONTRACT_DIGEST` (SHA-256). The digest identifies the exact authority/capability surface without silently changing Safe Contract v2 semantics or any independently versioned Receipt schema.

Current native runtime support is explicit rather than open-ended:

- Node 22 LTS: **>=22.22.2 <23**
- Node 24 LTS: **>=24.19.0 <25**

CI validates both exact floors on Linux, Windows and macOS. Untested odd/future Node majors are not implicitly supported.

## Ownership

Core owns Codex capability probing/invocation, process lifecycle, generic Git primitives, Semantic Context, coverage-preserving Review Evidence Chunking, **Policy Schema v4**, deterministic review rules, fingerprints and Receipt validation/provenance. Core 4.x also owns Runtime/Provider Contract v2 credential and transport resolution, versioned Review Profile Packs, deterministic Test Impact selection, pure Diagnosis Contract/Receipt primitives, bounded token-estimator calibration, Review/Diagnose quality evaluation, Atomic Family Snapshot v1, Family Manifest v3, Product Contract v1 validation and immutable released-Core pin validation. `core-ownership-manifest.json` records this boundary.

Product domains remain product-owned. Change Safe owns SCM provider adapters, source/target topology, native SCM policy discovery, PR/MR mutations, merge readiness and Delivery Authorization. Review Service owns webhook/queue/publication/audit. Diagnose owns CI evidence acquisition and diagnosis orchestration. Core never performs provider side effects.

Model-generated PR/MR narrative remains a non-goal. Change Safe is deterministic delivery authorization, not a revival of the retired PR narrative generator.

## Safe Contract v2

Required capabilities include `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of shell/unified execution, web search, apps, multi-agent, plugins, hooks, goals, memories and dependency installation. Missing capabilities fail closed; there is no legacy CLI fallback.

The daily Codex CLI Canary checks the latest upstream CLI on Linux/Windows/macOS and records the Safe Contract digest. When protected OpenAI credentials are configured, a live behavioral canary additionally attempts forbidden filesystem and loopback-network side effects and fails if either succeeds. A permanent adversarial corpus verifies that untrusted repository/model text cannot mutate Safe Contract argv.

## Runtime / Provider Contract v2

`openai-compatible` consumers may resolve a relay API key from the configured environment variable or directly from `${CODEX_HOME}/auth.json` / `~/.codex/auth.json`. `credentialSource=auto` prefers the environment and falls back to `auth.json`; only `auth_mode=apikey` with `OPENAI_API_KEY` is accepted. Secrets are injected only into the child Codex environment and are never placed in argv, settings, receipts or diagnostics.

HTTPS remains the default transport. Loopback HTTP remains available for local development; non-loopback HTTP requires the explicit product/machine runtime opt-in `allowInsecureHttp=true`. Repository policy cannot enable insecure transport. Compatible providers continue to use Responses HTTP/SSE with Structured Output and WebSockets disabled.

## Policy Schema v4

The only repository policy is committed `.codex-safe.json`. Policy Schema v4 is a hard cut: older schema versions are rejected rather than silently migrated.

The closed top-level sections are:

- `review` — Codex Review Safe policy;
- `commit` — Codex Commit Safe policy;
- `change` — Codex Change Safe delivery requirements;
- `reviewService` — Codex Review Service repository policy.

The old `pr` policy/prompt surface remains rejected. The new `change` section is not a compatibility alias for it: it contains deterministic delivery requirements such as required checks/approvals, provenance requirements and safety booleans, and never model narrative instructions.

All products consume their section through the same Core parser/validator and the same committed policy fingerprint. Local Change Safe settings may only tighten the committed `change` policy; SCM-native requirements are unioned later in the Change product and cannot be weakened locally.

Diagnose continues to use separate product configuration because CI diagnosis is not a repository delivery/review policy surface.

## Core 4.12 Quality Platform v3

The existing `quick`, `standard`, `deep`, `security`, and `embedded` execution profiles remain stable. Profile Pack v1 provides versioned engineering packs for `general`, `backend`, `frontend`, `security`, `cpp`, `embedded-linux`, `embedded-mcu`, `driver`, `kernel`, and `realtime`. Test Impact v1 ranks controller-provided test candidates from changed paths and semantic evidence without executing tests. Diagnosis Contract v1 remains stable. Quality Platform v3 adds labeled Review and Diagnose regression corpora, including clean negative/cascade cases and explicit cost/accuracy gates. Token Calibration v1 can improve preflight estimates from actual usage without weakening fail-closed budgets.

## Receipt provenance

Review Receipt v5 and Commit Receipt v4 are independently versioned closed contracts. Change Receipt v1 remains owned by Change Safe and binds a deterministic delivery snapshot to remote change identity. Diagnosis Receipt v2 binds project/pipeline/job/commit identity and the full Diagnosis Input Manifest, including exact model-visible evidence identity. Receipts are workflow provenance, never human approval, build evidence or test evidence by themselves.

Core Trust Root governance does not silently add fields to a Receipt schema. Safe Contract/execution/runtime identities remain separately versioned machine identities unless a Receipt version explicitly adopts them.

## Deterministic boundary

Git evidence identity, policy evaluation, Receipt validation, coverage/readiness/mechanical gates, severity/confidence filtering, stale-publication rejection, Profile Pack resolution, Test Impact ranking, diagnosis evidence digests, quality metrics, Family snapshot identity and manifest identity are deterministic. Model wording/findings/diagnoses are non-deterministic inputs and cannot bypass schema validation, evidence binding or deterministic gates.

## Family governance

- **Atomic Family Compatibility:** weekly/manual Linux + Windows + macOS validation freezes one exact Core/consumer snapshot, then every platform checks out the same snapshot, verifies the five exact released Core pins, checks consumers for Core-owned primitive reimplementation, and runs every active consumer CI.
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

Core major versions are implementation/protocol-family boundaries. Protocol numbers remain independent and change only when their semantics change. Policy Schema v4, Safe Contract v2, Review Receipt v5, Commit Receipt v4, Diagnosis Receipt v2, Codex Runtime v2 and Provider Contract v2 are independently versioned. Breaking policy/Core changes require a coordinated hard switch across active consumers; permanent compatibility shims are forbidden.

## Security

See [SECURITY.md](SECURITY.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [VERIFY_RELEASE.md](VERIFY_RELEASE.md).

The invariant is: **AI output is untrusted data and never gains authority to mutate Git, execute arbitrary commands, bypass safety capabilities, retry CI, or create provider side effects.**

## License

MIT

## User-visible time zone

Machine-readable receipts, evidence and persisted audit timestamps remain canonical UTC. User-visible timestamps use the runtime system time zone by default. When a server or container runs in UTC but operators need a business-local display, set `CODEX_SAFE_DISPLAY_TIME_ZONE` to an IANA zone such as `Asia/Singapore`, `Asia/Shanghai`, or `America/New_York`. The display time zone never participates in fingerprints, receipts or evidence digests.
