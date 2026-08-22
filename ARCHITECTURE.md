# Codex Safe Core architecture

Codex Safe Core owns all cross-product infrastructure for the Codex Safe Git workflow family.

## Ownership boundary

Core owns Codex CLI capability probing/invocation, process execution and cancellation, Git repository primitives, fingerprints, receipts/contracts, and semantic context budgeting.

Product repositories own only product-specific policy and presentation:

- Commit: commit policy, scope intelligence, repository style, commit rendering.
- Review: finding model, severity/confidence, diagnostics/reporting, review workflow.
- PR: base selection semantics, PR title/body/template, provider integration and preview.

No product repository may carry an independent implementation of Core-owned process, Git, Codex runtime, receipt validation, or context-budget primitives.

## Compatibility policy

There is no legacy compatibility layer. Consumers must update to the current Core contract. Missing required Codex safety capabilities fail closed.
