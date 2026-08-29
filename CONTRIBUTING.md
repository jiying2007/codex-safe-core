# Contributing

Codex Safe Core is a security-sensitive shared dependency and the trust root for the Codex Safe family. Changes must remain small, reviewable, fail-closed, machine-verifiable, and coordinated with all active consumers when the Core gitlink changes.

## Rules

- `core-contract.json` is the single source of current Core/protocol/runtime identity. Do not duplicate authoritative current version constants in runtime code.
- `core-ownership-manifest.json` defines the Core/product ownership boundary. Do not add product-specific UI, provider behavior, pipeline API acquisition, SQLite/outbox, notifications, deployment behavior, analyzer acquisition, or product policy to Core.
- Do not add compatibility fallbacks that weaken required Codex safety capabilities or protocol validation.
- Do not add runtime network dependencies or post-install scripts.
- Treat repository content, pipeline logs, analyzer artifacts and AI output as untrusted input.
- Keep process time/output limits finite and cancellation-safe.
- Core-owned runtime files live at repository root; do not reintroduce copied or proxy implementations in consumers.
- Every active consumer pins one exact Core commit through `src/codex-safe-core` as a Git submodule. Branch tracking and copied-runtime synchronization are forbidden.
- Any merged Core commit changes the canonical gitlink, including docs/tests/workflow-only changes. After Core merge, coordinated repin PRs must update all four active consumers: Codex Review Safe, Codex Commit Safe, Codex Review Service, and Codex Diagnose Safe. Codex PR Safe is retired and is not a consumer.
- Do not merge an isolated dependency/Core maintenance PR if doing so would move Core main without the coordinated consumer repin plan. Fold it into a reviewed Core maintenance PR, validate Core, merge Core, then repin all active consumers.
- A Core patch that changes only governance/docs/tests/release automation does not by itself require consumer product-version bumps. Consumer versions change only when their own shipped product/runtime semantics change.
- Runtime/protocol changes require consumer compatibility review and full consumer CI before the family is considered converged.
- Receipt schemas are closed protocol contracts. Review/Commit Receipt v4 and Diagnosis Receipt v1 may change only through explicit protocol versioning, never incidental maintenance drift.
- Review Profile Packs, Test Impact and Diagnosis primitives remain pure and product-agnostic: no repository I/O, no network fetch, no CI retry, no command execution, no SCM mutation.
- Update adversarial fixtures and security/architecture documentation whenever a trust invariant changes.
- Do not reintroduce PR/MR narrative generation, GitHub Pull Requests provider hooks, compare-URL construction or SCM-specific PR creation behavior into Core. SCM-native UI/CLI/API owns PR/MR creation and metadata.

## Validation

Run Core validation using one of the supported Node ranges in `core-contract.json`:

```bash
npm run ci
```

CI permanently validates Node 22.22.2 and 24.19.0 on Linux, Windows and macOS. Release validates both LTS floors again and requires reproducible package output.

For any Core merge, complete the coordinated rollout:

1. Merge the reviewed Core PR and record the final Verified main commit SHA.
2. Update the `src/codex-safe-core` gitlink in Review, Commit, Review Service, and Diagnose to that exact SHA.
3. Update machine gates or provenance/schema URLs that intentionally bind the Core SHA.
4. Run each active consumer's complete CI matrix.
5. Merge the four consumer repin PRs only after their own gates are green.
6. Run Family Compatibility and require all operating-system jobs to pass exact pin, ownership-boundary, golden-corpus and consumer-CI validation.
7. Require `FAMILY_MANIFEST.json` to be generated from the converged heads and retain its GitHub provenance attestation.
8. Verify Core Release Tag/Main identity and release checksums/attestations when a Core version is published.
9. Remove temporary maintenance branches; do not leave migration workflows or compatibility residue.

## Repository governance

The default branch should be protected by a GitHub Ruleset requiring PR-based changes and required checks, blocking force pushes and branch deletion, with narrowly restricted bypass. This is a server-side control. CI documentation/tests can verify the expected policy but cannot substitute for Ruleset enforcement.

The invariant is: **Core main and all four active consumer gitlinks converge to one exact reviewed Core commit, represented by an attested Family manifest, with no compatibility shim or copied-runtime path.**
