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
- coverage-preserving Review Evidence Chunking.

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

- Safe Core implementation: v3
- Safe Contract: v2
- Policy Schema: v3
- Review Receipt: v3
- Commit Receipt: v3

Protocol versions are independent. A number changes only when that protocol changes.

## Compatibility policy

There is no cross-major compatibility layer. Consumers hard-switch to the current protocol line. Missing required Codex safety capabilities, obsolete Policy schemas and obsolete Receipt schemas fail closed.
