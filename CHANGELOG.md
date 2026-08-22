# Changelog

All notable changes to Codex Safe Core are documented here.

## Unreleased

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
