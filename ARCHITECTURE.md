# Codex Safe Core architecture

Codex Safe Core owns the cross-product safety/runtime and protocol boundary for the Codex Safe family.

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

Products own domain behavior:

- **Commit Safe:** commit policy, scope/style intelligence, rendering, receipt persistence/binding.
- **Review Safe:** staged snapshot, finding semantics, deterministic Review gate integration, diagnostics/reporting.
- **PR Safe:** base/fork semantics, narrative, provider integration, preview/provenance presentation.
- **Review Service:** GitLab webhook/provider semantics, Project/Group scope, immutable MR evidence acquisition, SQLite queue/outbox, merge gate and publication.

No product may carry an independent implementation of Core-owned Process/Codex/Policy/Receipt/Review-Evidence primitives.

## Context boundary

Core `buildSemanticContext()` is optimized for Commit/PR narrative generation. Core `buildReviewEvidenceChunks()` preserves Review coverage and reports explicit gaps instead of silently truncating changed hunks.

Provider-specific context acquisition stays outside Core. For example, Review Service fetches bounded source/target windows at exact GitLab `head_sha/start_sha`, then supplies that evidence to its Review domain without granting provider credentials or tools to Codex.

## Protocol boundary

- Safe Core implementation: v4
- Safe Contract: v2
- Policy Schema: v3
- Review Receipt: v4
- Commit Receipt: v4
- Review Prompt Contract: v1
- Commit Prompt Contract: v1
- PR Prompt Contract: v1

Protocol versions are independent. A number changes only when that protocol changes. Receipt v4 records Core, Safe Contract, Policy Schema, Prompt Contract, requested/resolved model identity and Codex CLI version so historical decisions remain attributable.

## Deterministic boundary

The following are deterministic and must be independently testable without a model:

- Git evidence identity and fingerprints;
- Policy parsing/evaluation;
- Receipt validation;
- coverage/readiness/mechanical gate logic;
- severity/confidence filtering and deterministic review rules;
- publication idempotency and stale-snapshot rejection.

Model-generated wording and findings are non-deterministic inputs. They cannot bypass schema validation, evidence binding or deterministic gates.

## Family governance

`codex-safe-core` is the family trust root. Every consumer pins one exact Core commit. The recurring Family Compatibility workflow verifies all four consumers pin the current Core and runs every consumer CI on Linux, Windows and macOS. The Codex CLI Canary separately probes the latest upstream CLI on all three operating systems so an upstream flag/capability change is detected without relying on product users to find it first.

Release artifacts are immutable and include SHA-256 checksums, SPDX SBOM and GitHub build-provenance attestation. OpenSSF Scorecard is a recurring security-regression signal, not a substitute for repository policy.

## Compatibility policy

There is no cross-major compatibility layer. Consumers hard-switch to the current protocol line. Missing required Codex safety capabilities, obsolete Policy schemas and obsolete Receipt schemas fail closed.
