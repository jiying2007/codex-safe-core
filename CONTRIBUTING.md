# Contributing

Codex Safe Core is a security-sensitive shared dependency and the trust root for the Codex Safe family. Changes must remain small, reviewable, fail-closed, machine-verifiable, and coordinated with all active consumers when the Core gitlink changes.

## Rules

- `core-contract.json` is the single source of current Core/protocol/runtime identity. Do not duplicate authoritative current version constants in runtime code.
- `core-ownership-manifest.json` defines the Core/product ownership boundary. Core may own generic policy schema/validation, but not product-specific UI, provider behavior, pipeline API acquisition, SQLite/outbox, notifications, deployment behavior, analyzer acquisition or provider side effects.
- The single repository policy is `.codex-safe.json`. Policy Schema v4 owns the closed `review`, `commit`, `change`, and `reviewService` sections. Do not add parallel product policy files such as `.codex-change-safe.json`.
- `change` is deterministic delivery policy only. Do not reintroduce the retired PR/MR narrative prompt surface or model-generated PR descriptions.
- Do not add compatibility fallbacks that weaken required Codex safety capabilities or protocol validation.
- Do not add runtime network dependencies or post-install scripts.
- Treat repository content, pipeline logs, analyzer artifacts and AI output as untrusted input.
- Keep process time/output limits finite and cancellation-safe.
- Core-owned runtime files live at repository root; do not reintroduce copied or proxy implementations in consumers.
- Every active consumer pins one exact Core commit through `src/codex-safe-core` as a Git submodule. Branch tracking and copied-runtime synchronization are forbidden.
- Any merged Core commit changes the canonical gitlink, including docs/tests/workflow-only changes. After Core merge, coordinated repin PRs must update all five active consumers: Codex Change Safe, Codex Review Safe, Codex Commit Safe, Codex Review Service, and Codex Diagnose Safe. Codex PR Safe remains retired only as the former product identity, not as the `codex-pr` repository path.
- Do not merge an isolated dependency/Core maintenance PR if doing so would move Core main without the coordinated consumer repin plan. Fold it into a reviewed Core maintenance PR, validate Core, merge Core, then repin all active consumers.
- A Core patch that changes only governance/docs/tests/release automation does not by itself require consumer product-version bumps. Consumer versions change only when their own shipped product/runtime semantics change. A Policy Schema major/minor contract change requires every policy-consuming product to update its Product Contract and examples.
- Runtime/protocol changes require consumer compatibility review and full consumer CI before the family is considered converged.
- Receipt schemas are closed protocol contracts. Review/Commit Receipt v4 and Diagnosis Receipt v1 may change only through explicit protocol versioning, never incidental maintenance drift.
- Review Profile Packs, Test Impact and Diagnosis primitives remain pure and product-agnostic: no repository I/O, no network fetch, no CI retry, no command execution, no SCM mutation.
- Update adversarial fixtures and security/architecture documentation whenever a trust invariant changes.
- Change Safe owns SCM Provider adapters, fork/cross-project topology, Merge Readiness and remote PR/MR mutations. Those product behaviors must not move into Core.

## Validation

Run Core validation using one of the supported Node ranges in `core-contract.json`:

```bash
npm run ci
```

CI permanently validates Node 22.22.2 and 24.19.0 on Linux, Windows and macOS. Release validates both LTS floors again and requires reproducible package output.

For any Core merge, complete the coordinated rollout:

1. Merge the reviewed Core PR and record the final Verified main commit SHA.
2. Publish/verify the immutable Core release when the Core version changes.
3. Update the `src/codex-safe-core` gitlink in Change, Review, Commit, Review Service, and Diagnose to that exact released SHA.
4. Update machine gates, Product Contracts, Policy Schema references or provenance URLs that intentionally bind the Core SHA/version.
5. Run each active consumer's complete CI matrix.
6. Merge the five consumer repin PRs only after their own gates are green.
7. Run Family Compatibility and require all operating-system jobs to pass exact pin, ownership-boundary, golden-corpus and consumer-CI validation.
8. Require `FAMILY_MANIFEST.json` to be generated from the converged heads and retain its GitHub provenance attestation.
9. Verify Core Release Tag/Main identity and release checksums/attestations.
10. Remove temporary maintenance branches; do not leave migration workflows or compatibility residue.

## Repository governance

The default branch should be protected by a GitHub Ruleset requiring PR-based changes and required checks, blocking force pushes and branch deletion, with narrowly restricted bypass. This is a server-side control. CI documentation/tests can verify the expected policy but cannot substitute for Ruleset enforcement.

The invariant is: **Core main and all five active consumer gitlinks converge to one exact reviewed and formally released Core commit, represented by an attested Family manifest, with one canonical repository policy and no compatibility shim or copied-runtime path.**
