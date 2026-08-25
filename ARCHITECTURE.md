# Codex Safe Core architecture

Codex Safe Core owns the cross-product safety/runtime and protocol boundary for the Codex Safe family. `core-contract.json` is the machine-readable current identity; code and documentation must not independently invent current protocol/runtime facts.

## Ownership boundary

Core owns:

- Safe Contract / Codex CLI capability probing and invocation;
- process lifecycle, cancellation, timeout and output bounds;
- generic local Git primitives for desktop consumers;
- canonical fingerprints and Receipt validation;
- `.codex-safe.json` Policy Schema v3;
- narrative Semantic Context budgeting;
- coverage-preserving Review Evidence Chunking;
- provenance fields shared by Review/Commit Receipt contracts.

`core-ownership-manifest.json` is the machine-readable ownership declaration. Family validation checks consumers for independent declarations of Core-owned safety/process/policy/receipt primitives.

Products own domain behavior:

- **Commit Safe:** commit policy, scope/style intelligence, rendering, receipt persistence/binding.
- **Review Safe:** staged snapshot, finding semantics, deterministic Review gate integration, diagnostics/reporting.
- **PR Safe:** base/fork semantics, narrative, provider integration, preview/provenance presentation.
- **Review Service:** GitLab webhook/provider semantics, Project/Group scope, immutable MR evidence acquisition, SQLite queue/outbox, merge gate and publication.

No product may carry an independent implementation of Core-owned Process/Codex/Policy/Receipt/Review-Evidence primitives. Provider, SQLite/outbox, notifications and deployment concerns must not move into Core.

## Contract identity boundary

The current line is machine-owned by `core-contract.json`:

- Safe Core v4
- Safe Contract v2
- Policy Schema v3
- Review Receipt v4
- Commit Receipt v4
- Review Prompt Contract v1
- Commit Prompt Contract v1
- PR Prompt Contract v1
- Node 22 LTS >=22.22.2 <23
- Node 24 LTS >=24.19.0 <25

`SAFE_CONTRACT_MANIFEST` describes the closed authority-bearing capability set and `SAFE_CONTRACT_DIGEST` is its SHA-256 identity. Version and digest solve different problems: version represents semantic protocol compatibility; digest identifies the exact manifest bytes represented by the current implementation. A maintenance release cannot use a digest change to smuggle a semantic Safe Contract change without a protocol-version decision.

Receipt v4 remains closed and unchanged in Core 4.1. Contract/execution digests stay separate machine identities until a future Receipt major explicitly adopts them.

## Context boundary

Core `buildSemanticContext()` is optimized for Commit/PR narrative generation. Core `buildReviewEvidenceChunks()` preserves Review coverage and reports explicit gaps instead of silently truncating changed hunks.

Provider-specific context acquisition stays outside Core. For example, Review Service fetches bounded source/target windows at exact GitLab `head_sha/start_sha`, then supplies that evidence to its Review domain without granting provider credentials or tools to Codex.

## Deterministic boundary

The following are deterministic and must be independently testable without a model:

- Git evidence identity and fingerprints;
- Policy parsing/evaluation;
- Receipt validation;
- coverage/readiness/mechanical gate logic;
- severity/confidence filtering and deterministic review rules;
- Safe Contract argv/capability construction;
- publication idempotency and stale-snapshot rejection in the owning product.

Model-generated wording and findings are non-deterministic inputs. They cannot bypass schema validation, evidence binding or deterministic gates. The adversarial corpus treats source text, filenames, fake system/tool blocks, repository rules and dependency-install instructions as hostile data and proves they do not mutate the constructed Safe Contract.

## Codex capability and behavior boundary

Capability negotiation remains fail closed. The recurring Canary validates that the latest upstream Codex CLI still accepts every required flag/config on Linux, Windows and macOS and records the current Safe Contract digest.

When protected OpenAI credentials are configured, an additional behavioral canary executes the real CLI under Safe Contract constraints and attempts filesystem and loopback-network side effects. Success of either side effect is a security regression. A credentialless environment is reported as not-executed for the live behavior probe; it is never presented as behavioral success.

## Family baseline boundary

Every consumer pins one exact Core commit. A coordinated family state is complete only when all four consumer CIs pass on that Core.

Family Compatibility then generates `FAMILY_BASELINE.json` containing:

```text
Core version + exact SHA
protocol versions
supported runtime identity
Commit / Review / PR / Review Service exact SHAs
exact Core pin seen by every consumer
baseline SHA-256 digest
```

The baseline file receives GitHub build-provenance attestation. This makes a historical family baseline explicit evidence rather than an inference from moving branches or old workflow logs.

## Release and supply-chain boundary

The public `release.yml` owns version selection and unprivileged Node 22.22.2 / 24.19.0 validation. Authority-bearing publication is delegated to `_trusted-release.yml`, which alone requires contents-write, id-token and attestation permissions.

Before tagging/publication, two independent `npm pack` outputs must be bit-for-bit identical. Release publishes the package, SPDX SBOM, Core Contract, Ownership Manifest and SHA256SUMS and attests all immutable release files. Existing tags/assets are never overwritten.

A same-repository reusable workflow centralizes and reduces publication attack surface; it does not by itself justify claiming a higher SLSA level. Provenance claims must match the actual workflow/repository trust boundary.

## Family governance

`codex-safe-core` is the family trust root. CI validates both supported Node LTS floors across Linux/Windows/macOS. Family Compatibility verifies exact pins, ownership boundaries, golden behavior and consumer CIs. OpenSSF Scorecard is a recurring signal, not a substitute for repository policy.

The default branch should be protected by a GitHub Ruleset requiring PR-based changes and required checks, blocking deletion/force push, and tightly limiting bypass. This is a server-side repository control and cannot be emulated by a test file.

## Compatibility policy

There is no cross-major compatibility layer. Consumers hard-switch to the current protocol line. Missing required Codex safety capabilities, obsolete Policy schemas and obsolete Receipt schemas fail closed. Governance improvements must not reintroduce provider abstractions, runtime fallbacks or hidden compatibility paths into Core.
