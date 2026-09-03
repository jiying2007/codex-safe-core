# Contributing

Codex Safe Core is a security-sensitive shared dependency and the trust root for the Codex Safe family. Changes must remain small, reviewable, fail-closed, machine-verifiable, and coordinated with all active consumers when the Core gitlink changes.

## Rules

- `core-contract.json` is the single source of current Core/protocol/runtime identity. Do not duplicate authoritative current version constants in runtime code.
- `family-registry.json` is the single source of active Family repository, product, release-artifact and distribution-channel topology. Do not hard-code a second consumer list.
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
- **Every Core gitlink change requires a consumer patch release.** A repin changes distributable bytes even when the consumer's product-owned source is unchanged. The package/Product Contract version must advance by exactly one patch, the changelog/current identity must move with it, and the new consumer SHA must receive its own exact immutable release. Reusing an old product tag for new Core bytes is forbidden.
- Do not merge an isolated dependency/Core maintenance PR if doing so would move Core main without the coordinated consumer release plan. Fold it into a reviewed Core maintenance PR, validate Core, merge/release Core, then repin and release all active consumers.
- Policy/runtime/protocol changes require consumer compatibility review and full consumer CI before the family is considered converged.
- Receipt schemas are closed protocol contracts. Review Receipt v5, Commit Receipt v4 and Diagnosis Receipt v2 may change only through explicit protocol versioning, never incidental maintenance drift.
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
2. Publish and verify the immutable Core release.
3. Run the coordinated repin: update the exact Core gitlink plus Product Contract/current identity in Change, Review, Commit, Review Service and Diagnose, and bump each consumer by exactly one patch version.
4. Run each active consumer's complete PR gates and merge only exact reviewed heads.
5. Require each merged consumer SHA to publish an immutable `vX.Y.Z` release whose tag resolves exactly to that SHA; verify every release asset and provenance.
6. Require product distribution evidence: Marketplace receipt for Review/Commit/Change, released GHCR digest for Review Service, immutable GitHub Release for Diagnose.
7. Only after all five consumers report `ready=true` may Family Freshness dispatch Family Compatibility.
8. Family Compatibility must freeze Family Snapshot v2, run all three operating systems, exact-pin/ownership/golden-corpus/consumer-CI validation, then generate provenance-attested Family Manifest v4.
9. Verify the digest-addressed Family Manifest release and its asset; Family Status v1 must subsequently report `family-manifest-current`.
10. Remove temporary maintenance branches; do not leave migration workflows or compatibility residue.

## Repository governance

At the current product stage, server-side protection of `main` is intentionally deferred. Do **not** claim GitHub Ruleset/branch-protection enforcement while it is disabled. PR, CI, release and Family workflows remain the required engineering process, but they are not described as an unbypassable server-side control. When the project later enables main protection, that must be treated as a separate repository-administration change rather than simulated in source code.

The invariant is: **Core and all five active consumers converge on one exact reviewed Core release; every consumer Core repin has its own immutable product release and required distribution evidence; Family Snapshot v2 / Manifest v4 represent those released artifacts rather than unreleased main heads; one canonical repository policy and no compatibility shim or copied-runtime path remain.**
