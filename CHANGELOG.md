# Changelog

All notable changes to Codex Safe Core are documented here.

## Unreleased

## 3.0.0

### Changed

- Raised the implementation line to Safe Core v3 while keeping Safe Contract v2 unchanged.
- Replaced Policy Schema v2 with closed Policy Schema v3; v2 documents are intentionally rejected.
- Added shared Review deterministic rules under `.codex-safe.json.review.rules` and a separate `reviewService` section for server-only context/coverage controls.
- Replaced Review Receipt v2 with Review Receipt v3 using an explicit subject envelope for local Git-index review and GitLab MR review.
- Raised Commit Receipt to schema v3 so Commit provenance can bind Review Receipt v3 without compatibility shims.
- Added coverage-preserving Review Evidence Chunking: changed hunks are either included in bounded review chunks or reported as explicit coverage gaps; review input is never silently middle-truncated.
- Kept Semantic Context budgeting as the narrative-oriented Commit/PR path, separate from review evidence coverage semantics.
- Continued fail-closed Codex capability negotiation, read-only execution and immutable public runtime boundaries.

## 2.1.0

### Changed

- Unified text and buffer subprocess execution behind one hardened lifecycle engine.
- Enforce shell-free execution, bounded process options, shared timeout/cancellation/output-limit behavior, and cross-platform process-tree termination.
- Harden generic Git helpers with fail-closed revision/remote token validation and deterministic read-only Git environment defaults.
- Make Review and Commit Receipt v2 validation closed: unknown fields and non-canonical timestamps are rejected.
- Harden the public Codex CLI adapter against unsafe temp prefixes, schema filenames, invalid schemas, invalid CLI paths, and malformed process options.
- Replace the shallow root smoke test with first-class Node test modules covering contracts, process lifecycle, Git snapshots/ref injection, policy HEAD isolation, semantic context budgeting, capability negotiation, and structured output.

## 2.0.0

### Changed

- Hard switch to Safe Core contract v2 with no v1 compatibility fallback.
- Repository root is the canonical runtime API consumed by Commit, Review, and PR through commit-pinned Git submodules.
- Unified `.codex-safe.json` policy schema v2.
- Added Review Receipt v2 and Commit Receipt v2 validation.
- Added semantic per-file context budgeting that prioritizes source changes while representing generated/lock/binary files as metadata.
- Established fail-closed Codex capability negotiation, read-only execution, shared Git primitives, and cross-product security invariants.
